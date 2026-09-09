import { getCategory } from './categories'
import { summarizeInventory, type InventorySummary } from './ghg'
import { escapeHtml } from './safe'
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

export function inventoryToCsv(summary: InventorySummary) {
  const header = ['Scope', 'GHG_code', 'Category', 'tCO2e', 'Percent_of_total', 'Status', 'What_this_is']
  const rows = summary.rows.map((row) =>
    [
      row.scope,
      row.code,
      row.name,
      row.tco2e.toFixed(4),
      row.percent.toFixed(1),
      row.status === 'reported' ? 'Reported' : 'Not yet logged',
      row.plain,
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

export function downloadInventoryCsv(filename: string, entries: EmissionEntry[]) {
  downloadText(filename, inventoryToCsv(summarizeInventory(entries)), 'text/csv')
}

export type ReportContext = {
  organizationName: string
  revenue?: number
}

const REPORT_CSS = `
  :root { color-scheme: light; }
  body { font-family: Inter, system-ui, sans-serif; padding: 32px; color: #0f1e33; max-width: 900px; margin: 0 auto; }
  h1 { margin: 0 0 4px; color: #02234e; font-size: 26px; }
  h2 { margin: 28px 0 10px; color: #02234e; font-size: 16px; border-bottom: 2px solid #6cbe2c; padding-bottom: 6px; }
  .kicker { text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; color: #6cbe2c; font-weight: 700; }
  .muted { color: #64748b; font-size: 13px; }
  .hero { display: flex; gap: 12px; flex-wrap: wrap; margin: 18px 0; }
  .kpi { flex: 1; min-width: 140px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; }
  .kpi strong { display: block; font-size: 22px; color: #02234e; }
  .kpi span { font-size: 12px; color: #64748b; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
  th, td { border: 1px solid #e2e8f0; padding: 7px 8px; text-align: left; vertical-align: top; }
  th { background: #02234e; color: #ffffff; font-weight: 600; }
  tr.section td { background: #f1f5f9; font-weight: 700; }
  .plain { color: #64748b; font-size: 11px; }
  ul { padding-left: 18px; }
  li { margin: 6px 0; line-height: 1.45; }
  .footnote { margin-top: 28px; font-size: 11px; color: #64748b; }
`

function openPrint(title: string, body: string) {
  const html = `<!doctype html>
<html><head><title>${escapeHtml(title)}</title><style>${REPORT_CSS}</style></head>
<body>${body}</body></html>`
  const popup = window.open('', '_blank', 'width=960,height=720')
  if (!popup) return
  popup.document.write(html)
  popup.document.close()
  popup.focus()
  popup.print()
}

function kpi(label: string, value: string) {
  return `<div class="kpi"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`
}

function inventoryTable(summary: InventorySummary) {
  const body = summary.rows
    .map((row) => {
      const status = row.status === 'reported' ? `${row.tco2e.toFixed(2)} tCO₂e` : 'Not yet logged'
      return `<tr>
        <td>${escapeHtml(row.scope)}</td>
        <td>${escapeHtml(row.code)}</td>
        <td>${escapeHtml(row.name)}<div class="plain">${escapeHtml(row.plain)}</div></td>
        <td>${row.status === 'reported' ? status : '—'}</td>
        <td>${row.status === 'reported' ? `${row.percent.toFixed(1)}%` : '—'}</td>
      </tr>`
    })
    .join('')
  return `<table>
    <thead><tr><th>Scope</th><th>GHG Protocol</th><th>Category</th><th>tCO₂e</th><th>% of total</th></tr></thead>
    <tbody>${body}
      <tr class="section"><td colspan="3">Total reported</td><td>${summary.total.toFixed(2)} tCO₂e</td><td>100%</td></tr>
    </tbody>
  </table>`
}

export function printInventoryReport(entries: EmissionEntry[], context: ReportContext) {
  const summary = summarizeInventory(entries)
  const org = context.organizationName || 'Organisation'
  const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const body = `
    <p class="kicker">Carbon Logic · GHG inventory</p>
    <h1>${escapeHtml(org)}</h1>
    <p class="muted">Combined results for reporting · ${escapeHtml(generated)} · ${summary.entryCount} logged ${summary.entryCount === 1 ? 'activity' : 'activities'}</p>
    <div class="hero">
      ${kpi('Total reported', `${summary.total.toFixed(2)} tCO₂e`)}
      ${kpi('Scope 1 (owned fuel & leaks)', `${summary.scope1.toFixed(2)} tCO₂e`)}
      ${kpi('Scope 2 (bought energy)', `${summary.scope2.toFixed(2)} tCO₂e`)}
      ${kpi('Scope 3 (value chain)', `${summary.scope3.toFixed(2)} tCO₂e`)}
    </div>
    <h2>How to read this report</h2>
    <p>Figures are tonnes of carbon dioxide equivalent (tCO₂e). Scope 1 is fuel and leaks you own. Scope 2 is electricity and heat you buy. Scope 3 is everything else in your value chain, labelled with the GHG Protocol’s 15 categories so this table can sit in a SECR, PPN 06/21, or customer questionnaire without translation.</p>
    <h2>Greenhouse Gas Protocol inventory</h2>
    ${inventoryTable(summary)}
    <h2>What the totals mean</h2>
    <ul>${summary.insights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    ${
      summary.bySite.length > 1
        ? `<h2>By site</h2>
    <table><thead><tr><th>Site</th><th>tCO₂e</th><th>% of total</th></tr></thead><tbody>
      ${summary.bySite
        .map(
          (site) =>
            `<tr><td>${escapeHtml(site.name)}</td><td>${site.tco2e.toFixed(2)}</td><td>${site.percent.toFixed(1)}%</td></tr>`,
        )
        .join('')}
    </tbody></table>`
        : ''
    }
    <p class="footnote">Method: tCO₂e = (activity amount × conversion value in kg CO₂e) ÷ 1000. Conversion values are taken from the organisation’s emission-factor library (typically DESNZ/DEFRA and ICE). Empty Scope 3 categories are shown on purpose: “not yet logged” is a completeness signal, not a zero. Categories 8–15 are often not relevant for a typical contractor, miner, or logistics operator.</p>
  `
  openPrint(`${org} — GHG inventory`, body)
}

export function printAnalysisReport(entries: EmissionEntry[], context: ReportContext) {
  const summary = summarizeInventory(entries)
  const org = context.organizationName || 'Organisation'
  const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const intensity =
    context.revenue && context.revenue > 0
      ? `${(summary.total / (context.revenue / 1_000_000)).toFixed(2)} tCO₂e per £ million turnover`
      : 'Add annual revenue in Analysis to calculate the SECR intensity ratio (tCO₂e per £ million).'
  const actions: string[] = []
  if (summary.hotspots[0]) {
    actions.push(
      `Tackle ${summary.hotspots[0].name.toLowerCase()} first — it is ${summary.hotspots[0].percent.toFixed(0)}% of the reported total.`,
    )
  }
  if (summary.gaps[0]) {
    actions.push(
      `Log ${summary.gaps
        .slice(0, 3)
        .map((row) => row.name.toLowerCase())
        .join(', ')} next. These are the material gaps for a construction, mining, or logistics reporter.`,
    )
  }
  actions.push(
    'Keep using activity data (kWh, litres, tonnes, tkm) rather than spend where you can — it is more accurate for customer and framework reporting.',
  )

  const hotspotRows = summary.hotspots
    .map(
      (row, index) =>
        `<tr><td>${index + 1}</td><td>${escapeHtml(row.code)} · ${escapeHtml(row.name)}</td><td>${row.tco2e.toFixed(2)}</td><td>${row.percent.toFixed(1)}%</td></tr>`,
    )
    .join('')

  const coverage = summary.rows.filter((row) => row.scope === 'Scope 3' && row.status === 'reported').length

  const body = `
    <p class="kicker">Carbon Logic · management insights</p>
    <h1>${escapeHtml(org)}</h1>
    <p class="muted">Analysis report · ${escapeHtml(generated)} · for leadership, not a line-by-line ledger</p>
    <div class="hero">
      ${kpi('Reported footprint', `${summary.total.toFixed(2)} tCO₂e`)}
      ${kpi('Under direct control (S1+S2)', `${(summary.scope1 + summary.scope2).toFixed(2)} tCO₂e`)}
      ${kpi('Value chain (Scope 3)', `${summary.scope3.toFixed(2)} tCO₂e`)}
      ${kpi('Scope 3 categories with data', `${coverage} of 15`)}
    </div>
    <h2>Headline findings</h2>
    <ul>${summary.insights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    <h2>Where the emissions sit</h2>
    <p class="muted">These are the largest reported sources. Reducing the top items moves the organisational total; spreading effort across empty categories does not.</p>
    <table>
      <thead><tr><th>#</th><th>Source (GHG Protocol)</th><th>tCO₂e</th><th>% of total</th></tr></thead>
      <tbody>${hotspotRows || '<tr><td colspan="4">No sources logged yet.</td></tr>'}</tbody>
    </table>
    <h2>SECR intensity</h2>
    <p>${escapeHtml(intensity)}</p>
    <h2>Recommended next steps</h2>
    <ul>${actions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    <h2>How this differs from the Combined Results report</h2>
    <p>Combined Results is the inventory you can attach to a disclosure: every GHG Protocol category, including empty ones. This analysis report is for decisions: what dominates, what is missing that usually matters, and where to act first. Neither report lists individual activity rows — those stay on each data-input form as the audit trail.</p>
    <p class="footnote">tCO₂e = (activity × conversion value in kg CO₂e) ÷ 1000. Factors: organisation library (typically DESNZ/DEFRA 2025 and ICE). This is an estimate to support reporting; it is not a third-party verification statement.</p>
  `
  openPrint(`${org} — emissions analysis`, body)
}

/** @deprecated Use printInventoryReport or printAnalysisReport. */
export function printReport(title: string, entries: EmissionEntry[]) {
  printInventoryReport(entries, { organizationName: title })
}
