import { useEffect, useState } from 'react'
import type { TutorialId } from '../../lib/tutorials'

type Frame = { label: string; ui: string }

const FRAMES: Record<TutorialId, Frame[]> = {
  'data-entry': [
    { label: 'Open a category form', ui: 'form' },
    { label: 'Pick a facility', ui: 'site' },
    { label: 'Enter activity amount', ui: 'amount' },
    { label: 'Calculate & add', ui: 'calc' },
    { label: 'Row appears in Results', ui: 'result' },
  ],
  organization: [
    { label: 'Open Organisation', ui: 'org' },
    { label: 'Enter annual turnover', ui: 'turnover' },
    { label: 'Set baseline YTD', ui: 'baseline' },
    { label: 'Checklist ticks as you go', ui: 'checks' },
    { label: 'Reporting setup ready', ui: 'done' },
  ],
  sbti: [
    { label: 'Open Science Based Targets', ui: 'sbti' },
    { label: 'Confirm inventory years', ui: 'inventory' },
    { label: 'Set target years', ui: 'years' },
    { label: 'Review criteria checks', ui: 'checks' },
    { label: 'Save the target', ui: 'save' },
  ],
}

type Props = {
  topicId: TutorialId
}

/**
 * Silent animated walkthrough used as the tutorial “video” when a recorded
 * file is unavailable, and as an immediate in-app demo either way.
 */
export default function TutorialScreencast({ topicId }: Props) {
  const frames = FRAMES[topicId]
  const [index, setIndex] = useState(0)
  const frame = frames[index]

  useEffect(() => {
    setIndex(0)
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % frames.length)
    }, 2000)
    return () => window.clearInterval(id)
  }, [topicId, frames.length])

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-gradient-to-br from-[#e8eef5] to-[#f7faf7]">
      <div className="relative aspect-video p-4 sm:p-6">
        <div className="text-sm font-bold tracking-tight text-brand">Carbon Logic</div>
        <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-accent-dark">
          Tutorial walkthrough
        </div>

        <div className="relative mt-3 min-h-[58%] rounded-xl border border-line bg-white p-4 shadow-sm">
          {topicId === 'data-entry' ? <DataEntryFrame ui={frame.ui} /> : null}
          {topicId === 'organization' ? <OrganizationFrame ui={frame.ui} /> : null}
          {topicId === 'sbti' ? <SbtiFrame ui={frame.ui} /> : null}
        </div>

        <div className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white sm:inset-x-6">
          <span>{frame.label}</span>
          <span className="text-xs font-medium text-accent">
            {index + 1}/{frames.length}
          </span>
        </div>
      </div>
    </div>
  )
}

function Field({ active, children }: { active?: boolean; children: string }) {
  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm transition ${
        active ? 'border-accent bg-white shadow-[0_0_0_3px_rgba(108,190,44,0.2)]' : 'border-line bg-page'
      }`}
    >
      {children}
    </div>
  )
}

function Tick({ on, label }: { on: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm text-ink">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${
          on ? 'bg-accent text-white' : 'border border-line text-transparent'
        }`}
      >
        ✓
      </span>
      {label}
    </div>
  )
}

function DataEntryFrame({ ui }: { ui: string }) {
  return (
    <>
      <p className="text-xs font-semibold text-muted">Data input · Site fuel</p>
      <h3 className="mt-1 text-base font-semibold text-brand">Log diesel for a construction site</h3>
      <div className="mt-3 space-y-2">
        <Field active={ui !== 'form'}>{ui === 'form' ? 'Select facility…' : 'Construction site A'}</Field>
        <Field active={ui === 'amount' || ui === 'calc' || ui === 'result'}>
          {ui === 'form' || ui === 'site' ? 'Litres' : '12,500 L Diesel'}
        </Field>
        <button
          type="button"
          className={`rounded-md px-3 py-2 text-sm font-semibold text-white ${
            ui === 'calc' || ui === 'result' ? 'bg-accent' : 'bg-brand/40'
          }`}
        >
          Calculate & add to footprint
        </button>
        {ui === 'result' ? (
          <p className="border-t border-line pt-2 text-sm text-ink">
            12,500 L Diesel · Site A → <strong>33.812 tCO₂e</strong>
          </p>
        ) : null}
      </div>
    </>
  )
}

function OrganizationFrame({ ui }: { ui: string }) {
  const states: Record<string, boolean[]> = {
    org: [true, false, false, false, false],
    turnover: [true, false, false, true, false],
    baseline: [true, false, true, true, false],
    checks: [true, true, true, true, false],
    done: [true, true, true, true, true],
  }
  const ticks = states[ui] ?? [false, false, false, false, false]
  return (
    <>
      <p className="text-xs font-semibold text-muted">Organisation</p>
      <h3 className="mt-1 text-base font-semibold text-brand">Reporting setup</h3>
      <div className="mt-3 space-y-2">
        <Field active={ui !== 'org'}>
          {ui === 'org' ? 'Annual turnover: £' : 'Annual turnover: £48,200,000'}
        </Field>
        <Field active={ui === 'baseline' || ui === 'checks' || ui === 'done'}>
          {ui === 'org' || ui === 'turnover' ? 'Baseline YTD: tCO₂e' : 'Baseline YTD: 4,180 tCO₂e'}
        </Field>
        <div className="pt-1">
          <Tick on={ticks[0]} label="Add facility" />
          <Tick on={ticks[1]} label="Log first emissions" />
          <Tick on={ticks[2]} label="Set baseline" />
          <Tick on={ticks[3]} label="Enter annual turnover" />
          <Tick on={ticks[4]} label="Save science-based target" />
        </div>
      </div>
    </>
  )
}

function SbtiFrame({ ui }: { ui: string }) {
  const ticks =
    ui === 'save'
      ? [true, true, true]
      : ui === 'checks'
        ? [true, true, false]
        : [false, false, false]
  return (
    <>
      <p className="text-xs font-semibold text-muted">Science Based Targets</p>
      <h3 className="mt-1 text-base font-semibold text-brand">Set a near-term pathway</h3>
      <div className="mt-3 space-y-2">
        <Field active={ui !== 'sbti'}>
          {ui === 'sbti' ? 'Base year — · Recent —' : 'Base year 2023 · Recent 2025'}
        </Field>
        <Field active={ui === 'years' || ui === 'checks' || ui === 'save'}>
          {ui === 'sbti' || ui === 'inventory' ? 'Target year — · Net-zero 2050' : 'Target year 2034 · Net-zero 2050'}
        </Field>
        <div className="pt-1">
          <Tick on={ticks[0]} label="Criteria: base year coverage" />
          <Tick on={ticks[1]} label="Criteria: target horizon 5–10 years" />
          <Tick on={ticks[2]} label="Target language ready" />
        </div>
        <button
          type="button"
          className={`rounded-md px-3 py-2 text-sm font-semibold text-white ${
            ui === 'save' ? 'bg-accent' : 'bg-brand/40'
          }`}
        >
          Save target
        </button>
      </div>
    </>
  )
}
