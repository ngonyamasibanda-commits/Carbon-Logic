import { useState } from 'react'
import { X } from 'lucide-react'
import { buildTemplate, parseCsv } from '../../lib/csv'
import { lookupFactor } from '../../lib/calculate'
import { workingFromForm } from '../../lib/emissions'
import { downloadText } from '../../lib/export'
import type { CategoryConfig, EmissionEntry } from '../../lib/types'
import { emptyAdditional } from '../../lib/types'
import { useEntries } from '../../lib/entries-context'

type Props = {
  category: CategoryConfig
  onClose: () => void
}

export default function BulkUpload({ category, onClose }: Props) {
  const { factors, addEntry } = useEntries()
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const headers = [
    ...category.fields.map((field) => field.key),
    'site',
    'comment',
    'link',
    'tags',
    'activity_date',
  ]

  function downloadTemplate() {
    downloadText(`${category.id}-template.csv`, buildTemplate(headers), 'text/csv')
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setStatus(null)
    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length === 0) {
      setError('No data rows found. Use the template and include a header row.')
      return
    }

    setImporting(true)
    let imported = 0
    let skipped = 0
    const failures: string[] = []

    for (const [index, row] of rows.entries()) {
      const values = { ...row }
      const factor = lookupFactor(
        factors,
        category.resolveFactorKey(values),
        Number(values.conversion),
      )
      const working = factor ? workingFromForm(category, values, factor) : null

      if (!working || working.error || working.activityAmount <= 0 || !factor) {
        skipped += 1
        failures.push(
          `Row ${index + 2}: ${
            !factor
              ? 'factor needed — add an EPD on Emission factors, or include a conversion column'
              : working?.error || 'invalid amount'
          }`,
        )
        continue
      }

      const extras = emptyAdditional()
      extras.site = values.site ?? ''
      extras.comment = values.comment ?? ''
      extras.link = values.link ?? ''
      extras.tags = (values.tags ?? '')
        .split(/[;|]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
      extras.activity_date = (values.activity_date || extras.activity_date).slice(0, 10)
      extras.files = []

      const entry: Omit<EmissionEntry, 'id' | 'created_at'> = {
        category: category.id,
        scope: category.resolveScope?.(values) ?? category.scope,
        emissions_tco2e: working.tco2e,
        details: `${category.resolveDetails(values, working.activityAmount)}${
          factor.isPlaceholder ? ' [PLACEHOLDER factor]' : ''
        } | ${working.formula} | Factor: ${factor.name} (${factor.sourceFamily}${factor.source && factor.source !== factor.sourceFamily ? ' — ' + factor.source : ''})`,
        amount: working.activityAmount,
        unit: category.resolveUnit(values),
        ...extras,
      }

      try {
        await addEntry(entry)
        imported += 1
      } catch (err) {
        skipped += 1
        failures.push(`Row ${index + 2}: ${err instanceof Error ? err.message : 'could not save'}`)
      }
    }

    setImporting(false)
    setStatus(`${imported} rows imported, ${skipped} skipped.`)
    if (failures.length) setError(failures.slice(0, 5).join(' · '))
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Bulk Upload — {category.name}</h2>
            <p className="mt-1 text-sm text-muted">
              Import a CSV. Invalid rows are skipped so the rest still save. Steel, rebar, cement,
              aluminium, copper, lime, and grinding media need an EPD factor in the library first,
              or a conversion column on the row.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-md border border-line px-3 py-2"
          >
            Download CSV template
          </button>
          <input
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          {importing ? <p className="text-muted">Importing…</p> : null}
          {status ? <p className="text-brand-dark">{status}</p> : null}
          {error ? <p className="text-red-700">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}
