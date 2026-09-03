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
import { useEntries } from '../lib/entries-context'
import { useOrg } from '../providers/OrgProvider'
import { useAuth } from '../lib/auth-context'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good to see you'
  return 'Good evening'
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name
}

function ytd(date: string) {
  return new Date(date).getFullYear() === new Date().getFullYear()
}

const NAVY = '#02234e'
const GREEN = '#6cbe2c'

export default function DashboardPage() {
  const { entries } = useEntries()
  const { profile, updateProfile, sites } = useOrg()
  const { profile: account, user } = useAuth()
  const [baselineDraft, setBaselineDraft] = useState(String(profile.baselineYtdTco2e || ''))
  const [baselineSaved, setBaselineSaved] = useState(false)

  const yearEntries = useMemo(
    () => entries.filter((entry) => ytd(entry.created_at)),
    [entries],
  )

  const ytdTotal = yearEntries.reduce((sum, row) => sum + row.emissions_tco2e, 0)
  const scope3 = yearEntries
    .filter((entry) => entry.scope === 'Scope 3')
    .reduce((sum, row) => sum + row.emissions_tco2e, 0)
  const baseline = profile.baselineYtdTco2e || 0
  const reduction = baseline > 0 ? (baseline - ytdTotal) / baseline : 0

  const scopeData = useMemo(() => {
    const totals = { 'Scope 1': 0, 'Scope 2': 0, 'Scope 3': 0 }
    for (const entry of yearEntries) {
      if (entry.scope in totals) {
        totals[entry.scope as keyof typeof totals] += entry.emissions_tco2e
      }
    }
    return Object.entries(totals).map(([name, emissions]) => ({
      name,
      emissions: Number(emissions.toFixed(3)),
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
      emissions: Number(emissions.toFixed(3)),
    }))
  }, [yearEntries, sites])

  function saveBaseline() {
    const value = Number(baselineDraft)
    const next = Number.isFinite(value) && value > 0 ? value : 0
    updateProfile({ ...profile, baselineYtdTco2e: next })
    setBaselineSaved(true)
    setTimeout(() => setBaselineSaved(false), 3000)
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-6 px-6 py-8">
          <div>
            <h1 className="text-3xl font-semibold text-brand">
              {greeting()}, {firstName(account?.fullName || user?.email || '')}
            </h1>
            <p className="mt-2 text-sm text-muted">
              Track YTD emissions, Scope 3, and progress vs baseline.
            </p>
          </div>
          <LogoLockup width={132} className="hidden sm:block" />
        </div>
        <div className="h-1.5 bg-gradient-to-r from-brand to-accent" />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Current YTD Emissions" value={ytdTotal.toFixed(3)} />
        <MetricCard label="Scope 3 YTD tCO2e" value={scope3.toFixed(3)} />
        <MetricCard
          label={baseline ? `Reduction vs ${baseline.toLocaleString()} tCO₂e baseline` : 'Set a baseline below ↓'}
          value={baseline ? `${(reduction * 100).toFixed(1)}%` : '—'}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Emissions by Scope">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={scopeData} margin={{ top: 24, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip formatter={(value) => `${Number(value ?? 0).toFixed(3)} tCO2e`} />
              <Bar dataKey="emissions" fill={NAVY} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="emissions" position="top" fill="#0f1e33" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Emissions by Facility">
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
              <Tooltip formatter={(value) => `${Number(value ?? 0).toFixed(3)} tCO2e`} />
              <Bar dataKey="emissions" fill={GREEN} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="emissions" position="top" fill="#0f1e33" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 text-sm">
        <h2 className="mb-3 text-lg font-semibold text-ink">Settings &amp; Baseline</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            saveBaseline()
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="block font-medium">
            <span className="text-muted">Baseline YTD tCO₂e</span>
            <input
              type="number"
              min={0}
              step="any"
              value={baselineDraft}
              onChange={(event) => {
                setBaselineDraft(event.target.value)
                setBaselineSaved(false)
              }}
              placeholder="e.g. 1200"
              className="mt-1 block w-40 rounded-md border border-line px-3 py-2"
            />
          </label>
          <button type="submit" className="rounded-md bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark">
            Save baseline
          </button>
          {baselineSaved ? (
            <span className="text-sm font-medium text-accent-dark">✓ Baseline saved</span>
          ) : null}
          {baseline > 0 ? (
            <span className="text-xs text-muted">
              Current baseline: {baseline.toLocaleString()} tCO₂e
            </span>
          ) : null}
        </form>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link to="/factors" className="text-brand hover:underline">
            Manage emission factors
          </Link>
          <Link to="/sites" className="text-brand hover:underline">
            Manage facilities
          </Link>
          <Link to="/input" className="text-brand hover:underline">
            Open data input
          </Link>
        </div>
      </section>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-6 py-7">
      <div className="text-4xl font-semibold tracking-tight text-brand">{value}</div>
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
