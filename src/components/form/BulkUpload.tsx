import { useMemo, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { parseCsv } from '../../lib/csv'
import {
  activityAmountFromBulkRow,
  buildCategoryTemplate,
  bulkColumnsForCategory,
  formatBulkCellError,
  prepareBulkRow,
} from '../../lib/bulk-upload'
import { calculateTco2e, lookupFactor } from '../../lib/calculate'
import { downloadText } from '../../lib/export'
import type { CategoryConfig, EmissionEntry } from '../../lib/types'
import { emptyAdditional } from '../../lib/types'
import { useEntries } from '../../lib/entries-context'
import { useToast } from '../../lib/toast-context'

type Props = {
  category: CategoryConfig
  onClose: () => void
}

export default function BulkUpload({ category, onClose }: Props) {
  const { factors, addEntry } = useEntries()
  const toast = useToast()
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const columns = useMemo(() => bulkColumnsForCategory(category), [category])
  const requiredHints = useMemo(
    () =>
      columns
        .filter((column) => column.kind !== 'meta')
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
    setFileName(file.name)
    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length === 0) {
      const message = 'No data rows found. Download the template and keep the header row.'
      setError(message)
      toast.error(message)
      return
    }

    setImporting(true)
    let imported = 0
    let skipped = 0
    const failures: string[] = []

    for (const [index, row] of rows.entries()) {
      const spreadsheetRow = index + 2
      const { values, errors } = prepareBulkRow(row, category, spreadsheetRow)
      if (errors.length > 0) {
        skipped += 1
        for (const cellError of errors) {
          failures.push(formatBulkCellError(category, cellError))
        }
        continue
      }

      const activityAmount = activityAmountFromBulkRow(values, category)
      if (!Number.isFinite(activityAmount) || activityAmount <= 0) {
        skipped += 1
        failures.push(
          formatBulkCellError(category, {
            row: spreadsheetRow,
            column: columnIndexHint(category, category.amountField),
            header: columns.find((column) => column.key === category.amountField)?.header ?? category.amountField,
            value: values[category.amountField] ?? '',
            message: 'enter a valid activity amount greater than zero.',
          }),
        )
        continue
      }

      const factorKey = category.resolveFactorKey(values)
      const factor = lookupFactor(factors, factorKey, Number(values.conversion))
      if (!factor) {
        skipped += 1
        failures.push(
          `${category.name} — Row ${spreadsheetRow}: no emission factor for “${factorKey}”. Check select values match the form options.`,
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

      const totalTco2e = calculateTco2e(activityAmount, factor.conversionValue)
      const entry: Omit<EmissionEntry, 'id' | 'created_at'> = {
        category: category.id,
        scope: category.resolveScope?.(values) ?? category.scope,
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
        failures.push(
          `${category.name} — Row ${spreadsheetRow}: ${err instanceof Error ? err.message : 'could not save'}`,
        )
      }
    }

    setImporting(false)
    const summary = `${imported} rows imported, ${skipped} skipped.`
    setStatus(summary)
    if (imported > 0) toast.success(summary)
    else toast.error(summary)
    if (failures.length) setError(failures.slice(0, 8).join('\n'))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Bulk Upload — {category.name}</h2>
            <p className="mt-1 text-sm text-muted">
              Download this category’s template, then upload a CSV. Every cell is checked against the
              form rules. Invalid values are listed by row and column and are not calculated.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0">
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
          <div className="rounded-md border border-line bg-page px-3 py-3">
            <p className="mb-2 font-semibold text-ink">Upload completed CSV</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              <Upload size={14} /> Choose file
            </button>
            {fileName ? <p className="mt-2 text-muted">Selected: {fileName}</p> : (
              <p className="mt-2 text-xs text-muted">CSV only. Keep the template header row.</p>
            )}
          </div>
          {importing ? <p className="text-muted">Importing…</p> : null}
          {status ? <p className="text-brand-dark">{status}</p> : null}
          {error ? (
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function columnIndexHint(category: CategoryConfig, key: string): number {
  const index = bulkColumnsForCategory(category).findIndex((column) => column.key === key)
  return index >= 0 ? index + 1 : 1
}
