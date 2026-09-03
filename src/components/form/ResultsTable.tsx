import { Paperclip, Trash2 } from 'lucide-react'
import { safeDownloadUrl } from '../../lib/safe'
import type { EmissionEntry } from '../../lib/types'

type Props = {
  entries: EmissionEntry[]
  onDelete: (id: string) => void
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return date.toISOString().slice(0, 10)
}

export default function ResultsTable({ entries, onDelete }: Props) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-bold text-ink">Results</h2>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-page text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Date Added</th>
              <th className="px-4 py-3 font-semibold">Emissions (tCO2e)</th>
              <th className="px-4 py-3 font-semibold">Details</th>
              <th className="px-4 py-3 font-semibold">Site / Tags</th>
              <th className="px-4 py-3 font-semibold">Comment</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No entries, please add some data above.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="border-t border-line">
                  <td className="px-4 py-3">{formatDate(entry.created_at)}</td>
                  <td className="px-4 py-3 font-semibold">
                    {entry.emissions_tco2e.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const parts = entry.details.split(' | ')
                      const activity = parts[0]
                      const calc = parts.length > 1 ? parts[1] : null
                      const factorSource = parts.length > 2 ? parts[2] : null
                      return (
                        <>
                          <div>{activity}</div>
                          {calc ? (
                            <div className="mt-1 font-mono text-xs text-muted">{calc}</div>
                          ) : null}
                          {factorSource ? (
                            <div className="mt-0.5 text-xs text-brand-mid">{factorSource}</div>
                          ) : null}
                        </>
                      )
                    })()}
                    {entry.customFields.length > 0 ? (
                      <div className="mt-1 text-xs text-muted">
                        {entry.customFields
                          .filter((field) => field.label)
                          .map((field) => `${field.label}: ${field.value}`)
                          .join(' · ')}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div>{entry.site || '—'}</div>
                    <div className="mt-1 text-violet-700">{entry.tags.join(', ') || ''}</div>
                    {entry.files.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1 text-sky-700">
                        {entry.files.map((file) => {
                          const href = safeDownloadUrl(file.dataUrl)
                          if (!href) return null
                          return (
                          <a
                            key={file.name}
                            href={href}
                            download={file.name}
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <Paperclip size={11} />
                            {file.name}
                          </a>
                          )
                        })}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{entry.comment || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onDelete(entry.id)}
                      className="text-red-600 hover:text-red-700"
                      aria-label="Delete entry"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
