import { downloadCsv, printReport } from '../lib/export'
import { useEntries } from '../lib/entries-context'
import ResultsTable from '../components/form/ResultsTable'

export default function CombinedResultsPage() {
  const { entries, removeEntry } = useEntries()
  const total = entries.reduce((sum, row) => sum + row.emissions_tco2e, 0)

  return (
    <div>
      <h1 className="text-3xl font-bold text-ink">Combined Results</h1>
      <p className="mt-2 text-sm text-muted">
        Every construction and logistics activity logged for this organisation.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 text-sm">
        <div>
          Total footprint: <strong>{total.toFixed(4)} tCO2e</strong> across {entries.length}{' '}
          {entries.length === 1 ? 'entry' : 'entries'}.
        </div>
        <div className="flex gap-3">
          <button type="button" className="text-brand hover:underline" onClick={() => downloadCsv('combined-results.csv', entries)}>
            Export CSV
          </button>
          <button type="button" className="text-brand hover:underline" onClick={() => printReport('Combined results', entries)}>
            Download PDF
          </button>
        </div>
      </div>
      <ResultsTable entries={entries} onDelete={(id) => void removeEntry(id)} />
    </div>
  )
}
