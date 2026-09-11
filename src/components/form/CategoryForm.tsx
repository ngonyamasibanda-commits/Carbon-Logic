import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CloudUpload, Grid2x2, Play } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { adjacentCategory, unitOptionsFor } from '../../lib/categories'
import { lookupFactor } from '../../lib/calculate'
import { workingFromForm, computeWorking } from '../../lib/emissions'
import {
  conversionToPerTonne,
  epdMaterialForKey,
  factorFromEpd,
  isEpdRequiredKey,
  isEpdRequiredOption,
  EPD_DECLARED_UNITS,
} from '../../lib/epd-materials'
import { formatNumber, formatTco2e } from '../../lib/format'
import { CATEGORY_ICONS } from '../../lib/icons'
import { useEntries } from '../../lib/entries-context'
import { useAuth } from '../../lib/auth-context'
import { emptyAdditional, type AdditionalState, type CategoryConfig } from '../../lib/types'
import AdditionalData from './AdditionalData'
import BulkUpload from './BulkUpload'
import ResultsTable from './ResultsTable'
import Tutorial from './Tutorial'
import Callout from '../ui/Callout'
import { useOrg } from '../../providers/OrgProvider'
import { isYearLocked, yearFromIsoDate } from '../../lib/period-lock'
import {
  customFieldsWithScope2,
  dualFromActivity,
  instrumentFromForm,
} from '../../lib/scope2'

type Props = {
  category: CategoryConfig
}

export default function CategoryForm({ category }: Props) {
  const { entries, factors, addEntry, removeEntry, saveFactors } = useEntries()
  const { can } = useAuth()
  const { profile } = useOrg()
  const canWrite = can('entries:write')
  const canWriteFactors = can('factors:write')
  const navigate = useNavigate()
  const { prev, next } = adjacentCategory(category.id)
  const Icon = CATEGORY_ICONS[category.id]

  // Initialise default units from the category's unitOptions
  const defaultValues = useMemo(() => {
    const init: Record<string, string> = {}
    // Category-level unit default
    if (category.unitOptions?.length) {
      init['unit'] = category.unitOptions[0].value
      init['unit_factor'] = String(category.unitOptions[0].toBase)
    }
    // Field-level unit defaults
    for (const field of category.fields) {
      if (field.unitOptions?.length) {
        init[`${field.key}_unit`] = field.unitOptions[0].value
        init[`${field.key}_unit_factor`] = String(field.unitOptions[0].toBase)
      }
    }
    return init
  }, [category])

  const [values, setValues] = useState<Record<string, string>>(defaultValues)
  // Reset form whenever the category changes
  useEffect(() => {
    setValues(defaultValues)
    setAdditional(emptyAdditional())
    // defaultValues is memoised on category; only re-run when category changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.id])
  const [additional, setAdditional] = useState<AdditionalState>(emptyAdditional)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [showBulk, setShowBulk] = useState(false)

  const categoryEntries = useMemo(
    () => entries.filter((entry) => entry.category === category.id),
    [entries, category.id],
  )
  const activityYearLocked = isYearLocked(profile.lockedYears, yearFromIsoDate(additional.activity_date))
  const liveUnits = unitOptionsFor(category, values) ?? category.unitOptions

  const liveFactorKey = category.resolveFactorKey(values)
  const liveCustom = Number(values.conversion) || undefined
  const liveFactor = lookupFactor(factors, liveFactorKey, liveCustom)
  const liveWorking =
    liveFactor && Number(values[category.amountField] || values.amount)
      ? workingFromForm(category, values, liveFactor)
      : null

  useEffect(() => {
    const options = unitOptionsFor(category, values)
    if (!options?.length) return
    if (options.some((row) => row.value === values.unit)) return
    setValues((prev) => ({
      ...prev,
      unit: options[0].value,
      unit_factor: String(options[0].toBase),
    }))
    // only when fuel/source selection changes the unit set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.fuel, values.source, category.id])

  function setField(key: string, value: string) {
    setValues((prevValues) => ({ ...prevValues, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    const factorKey = category.resolveFactorKey(values)
    const needsEpd = isEpdRequiredKey(factorKey) && isEpdRequiredOption(values.material || '')
    const epdGwp = Number(values.epd_gwp)
    const epdPerTonne = needsEpd && !factors.get(factorKey)
      ? conversionToPerTonne(epdGwp, values.epd_declared || 'kg')
      : undefined
    const customConversion = Number(values.conversion) || epdPerTonne || undefined
    let factor = lookupFactor(factors, factorKey, customConversion)

    if (needsEpd && !factors.get(factorKey) && epdPerTonne) {
      factor = factorFromEpd({
        key: factorKey,
        name: epdMaterialForKey(factorKey)?.name,
        conversionValue: epdPerTonne,
        source: values.epd_source || 'Environmental Product Declaration (EN 15804 A1–A3)',
        sourceUrl: values.epd_url,
      })
    }

    if (!factor) {
      setError(
        needsEpd
          ? 'This material needs an EPD or user factor. Enter the A1–A3 GWP below, or import an EPD spreadsheet on Emission factors.'
          : `Factor needed for ${factorKey}. Add it to emission_factors (value, unit, source) before this activity can be calculated.`,
      )
      return
    }

    const working = workingFromForm(category, values, factor)
    if (working.error || !Number.isFinite(working.tco2e) || working.tco2e < 0 || working.activityAmount <= 0) {
      setError(working.error ?? 'Enter a valid activity amount greater than zero.')
      return
    }
    const activityAmount = working.activityAmount
    const totalTco2e = working.tco2e
    const activityYear = yearFromIsoDate(additional.activity_date)
    if (isYearLocked(profile.lockedYears, activityYear)) {
      setError(
        `Reporting year ${activityYear} is closed. An administrator can reopen it from Organisation settings.`,
      )
      return
    }

    let emissions = totalTco2e
    let detailsExtra = ''
    let customFields = additional.customFields
    if (category.id === 'site_electricity') {
      const grid = lookupFactor(factors, 'electricity_grid_kwh')
      const locationKg = factor.key === 'electricity_renewable_kwh' ? 0 : (grid?.conversionValue ?? factor.conversionValue)
      const instrument = instrumentFromForm(values.source || '', values.market_instrument || '')
      const dual = dualFromActivity({
        kwh: activityAmount,
        locationKg,
        instrument,
        residualMixKg: profile.residualMixKgPerKwh,
        supplierKg: Number(values.supplier_kg),
      })
      emissions = dual.meta.locationTco2e
      customFields = customFieldsWithScope2(additional.customFields, dual.meta)
      detailsExtra = ` | Scope 2 location ${formatTco2e(dual.meta.locationTco2e, true)}; market ${formatTco2e(dual.meta.marketTco2e, true)} (${dual.meta.instrument})`
    } else if (category.id === 'heat_steam') {
      const dual = dualFromActivity({
        kwh: activityAmount,
        locationKg: factor.conversionValue,
        instrument: Number(values.supplier_kg) > 0 ? 'supplier-specific' : 'residual-mix',
        residualMixKg: 0,
        supplierKg: Number(values.supplier_kg) || factor.conversionValue,
      })
      emissions = dual.meta.locationTco2e
      customFields = customFieldsWithScope2(additional.customFields, dual.meta)
    }

    setSubmitting(true)
    try {
      if (
        needsEpd &&
        !factors.get(factorKey) &&
        canWriteFactors &&
        values.epd_save !== '0' &&
        factor.sourceFamily === 'EPD'
      ) {
        const next = new Map(factors)
        next.set(factor.key, factor)
        await saveFactors([...next.values()])
      }
      await addEntry({
        category: category.id,
        scope: category.scope,
        emissions_tco2e: emissions,
        details: `${category.resolveDetails(values, activityAmount)}${
          factor.isPlaceholder ? ' [PLACEHOLDER factor]' : ''
        } | ${working.formula} | Factor: ${factor.name} (${factor.sourceFamily}${factor.source && factor.source !== factor.sourceFamily ? ' — ' + factor.source : ''})${detailsExtra}`,
        amount: activityAmount,
        unit: category.resolveUnit(values),
        link: additional.link,
        comment: additional.comment,
        site: additional.site,
        tags: additional.tags,
        customFields,
        files: [],
        activity_date: additional.activity_date,
      })
      const extras: string[] = []
      if (values.include_td === '1' && factor.tdKey) {
        const td = lookupFactor(factors, factor.tdKey)
        if (td) {
          const extra = computeWorking(td, activityAmount)
          await addEntry({
            category: category.id,
            scope: td.scope,
            emissions_tco2e: extra.tco2e,
            details: `T&D chain for ${category.resolveDetails(values, activityAmount)} | ${extra.formula} | Factor: ${td.name}`,
            amount: activityAmount,
            unit: td.unit,
            link: additional.link,
            comment: additional.comment,
            site: additional.site,
            tags: additional.tags,
            customFields: additional.customFields,
            files: [],
            activity_date: additional.activity_date,
          })
          extras.push(`T&D ${formatTco2e(extra.tco2e, true)}`)
        }
      }
      if (values.include_wtt === '1' && factor.wttKey) {
        const wtt = lookupFactor(factors, factor.wttKey)
        if (wtt) {
          const extra = computeWorking(wtt, activityAmount)
          await addEntry({
            category: category.id,
            scope: wtt.scope,
            emissions_tco2e: extra.tco2e,
            details: `WTT chain for ${category.resolveDetails(values, activityAmount)} | ${extra.formula} | Factor: ${wtt.name}`,
            amount: activityAmount,
            unit: wtt.unit,
            link: additional.link,
            comment: additional.comment,
            site: additional.site,
            tags: additional.tags,
            customFields: additional.customFields,
            files: [],
            activity_date: additional.activity_date,
          })
          extras.push(`WTT ${formatTco2e(extra.tco2e, true)}`)
        }
      }
      setMessage(
        `Added ${formatTco2e(emissions, true)} to your footprint${extras.length ? `; also ${extras.join(', ')}` : ''}.`,
      )
      setValues(defaultValues)
      setAdditional(emptyAdditional())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save entry.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {!canWrite ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You have read-only access, so this form is disabled. Ask an administrator for the editor
          role to log emissions data.
        </p>
      ) : null}
      {activityYearLocked ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Reporting year {yearFromIsoDate(additional.activity_date)} is closed. Change the activity
          date to an open year, or ask an administrator to reopen it from Organisation settings.
        </p>
      ) : null}
      {showTutorial ? (
        <Tutorial categoryName={category.name} onClose={() => setShowTutorial(false)} />
      ) : null}
      {showBulk ? <BulkUpload category={category} onClose={() => setShowBulk(false)} /> : null}

      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          {Icon ? <Icon size={28} className="text-brand" /> : null}
          <h1 className="text-3xl font-bold text-ink">{category.name}</h1>
        </div>
        <div className="flex gap-3 text-sm text-brand">
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:underline"
            onClick={() => setShowTutorial(true)}
          >
            <Play size={14} /> Tutorial
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:underline"
            onClick={() => setShowBulk(true)}
          >
            <CloudUpload size={14} /> Bulk Upload
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
          <form id={`${category.id}-form`} onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold text-ink">Instructions</h2>
            <p className="text-sm leading-6 text-muted">{category.instructions}</p>
            {category.id === 'bulk_materials' ? (
              <div className="space-y-2">
                <Callout tone="info">
                  Concrete, timber, asphalt, aggregates, bricks, insulation, plasterboard, glass, and
                  PVC use DESNZ 2026 published factors. Steel, rebar, cement, aluminium, copper, lime,
                  and grinding media do not — paste an EPD A1–A3 GWP, or import EPDs on{' '}
                  <Link to="/factors" className="font-semibold underline">
                    Emission factors
                  </Link>
                  .
                </Callout>
              </div>
            ) : null}
            {category.fields.map((field) => {
              if (field.key === 'hotel_country' && values.type !== 'Hotel') return null
              if (field.key === 'passengers' && values.type === 'Hotel') return null
              return (
              <label key={field.key} className="block text-sm font-semibold text-ink">
                {field.label}
                {field.type === 'select' ? (
                  <select
                    value={values[field.key] ?? ''}
                    onChange={(event) => setField(field.key, event.target.value)}
                    className="mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm font-normal"
                    required={field.key !== 'rf'}
                  >
                    <option value="">Select an option</option>
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                        {category.id === 'bulk_materials' && isEpdRequiredOption(option)
                          ? ' — EPD required'
                          : ''}
                      </option>
                    ))}
                  </select>
                ) : field.unitOptions?.length ? (
                  // Number field with inline unit selector
                  <div className="mt-1 flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={values[field.key] ?? ''}
                      placeholder={field.placeholder}
                      onChange={(event) => setField(field.key, event.target.value)}
                      className="min-w-0 flex-1 rounded-md border border-line bg-page px-3 py-2 text-sm font-normal"
                      required
                    />
                    <select
                      value={values[`${field.key}_unit`] ?? field.unitOptions[0].value}
                      onChange={(event) => {
                        const chosen = field.unitOptions!.find(
                          (u) => u.value === event.target.value,
                        )
                        setField(`${field.key}_unit`, event.target.value)
                        setField(
                          `${field.key}_unit_factor`,
                          String(chosen?.toBase ?? 1),
                        )
                      }}
                      className="w-36 shrink-0 rounded-md border border-line bg-page px-2 py-2 text-sm font-normal"
                    >
                      {field.unitOptions.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    min={field.type === 'number' ? 0 : undefined}
                    step={field.type === 'number' ? 'any' : undefined}
                    value={values[field.key] ?? ''}
                    placeholder={field.placeholder}
                    onChange={(event) => setField(field.key, event.target.value)}
                    className="mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm font-normal"
                    required={field.key !== 'passengers'}
                  />
                )}
                {field.hint ? (
                  <span className="mt-1 block text-xs font-normal text-muted">{field.hint}</span>
                ) : null}
              </label>
            )})}
            {category.id === 'site_electricity' &&
            (values.source || '').toLowerCase().includes('purchased') ? (
              <Scope2MarketFields
                values={values}
                setField={setField}
                residualMixKg={profile.residualMixKgPerKwh}
              />
            ) : null}
            {isEpdRequiredOption(values.material || '') ? (
              <EpdFields
                factorKey={category.resolveFactorKey(values)}
                existing={factors.get(category.resolveFactorKey(values))}
                values={values}
                setField={setField}
                canWriteFactors={canWriteFactors}
              />
            ) : null}
            {/* Category-level unit selector (for single-amount categories) */}
            {liveUnits?.length ? (
              <label className="block text-sm font-semibold text-ink">
                Unit of measure
                <select
                  value={values['unit'] ?? liveUnits[0].value}
                  onChange={(event) => {
                    const chosen = liveUnits.find(
                      (u) => u.value === event.target.value,
                    )
                    setField('unit', event.target.value)
                    setField('unit_factor', String(chosen?.toBase ?? 1))
                  }}
                  className="mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm font-normal"
                >
                  {liveUnits.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-muted">
                  Converted to the published factor unit ({liveFactor?.unit || category.amountLabel}) before the kg→tonne step.
                </span>
              </label>
            ) : null}
            {category.chainExtras?.includes('td') ? (
              <label className="flex items-start gap-2 text-sm font-normal text-ink">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={values.include_td === '1'}
                  onChange={(event) => setField('include_td', event.target.checked ? '1' : '0')}
                />
                Also add UK transmission and distribution losses as a separate Scope 3 line (same kWh × T&D factor ÷ 1,000).
              </label>
            ) : null}
            {category.chainExtras?.includes('wtt') ? (
              <label className="flex items-start gap-2 text-sm font-normal text-ink">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={values.include_wtt === '1'}
                  onChange={(event) => setField('include_wtt', event.target.checked ? '1' : '0')}
                />
                Also add well-to-tank (fuel/electricity supply chain) as a separate Scope 3 line.
              </label>
            ) : null}
            {liveWorking && !liveWorking.error && liveWorking.activityAmount > 0 ? (
              <div className="rounded-md border border-brand/30 bg-brand-soft/40 p-3 text-sm">
                <p className="font-semibold text-ink">Calculation working</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
                  {liveWorking.steps.map((step) => (
                    <li key={step.label}>
                      <span className="text-ink">{step.label}:</span> {step.value}
                    </li>
                  ))}
                </ol>
                <p className="mt-2 font-medium text-brand">{liveWorking.formula}</p>
              </div>
            ) : null}
          </form>

          <AdditionalData value={additional} onChange={setAdditional} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {prev ? (
          <button
            type="button"
            onClick={() => navigate(`/input/${prev.id}`)}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm"
          >
            ← Back to {prev.name}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/input')}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm"
          >
            ← Back to data input
          </button>
        )}

        <button
          form={`${category.id}-form`}
          type="submit"
          disabled={submitting || !canWrite || activityYearLocked}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          <Grid2x2 size={16} />
          {submitting ? 'Saving…' : 'Calculate & add to footprint'}
        </button>

        <div className="text-right">
          {next ? (
            <button
              type="button"
              onClick={() => navigate(`/input/${next.id}`)}
              className="rounded-md border border-line bg-white px-4 py-2 text-sm"
            >
              Next to {next.name} →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/analysis')}
              className="rounded-md border border-line bg-white px-4 py-2 text-sm"
            >
              Next to Analysis →
            </button>
          )}
          <div>
            <Link to="/analysis" className="text-sm text-sky-700 hover:underline">
              Go to results
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-md border border-brand/30 bg-brand-soft px-4 py-3 text-sm text-brand-dark">
          {message}
        </p>
      ) : null}

      <ResultsTable
        entries={categoryEntries}
        lockedYears={profile.lockedYears}
        canDelete={canWrite}
        onDelete={(id) => void removeEntry(id)}
      />
    </div>
  )
}

function Scope2MarketFields({
  values,
  setField,
  residualMixKg,
}: {
  values: Record<string, string>
  setField: (key: string, value: string) => void
  residualMixKg: number
}) {
  const instrument = values.market_instrument || ''
  return (
    <div className="space-y-3 rounded-md border border-brand/30 bg-brand-soft/40 p-3">
      <Callout tone="info">
        Location-based Scope 2 always uses the DESNZ 2026 UK grid factor. Market-based Scope 2 uses
        the instrument below, as required for SECR dual reporting.
      </Callout>
      <label className="block text-sm font-semibold text-ink">
        Market-based instrument
        <select
          value={instrument}
          onChange={(event) => setField('market_instrument', event.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm font-normal"
          required
        >
          <option value="">Select an option</option>
          <option value="None — residual mix">None — residual mix</option>
          <option value="Supplier-specific factor (bill / PPA)">
            Supplier-specific factor (bill / PPA)
          </option>
          <option value="REGO or 100% renewable tariff">REGO or 100% renewable tariff</option>
        </select>
      </label>
      {instrument.toLowerCase().includes('supplier') ? (
        <label className="block text-sm font-semibold text-ink">
          Supplier-specific kg CO₂e per kWh
          <input
            type="number"
            min={0}
            step="any"
            required
            value={values.supplier_kg ?? ''}
            placeholder="From the contract or PPA"
            onChange={(event) => setField('supplier_kg', event.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm font-normal"
          />
        </label>
      ) : null}
      {instrument.toLowerCase().includes('residual') && residualMixKg <= 0 ? (
        <p className="text-xs text-amber-900">
          No GB residual mix is set yet. Market-based will equal location-based until an
          administrator enters the AIB figure in Organisation settings, or you choose a supplier
          factor or REGO.
        </p>
      ) : null}
    </div>
  )
}

function EpdFields({
  factorKey,
  existing,
  values,
  setField,
  canWriteFactors,
}: {
  factorKey: string
  existing: import('../../lib/types').EmissionFactor | undefined
  values: Record<string, string>
  setField: (key: string, value: string) => void
  canWriteFactors: boolean
}) {
  const spec = epdMaterialForKey(factorKey)
  if (existing) {
    return (
      <Callout tone="info">
        Using your organisation factor for {spec?.name ?? existing.name}:{' '}
        <span className="font-semibold tabular-nums">
          {formatNumber(existing.conversionValue)} kg CO₂e/t
        </span>
        {existing.source ? ` — ${existing.source}` : ''}. To use a different EPD, edit this key on{' '}
        <Link to="/factors" className="font-semibold underline">
          Emission factors
        </Link>
        .
      </Callout>
    )
  }
  return (
    <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50/60 p-3">
      <Callout tone="tip">
        Ask the supplier for an EN 15804 EPD. Copy Global Warming Potential (GWP) for modules A1–A3.
        Most steel, rebar, cement, aluminium, copper, and lime EPDs print this as kg CO₂e per kg —
        enter that number and we convert it to per tonne.
      </Callout>
      <label className="block text-sm font-semibold text-ink">
        EPD GWP (A1–A3)
        <div className="mt-1 flex gap-2">
          <input
            type="number"
            min={0}
            step="any"
            required
            value={values.epd_gwp ?? ''}
            placeholder="e.g. 1.55"
            onChange={(event) => setField('epd_gwp', event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm font-normal"
          />
          <select
            value={values.epd_declared || 'kg'}
            onChange={(event) => setField('epd_declared', event.target.value)}
            className="w-56 shrink-0 rounded-md border border-line bg-white px-2 py-2 text-sm font-normal"
          >
            {EPD_DECLARED_UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </div>
      </label>
      <label className="block text-sm font-semibold text-ink">
        EPD name or number
        <input
          type="text"
          required
          value={values.epd_source ?? ''}
          placeholder="e.g. EPD-XYZ-2026, EN 15804"
          onChange={(event) => setField('epd_source', event.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm font-normal"
        />
      </label>
      <label className="block text-sm font-semibold text-ink">
        EPD URL (optional)
        <input
          type="url"
          value={values.epd_url ?? ''}
          placeholder="https://"
          onChange={(event) => setField('epd_url', event.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm font-normal"
        />
      </label>
      {canWriteFactors ? (
        <label className="flex items-center gap-2 text-sm font-normal text-ink">
          <input
            type="checkbox"
            checked={values.epd_save !== '0'}
            onChange={(event) => setField('epd_save', event.target.checked ? '1' : '0')}
          />
          Save this EPD to the organisation factor library so the next load of this material
          does not need the GWP again.
        </label>
      ) : (
        <p className="text-xs text-muted">
          This entry will use the EPD GWP you typed. Ask an admin to import it on Emission factors
          if the whole organisation should reuse it.
        </p>
      )}
    </div>
  )
}
