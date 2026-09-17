import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { LogoLockup } from '../components/brand/Logo'
import { completenessForYear } from '../lib/completeness'
import { useEntries } from '../lib/entries-context'
import { entryActivityYear } from '../lib/entry-date'
import { formatNumber, formatPercent, formatTco2e, roundDisplay } from '../lib/format'
import { summarizeInventory } from '../lib/ghg'
import { isYearLocked } from '../lib/period-lock'
import { summarizeScope2 } from '../lib/scope2'
import { loadSbtiConfig } from '../lib/targets-store'
import { useAuth } from '../lib/auth-context'
import { useOrg } from '../providers/OrgProvider'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good to see you'
  return 'Good evening'
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name
}

const NAVY = '#02234e'
const GREEN = '#6cbe2c'

export default function DashboardPage() {
  const { entries } = useEntries()
  const { profile, sites } = useOrg()
  const { profile: account, user, organization } = useAuth()
  const defaultYear = profile.reportingYear || new Date().getFullYear()
  const years = useMemo(() => {
    const set = new Set(entries.map((entry) => entryActivityYear(entry)))
    set.add(defaultYear)
    set.add(defaultYear - 1)
    return [...set].sort((a, b) => b - a)
  }, [entries, defaultYear])
  const [year, setYear] = useState(defaultYear)

  const yearEntries = useMemo(
    () => entries.filter((entry) => entryActivityYear(entry) === year),
    [entries, year],
  )
  const priorEntries = useMemo(
    () => entries.filter((entry) => entryActivityYear(entry) === year - 1),
    [entries, year],
  )

  const ytdTotal = yearEntries.reduce((sum, row) => sum + row.emissions_tco2e, 0)
  const priorTotal = priorEntries.reduce((sum, row) => sum + row.emissions_tco2e, 0)
  const scope3 = yearEntries
    .filter((entry) => entry.scope === 'Scope 3')
    .reduce((sum, row) => sum + row.emissions_tco2e, 0)
  const baseline = profile.baselineYtdTco2e || 0
  const reduction = baseline > 0 ? (baseline - ytdTotal) / baseline : 0
  const yoy = priorTotal > 0 ? (ytdTotal - priorTotal) / priorTotal : null
  const dual = summarizeScope2(yearEntries, profile.residualMixKgPerKwh, 0.13096)
  const inventory = summarizeInventory(yearEntries)
  const complete = completenessForYear({ entries, sites, profile, year })
  const locked = isYearLocked(profile.lockedYears, year)
  const sbti = loadSbtiConfig(organization?.id)
  const yearsElapsed = year - sbti.baseYear
  const expected =
    baseline > 0 && yearsElapsed >= 0 ? baseline * (1 - 0.042 * yearsElapsed) : null

  const scopeData = useMemo(() => {
    const totals = { 'Scope 1': 0, 'Scope 2': 0, 'Scope 3': 0 }
    for (const entry of yearEntries) {
      if (entry.scope in totals) {
        totals[entry.scope as keyof typeof totals] += entry.emissions_tco2e
      }
    }
    return Object.entries(totals).map(([name, emissions]) => ({
      name,
      emissions: roundDisplay(emissions),
    }))
  }, [yearEntries])

  const facilityData = useMemo(() => {
    const totals = new Map<string, number>()
    for (const site of sites) totals.set(site.name, 0)
    for (const entry of yearEntries) {
      const name = entry.site || 'Unassigned'
      totals.set(name, (totals.get(name) ?? 0) + entry.emissions_tco2e)
    }
    return [...totals.entries()].map(([name, emissions]) => ({
      name,
      emissions: roundDisplay(emissions),
    }))
  }, [yearEntries, sites])

  const empty = yearEntries.length === 0

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-6 px-6 py-8">
          <div>
            <h1 className="text-3xl font-semibold text-brand">
              {greeting()}, {firstName(account?.fullName || user?.email || '')}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {year} inventory for {organization?.name ?? 'this organisation'}
              {locked ? ' · closed' : ''}. Dual Scope 2, completeness, and progress vs baseline.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm">
              Year
              <select
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                className="ml-2 rounded-md border border-line px-2 py-1"
              >
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <LogoLockup width={132} className="hidden sm:block" />
          </div>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-brand to-accent" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={`${year} reported tCO₂e`} value={formatTco2e(ytdTotal)} />
        <MetricCard
          label={yoy == null ? `No ${year - 1} data yet` : `vs ${year - 1}`}
          value={yoy == null ? '—' : formatPercent(yoy * 100)}
        />
        <MetricCard
          label={baseline ? `vs ${formatTco2e(baseline)} tCO₂e baseline` : 'Set a baseline'}
          value={baseline ? formatPercent(reduction * 100) : '—'}
        />
        <MetricCard label="Inventory completeness" value={formatPercent(complete.score * 100)} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Scope 3" value={formatTco2e(scope3)} />
        <MetricCard label="Scope 2 location-based" value={formatTco2e(dual.locationTco2e || inventory.scope2)} />
        <MetricCard label="Scope 2 market-based" value={formatTco2e(dual.marketTco2e)} />
      </section>

      {expected != null && Number.isFinite(expected) ? (
        <p className="text-sm text-muted">
          Linear path toward the science-based target year {sbti.targetYear}:{' '}
          <strong>{formatTco2e(Math.max(expected, 0), true)}</strong> this year, against{' '}
          {formatTco2e(ytdTotal, true)} reported.
        </p>
      ) : null}

      {empty ? (
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Set up this organisation</h2>
          <p className="mt-1 text-sm text-muted">
            A paying workspace is useful once the inventory can be closed and reported. Work through
            the list — completeness is the score on the dashboard.
          </p>
          <ol className="mt-4 space-y-2">
            {complete.items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 text-sm">
                <span
                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                    item.done ? 'bg-accent-dark' : 'bg-slate-300'
                  }`}
                >
                  {item.done ? '✓' : ''}
                </span>
                <span>
                  {item.href ? (
                    <Link to={item.href} className="font-medium text-brand hover:underline">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="font-medium">{item.label}</span>
                  )}
                  <span className="block text-muted">{item.hint}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-line bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">Completeness</h2>
              <Link to="/reports" className="text-sm text-brand hover:underline">
                Open report pack
              </Link>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {complete.items.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm">
                  <span className={item.done ? 'text-accent-dark' : 'text-muted'}>{item.done ? '✓' : '○'}</span>
                  {item.href ? (
                    <Link to={item.href} className="hover:underline">
                      {item.label}
                    </Link>
                  ) : (
                    item.label
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Emissions by Scope">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={scopeData} margin={{ top: 24, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatTco2e(Number(value ?? 0), true)} />
                  <Bar dataKey="emissions" fill={NAVY} radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="emissions"
                      position="top"
                      fill="#0f1e33"
                      fontSize={12}
                      formatter={(value) => formatNumber(Number(value ?? 0))}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Emissions by Facility">
              {facilityData.every((row) => row.emissions === 0) ? (
                <p className="flex h-[280px] items-center justify-center text-sm text-muted">
                  Assign facilities on each activity to populate this chart.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={facilityData} margin={{ top: 24, right: 8, left: 0, bottom: 24 }}>
                    <CartesianGrid stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      interval={0}
                      tick={{ fill: '#475569', fontSize: 11 }}
                      tickFormatter={(value: string) =>
                        value.length > 16 ? `${value.slice(0, 15)}…` : value
                      }
                    />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip formatter={(value) => formatTco2e(Number(value ?? 0), true)} />
                    <Bar dataKey="emissions" fill={GREEN} radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="emissions"
                        position="top"
                        fill="#0f1e33"
                        fontSize={12}
                        formatter={(value) => formatNumber(Number(value ?? 0))}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </section>
        </>
      )}

      <section className="rounded-xl border border-line bg-white p-5 text-sm">
        <h2 className="mb-3 text-lg font-semibold text-ink">Where to work next</h2>
        <div className="flex flex-wrap gap-4">
          <Link to="/organisation" className="text-brand hover:underline">
            Organisation settings
          </Link>
          <Link to="/reports" className="text-brand hover:underline">
            SECR and PPN reports
          </Link>
          <Link to="/factors" className="text-brand hover:underline">
            Emission factors
          </Link>
          <Link to="/facilities" className="text-brand hover:underline">
            Facilities
          </Link>
          <Link to="/input" className="text-brand hover:underline">
            Data input
          </Link>
        </div>
      </section>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white px-6 py-7">
      <div
        className="truncate text-3xl font-semibold tabular-nums tracking-tight text-brand sm:text-4xl"
        title={value}
      >
        {value}
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm text-muted">
        <span className="h-2 w-2 rounded-full bg-accent" />
        {label}
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-2xl border border-line bg-white p-5">
      <h2 className="mb-3 text-lg font-semibold text-ink">{title}</h2>
      {children}
    </article>
  )
}
