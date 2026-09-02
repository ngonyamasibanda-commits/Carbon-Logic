import { getCategory } from './categories'
import type { EmissionEntry } from './types'

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

export function entriesToCsv(entries: EmissionEntry[]) {
  const header = [
    'Date',
    'Category',
    'Scope',
    'Site',
    'Emissions_tCO2e',
    'Amount',
    'Unit',
    'Details',
    'Comment',
    'Tags',
    'Link',
  ]
  const rows = entries.map((entry) =>
    [
      entry.created_at,
      getCategory(entry.category)?.name ?? entry.category,
      entry.scope,
      entry.site,
      entry.emissions_tco2e.toFixed(4),
      entry.amount ?? '',
      entry.unit,
      entry.details,
      entry.comment,
      entry.tags.join('; '),
      entry.link,
    ].map((value) => csvEscape(String(value))),
  )
  return [header.join(','), ...rows.map((row) => row.join(','))].join('\n')
}

export function downloadText(filename: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadCsv(filename: string, entries: EmissionEntry[]) {
  downloadText(filename, entriesToCsv(entries), 'text/csv')
}

export function printReport(title: string, entries: EmissionEntry[]) {
  const total = entries.reduce((sum, row) => sum + row.emissions_tco2e, 0)
  const rows = entries
    .map(
      (entry) => `
      <tr>
        <td>${entry.created_at.slice(0, 10)}</td>
        <td>${getCategory(entry.category)?.name ?? entry.category}</td>
        <td>${entry.scope}</td>
        <td>${entry.site || '—'}</td>
        <td>${entry.emissions_tco2e.toFixed(4)}</td>
        <td>${entry.details}</td>
      </tr>`,
    )
    .join('')

  const html = `<!doctype html>
<html><head><title>${title}</title>
<style>
  body { font-family: Inter, sans-serif; padding: 24px; color: #1f2933; }
  h1 { margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
  th { background: #f4f5f7; }
</style></head>
<body>
  <h1>${title}</h1>
  <p>Total: <strong>${total.toFixed(4)} tCO2e</strong> · ${entries.length} entries</p>
  <table>
    <thead><tr><th>Date</th><th>Category</th><th>Scope</th><th>Site</th><th>tCO2e</th><th>Details</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`

  const popup = window.open('', '_blank', 'width=900,height=700')
  if (!popup) return
  popup.document.write(html)
  popup.document.close()
  popup.focus()
  popup.print()
}
