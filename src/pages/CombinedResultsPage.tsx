import { downloadInventoryCsv, printInventoryReport } from '../lib/export'
import { summarizeInventory } from '../lib/ghg'
import { entryActivityYear } from '../lib/entry-date'
import { isYearLocked } from '../lib/period-lock'
import { summarizeScope2 } from '../lib/scope2'
import { useEntries } from '../lib/entries-context'
import { useAuth } from '../lib/auth-context'
import { formatPercent, formatTco2e } from '../lib/format'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrg } from '../providers/OrgProvider'

export default function CombinedResultsPage() {
  const { entries } = useEntries()
  const { organization } = useAuth()
  const { profile } = useOrg()
  const years = useMemo(() => {
    const set = new Set(entries.map((entry) => entryActivityYear(entry)))
    set.add(profile.reportingYear || new Date().getFullYear())
    return [...set].sort((a, b) => b - a)
  }, [entries, profile.reportingYear])
  const [year, setYear] = useState<'all' | number>(profile.reportingYear || new Date().getFullYear())
  const visible = useMemo(
    () => (year === 'all' ? entries : entries.filter((entry) => entryActivityYear(entry) === year)),
    [entries, year],
  )
  const summary = summarizeInventory(visible)
  const dual = summarizeScope2(visible, profile.residualMixKgPerKwh, 0.13096)
  const orgName = organization?.name ?? 'This organisation'
  const locked = typeof year === 'number' && isYearLocked(profile.lockedYears, year)

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-ink">Combined Results</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          A GHG Protocol inventory for {orgName}: totals by Scope 1, 2 and 3, and all fifteen Scope 3
          categories. Use this page for the inventory table. Use{' '}
          <Link to="/reports" className="text-brand hover:underline">
            Reports
          </Link>{' '}
          for the SECR statement and PPN 06/21 Carbon Reduction Plan.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 text-sm">
        <div>
          Reported footprint: <strong>{formatTco2e(summary.total, true)}</strong> from {summary.entryCount}{' '}
          {summary.entryCount === 1 ? 'activity' : 'activities'}
          {year === 'all' ? '' : ` in ${year}`}
          {locked ? ' · closed' : ''}.
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {years.length > 0 ? (
            <label className="flex items-center gap-2 text-sm">
              Reporting year
              <select
                value={year}
                onChange={(event) =>
                  setYear(event.target.value === 'all' ? 'all' : Number(event.target.value))
                }
                className="rounded-md border border-line px-2 py-1"
              >
                <option value="all">All years</option>
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => downloadInventoryCsv('ghg-inventory.csv', visible)}
          >
            Export inventory CSV
          </button>
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() =>
              printInventoryReport(visible, {
                organizationName: orgName,
                year: year === 'all' ? undefined : year,
                residualMixKg: profile.residualMixKgPerKwh,
                locked,
              })
            }
          >
            Download inventory PDF
          </button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Scope 1" hint="Fuel and leaks you own" value={summary.scope1} total={summary.total} color="#02234e" />
        <SummaryCard
          label="Scope 2 location-based"
          hint="UK grid electricity and heat"
          value={dual.locationTco2e || summary.scope2}
          total={summary.total}
          color="#14396d"
        />
        <SummaryCard
          label="Scope 2 market-based"
          hint="Contracts, REGO, or residual mix"
          value={dual.marketTco2e}
          total={summary.total}
          color="#14396d"
        />
        <SummaryCard label="Scope 3" hint="Your value chain (Categories 1–15)" value={summary.scope3} total={summary.total} color="#6cbe2c" />
        <SummaryCard label="Total" hint="Location-based organisational total" value={summary.total} total={summary.total} color="#0f1e33" />
      </section>

      {summary.insights.length > 0 ? (
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">In plain language</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
            {summary.insights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <InventoryBlock title="Scope 1 — direct emissions" rows={summary.rows.filter((row) => row.scope === 'Scope 1')} />
      <InventoryBlock
        title="Scope 2 — purchased energy"
        caption="Location-based totals sit in this table (UK grid). Market-based Scope 2 is shown in the headline cards and in the SECR statement."
        rows={summary.rows.filter((row) => row.scope === 'Scope 2')}
      />
      <InventoryBlock
        title="Scope 3 — GHG Protocol Categories 1 to 15"
        caption="Empty rows are intentional. They show completeness for a customer or framework request, not a calculated zero."
        rows={summary.rows.filter((row) => row.scope === 'Scope 3')}
      />
      {summary.rows.some((row) => row.scope === 'Custom') ? (
        <InventoryBlock title="Custom" rows={summary.rows.filter((row) => row.scope === 'Custom')} />
      ) : null}

      {summary.bySite.length > 1 ? (
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">By site</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-2 font-semibold">Site</th>
                <th className="py-2 font-semibold">tCO₂e</th>
                <th className="py-2 font-semibold">% of total</th>
              </tr>
            </thead>
            <tbody>
              {summary.bySite.map((site) => (
                <tr key={site.name} className="border-b border-line">
                  <td className="py-2">{site.name}</td>
                  <td className="py-2 font-medium tabular-nums">{formatTco2e(site.tco2e)}</td>
                  <td className="py-2 text-muted">{formatPercent(site.percent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  )
}

function SummaryCard({
  label,
  hint,
  value,
  total,
  color,
}: {
  label: string
  hint: string
  value: number
  total: number
  color: string
}) {
  const share = total > 0 ? formatPercent((value / total) * 100, 0) : '—'
  return (
    <div className="min-w-0 rounded-xl border border-line bg-white px-5 py-4">
      <div className="truncate text-2xl font-semibold tabular-nums" style={{ color }} title={formatTco2e(value)}>
        {formatTco2e(value)}
      </div>
      <div className="mt-1 text-xs text-muted">tCO₂e · {share} of total</div>
      <div className="mt-2 text-sm font-medium text-ink">{label}</div>
      <div className="text-xs text-muted">{hint}</div>
    </div>
  )
}

function InventoryBlock({
  title,
  caption,
  rows,
}: {
  title: string
  caption?: string
  rows: ReturnType<typeof summarizeInventory>['rows']
}) {
  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {caption ? <p className="mt-1 text-xs text-muted">{caption}</p> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2 font-semibold">GHG Protocol</th>
              <th className="py-2 font-semibold">What this is</th>
              <th className="py-2 font-semibold">tCO₂e</th>
              <th className="py-2 font-semibold">% of total</th>
              <th className="py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-line align-top">
                <td className="py-2">
                  <div className="font-medium">{row.code}</div>
                  <div className="text-xs text-muted">{row.name}</div>
                </td>
                <td className="max-w-sm py-2 text-muted">{row.plain}</td>
                <td className="py-2 font-medium tabular-nums">{row.status === 'reported' ? formatTco2e(row.tco2e) : '—'}</td>
                <td className="py-2 text-muted">{row.status === 'reported' ? formatPercent(row.percent) : '—'}</td>
                <td className="py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      row.status === 'reported' ? 'bg-accent-soft text-accent-dark' : 'bg-page text-muted'
                    }`}
                  >
                    {row.status === 'reported' ? 'Reported' : 'Not yet logged'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
