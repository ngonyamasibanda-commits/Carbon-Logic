import { useMemo, useState, Fragment } from 'react'
import { ChevronRight, Download, FileDown } from 'lucide-react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CATEGORIES, getCategory } from '../lib/categories'
import { downloadCsv, downloadText, printReport } from '../lib/export'
import { useEntries } from '../lib/entries-context'
import { useOrg } from '../providers/OrgProvider'

const SCOPE_COLORS: Record<string, string> = {
  'Scope 1': '#2aa198',
  'Scope 2': '#e67e22',
  'Scope 3': '#8e44ad',
  Custom: '#64748b',
}

export default function AnalysisPage() {
  const { entries } = useEntries()
  const { sites } = useOrg()
  const [mode, setMode] = useState<'scope' | 'source'>('scope')
  const [openScopes, setOpenScopes] = useState<Record<string, boolean>>({})
  const [month, setMonth] = useState('all')
  const [site, setSite] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [tag, setTag] = useState('all')
  const [reporting, setReporting] = useState('All')

  const months = useMemo(() => {
    const set = new Set(entries.map((entry) => entry.created_at.slice(0, 7)).filter(Boolean))
    return [...set].sort().reverse()
  }, [entries])

  const tags = useMemo(() => {
    const set = new Set<string>()
    for (const entry of entries) for (const item of entry.tags) set.add(item)
    return [...set].sort()
  }, [entries])

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (month !== 'all' && entry.created_at.slice(0, 7) !== month) return false
      if (site !== 'all' && entry.site !== site) return false
      if (categoryId !== 'all' && entry.category !== categoryId) return false
      if (tag !== 'all' && !entry.tags.includes(tag)) return false
      if (reporting === 'SECR' && entry.scope === 'Scope 3') return false
      return true
    })
  }, [entries, month, site, categoryId, tag, reporting])

  const byScope = useMemo(() => {
    const totals = new Map<string, number>()
    for (const entry of filtered) {
      totals.set(entry.scope, (totals.get(entry.scope) ?? 0) + entry.emissions_tco2e)
    }
    return [...totals.entries()].map(([name, value]) => ({
      name,
      value: Number(value.toFixed(4)),
    }))
  }, [filtered])

  const bySource = useMemo(() => {
    const totals = new Map<string, number>()
    for (const entry of filtered) {
      const name = getCategory(entry.category)?.name ?? entry.category
      totals.set(name, (totals.get(name) ?? 0) + entry.emissions_tco2e)
    }
    return [...totals.entries()]
      .map(([name, value]) => ({ name, value: Number(value.toFixed(4)) }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  const chartData = mode === 'scope' ? byScope : bySource
  const total = filtered.reduce((sum, row) => sum + row.emissions_tco2e, 0)
  const scope1 = byScope.find((row) => row.name === 'Scope 1')?.value ?? 0
  const scope2 = byScope.find((row) => row.name === 'Scope 2')?.value ?? 0
  const scope3 = byScope.find((row) => row.name === 'Scope 3')?.value ?? 0
  const offset = Math.ceil(total)

  const rowsByScope = useMemo(() => {
    const groups = new Map<string, { name: string; value: number }[]>()
    for (const entry of filtered) {
      const name = getCategory(entry.category)?.name ?? entry.category
      const list = groups.get(entry.scope) ?? []
      const existing = list.find((row) => row.name === name)
      if (existing) existing.value += entry.emissions_tco2e
      else list.push({ name, value: entry.emissions_tco2e })
      groups.set(entry.scope, list)
    }
    return groups
  }, [filtered])

  function exportGraph() {
    const lines = ['Name,tCO2e', ...chartData.map((row) => `${row.name},${row.value}`)]
    downloadText(`emissions-${mode}.csv`, lines.join('\n'), 'text/csv')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">Home / Analysis</p>
          <h1 className="text-3xl font-bold text-ink">Yearly Analysis</h1>
        </div>
        <button
          type="button"
          onClick={() => printReport('Carbon Logic yearly analysis', filtered)}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          <FileDown size={16} />
          Download PDF Report
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterSelect label="Months" value={month} onChange={setMonth} options={[['all', 'All months'], ...months.map((item) => [item, item])]} />
        <FilterSelect label="Sites" value={site} onChange={setSite} options={[['all', 'All sites'], ...sites.map((item) => [item.name, item.name])]} />
        <FilterSelect
          label="GHG Category"
          value={categoryId}
          onChange={setCategoryId}
          options={[['all', 'All categories'], ...CATEGORIES.map((item) => [item.id, item.name])]}
        />
        <FilterSelect label="Data Tags" value={tag} onChange={setTag} options={[['all', 'All tags'], ...tags.map((item) => [item, item])]} />
        <FilterSelect
          label="Reporting"
          value={reporting}
          onChange={setReporting}
          options={['All', 'SECR', 'PPN 006', 'Net Zero Standard', 'SBTi'].map((item) => [item, item])}
        />
      </div>

      <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Graph</h2>
          <button type="button" onClick={exportGraph} className="text-muted hover:text-ink" aria-label="Download graph data">
            <Download size={16} />
          </button>
        </div>
        <p className="text-sm font-medium text-brand">
          {mode === 'scope' ? 'Pie Scope Chart' : 'Emissions Source Chart'}
        </p>
        <div className="mt-2 inline-flex rounded-md border border-line text-sm">
          <button
            type="button"
            onClick={() => setMode('scope')}
            className={`px-3 py-1.5 ${mode === 'scope' ? 'bg-brand text-white' : 'bg-white'}`}
          >
            Scope
          </button>
          <button
            type="button"
            onClick={() => setMode('source')}
            className={`px-3 py-1.5 ${mode === 'source' ? 'bg-brand text-white' : 'bg-white'}`}
          >
            Emissions Source
          </button>
        </div>
        <div className="h-80">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              Add activity data to see the analysis chart.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={1}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={
                        SCOPE_COLORS[entry.name] ??
                        ['#2aa198', '#8e44ad', '#e67e22', '#3498db', '#27ae60'][index % 5]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${Number(value ?? 0).toFixed(2)} tCO2e`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Results Breakdown</h2>
          <button
            type="button"
            className="text-sm text-brand hover:underline"
            onClick={() => downloadCsv('results-breakdown.csv', filtered)}
          >
            Export
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2 font-semibold">Name</th>
              <th className="py-2 font-semibold">Results (tCO2e)</th>
            </tr>
          </thead>
          <tbody>
            {['Scope 1', 'Scope 2', 'Scope 3'].map((scope) => (
              <Fragment key={scope}>
                <tr className="border-b border-line">
                  <td className="py-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      onClick={() =>
                        setOpenScopes((prev) => ({ ...prev, [scope]: !prev[scope] }))
                      }
                    >
                      <ChevronRight
                        size={14}
                        className={openScopes[scope] ? 'rotate-90' : ''}
                      />
                      {scope}
                    </button>
                  </td>
                  <td className="py-2">
                    {(byScope.find((row) => row.name === scope)?.value ?? 0).toFixed(2)}
                  </td>
                </tr>
                {openScopes[scope]
                  ? (rowsByScope.get(scope) ?? []).map((row) => (
                      <tr key={`${scope}-${row.name}`} className="border-b border-line bg-page/70">
                        <td className="py-2 pl-8 text-muted">{row.name}</td>
                        <td className="py-2">{row.value.toFixed(2)}</td>
                      </tr>
                    ))
                  : null}
              </Fragment>
            ))}
            <tr className="font-semibold">
              <td className="py-2">Total</td>
              <td className="py-2">{total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Emissions Summary</h2>
        <p className="mt-3 text-sm leading-7">
          Scope 1 = {scope1.toFixed(2)} tCO2e
          <br />
          Scope 2 = {scope2.toFixed(2)} tCO2e
          <br />
          Scope 3 = {scope3.toFixed(2)} tCO2e
          <br />
          <strong>Total = {total.toFixed(2)} tCO2e</strong>
        </p>
        <div className="mt-4 rounded-lg border border-line bg-page px-4 py-3">
          Total = {offset} tCO2e
        </div>
      </section>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: (readonly [string, string])[] | string[][]
}) {
  return (
    <label className="rounded-full border border-dashed border-line bg-white px-3 py-1 text-xs">
      <span className="mr-2 text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent font-medium"
      >
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  )
}
