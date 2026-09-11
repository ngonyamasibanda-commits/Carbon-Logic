import { useEffect, useMemo, useState, Fragment } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronRight, Download, FileDown } from 'lucide-react'
import { CATEGORIES, getCategory } from '../lib/categories'
import { downloadInventoryCsv, downloadText, printAnalysisReport } from '../lib/export'
import { summarizeInventory } from '../lib/ghg'
import { entryActivityMonth } from '../lib/entry-date'
import { useEntries } from '../lib/entries-context'
import { useAuth } from '../lib/auth-context'
import { formatNumber, formatPercent, formatTco2e, roundDisplay } from '../lib/format'
import { useOrg } from '../providers/OrgProvider'
import { summarizeScope2 } from '../lib/scope2'

const SCOPE_COLORS: Record<string, string> = {
  'Scope 1': '#02234e',
  'Scope 2': '#14396d',
  'Scope 3': '#6cbe2c',
  Custom: '#94a3b8',
}

const SOURCE_PALETTE = ['#02234e', '#6cbe2c', '#14396d', '#55a01f', '#4b6ea8', '#8b5cf6', '#f59e0b', '#ef4444']

export default function AnalysisPage() {
  const { entries } = useEntries()
  const { sites, profile, updateProfile } = useOrg()
  const { organization } = useAuth()
  const [mode, setMode] = useState<'scope' | 'source'>('scope')
  const [openScopes, setOpenScopes] = useState<Record<string, boolean>>({
    'Scope 1': true,
    'Scope 2': true,
    'Scope 3': true,
    Custom: true,
  })
  const [month, setMonth] = useState('all')
  const [site, setSite] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [tag, setTag] = useState('all')
  const [reporting, setReporting] = useState('All')

  const [revenue, setRevenue] = useState(profile.annualRevenue || 0)
  const [revenueDraft, setRevenueDraft] = useState(String(profile.annualRevenue || ''))

  useEffect(() => {
    setRevenue(profile.annualRevenue || 0)
    setRevenueDraft(String(profile.annualRevenue || ''))
  }, [profile.annualRevenue])

  function saveRevenue() {
    const value = Number(revenueDraft)
    if (Number.isFinite(value) && value > 0) {
      setRevenue(value)
      void updateProfile({ ...profile, annualRevenue: value })
    }
  }

  const months = useMemo(() => {
    const set = new Set(entries.map((entry) => entryActivityMonth(entry)).filter(Boolean))
    return [...set].sort().reverse()
  }, [entries])

  const tags = useMemo(() => {
    const set = new Set<string>()
    for (const entry of entries) for (const item of entry.tags) set.add(item)
    return [...set].sort()
  }, [entries])

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (month !== 'all' && entryActivityMonth(entry) !== month) return false
      if (site !== 'all' && entry.site !== site) return false
      if (categoryId !== 'all' && entry.category !== categoryId) return false
      if (tag !== 'all' && !entry.tags.includes(tag)) return false
      // Reporting framework filters
      if (reporting === 'SECR') {
        // UK SECR requires Scope 1 + 2 (Scope 3 optional but recommended)
        return entry.scope === 'Scope 1' || entry.scope === 'Scope 2'
      }
      if (reporting === 'PPN 06/21') {
        // UK PPN 06/21 requires full Scope 1 + 2 + mandatory Scope 3
        return entry.scope !== 'Custom'
      }
      if (reporting === 'SBTi / CDP') {
        // SBTi/CDP requires all scopes including Scope 3
        return entry.scope !== 'Custom'
      }
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
      value: roundDisplay(value),
    }))
  }, [filtered])

  const bySource = useMemo(() => {
    const totals = new Map<string, number>()
    for (const entry of filtered) {
      const name = getCategory(entry.category)?.name ?? entry.category
      totals.set(name, (totals.get(name) ?? 0) + entry.emissions_tco2e)
    }
    return [...totals.entries()]
      .map(([name, value]) => ({ name, value: roundDisplay(value) }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  // Monthly trend data
  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { scope1: number; scope2: number; scope3: number }>()
    for (const entry of filtered) {
      const m = entryActivityMonth(entry)
      if (!m) continue
      const row = map.get(m) ?? { scope1: 0, scope2: 0, scope3: 0 }
      if (entry.scope === 'Scope 1') row.scope1 += entry.emissions_tco2e
      else if (entry.scope === 'Scope 2') row.scope2 += entry.emissions_tco2e
      else if (entry.scope === 'Scope 3') row.scope3 += entry.emissions_tco2e
      map.set(m, row)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        'Scope 1': roundDisplay(data.scope1),
        'Scope 2': roundDisplay(data.scope2),
        'Scope 3': roundDisplay(data.scope3),
        Total: roundDisplay(data.scope1 + data.scope2 + data.scope3),
      }))
  }, [filtered])

  const chartData = mode === 'scope' ? byScope : bySource
  const total = filtered.reduce((sum, row) => sum + row.emissions_tco2e, 0)
  const scope1 = byScope.find((row) => row.name === 'Scope 1')?.value ?? 0
  const scope2 = byScope.find((row) => row.name === 'Scope 2')?.value ?? 0
  const scope3 = byScope.find((row) => row.name === 'Scope 3')?.value ?? 0
  const inventory = useMemo(() => summarizeInventory(filtered), [filtered])
  const dual = useMemo(
    () => summarizeScope2(filtered, profile.residualMixKgPerKwh, 0.13096),
    [filtered, profile.residualMixKgPerKwh],
  )

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
          <p className="mt-1 max-w-2xl text-sm text-muted">
            What the numbers mean for {organization?.name ?? 'this organisation'}: mix, hotspots, and gaps.
          Combined Results is the GHG Protocol inventory for disclosure. Reports produces the SECR
            statement and PPN 06/21 Carbon Reduction Plan.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            printAnalysisReport(filtered, {
              organizationName: organization?.name ?? 'Organisation',
              revenue,
            })
          }
          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          <FileDown size={16} />
          Download PDF Report
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterSelect label="Month" value={month} onChange={setMonth} options={[['all', 'All months'], ...months.map((item) => [item, item])]} />
        <FilterSelect label="Site" value={site} onChange={setSite} options={[['all', 'All sites'], ...sites.map((item) => [item.name, item.name])]} />
        <FilterSelect
          label="Category"
          value={categoryId}
          onChange={setCategoryId}
          options={[['all', 'All categories'], ...CATEGORIES.map((item) => [item.id, item.name])]}
        />
        <FilterSelect label="Tag" value={tag} onChange={setTag} options={[['all', 'All tags'], ...tags.map((item) => [item, item])]} />
        <FilterSelect
          label="Framework"
          value={reporting}
          onChange={setReporting}
          options={[
            ['All', 'All scopes'],
            ['SECR', 'SECR (S1 + dual S2)'],
            ['PPN 06/21', 'PPN 06/21 (All scopes)'],
            ['SBTi / CDP', 'SBTi / CDP (All scopes)'],
          ]}
        />
      </div>

      {/* ── Scope summary KPIs ───────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Scope 1" value={formatTco2e(scope1)} unit="tCO₂e" color="#02234e" />
        <KpiCard
          label="Scope 2 location-based"
          value={formatTco2e(dual.locationTco2e || scope2)}
          unit="tCO₂e"
          color="#14396d"
        />
        <KpiCard
          label="Scope 2 market-based"
          value={formatTco2e(dual.marketTco2e)}
          unit="tCO₂e"
          color="#14396d"
        />
        <KpiCard label="Scope 3" value={formatTco2e(scope3)} unit="tCO₂e" color="#6cbe2c" />
        <KpiCard label="Total" value={formatTco2e(total)} unit="tCO₂e" color="#0f1e33" />
      </section>

      {/* ── Pie / source chart ───────────────────────────────────────── */}
      <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Emissions Breakdown</h2>
          <button type="button" onClick={exportGraph} className="text-muted hover:text-ink" aria-label="Download graph data">
            <Download size={16} />
          </button>
        </div>
        <div className="mt-2 inline-flex rounded-md border border-line text-sm">
          <button
            type="button"
            onClick={() => setMode('scope')}
            className={`px-3 py-1.5 ${mode === 'scope' ? 'bg-brand text-white' : 'bg-white'}`}
          >
            By Scope
          </button>
          <button
            type="button"
            onClick={() => setMode('source')}
            className={`px-3 py-1.5 ${mode === 'source' ? 'bg-brand text-white' : 'bg-white'}`}
          >
            By Source
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
                        SCOPE_COLORS[entry.name] ?? SOURCE_PALETTE[index % SOURCE_PALETTE.length]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatTco2e(Number(value ?? 0), true)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ── Monthly trend ────────────────────────────────────────────── */}
      {monthlyTrend.length > 1 ? (
        <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Monthly Trend</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip formatter={(value) => formatTco2e(Number(value ?? 0), true)} />
                <Legend />
                <Line type="monotone" dataKey="Scope 1" stroke="#02234e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Scope 2" stroke="#14396d" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Scope 3" stroke="#6cbe2c" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Total" stroke="#0f1e33" strokeWidth={2} strokeDasharray="6 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      {/* ── Intensity metrics ────────────────────────────────────────── */}
      <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Intensity Metrics</h2>
        <p className="mb-3 text-xs text-muted">
          Used for SECR reporting (tCO₂e per £M revenue) and benchmarking. Enter annual revenue
          here or in Organisation settings.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium">
            Annual revenue (£)
            <input
              type="number"
              min={0}
              step="any"
              value={revenueDraft}
              onChange={(event) => setRevenueDraft(event.target.value)}
              className="ml-2 rounded-md border border-line px-3 py-1.5 text-sm"
            />
          </label>
          <button type="button" onClick={saveRevenue} className="rounded-md bg-brand px-3 py-1.5 text-sm text-white">
            Save
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <IntensityCard
            label="tCO₂e per £M revenue"
            value={revenue > 0 ? formatNumber(total / (revenue / 1_000_000)) : '—'}
            hint="SECR mandatory intensity ratio"
          />
          <IntensityCard
            label="tCO₂e per FTE"
            value={
              profile.employeeCount > 0 ? formatNumber(total / profile.employeeCount) : '—'
            }
            hint={
              profile.employeeCount > 0
                ? 'Average FTE from Organisation settings'
                : 'Add average FTE in Organisation settings'
            }
          />
          <IntensityCard
            label="Scope 1 + 2 / Total"
            value={total > 0 ? formatPercent(((scope1 + scope2) / total) * 100) : '—'}
            hint="Proportion under direct control"
          />
        </div>
      </section>

      {/* ── Source breakdown by scope ─────────────────────────────────── */}
      <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Emissions by scope and category</h2>
          <button
            type="button"
            className="text-sm text-brand hover:underline"
            onClick={() => downloadInventoryCsv('analysis-inventory.csv', filtered)}
          >
            Export CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2 font-semibold">Scope / Category</th>
              <th className="py-2 font-semibold">Results (tCO₂e)</th>
              <th className="py-2 font-semibold">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {['Scope 1', 'Scope 2', 'Scope 3', 'Custom'].map((scope) => {
              const scopeValue = byScope.find((row) => row.name === scope)?.value ?? 0
              return (
                <Fragment key={scope}>
                  <tr className="border-b border-line">
                    <td className="py-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium"
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
                    <td className="py-2 tabular-nums">{formatTco2e(scopeValue)}</td>
                    <td className="py-2 text-muted">
                      {total > 0 ? formatPercent((scopeValue / total) * 100) : '—'}
                    </td>
                  </tr>
                  {openScopes[scope]
                    ? (rowsByScope.get(scope) ?? [])
                        .sort((a, b) => b.value - a.value)
                        .map((row) => (
                          <tr key={`${scope}-${row.name}`} className="border-b border-line bg-page/70">
                            <td className="py-2 pl-8 text-muted">{row.name}</td>
                            <td className="py-2 tabular-nums">{formatTco2e(row.value)}</td>
                            <td className="py-2 text-muted">
                              {total > 0 ? formatPercent((row.value / total) * 100) : '—'}
                            </td>
                          </tr>
                        ))
                    : null}
                </Fragment>
              )
            })}
            <tr className="font-semibold">
              <td className="py-2">Total</td>
              <td className="py-2 tabular-nums">{formatTco2e(total)}</td>
              <td className="py-2">100%</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">In plain language</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
          {inventory.insights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold">Scope 3 · GHG Protocol Categories 1 to 15</h2>
        <p className="mb-3 text-xs text-muted">
          Categories 1–7 are the usual priorities for construction, mining, and logistics. 8–15 are listed so a
          report looks complete; empty means not logged, not necessarily zero.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-2 font-semibold">Category</th>
                <th className="py-2 font-semibold">Name</th>
                <th className="py-2 font-semibold">tCO₂e</th>
                <th className="py-2 font-semibold">% of total</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {inventory.rows
                .filter((row) => row.scope === 'Scope 3')
                .map((row) => (
                  <tr key={row.key} className="border-b border-line">
                    <td className="py-2 font-medium">{row.code}</td>
                    <td className="py-2">
                      {row.name}
                      <div className="text-xs text-muted">{row.plain}</div>
                    </td>
                    <td className="py-2 font-medium tabular-nums">{row.status === 'reported' ? formatTco2e(row.tco2e) : '—'}</td>
                    <td className="py-2 text-muted">{row.status === 'reported' ? formatPercent(row.percent) : '—'}</td>
                    <td className="py-2 text-xs">{row.status === 'reported' ? 'Reported' : 'Not yet logged'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Emissions by source bar chart ──────────────────────────────── */}
      {bySource.length > 0 ? (
        <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Top Emission Sources</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySource.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 8, left: 120, bottom: 8 }}>
                <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} width={110} />
                <Tooltip formatter={(value) => formatTco2e(Number(value ?? 0), true)} />
                <Bar dataKey="value" fill="#02234e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function KpiCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-white px-5 py-4">
      <div className="truncate text-2xl font-semibold tabular-nums" style={{ color }} title={value}>{value}</div>
      <div className="mt-1 text-xs text-muted">{unit}</div>
      <div className="mt-2 text-sm font-medium text-ink">{label}</div>
    </div>
  )
}

function IntensityCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-page px-4 py-3">
      <div className="truncate text-xl font-semibold tabular-nums text-brand" title={value}>{value}</div>
      <div className="mt-1 text-sm font-medium">{label}</div>
      <div className="mt-0.5 text-xs text-muted">{hint}</div>
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
