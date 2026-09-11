import { useEffect, useState, type FormEvent } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { PROFESSIONAL_PLAN } from '../lib/commercial'
import { useAuth } from '../lib/auth-context'
import { useOrg } from '../providers/OrgProvider'

export default function OrganisationPage() {
  const { organization, can } = useAuth()
  const { profile, updateProfile, setYearLock, error } = useOrg()
  const canEdit = can('settings:write')
  const [draft, setDraft] = useState(profile)
  const [status, setStatus] = useState<string | null>(null)
  const [lockReason, setLockReason] = useState('')
  const [lockBusy, setLockBusy] = useState(false)

  useEffect(() => {
    setDraft(profile)
  }, [profile])

  const year = draft.reportingYear || new Date().getFullYear()
  const closed = profile.lockedYears.includes(year)

  async function save(event: FormEvent) {
    event.preventDefault()
    setStatus(null)
    const result = await updateProfile({
      ...draft,
      organisation: organization?.name || draft.organisation,
      employeeCount: Number(draft.employeeCount) || 0,
      annualRevenue: Number(draft.annualRevenue) || 0,
      baselineYtdTco2e: Number(draft.baselineYtdTco2e) || 0,
      residualMixKgPerKwh: Number(draft.residualMixKgPerKwh) || 0,
      reportingYear: Number(draft.reportingYear) || new Date().getFullYear(),
    })
    setStatus(result.error ?? 'Organisation settings saved.')
  }

  async function toggleLock() {
    setLockBusy(true)
    setStatus(null)
    const result = await setYearLock(year, !closed, lockReason)
    setLockBusy(false)
    setStatus(
      result.error ??
        (closed ? `${year} is open again for editing.` : `${year} is closed. Activities in that year can no longer be changed.`),
    )
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="px-6 py-7">
          <h1 className="text-2xl font-semibold text-brand">Organisation</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Reporting year, baseline, turnover, headcount, and year-end close for{' '}
            {organization?.name ?? 'this organisation'}. These figures feed the board dashboard, SECR
            intensity ratios, and the PPN 06/21 Carbon Reduction Plan.
          </p>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-brand to-accent" />
      </section>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">What this workspace includes</h2>
        <p className="mt-1 text-sm text-muted">{PROFESSIONAL_PLAN.summary}</p>
        <ul className="mt-3 grid gap-2 text-sm text-ink md:grid-cols-2">
          {PROFESSIONAL_PLAN.includes.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={(event) => void save(event)} className="space-y-6">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Reporting profile</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Display name">
              <input
                value={draft.displayName}
                onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
                disabled={!canEdit}
                className={inputClass}
              />
            </Field>
            <Field label="Country">
              <input
                value={draft.country}
                onChange={(event) => setDraft({ ...draft, country: event.target.value })}
                disabled={!canEdit}
                className={inputClass}
              />
            </Field>
            <Field label="Reporting year">
              <input
                type="number"
                min={2000}
                max={2100}
                value={draft.reportingYear}
                onChange={(event) => setDraft({ ...draft, reportingYear: Number(event.target.value) })}
                disabled={!canEdit}
                className={inputClass}
              />
            </Field>
            <Field label="Baseline tCO₂e">
              <input
                type="number"
                min={0}
                step="any"
                value={draft.baselineYtdTco2e || ''}
                onChange={(event) => setDraft({ ...draft, baselineYtdTco2e: Number(event.target.value) })}
                disabled={!canEdit}
                className={inputClass}
              />
            </Field>
            <Field label="Annual turnover (£)">
              <input
                type="number"
                min={0}
                step="any"
                value={draft.annualRevenue || ''}
                onChange={(event) => setDraft({ ...draft, annualRevenue: Number(event.target.value) })}
                disabled={!canEdit}
                className={inputClass}
              />
            </Field>
            <Field label="Average FTE">
              <input
                type="number"
                min={0}
                step="any"
                value={draft.employeeCount || ''}
                onChange={(event) => setDraft({ ...draft, employeeCount: Number(event.target.value) })}
                disabled={!canEdit}
                className={inputClass}
              />
            </Field>
            <Field
              label="GB residual mix (kg CO₂e / kWh)"
              hint="From the Association of Issuing Bodies residual-mix disclosure. Used when a site has no REGO or supplier-specific factor. Leave at 0 until you have the official figure — Carbon Logic does not invent one."
            >
              <input
                type="number"
                min={0}
                step="any"
                value={draft.residualMixKgPerKwh || ''}
                onChange={(event) =>
                  setDraft({ ...draft, residualMixKgPerKwh: Number(event.target.value) })
                }
                disabled={!canEdit}
                className={inputClass}
              />
            </Field>
          </div>
          {!canEdit ? (
            <p className="mt-3 text-sm text-muted">Only an administrator can change these settings.</p>
          ) : (
            <button type="submit" className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
              Save settings
            </button>
          )}
          {status ? <p className="mt-3 text-sm font-medium text-accent-dark">{status}</p> : null}
        </section>
      </form>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Year-end close</h2>
        <p className="mt-1 text-sm text-muted">
          Closing {year} stops new logs, deletes, and bulk uploads for that calendar year. Reopen only
          to correct a genuine error — the change is written to the activity log.
        </p>
        {profile.lockedYears.length > 0 ? (
          <p className="mt-2 text-sm">
            Closed years: <strong>{profile.lockedYears.join(', ')}</strong>
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">No years are closed yet.</p>
        )}
        {canEdit ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium">
              Reason
              <input
                value={lockReason}
                onChange={(event) => setLockReason(event.target.value)}
                placeholder={closed ? 'Why reopen?' : 'Why close?'}
                className="mt-1 block w-72 rounded-md border border-line px-3 py-2 text-sm font-normal"
              />
            </label>
            <button
              type="button"
              disabled={lockBusy}
              onClick={() => void toggleLock()}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                closed ? 'bg-brand' : 'bg-red-700'
              }`}
            >
              {closed ? <Unlock size={15} /> : <Lock size={15} />}
              {lockBusy ? 'Saving…' : closed ? `Reopen ${year}` : `Close ${year}`}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block text-sm font-semibold text-ink">
      {label}
      {children}
      {hint ? <span className="mt-1 block text-xs font-normal leading-5 text-muted">{hint}</span> : null}
    </label>
  )
}

const inputClass =
  'mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm font-normal disabled:opacity-60'
