import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, Check, Copy, Download, Info, Save, X } from 'lucide-react'
import { downloadText } from '../lib/export'
import {
  NET_ZERO_MIN_REDUCTION,
  SBTI_SOURCES,
  calculateSbti,
  inventoryByYear,
  alignConfigWithInventory,
  type CriterionCheck,
  type SbtiConfig,
} from '../lib/sbti'
import { loadSbtiConfig, loadSbtiConfigCloud, saveSbtiConfig } from '../lib/targets-store'
import { useEntries } from '../lib/entries-context'
import { useAuth } from '../lib/auth-context'
import { formatNumber, formatPercent, formatTco2e } from '../lib/format'

const NAVY = '#02234e'
const GREEN = '#6cbe2c'
const SLATE = '#94a3b8'

const pct = (value: number) => formatPercent(value * 100)
const t = (value: number) => formatNumber(value)

export default function TargetsPage() {
  const { entries } = useEntries()
  const { organization } = useAuth()
  const organisationName = organization?.name ?? 'Your organisation'
  const [config, setConfig] = useState<SbtiConfig>(() => loadSbtiConfig(organization?.id))
  const [status, setStatus] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!organization?.id) {
      setConfig(loadSbtiConfig())
      return
    }
    void loadSbtiConfigCloud(organization.id).then(setConfig)
  }, [organization?.id])

  const inventory = useMemo(() => inventoryByYear(entries), [entries])
  const actualByYear = useMemo(
    () => new Map(inventory.map((row) => [row.year, row.total])),
    [inventory],
  )

  const effectiveConfig = useMemo(
    () => alignConfigWithInventory(config, inventory),
    [config, inventory],
  )
  const yearsAlignedToInventory =
    config.useLiveInventory &&
    inventory.length > 0 &&
    (!inventory.some((row) => row.year === config.baseYear) ||
      !inventory.some((row) => row.year === config.mostRecentYear))

  const result = useMemo(
    () => calculateSbti(effectiveConfig, organisationName, actualByYear),
    [effectiveConfig, organisationName, actualByYear],
  )

  const failures = result.checks.filter((check) => check.status === 'fail')
  const set = <K extends keyof SbtiConfig>(key: K, value: SbtiConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }))

  function persist() {
    saveSbtiConfig(config, organization?.id)
    setStatus('Target saved for this organisation. Every colleague will see it.')
  }

  async function copyLanguage() {
    await navigator.clipboard.writeText(result.targetLanguage.join('\n\n'))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  function exportSummary() {
    const rows = [
      ['Field', 'Value'],
      ['Organisation', organisationName],
      ['Base year', String(effectiveConfig.baseYear)],
      ['Target year', String(effectiveConfig.targetYear)],
      ['Submission year', String(effectiveConfig.submissionYear)],
      ['Net-zero year', String(effectiveConfig.netZeroYear)],
      ['Base year scope 1 (tCO2e)', formatTco2e(effectiveConfig.baseScope1 ?? 0)],
      ['Base year scope 2 (tCO2e)', formatTco2e(effectiveConfig.baseScope2 ?? 0)],
      ['Base year scope 3 (tCO2e)', formatTco2e(effectiveConfig.baseScope3 ?? 0)],
      ['Most recent inventory year', String(effectiveConfig.mostRecentYear)],
      ['Scope 3 share of inventory', pct(result.scope3Share)],
      ['Scope 3 target required', result.scope3TargetRequired ? 'Yes' : 'No'],
      ['Scope 1 dLARR', pct(result.scope1Rate)],
      ['Scope 2 dLARR', pct(result.scope2Rate)],
      ['Scope 1+2 blended dLARR', pct(result.s12.rate)],
      ['Scope 1+2 reduction by target year', pct(result.s12.adjustedAmbition)],
      ['Scope 1+2 target emissions (tCO2e)', formatTco2e(result.s12.targetEmissions)],
      ['Scope 3 pathway', result.s3.ambitionLabel],
      ['Scope 3 dLARR', pct(result.s3.rate)],
      ['Scope 3 reduction by target year', pct(result.s3.adjustedAmbition)],
      ['Scope 3 target emissions (tCO2e)', formatTco2e(result.s3.targetEmissions)],
      ['Net-zero residual (tCO2e)', formatTco2e(result.netZeroEmissions)],
      ...result.checks.map((check) => [`${check.criterion} — ${check.label}`, check.status.toUpperCase()]),
      ...result.targetLanguage.map((line, index) => [`Target language ${index + 1}`, line]),
    ]
    const csv = rows
      .map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell)).join(','))
      .join('\n')
    downloadText('science-based-target.csv', csv, 'text/csv')
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-brand text-white">
        <div className="px-6 py-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            Science Based Targets initiative
          </div>
          <h1 className="mt-2 text-3xl font-semibold">Set a science based target</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/80">
            Models a near-term target with the absolute contraction approach and a long-term
            net-zero target, then checks the result against the SBTi corporate criteria. Rates use
            the dynamic linear annual reduction rate introduced in Corporate Net-Zero Standard
            v1.3.1, effective 14 April 2026, which replaced the earlier post-2020 base year
            ratchet.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            {Object.values(SBTI_SOURCES).map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline-offset-4 hover:underline"
              >
                {source.label}
              </a>
            ))}
          </div>
        </div>
        <div className="h-1.5 bg-accent" />
      </section>

      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
          failures.length === 0
            ? 'border-accent/40 bg-accent-soft text-brand'
            : 'border-red-200 bg-red-50 text-red-900'
        }`}
      >
        <span className="font-medium">
          {failures.length === 0
            ? 'This target package passes every criteria check modelled here.'
            : `${failures.length} criteria check${failures.length === 1 ? '' : 's'} still failing.`}
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportSummary}
            className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink"
          >
            <Download size={14} /> Export summary
          </button>
          <button
            type="button"
            onClick={persist}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white"
          >
            <Save size={14} /> Save target
          </button>
        </div>
      </div>
      {status ? <p className="text-sm text-accent-dark">{status}</p> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card step="Step 1" title="Inventory">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.useLiveInventory}
              onChange={(event) => {
                const checked = event.target.checked
                setConfig((prev) => ({
                  ...prev,
                  useLiveInventory: checked,
                  ...(checked
                    ? {}
                    : {
                        baseScope1: prev.baseScope1 || null,
                        baseScope2: prev.baseScope2 || null,
                        baseScope3: prev.baseScope3 || null,
                        recentScope1: prev.recentScope1 || null,
                        recentScope2: prev.recentScope2 || null,
                        recentScope3: prev.recentScope3 || null,
                      }),
                }))
              }}
            />
            Fill from logged emissions
          </label>
          {config.useLiveInventory && inventory.length === 0 ? (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              No entries logged yet. Add data or untick the box and enter the inventory manually.
            </p>
          ) : null}
          {yearsAlignedToInventory ? (
            <p className="mt-2 rounded-md border border-line bg-page px-3 py-2 text-xs text-muted">
              No logged emissions in {config.baseYear}
              {config.mostRecentYear !== config.baseYear ? ` / ${config.mostRecentYear}` : ''}.
              Choose years that appear in Combined Results, or untick the box and enter the
              inventory manually.
            </p>
          ) : null}

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">
            Base year {config.baseYear}
          </h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <NumberField
              label="Scope 1 (tCO₂e)"
              value={config.useLiveInventory ? effectiveConfig.baseScope1 : config.baseScope1}
              disabled={config.useLiveInventory}
              onChange={(value) => set('baseScope1', value)}
            />
            <NumberField
              label="Scope 2 (tCO₂e)"
              value={config.useLiveInventory ? effectiveConfig.baseScope2 : config.baseScope2}
              disabled={config.useLiveInventory}
              onChange={(value) => set('baseScope2', value)}
            />
            <NumberField
              label="Scope 3 (tCO₂e)"
              value={config.useLiveInventory ? effectiveConfig.baseScope3 : config.baseScope3}
              disabled={config.useLiveInventory}
              onChange={(value) => set('baseScope3', value)}
            />
          </div>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">
            Most recent year {config.mostRecentYear}
          </h3>
          <p className="mt-1 text-xs text-muted">
            Progress since the base year is built into the dynamic rate, so a recent inventory is
            required alongside the base year (C14).
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <NumberField
              label="Scope 1 (tCO₂e)"
              value={config.useLiveInventory ? effectiveConfig.recentScope1 : config.recentScope1}
              disabled={config.useLiveInventory}
              onChange={(value) => set('recentScope1', value)}
            />
            <NumberField
              label="Scope 2 (tCO₂e)"
              value={config.useLiveInventory ? effectiveConfig.recentScope2 : config.recentScope2}
              disabled={config.useLiveInventory}
              onChange={(value) => set('recentScope2', value)}
            />
            <NumberField
              label="Scope 3 (tCO₂e)"
              value={config.useLiveInventory ? effectiveConfig.recentScope3 : config.recentScope3}
              disabled={config.useLiveInventory}
              onChange={(value) => set('recentScope3', value)}
            />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Total base year" value={`${t(result.baseTotal)} tCO₂e`} />
            <Stat
              label="Scope 3 share"
              value={pct(result.scope3Share)}
              tone={result.scope3TargetRequired ? 'accent' : 'muted'}
            />
          </dl>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Scope 1 + 2 boundary coverage (%)"
              value={config.scope12Coverage}
              onChange={(value) => {
                if (value == null) return
                set('scope12Coverage', value)
              }}
            />
            <NumberField
              label="Scope 3 target coverage (%)"
              value={config.scope3Coverage}
              onChange={(value) => {
                if (value == null) return
                set('scope3Coverage', value)
              }}
            />
          </div>
        </Card>

        <Card step="Step 2" title="Target settings">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Base year"
              value={config.baseYear}
              integer
              onChange={(v) => {
                if (v == null) return
                set('baseYear', v)
              }}
            />
            <NumberField
              label="Most recent inventory year"
              value={config.mostRecentYear}
              integer
              onChange={(v) => {
                if (v == null) return
                set('mostRecentYear', v)
              }}
            />
            <NumberField
              label="Submission year"
              value={config.submissionYear}
              integer
              onChange={(v) => {
                if (v == null) return
                set('submissionYear', v)
              }}
            />
            <NumberField
              label="Target year"
              value={config.targetYear}
              integer
              onChange={(v) => {
                if (v == null) return
                set('targetYear', v)
              }}
              hint={`${config.targetYear - config.submissionYear} years from submission`}
            />
            <NumberField
              label="Net-zero year"
              value={config.netZeroYear}
              integer
              onChange={(v) => {
                if (v == null) return
                set('netZeroYear', v)
              }}
              hint="2050 at the latest"
            />
          </div>

          <label className="mt-4 block text-sm font-medium">
            Scope 3 pathway
            <select
              value={config.scope3Ambition}
              onChange={(event) =>
                set('scope3Ambition', event.target.value as SbtiConfig['scope3Ambition'])
              }
              className="mt-1 w-full rounded-md border border-line px-3 py-2 font-normal"
            >
              <option value="WB2C">Well-below 2°C — the criteria minimum (75% by 2050)</option>
              <option value="1.5C">1.5°C — encouraged, more ambitious (90% by 2050)</option>
            </select>
          </label>

          <label className="mt-4 block text-sm font-medium">
            Scope 2 accounting approach
            <select
              value={config.scope2Approach}
              onChange={(event) =>
                set('scope2Approach', event.target.value as SbtiConfig['scope2Approach'])
              }
              className="mt-1 w-full rounded-md border border-line px-3 py-2 font-normal"
            >
              <option value="location-based">Location-based</option>
              <option value="market-based">Market-based</option>
            </select>
          </label>

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.renewableElectricityTarget}
              onChange={(event) => set('renewableElectricityTarget', event.target.checked)}
            />
            Add a renewable electricity target instead of a scope 2 reduction target
          </label>
          {config.renewableElectricityTarget ? (
            <div className="mt-3">
              <NumberField
                label="Renewable electricity today (%)"
                value={config.renewableShareBaseYear}
                onChange={(value) => {
                  if (value == null) return
                  set('renewableShareBaseYear', value)
                }}
                hint="SBTi thresholds: 80% by 2025, 100% by 2030"
              />
            </div>
          ) : null}

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.sellsFossilFuels}
              onChange={(event) => set('sellsFossilFuels', event.target.checked)}
            />
            We sell, transmit or distribute fossil fuels
          </label>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ResultCard
          title="Scope 1 + 2 near-term"
          badge="1.5°C"
          headline={pct(result.s12.adjustedAmbition)}
          caption={`reduction by ${config.targetYear} from a ${config.baseYear} base year`}
          rows={[
            ['Annual rate (dLARR)', pct(result.s12.rate)],
            ['Base year emissions', `${t(result.s12.baseEmissions)} tCO₂e`],
            ['Target year emissions', `${t(result.s12.targetEmissions)} tCO₂e`],
            ['Absolute cut', `${t(result.s12.absoluteCut)} tCO₂e`],
          ]}
        />
        <ResultCard
          title="Scope 3 near-term"
          badge={result.scope3TargetRequired ? 'Required' : 'Optional'}
          headline={pct(result.s3.adjustedAmbition)}
          caption={`reduction by ${config.targetYear}, ${result.s3.ambitionLabel} aligned`}
          rows={[
            ['Annual rate (dLARR)', pct(result.s3.rate)],
            ['Base year emissions', `${t(result.s3.baseEmissions)} tCO₂e`],
            ['Target year emissions', `${t(result.s3.targetEmissions)} tCO₂e`],
            ['Share of inventory', pct(result.scope3Share)],
          ]}
        />
        <ResultCard
          title="Net-zero long-term"
          badge={`by ${config.netZeroYear}`}
          headline={pct(NET_ZERO_MIN_REDUCTION)}
          caption="minimum absolute reduction before neutralising residuals"
          rows={[
            ['Residual emissions', `${t(result.netZeroEmissions)} tCO₂e`],
            ['Scope 3 coverage needed', '90%'],
            ['Scope 1 + 2 coverage needed', '95%'],
            ['Review cycle', 'Every 5 years'],
          ]}
        />
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">How the rate was derived</h2>
        <p className="mt-1 text-sm text-muted">
          The dynamic rate divides each pathway&rsquo;s net-zero ambition by the years between your
          most recent inventory year and that pathway&rsquo;s net-zero year, then blends scope 1 and
          scope 2 by their emissions ratio. Scope 2 decarbonises faster because the method assumes
          the power system reaches zero by 2040.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Scope 1 · 90% by 2050" value={`${pct(result.scope1Rate)} / yr`} />
          <Stat label="Scope 2 · 100% by 2040" value={`${pct(result.scope2Rate)} / yr`} />
          <Stat
            label={`Blended at ${(result.scope1Share * 100).toFixed(0)}:${((1 - result.scope1Share) * 100).toFixed(0)}`}
            value={`${pct(result.s12.rate)} / yr`}
            tone="accent"
          />
          <Stat
            label={`Scope 3 · ${result.s3.ambitionLabel}`}
            value={`${pct(result.s3.rate)} / yr`}
          />
        </div>
        {result.s12.floorApplied || result.s3.floorApplied ? (
          <p className="mt-3 text-xs text-muted">
            A minimum rate floor was applied
            {result.s12.floorApplied ? ' to scope 1 + 2 (4.2% per year)' : ''}
            {result.s12.floorApplied && result.s3.floorApplied ? ' and' : ''}
            {result.s3.floorApplied
              ? ` to scope 3 (${config.scope3Ambition === '1.5C' ? '4.2' : '2.5'}% per year)`
              : ''}
            .
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Decarbonisation pathway</h2>
        <p className="mt-1 text-sm text-muted">
          Required trajectory from the {effectiveConfig.baseYear} base year through the{' '}
          {effectiveConfig.targetYear} near-term target to net-zero in {effectiveConfig.netZeroYear}
          {inventory.length > 0 ? ', with your logged emissions plotted against it' : ''}.
        </p>
        {result.baseTotal <= 0 ? (
          <p className="mt-4 rounded-md border border-line bg-page px-4 py-8 text-center text-sm text-muted">
            Enter base-year emissions, or log activities, to plot the science-based pathway.
          </p>
        ) : (
          <div className="mt-4 h-[320px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.pathway} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 12 }} minTickGap={24} />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  domain={[0, (max: number) => (Number.isFinite(max) && max > 0 ? Math.ceil(max * 1.15) : 1)]}
                  tickFormatter={(value) => (value >= 1000 ? `${Math.round(value / 100) / 10}k` : String(value))}
                />
                <Tooltip
                  formatter={(value, name) =>
                    value == null ? ['—', String(name)] : [`${t(Number(value))} tCO₂e`, String(name)]
                  }
                  labelFormatter={(label) => `Year ${label}`}
                />
                <Legend />
                <Line
                  type="linear"
                  dataKey="required"
                  name="Near-term pathway"
                  stroke={NAVY}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="netZero"
                  name="Net-zero pathway"
                  stroke={SLATE}
                  strokeWidth={2}
                  strokeDasharray="6 5"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="actual"
                  name="Actual emissions"
                  stroke={GREEN}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: GREEN }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Criteria checks</h2>
        <ul className="mt-4 space-y-2">
          {result.checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Target language</h2>
            <p className="mt-1 text-sm text-muted">
              Wording follows the SBTi target language templates. Submit this with your validation
              pack.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copyLanguage()}
            className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm"
          >
            <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {result.targetLanguage.map((line) => (
            <p
              key={line}
              className="rounded-lg border-l-4 border-accent bg-page px-4 py-3 text-sm leading-6 text-ink"
            >
              {line}
            </p>
          ))}
        </div>
      </section>

      {inventory.length > 0 ? (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Progress against the pathway</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-page text-muted">
                <tr>
                  <th className="px-3 py-2">Year</th>
                  <th className="px-3 py-2">Scope 1</th>
                  <th className="px-3 py-2">Scope 2</th>
                  <th className="px-3 py-2">Scope 3</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Required</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((row) => {
                  const point = result.pathway.find((item) => item.year === row.year)
                  const required = point?.required ?? point?.netZero ?? null
                  const onTrack = required == null ? null : row.total <= required
                  return (
                    <tr key={row.year} className="border-t border-line">
                      <td className="px-3 py-2 font-medium">{row.year}</td>
                      <td className="px-3 py-2">{t(row.scope1)}</td>
                      <td className="px-3 py-2">{t(row.scope2)}</td>
                      <td className="px-3 py-2">{t(row.scope3)}</td>
                      <td className="px-3 py-2">{t(row.total)}</td>
                      <td className="px-3 py-2">{required == null ? '—' : t(required)}</td>
                      <td className="px-3 py-2">
                        {onTrack == null ? (
                          <span className="text-muted">Outside target period</span>
                        ) : onTrack ? (
                          <span className="rounded bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-dark">
                            On track
                          </span>
                        ) : (
                          <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                            Above pathway
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Annual reduction applied: {pct(result.s12.rate)} for scope 1 and 2, {pct(result.s3.rate)}{' '}
            for scope 3.
          </p>
        </section>
      ) : null}
    </div>
  )
}

function Card({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return (
    <article className="rounded-2xl border border-line bg-white p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-dark">
        {step}
      </div>
      <h2 className="mt-1 mb-4 text-lg font-semibold text-ink">{title}</h2>
      {children}
    </article>
  )
}

function ResultCard({
  title,
  badge,
  headline,
  caption,
  rows,
}: {
  title: string
  badge: string
  headline: string
  caption: string
  rows: Array<[string, string]>
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line bg-brand px-5 py-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-brand">
          {badge}
        </span>
      </div>
      <div className="px-5 py-4">
        <div className="text-4xl font-semibold tracking-tight text-brand">{headline}</div>
        <p className="mt-1 text-xs text-muted">{caption}</p>
        <dl className="mt-4 space-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">{label}</dt>
              <dd className="font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  )
}

function CheckRow({ check }: { check: CriterionCheck }) {
  const tone = {
    pass: { icon: Check, className: 'bg-accent-soft text-accent-dark' },
    fail: { icon: X, className: 'bg-red-50 text-red-700' },
    warn: { icon: AlertTriangle, className: 'bg-amber-50 text-amber-800' },
    info: { icon: Info, className: 'bg-brand-soft text-brand' },
  }[check.status]
  const Icon = tone.icon

  return (
    <li className="flex gap-3 rounded-lg border border-line px-4 py-3">
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tone.className}`}>
        <Icon size={14} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{check.label}</span>
          <span className="rounded bg-page px-1.5 py-0.5 font-mono text-[10px] text-muted">
            {check.criterion}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">{check.detail}</p>
      </div>
    </li>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'accent' | 'muted' }) {
  return (
    <div className="rounded-lg bg-page px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={`text-lg font-semibold ${tone === 'accent' ? 'text-accent-dark' : 'text-ink'}`}
      >
        {value}
      </dd>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
  hint,
  integer,
}: {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
  hint?: string
  integer?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const display =
    value == null || !Number.isFinite(value) ? '' : integer ? String(Math.round(value)) : String(value)

  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        type="number"
        step={integer ? 1 : 'any'}
        value={editing ? draft : display}
        disabled={disabled}
        onFocus={() => {
          setEditing(true)
          setDraft(display)
        }}
        onBlur={() => setEditing(false)}
        onChange={(event) => {
          const raw = event.target.value
          setDraft(raw)
          if (raw.trim() === '' || raw === '-') {
            onChange(null)
            return
          }
          const next = Number(raw)
          if (!Number.isFinite(next)) return
          onChange(integer ? Math.round(next) : next)
        }}
        className="mt-1 w-full rounded-md border border-line px-3 py-2 font-normal disabled:bg-page disabled:text-muted"
      />
      {hint ? <span className="mt-1 block text-xs font-normal text-muted">{hint}</span> : null}
    </label>
  )
}

