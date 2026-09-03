import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CloudUpload, Grid2x2, Play } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { adjacentCategory } from '../../lib/categories'
import { calculateTco2e, lookupFactor } from '../../lib/calculate'
import { CATEGORY_ICONS } from '../../lib/icons'
import { useEntries } from '../../lib/entries-context'
import { useAuth } from '../../lib/auth-context'
import { emptyAdditional, type AdditionalState, type CategoryConfig } from '../../lib/types'
import AdditionalData from './AdditionalData'
import BulkUpload from './BulkUpload'
import ResultsTable from './ResultsTable'
import Tutorial from './Tutorial'

type Props = {
  category: CategoryConfig
}

export default function CategoryForm({ category }: Props) {
  const { entries, factors, addEntry, removeEntry } = useEntries()
  const { can } = useAuth()
  const canWrite = can('entries:write')
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

  function setField(key: string, value: string) {
    setValues((prevValues) => ({ ...prevValues, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    const rawAmount = Number(values[category.amountField] ?? values.amount)
    // Apply category-level unit conversion (e.g. m³ → L when factor expects L)
    const unitFactor = Number(values['unit_factor'] ?? 1) || 1
    const amount = rawAmount * unitFactor
    const activityAmount = category.resolveActivityAmount
      ? category.resolveActivityAmount(values, amount)
      : amount

    if (!Number.isFinite(activityAmount) || activityAmount <= 0) {
      setError('Enter a valid activity amount greater than zero.')
      return
    }

    const factorKey = category.resolveFactorKey(values)
    const customConversion = Number(values.conversion)
    const factor = lookupFactor(factors, factorKey, customConversion)

    if (!factor) {
      setError(
        `Factor needed for ${factorKey}. Add it to emission_factors (value, unit, source) before this activity can be calculated.`,
      )
      return
    }

    const totalTco2e = calculateTco2e(activityAmount, factor.conversionValue)
    setSubmitting(true)
    try {
      await addEntry({
        category: category.id,
        scope: category.scope,
        emissions_tco2e: totalTco2e,
        details: `${category.resolveDetails(values, activityAmount)}${
          factor.isPlaceholder ? ' [PLACEHOLDER factor]' : ''
        }`,
        amount: activityAmount,
        unit: category.resolveUnit(values),
        ...additional,
      })
      setMessage(`Added ${totalTco2e.toFixed(4)} tCO2e to your footprint.`)
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
          You have read-only access, so this form is disabled. Ask an admin for the editor role to
          log emissions data.
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
            {category.fields.map((field) => (
              <label key={field.key} className="block text-sm font-semibold text-ink">
                {field.label}
                {field.type === 'select' ? (
                  <select
                    value={values[field.key] ?? ''}
                    onChange={(event) => setField(field.key, event.target.value)}
                    className="mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm font-normal"
                    required
                  >
                    <option value="">Select an option</option>
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
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
                    required
                  />
                )}
                {field.hint ? (
                  <span className="mt-1 block text-xs font-normal text-muted">{field.hint}</span>
                ) : null}
              </label>
            ))}
            {/* Category-level unit selector (for single-amount categories) */}
            {category.unitOptions?.length ? (
              <label className="block text-sm font-semibold text-ink">
                Unit of measure
                <select
                  value={values['unit'] ?? category.unitOptions[0].value}
                  onChange={(event) => {
                    const chosen = category.unitOptions!.find(
                      (u) => u.value === event.target.value,
                    )
                    setField('unit', event.target.value)
                    setField('unit_factor', String(chosen?.toBase ?? 1))
                  }}
                  className="mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm font-normal"
                >
                  {category.unitOptions.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-muted">
                  Values will be converted to the factor&apos;s base unit before calculation.
                </span>
              </label>
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
          disabled={submitting || !canWrite}
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

      <ResultsTable entries={categoryEntries} onDelete={(id) => void removeEntry(id)} />
    </div>
  )
}
