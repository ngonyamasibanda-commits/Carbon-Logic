import { useMemo, useState } from 'react'
import { FileDown } from 'lucide-react'
import {
  auditorPackCsv,
  downloadInventoryCsv,
  downloadText,
  printAnalysisReport,
  printInventoryReport,
  printPpnCarbonReductionPlan,
  printSecrStatement,
} from '../lib/export'
import { summarizeInventory } from '../lib/ghg'
import { entryActivityYear } from '../lib/entry-date'
import { isYearLocked } from '../lib/period-lock'
import { summarizeScope2 } from '../lib/scope2'
import { loadSbtiConfig } from '../lib/targets-store'
import { useEntries } from '../lib/entries-context'
import { useAuth } from '../lib/auth-context'
import { formatNumber, formatTco2e } from '../lib/format'
import { useOrg } from '../providers/OrgProvider'

export default function ReportsPage() {
  const { entries } = useEntries()
  const { organization } = useAuth()
  const { profile } = useOrg()
  const years = useMemo(() => {
    const set = new Set(entries.map((entry) => entryActivityYear(entry)))
    set.add(profile.reportingYear || new Date().getFullYear())
    return [...set].sort((a, b) => b - a)
  }, [entries, profile.reportingYear])
  const [year, setYear] = useState(profile.reportingYear || new Date().getFullYear())

  const visible = useMemo(
    () => entries.filter((entry) => entryActivityYear(entry) === year),
    [entries, year],
  )
  const summary = summarizeInventory(visible)
  const dual = summarizeScope2(visible, profile.residualMixKgPerKwh, 0.13096)
  const orgName = organization?.name ?? 'Organisation'
  const locked = isYearLocked(profile.lockedYears, year)
  const sbti = loadSbtiConfig(organization?.id)
  const context = {
    organizationName: orgName,
    year,
    revenue: profile.annualRevenue,
    employeeCount: profile.employeeCount,
    baselineTco2e: profile.baselineYtdTco2e,
    residualMixKg: profile.residualMixKgPerKwh,
    country: profile.country,
    locked,
    netZeroYear: sbti.netZeroYear,
    profile,
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-ink">Reports</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Disclosure packs for {orgName}. Combined Results remains the GHG Protocol table; these
          documents are the versions you attach to SECR filings, PPN 06/21 bids, and auditor requests.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 text-sm">
        <div>
          {year}: <strong>{formatTco2e(summary.total, true)}</strong>
          {locked ? ' · closed' : ''}
        </div>
        <label className="flex items-center gap-2">
          Reporting year
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="rounded-md border border-line px-2 py-1"
          >
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Scope 1" value={formatTco2e(summary.scope1)} />
        <Stat label="Scope 2 location-based" value={formatTco2e(dual.locationTco2e || summary.scope2)} />
        <Stat label="Scope 2 market-based" value={formatTco2e(dual.marketTco2e)} />
        <Stat label="Electricity" value={`${formatNumber(dual.electricityKwh)} kWh`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ReportCard
          title="GHG Protocol inventory"
          body="Every Scope 1, 2, and 3 category, including empty rows. Use this as the inventory annex."
          action="Download inventory PDF"
          onClick={() => printInventoryReport(visible, context)}
        />
        <ReportCard
          title="SECR statement"
          body="UK Streamlined Energy and Carbon Reporting: dual Scope 2, kWh, intensity ratios, and a directors’ statement block."
          action="Download SECR PDF"
          onClick={() => printSecrStatement(visible, context)}
        />
        <ReportCard
          title="PPN 06/21 Carbon Reduction Plan"
          body="Commitment, baseline, current emissions, reduction projects, and sign-off language for government tenders."
          action="Download CRP PDF"
          onClick={() => printPpnCarbonReductionPlan(visible, context)}
        />
        <ReportCard
          title="Management analysis"
          body="Hotspots and recommended next steps for leadership. Not a line-by-line ledger."
          action="Download analysis PDF"
          onClick={() => printAnalysisReport(visible, context)}
        />
      </section>

      <section className="rounded-xl border border-line bg-white p-5 text-sm">
        <h2 className="text-lg font-semibold text-ink">Auditor files</h2>
        <p className="mt-1 text-muted">
          CSV of every activity in {year}, including evidence links and dual Scope 2 working. Share
          this with your appointed verifier — Carbon Logic does not issue an assurance opinion.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => downloadText(`auditor-pack-${year}.csv`, auditorPackCsv(visible, context), 'text/csv')}
          >
            Download auditor pack CSV
          </button>
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => downloadInventoryCsv(`ghg-inventory-${year}.csv`, visible)}
          >
            Download inventory CSV
          </button>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-white px-5 py-4">
      <div className="truncate text-2xl font-semibold tabular-nums text-brand" title={value}>
        {value}
      </div>
      <div className="mt-2 text-sm text-muted">{label}</div>
    </div>
  )
}

function ReportCard({
  title,
  body,
  action,
  onClick,
}: {
  title: string
  body: string
  action: string
  onClick: () => void
}) {
  return (
    <article className="rounded-xl border border-line bg-white p-5">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
      >
        <FileDown size={15} />
        {action}
      </button>
    </article>
  )
}
