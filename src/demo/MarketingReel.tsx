/**
 * Self-running marketing reel. Dev-only — routed from DemoApp.
 * Types construction, mining, and logistics entries, remounts charts so they
 * draw, then assembles a report.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { LogoMark } from '../components/brand/Logo'
import Sidebar from '../components/layout/Sidebar'
import Header from '../components/layout/Header'
import { summarizeInventory } from '../lib/ghg'
import { alignConfigWithInventory, calculateSbti, inventoryByYear } from '../lib/sbti'
import { useEntries } from '../lib/entries-context'
import { DEMO_SBTI } from './demo-data'

type Beat =
  | 'hook'
  | 'dashboard'
  | 'form'
  | 'mine'
  | 'freight'
  | 'result'
  | 'report'
  | 'analysis'
  | 'targets'
  | 'cta'

const BEATS: Array<{ id: Beat; at: number }> = [
  { id: 'hook', at: 0 },
  { id: 'dashboard', at: 1600 },
  { id: 'form', at: 5400 },
  { id: 'mine', at: 11200 },
  { id: 'freight', at: 16800 },
  { id: 'result', at: 22200 },
  { id: 'report', at: 24600 },
  { id: 'analysis', at: 30400 },
  { id: 'targets', at: 35800 },
  { id: 'cta', at: 41200 },
]

export const REEL_MS = 46800

export default function MarketingReel() {
  const [beat, setBeat] = useState<Beat>('hook')
  const { entries } = useEntries()

  useEffect(() => {
    const timers = BEATS.slice(1).map((step) => setTimeout(() => setBeat(step.id), step.at))
    return () => timers.forEach(clearTimeout)
  }, [])

  const summary = useMemo(() => summarizeInventory(entries), [entries])
  const inventory = useMemo(() => inventoryByYear(entries), [entries])
  const sbti = useMemo(() => {
    const cfg = alignConfigWithInventory(DEMO_SBTI, inventory)
    return calculateSbti(
      cfg,
      'Meridian Construction Group',
      new Map(inventory.map((row) => [row.year, row.total])),
    )
  }, [inventory])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-page" data-reel-ready="1">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header />
        <main className="relative min-h-0 flex-1 overflow-hidden p-5">
          <div className="h-full min-h-0 w-full">
            {beat === 'hook' ? <Hook total={summary.total} /> : null}
            {beat === 'dashboard' ? <DashboardBeat inventory={inventory} summary={summary} /> : null}
            {beat === 'form' ? <FormBeat /> : null}
            {beat === 'mine' ? <MineBeat /> : null}
            {beat === 'freight' ? <FreightBeat /> : null}
            {beat === 'result' ? <ResultBeat /> : null}
            {beat === 'report' ? <ReportBeat summary={summary} /> : null}
            {beat === 'analysis' ? <AnalysisBeat inventory={inventory} /> : null}
            {beat === 'targets' ? (
              <TargetsBeat
                pathway={sbti.pathway}
                cut={sbti.s12.adjustedAmbition}
                rate={sbti.s12.rate}
              />
            ) : null}
            {beat === 'cta' ? <Cta /> : null}
          </div>
        </main>
      </div>
    </div>
  )
}

function Hook({ total }: { total: number }) {
  const n = useCount(total, 520)
  return (
    <div className="flex h-full items-center justify-center rounded-2xl bg-brand text-white">
      <div className="text-center">
        <div className="text-[92px] font-bold leading-none tracking-tight">
          {n.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        <div className="mt-3 text-2xl font-semibold text-accent">
          tCO₂e · construction · mining · logistics
        </div>
      </div>
    </div>
  )
}

function DashboardBeat({
  inventory,
  summary,
}: {
  inventory: ReturnType<typeof inventoryByYear>
  summary: ReturnType<typeof summarizeInventory>
}) {
  const scope = [
    { name: 'Scope 1', t: Number(summary.scope1.toFixed(1)) },
    { name: 'Scope 2', t: Number(summary.scope2.toFixed(1)) },
    { name: 'Scope 3', t: Number(summary.scope3.toFixed(1)) },
  ]
  const years = inventory.map((row) => ({
    year: String(row.year),
    t: Number(row.total.toFixed(0)),
  }))
  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-4">
      <div className="grid grid-cols-3 gap-4">
        <Kpi value={summary.total} label="Reported footprint" />
        <Kpi value={summary.scope3} label="Scope 3" suffix=" · 85%" />
        <Kpi value={8.2} label="Down vs baseline" decimals={1} suffix="%" />
      </div>
      <div className="grid min-h-0 grid-cols-2 gap-4">
        <ChartCard title="Emissions by scope">
          <BarChart data={scope}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
            <Bar dataKey="t" fill="#02234e" radius={[4, 4, 0, 0]} animationDuration={620} />
          </BarChart>
        </ChartCard>
        <ChartCard title="Year by year">
          <BarChart data={years}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="year" tick={{ fill: '#475569', fontSize: 12 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
            <Bar dataKey="t" fill="#6cbe2c" radius={[4, 4, 0, 0]} animationDuration={620} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  )
}

function FormBeat() {
  return (
    <AutoForm
      title="Heavy Machinery"
      blurb="Fuel burned by excavators, haul trucks, drills, and other plant at construction sites and mines."
      buttonDone="Added 10.62 tCO₂e to your footprint"
      pressAt={2300}
      fields={[
        { label: 'Equipment type', final: 'Excavator', at: 180 },
        { label: 'Fuel type', final: 'Diesel / red diesel', at: 480 },
        { label: 'Fuel used', final: '4200', at: 820, digits: true, suffix: 'Litres (L)' },
        { label: 'Site', final: 'Riverside Quarter', at: 1680 },
      ]}
    />
  )
}

function MineBeat() {
  return (
    <AutoForm
      title="Explosives & blasting"
      blurb="ANFO and emulsion used in blasting at mines and quarries. Combustion CO₂ is Scope 1."
      buttonDone="Added 8.16 tCO₂e to your footprint"
      pressAt={2200}
      fields={[
        { label: 'Explosive type', final: 'ANFO', at: 160 },
        { label: 'Mass used', final: '48000', at: 620, digits: true, suffix: 'Kilograms (kg)' },
        { label: 'Site', final: 'Northgate Pit', at: 1580 },
      ]}
    />
  )
}

function FreightBeat() {
  return (
    <AutoForm
      title="Road Freight"
      blurb="Contracted haulage of materials, ore, concentrate, and waste — tonne-kilometres, Scope 3."
      buttonDone="Added 7.94 tCO₂e to your footprint"
      pressAt={2400}
      fields={[
        { label: 'Vehicle class', final: 'HGV articulated', at: 160 },
        { label: 'Cargo weight', final: '420', at: 520, digits: true, suffix: 'Tonnes (t)' },
        { label: 'Distance', final: '186', at: 1100, digits: true, suffix: 'Kilometres (km)' },
        { label: 'Site', final: 'Northgate Pit → Immingham', at: 1780 },
      ]}
    />
  )
}

function AutoForm({
  title,
  blurb,
  fields,
  pressAt,
  buttonDone,
}: {
  title: string
  blurb: string
  fields: Array<{ label: string; final: string; at: number; digits?: boolean; suffix?: string }>
  pressAt: number
  buttonDone: string
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [pressed, setPressed] = useState(false)

  useEffect(() => {
    const timers = fields.map((field) =>
      window.setTimeout(() => {
        if (field.digits) typeDigits(field.final, (next) => setValues((prev) => ({ ...prev, [field.label]: next })), 40)
        else setValues((prev) => ({ ...prev, [field.label]: field.final }))
      }, field.at),
    )
    timers.push(window.setTimeout(() => setPressed(true), pressAt))
    return () => timers.forEach(clearTimeout)
  }, []) // field specs are fixed for the life of each beat

  return (
    <div className="flex h-full w-full flex-col rounded-2xl border border-line bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-bold text-brand">{title}</h1>
      <p className="mt-2 text-sm text-muted">{blurb}</p>
      <div className="mt-6 space-y-4">
        {fields.map((field) => (
          <Field key={field.label} label={field.label} value={values[field.label] ?? ''} suffix={field.suffix} />
        ))}
        <button
          type="button"
          className={`w-full rounded-md py-3 text-sm font-semibold text-white ${
            pressed ? 'bg-accent-dark' : 'bg-brand'
          }`}
        >
          {pressed ? buttonDone : 'Calculate & add to footprint'}
        </button>
      </div>
    </div>
  )
}

function ResultBeat() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-xl border border-accent bg-accent-soft px-5 py-3 text-sm font-semibold text-accent-dark">
        Logged across construction, mining, and logistics
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-page text-left text-muted">
            <tr>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3 text-right">tCO₂e</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-accent-soft font-semibold">
              <td className="px-4 py-3">420 t concentrate × 186 km — HGV articulated</td>
              <td className="px-4 py-3">Northgate Pit → Immingham</td>
              <td className="px-4 py-3 text-right">7.94</td>
            </tr>
            <tr className="border-t border-line">
              <td className="px-4 py-3">48,000 kg ANFO — blasting</td>
              <td className="px-4 py-3">Northgate Pit</td>
              <td className="px-4 py-3 text-right">8.16</td>
            </tr>
            <tr className="border-t border-line">
              <td className="px-4 py-3">4,200 L Diesel / red diesel — Excavator</td>
              <td className="px-4 py-3">Riverside Quarter</td>
              <td className="px-4 py-3 text-right">10.62</td>
            </tr>
            <tr className="border-t border-line">
              <td className="px-4 py-3">Diesel — 30t tracked excavators (x4)</td>
              <td className="px-4 py-3">Riverside Quarter</td>
              <td className="px-4 py-3 text-right">176.29</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReportBeat({ summary }: { summary: ReturnType<typeof summarizeInventory> }) {
  const [phase, setPhase] = useState<'build' | 'page'>('build')
  const [pct, setPct] = useState(0)
  const [rows, setRows] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const tick = window.setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - start) / 700) * 100))
      setPct(p)
      if (p >= 100) {
        clearInterval(tick)
        setPhase('page')
      }
    }, 40)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    if (phase !== 'page') return
    let n = 0
    const tick = window.setInterval(() => {
      n += 1
      setRows(n)
      if (n >= 8) clearInterval(tick)
    }, 80)
    return () => clearInterval(tick)
  }, [phase])

  if (phase === 'build') {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-line bg-white">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
          GHG Protocol inventory
        </div>
        <div className="mt-3 text-3xl font-bold text-brand">Generating report…</div>
        <div className="mt-8 h-2 w-96 overflow-hidden rounded-full bg-page">
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 text-sm text-muted">{pct}% · 138 activities · SECR / PPN 06/21</div>
      </div>
    )
  }

  const lines = [
    ['Scope 1 — stationary / mobile / fugitive', summary.scope1],
    ['Scope 2 — electricity and heat', summary.scope2],
    ['Cat 1  Purchased goods and services', 14353.91],
    ['Cat 4  Upstream transport', 86.6],
    ['Cat 5  Waste generated', 213.1],
    ['Cat 6  Business travel', 22.3],
    ['Cat 7  Employee commuting', 214.9],
    ['Total reported footprint', summary.total],
  ] as const

  return (
    <div className="h-full w-full overflow-hidden rounded-2xl border border-line bg-white p-8 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark size={28} />
          <div className="text-lg font-bold text-brand">Inventory report</div>
        </div>
        <div className="rounded bg-accent px-2 py-1 text-xs font-bold text-white">PDF READY</div>
      </div>
      <div className="mt-1 text-sm text-muted">
        Construction, mining &amp; logistics · FY23–FY26
      </div>
      <table className="mt-6 w-full text-sm">
        <tbody>
          {lines.slice(0, rows).map(([label, value]) => (
            <tr key={label} className="border-t border-line">
              <td className="py-2.5">{label}</td>
              <td className="py-2.5 text-right font-semibold">
                {value.toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AnalysisBeat({ inventory }: { inventory: ReturnType<typeof inventoryByYear> }) {
  const data = inventory.map((row) => ({
    year: String(row.year),
    s1: Number(row.scope1.toFixed(0)),
    s2: Number(row.scope2.toFixed(0)),
    s3: Number(row.scope3.toFixed(0)),
  }))
  return (
    <div className="h-full">
      <ChartCard title="Monthly trend · Scope 1 / 2 / 3">
        <LineChart data={data}>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis dataKey="year" tick={{ fill: '#475569', fontSize: 12 }} />
          <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="s1" stroke="#02234e" strokeWidth={3} dot animationDuration={700} />
          <Line type="monotone" dataKey="s2" stroke="#4b6ea8" strokeWidth={3} dot animationDuration={700} />
          <Line type="monotone" dataKey="s3" stroke="#6cbe2c" strokeWidth={3} dot animationDuration={700} />
        </LineChart>
      </ChartCard>
    </div>
  )
}

function TargetsBeat({
  pathway,
  cut,
  rate,
}: {
  pathway: Array<{ year: number; required?: number; netZero?: number; actual?: number }>
  cut: number
  rate: number
}) {
  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Kpi value={cut * 100} label="Scope 1 + 2 cut by 2033" decimals={1} suffix="%" />
        <Kpi value={rate * 100} label="Annual reduction rate" decimals={1} suffix="% / yr" />
      </div>
      <ChartCard title="Decarbonisation pathway">
        <LineChart data={pathway.filter((p) => p.year <= 2040)}>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis dataKey="year" tick={{ fill: '#475569', fontSize: 12 }} />
          <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
          <Line
            type="linear"
            dataKey="actual"
            stroke="#6cbe2c"
            strokeWidth={3}
            dot
            connectNulls={false}
            animationDuration={750}
          />
          <Line
            type="linear"
            dataKey="required"
            stroke="#02234e"
            strokeWidth={3}
            dot={false}
            connectNulls={false}
            animationDuration={750}
          />
          <Line
            type="linear"
            dataKey="netZero"
            stroke="#4b6ea8"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls={false}
            animationDuration={750}
          />
        </LineChart>
      </ChartCard>
    </div>
  )
}

function Cta() {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl bg-brand text-white">
      <div className="text-center px-8">
        <div className="text-6xl font-bold">Carbon Logic</div>
        <div className="mt-3 text-2xl font-semibold text-accent">
          Built for construction, mining, &amp; logistics.
        </div>
      </div>
    </div>
  )
}

function Kpi({
  value,
  label,
  decimals = 0,
  suffix = '',
}: {
  value: number
  label: string
  decimals?: number
  suffix?: string
}) {
  const n = useCount(value, 420)
  return (
    <div className="rounded-2xl border border-line bg-white px-6 py-5">
      <div className="text-4xl font-semibold text-brand">
        {n.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
        {suffix}
      </div>
      <div className="mt-2 text-sm text-muted">{label}</div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <article className="flex h-full min-h-0 flex-col rounded-2xl border border-line bg-white p-5">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </article>
  )
}

function Field({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <div className="mt-1 flex gap-2">
        <div className="min-h-10 flex-1 rounded-md border border-line bg-page px-3 py-2 text-sm font-normal">
          {value}
          <span className="animate-pulse text-brand">{value ? '' : ' '}</span>
        </div>
        {suffix ? (
          <div className="w-36 rounded-md border border-line bg-page px-2 py-2 text-sm font-normal text-muted">
            {suffix}
          </div>
        ) : null}
      </div>
    </label>
  )
}

function useCount(target: number, ms: number) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const tick = window.setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / ms)
      setN(target * t)
      if (t >= 1) clearInterval(tick)
    }, 32)
    return () => clearInterval(tick)
  }, [target, ms])
  return n
}

function typeDigits(text: string, set: (v: string) => void, step: number) {
  let i = 0
  const id = window.setInterval(() => {
    i += 1
    set(text.slice(0, i))
    if (i >= text.length) clearInterval(id)
  }, step)
}
