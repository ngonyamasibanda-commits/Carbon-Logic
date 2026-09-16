import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { parseCsv } from '../../lib/csv'
import {
  activityAmountFromBulkRow,
  buildCategoryTemplate,
  bulkColumnsForCategory,
  normalizeBulkRow,
} from '../../lib/bulk-upload'
import { calculateTco2e, lookupFactor } from '../../lib/calculate'
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

  const columns = useMemo(() => bulkColumnsForCategory(category), [category])
  const requiredHints = useMemo(
    () =>
      columns
        .filter((column) => column.key !== 'site' && column.key !== 'comment' && column.key !== 'link' && column.key !== 'tags')
        .map((column) => {
          const options = column.options?.length
            ? ` (${column.options.slice(0, 4).join(' / ')}${column.options.length > 4 ? '…' : ''})`
            : ''
          return `${column.header}${options}`
        }),
    [columns],
  )

  function downloadTemplate() {
    downloadText(`${category.id}-template.csv`, buildCategoryTemplate(category), 'text/csv')
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setStatus(null)
    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length === 0) {
      setError('No data rows found. Download the template and keep the header row.')
      return
    }

    setImporting(true)
    let imported = 0
    let skipped = 0
    const failures: string[] = []

    for (const [index, row] of rows.entries()) {
      const values = normalizeBulkRow(row, category)

      const activityAmount = activityAmountFromBulkRow(values, category)
      if (!Number.isFinite(activityAmount) || activityAmount <= 0) {
        skipped += 1
        failures.push(
          `Row ${index + 2}: Enter a valid activity amount greater than zero (column “${category.amountField}”).`,
        )
        continue
      }

      const factorKey = category.resolveFactorKey(values)
      const factor = lookupFactor(factors, factorKey, Number(values.conversion))
      if (!factor) {
        skipped += 1
        failures.push(
          `Row ${index + 2}: Factor needed for ${factorKey}. Check select values match the form options.`,
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

      const totalTco2e = calculateTco2e(activityAmount, factor.conversionValue)
      const entry: Omit<EmissionEntry, 'id' | 'created_at'> = {
        category: category.id,
        scope: category.scope,
        emissions_tco2e: totalTco2e,
        details: `${category.resolveDetails(values, activityAmount)}${
          factor.isPlaceholder ? ' [PLACEHOLDER factor]' : ''
        } | ${activityAmount.toLocaleString()} ${factor.unit} × ${factor.conversionValue} kg CO₂e/${factor.unit} ÷ 1000 = ${totalTco2e.toFixed(4)} tCO₂e | Factor: ${factor.name} (${factor.sourceFamily}${factor.source && factor.source !== factor.sourceFamily ? ' — ' + factor.source : ''})`,
        amount: activityAmount,
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
              Download this category’s template. It includes every field on the form, plus unit of
              measure where needed, and one example row you can replace or keep.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="mt-3 rounded-md border border-line bg-page px-3 py-2 text-xs text-muted">
          <p className="font-semibold text-ink">Columns in this template</p>
          <p className="mt-1 leading-5">{requiredHints.join(' · ')}</p>
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
