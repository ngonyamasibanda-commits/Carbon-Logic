import { useMemo, useState, type FormEvent } from 'react'
import { CloudUpload, Grid2x2, Play } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { adjacentCategory } from '../../lib/categories'
import { calculateTco2e, lookupFactor } from '../../lib/calculate'
import { CATEGORY_ICONS } from '../../lib/icons'
import { useEntries } from '../../lib/entries-context'
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
  const navigate = useNavigate()
  const { prev, next } = adjacentCategory(category.id)
  const Icon = CATEGORY_ICONS[category.id]

  const [values, setValues] = useState<Record<string, string>>({})
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

    const amount = Number(values[category.amountField] ?? values.amount)
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
      setValues({})
      setAdditional(emptyAdditional())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save entry.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
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
          disabled={submitting}
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
