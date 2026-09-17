import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Circle, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import Tutorial from '../components/form/Tutorial'
import { useAuth } from '../lib/auth-context'
import { useEntries } from '../lib/entries-context'
import { hasSavedSbtiConfig } from '../lib/targets-store'
import { useOrg } from '../providers/OrgProvider'

export default function OrganizationPage() {
  const { organization } = useAuth()
  const { profile, updateProfile, sites } = useOrg()
  const { entries } = useEntries()
  const [showTutorial, setShowTutorial] = useState(false)
  const [saved, setSaved] = useState(false)

  const [organisation, setOrganisation] = useState(profile.organisation || organization?.name || '')
  const [country, setCountry] = useState(profile.country || 'United Kingdom')
  const [turnoverDraft, setTurnoverDraft] = useState(
    profile.annualTurnover ? String(profile.annualTurnover) : '',
  )
  const [baselineDraft, setBaselineDraft] = useState(
    profile.baselineYtdTco2e ? String(profile.baselineYtdTco2e) : '',
  )
  const [intensityMetric, setIntensityMetric] = useState(
    profile.intensityMetric || 'tCO2e per £m turnover',
  )

  useEffect(() => {
    setOrganisation(profile.organisation || organization?.name || '')
    setCountry(profile.country || 'United Kingdom')
    setTurnoverDraft(profile.annualTurnover ? String(profile.annualTurnover) : '')
    setBaselineDraft(profile.baselineYtdTco2e ? String(profile.baselineYtdTco2e) : '')
    setIntensityMetric(profile.intensityMetric || 'tCO2e per £m turnover')
  }, [profile, organization?.name])

  const checklist = useMemo(() => {
    const hasFacility = sites.length > 0
    const hasEmissions = entries.length > 0
    const hasBaseline = (profile.baselineYtdTco2e || 0) > 0
    const hasTurnover = (profile.annualTurnover || 0) > 0
    const hasTarget = hasSavedSbtiConfig(organization?.id)
    return [
      {
        id: 'facility',
        label: 'Add a facility',
        detail: 'Define at least one site, mine, depot, or office under Facilities.',
        done: hasFacility,
        to: '/facilities',
      },
      {
        id: 'emissions',
        label: 'Log first emissions',
        detail: 'Calculate and add at least one activity under Data Input.',
        done: hasEmissions,
        to: '/input',
      },
      {
        id: 'baseline',
        label: 'Set a baseline',
        detail: 'Enter a baseline YTD tCO₂e so the dashboard can show reduction progress.',
        done: hasBaseline,
        to: '#baseline',
      },
      {
        id: 'turnover',
        label: 'Enter annual turnover',
        detail: 'Needed for SECR intensity (tCO₂e per £ million turnover).',
        done: hasTurnover,
        to: '#turnover',
      },
      {
        id: 'target',
        label: 'Save a science-based target',
        detail: 'Configure and save a pathway on Science Based Targets.',
        done: hasTarget,
        to: '/targets',
      },
    ]
  }, [sites.length, entries.length, profile.baselineYtdTco2e, profile.annualTurnover, organization?.id])

  const completeCount = checklist.filter((item) => item.done).length

  function onSave(event: FormEvent) {
    event.preventDefault()
    const turnover = Number(turnoverDraft)
    const baseline = Number(baselineDraft)
    updateProfile({
      ...profile,
      organisation: organisation.trim() || organization?.name || profile.organisation,
      country: country.trim() || profile.country,
      intensityMetric: intensityMetric.trim() || profile.intensityMetric,
      annualTurnover: Number.isFinite(turnover) && turnover > 0 ? turnover : 0,
      baselineYtdTco2e: Number.isFinite(baseline) && baseline > 0 ? baseline : 0,
    })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-6">
      {showTutorial ? (
        <Tutorial topicId="organization" subtitle="Organisation" onClose={() => setShowTutorial(false)} />
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-7">
          <div>
            <h1 className="text-3xl font-semibold text-brand">Organisation</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Record the details used for intensity metrics and reporting, then work through the
              setup checklist. Items tick automatically when the related work is done.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowTutorial(true)}
            className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
          >
            <Play size={14} /> Tutorial
          </button>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-brand to-accent" />
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Reporting setup checklist</h2>
            <p className="mt-1 text-sm text-muted">
              {completeCount} of {checklist.length} complete
            </p>
          </div>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-page">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${(completeCount / checklist.length) * 100}%` }}
            />
          </div>
        </div>
        <ul className="space-y-3">
          {checklist.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line px-4 py-3"
            >
              <div className="flex gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                    item.done ? 'bg-accent text-white' : 'border border-line text-muted'
                  }`}
                  aria-hidden
                >
                  {item.done ? <Check size={14} /> : <Circle size={12} />}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${item.done ? 'text-brand' : 'text-ink'}`}>
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
                </div>
              </div>
              {!item.done ? (
                item.to.startsWith('#') ? (
                  <a href={item.to} className="text-sm text-brand hover:underline">
                    Complete below
                  </a>
                ) : (
                  <Link to={item.to} className="text-sm text-brand hover:underline">
                    Go
                  </Link>
                )
              ) : (
                <span className="text-xs font-medium text-accent-dark">Done</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={onSave} className="rounded-xl border border-line bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-ink">Organisation details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            <span className="text-muted">Organisation name</span>
            <input
              value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            <span className="text-muted">Country</span>
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label id="turnover" className="block scroll-mt-24 text-sm font-medium">
            <span className="text-muted">Annual turnover (£)</span>
            <input
              type="number"
              min={0}
              step="any"
              value={turnoverDraft}
              onChange={(e) => setTurnoverDraft(e.target.value)}
              placeholder="e.g. 25000000"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label id="baseline" className="block scroll-mt-24 text-sm font-medium">
            <span className="text-muted">Baseline YTD tCO₂e</span>
            <input
              type="number"
              min={0}
              step="any"
              value={baselineDraft}
              onChange={(e) => setBaselineDraft(e.target.value)}
              placeholder="e.g. 1200"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium sm:col-span-2">
            <span className="text-muted">Intensity metric label</span>
            <input
              value={intensityMetric}
              onChange={(e) => setIntensityMetric(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
            Save organisation details
          </button>
          {saved ? <span className="text-sm font-medium text-accent-dark">✓ Saved</span> : null}
        </div>
      </form>
    </div>
  )
}
