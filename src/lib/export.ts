import { getCategory } from './categories'
import { completenessForYear } from './completeness'
import { entryActivityDate } from './entry-date'
import { summarizeInventory, type InventorySummary } from './ghg'
import type { OrgProfile } from './org'
import { escapeHtml } from './safe'
import { parseScope2Meta, summarizeScope2 } from './scope2'
import { formatCsvNumber, formatNumber, formatPercent, formatTco2e } from './format'
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
    'Evidence',
    'Scope2_location_tCO2e',
    'Scope2_market_tCO2e',
    'Market_instrument',
  ]
  const rows = entries.map((entry) => {
    const scope2 = entry.scope2 ?? parseScope2Meta(entry.customFields)
    return [
      entryActivityDate(entry),
      getCategory(entry.category)?.name ?? entry.category,
      entry.scope,
      entry.site,
      formatCsvNumber(entry.emissions_tco2e),
      entry.amount ?? '',
      entry.unit,
      entry.details,
      entry.comment,
      entry.tags.join('; '),
      entry.link,
      entry.link.trim() ? 'Yes' : 'No',
      scope2 ? formatCsvNumber(scope2.locationTco2e) : '',
      scope2 ? formatCsvNumber(scope2.marketTco2e) : '',
      scope2?.instrument ?? '',
    ].map((value) => csvEscape(String(value)))
  })
  return [header.join(','), ...rows.map((row) => row.join(','))].join('\n')
}

export function inventoryToCsv(summary: InventorySummary) {
  const header = ['Scope', 'GHG_code', 'Category', 'tCO2e', 'Percent_of_total', 'Status', 'What_this_is']
  const rows = summary.rows.map((row) =>
    [
      row.scope,
      row.code,
      row.name,
      formatCsvNumber(row.tco2e),
      Number.isFinite(row.percent) ? Number(row.percent.toFixed(1)).toString() : '',
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
  year?: number
  employeeCount?: number
  baselineTco2e?: number
  residualMixKg?: number
  country?: string
  locked?: boolean
  netZeroYear?: number
  profile?: OrgProfile
}

export function auditorPackCsv(entries: EmissionEntry[], context: ReportContext) {
  const year = context.year ?? new Date().getFullYear()
  const summary = summarizeInventory(entries)
  const dual = summarizeScope2(entries, context.residualMixKg ?? 0, 0.13096)
  const complete = context.profile
    ? completenessForYear({
        entries,
        sites: [],
        profile: context.profile,
        year,
      })
    : null
  const lines = [
    `# Carbon Logic auditor pack`,
    `# Organisation,${csvEscape(context.organizationName)}`,
    `# Reporting year,${year}`,
    `# Generated,${new Date().toISOString()}`,
    `# Total tCO2e,${formatCsvNumber(summary.total)}`,
    `# Scope 1,${formatCsvNumber(summary.scope1)}`,
    `# Scope 2 location-based,${formatCsvNumber(dual.locationTco2e || summary.scope2)}`,
    `# Scope 2 market-based,${formatCsvNumber(dual.marketTco2e)}`,
    `# Scope 3,${formatCsvNumber(summary.scope3)}`,
    `# Electricity kWh,${formatCsvNumber(dual.electricityKwh)}`,
    complete ? `# Completeness score,${formatCsvNumber(complete.score * 100)}` : '',
    `# Closed year,${context.locked ? 'yes' : 'no'}`,
    '',
    entriesToCsv(entries),
  ]
  return lines.filter((line) => line !== '').join('\n')
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
      const status = row.status === 'reported' ? formatTco2e(row.tco2e, true) : 'Not yet logged'
      return `<tr>
        <td>${escapeHtml(row.scope)}</td>
        <td>${escapeHtml(row.code)}</td>
        <td>${escapeHtml(row.name)}<div class="plain">${escapeHtml(row.plain)}</div></td>
        <td>${row.status === 'reported' ? status : '—'}</td>
        <td>${row.status === 'reported' ? formatPercent(row.percent) : '—'}</td>
      </tr>`
    })
    .join('')
  return `<table>
    <thead><tr><th>Scope</th><th>GHG Protocol</th><th>Category</th><th>tCO₂e</th><th>% of total</th></tr></thead>
    <tbody>${body}
      <tr class="section"><td colspan="3">Total reported</td><td>${formatTco2e(summary.total, true)}</td><td>100%</td></tr>
    </tbody>
  </table>`
}

export function printInventoryReport(entries: EmissionEntry[], context: ReportContext) {
  const summary = summarizeInventory(entries)
  const dual = summarizeScope2(entries, context.residualMixKg ?? 0, 0.13096)
  const org = context.organizationName || 'Organisation'
  const yearLabel = context.year ? String(context.year) : 'all years'
  const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const body = `
    <p class="kicker">Carbon Logic · GHG inventory</p>
    <h1>${escapeHtml(org)}</h1>
    <p class="muted">Combined results for reporting · ${escapeHtml(yearLabel)} · ${escapeHtml(generated)} · ${summary.entryCount} logged ${summary.entryCount === 1 ? 'activity' : 'activities'}${context.locked ? ' · year closed' : ''}</p>
    <div class="hero">
      ${kpi('Total reported', formatTco2e(summary.total, true))}
      ${kpi('Scope 1 (owned fuel & leaks)', formatTco2e(summary.scope1, true))}
      ${kpi('Scope 2 location-based', formatTco2e(dual.locationTco2e || summary.scope2, true))}
      ${kpi('Scope 2 market-based', formatTco2e(dual.marketTco2e, true))}
    </div>
    <h2>How to read this report</h2>
    <p>Figures are tonnes of carbon dioxide equivalent (tCO₂e). Scope 1 is fuel and leaks you own. Scope 2 is electricity and heat you buy, shown both location-based (UK grid) and market-based (contracts / residual mix) as required by the GHG Protocol Scope 2 Guidance. Scope 3 is everything else in your value chain, labelled with the GHG Protocol’s 15 categories so this table can sit in a SECR, PPN 06/21, or customer questionnaire without translation.</p>
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
            `<tr><td>${escapeHtml(site.name)}</td><td>${formatTco2e(site.tco2e)}</td><td>${formatPercent(site.percent)}</td></tr>`,
        )
        .join('')}
    </tbody></table>`
        : ''
    }
    <p class="footnote">Method: tCO₂e = (activity amount × conversion value in kg CO₂e) ÷ 1000. Conversion values are taken from the organisation’s emission-factor library (DESNZ/DEFRA 2026, plus supplier EPDs for steel, cement, aluminium, and similar). Empty Scope 3 categories are shown on purpose: “not yet logged” is a completeness signal, not a zero. Categories 8–15 are often not relevant for a typical contractor, miner, or logistics operator. This is not a third-party verification statement.</p>
  `
  openPrint(`${org} — GHG inventory`, body)
}

export function printAnalysisReport(entries: EmissionEntry[], context: ReportContext) {
  const summary = summarizeInventory(entries)
  const org = context.organizationName || 'Organisation'
  const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const intensity =
    context.revenue && context.revenue > 0
      ? `${formatNumber(summary.total / (context.revenue / 1_000_000))} tCO₂e per £ million turnover`
      : 'Add annual revenue in Analysis to calculate the SECR intensity ratio (tCO₂e per £ million).'
  const actions: string[] = []
  if (summary.hotspots[0]) {
    actions.push(
      `Tackle ${summary.hotspots[0].name.toLowerCase()} first — it is ${formatPercent(summary.hotspots[0].percent, 0)} of the reported total.`,
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
        `<tr><td>${index + 1}</td><td>${escapeHtml(row.code)} · ${escapeHtml(row.name)}</td><td>${formatTco2e(row.tco2e)}</td><td>${formatPercent(row.percent)}</td></tr>`,
    )
    .join('')

  const coverage = summary.rows.filter((row) => row.scope === 'Scope 3' && row.status === 'reported').length

  const body = `
    <p class="kicker">Carbon Logic · management insights</p>
    <h1>${escapeHtml(org)}</h1>
    <p class="muted">Analysis report · ${escapeHtml(generated)} · for leadership, not a line-by-line ledger</p>
    <div class="hero">
      ${kpi('Reported footprint', formatTco2e(summary.total, true))}
      ${kpi('Under direct control (S1+S2)', formatTco2e(summary.scope1 + summary.scope2, true))}
      ${kpi('Value chain (Scope 3)', formatTco2e(summary.scope3, true))}
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
    <p class="footnote">tCO₂e uses the published DESNZ/DEFRA 2026 method for that activity (tkm, pkm, GWP, or kg CO₂e per unit), then ÷ 1,000 to convert kg to tonnes. Steel, cement, aluminium, and similar use supplier EPDs. This is an estimate to support reporting; it is not a third-party verification statement.</p>
  `
  openPrint(`${org} — emissions analysis`, body)
}

/** @deprecated Use printInventoryReport or printAnalysisReport. */
export function printReport(title: string, entries: EmissionEntry[]) {
  printInventoryReport(entries, { organizationName: title })
}

export function printSecrStatement(entries: EmissionEntry[], context: ReportContext) {
  const summary = summarizeInventory(entries)
  const dual = summarizeScope2(entries, context.residualMixKg ?? 0, 0.13096)
  const org = context.organizationName || 'Organisation'
  const year = context.year ?? new Date().getFullYear()
  const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const secrTotalLocation = summary.scope1 + (dual.locationTco2e || summary.scope2)
  const secrTotalMarket = summary.scope1 + dual.marketTco2e
  const intensity =
    context.revenue && context.revenue > 0
      ? `${formatNumber(secrTotalLocation / (context.revenue / 1_000_000))} tCO₂e / £m turnover (location-based Scope 1+2)`
      : 'Turnover is not set — add it in Organisation settings to calculate the mandatory intensity ratio.'
  const fte =
    context.employeeCount && context.employeeCount > 0
      ? `${formatNumber(secrTotalLocation / context.employeeCount)} tCO₂e / FTE (location-based Scope 1+2)`
      : 'Average FTE is not set — add it in Organisation settings for a second intensity ratio.'
  const energyKwh = dual.electricityKwh + dual.heatKwh
  const body = `
    <p class="kicker">Streamlined Energy and Carbon Reporting</p>
    <h1>${escapeHtml(org)}</h1>
    <p class="muted">SECR energy and carbon statement · reporting year ${year} · prepared ${escapeHtml(generated)}${context.locked ? ' · inventory closed' : ''}</p>
    <div class="hero">
      ${kpi('Scope 1', formatTco2e(summary.scope1, true))}
      ${kpi('Scope 2 location-based', formatTco2e(dual.locationTco2e || summary.scope2, true))}
      ${kpi('Scope 2 market-based', formatTco2e(dual.marketTco2e, true))}
      ${kpi('Purchased energy', `${formatNumber(energyKwh)} kWh`)}
    </div>
    <h2>Methodology</h2>
    <p>This statement follows HM Government’s Streamlined Energy and Carbon Reporting guidance and the GHG Protocol Corporate Standard, including the Scope 2 dual-reporting requirement. Activity data (kWh, litres, kilometres) is multiplied by DESNZ/DEFRA 2026 conversion factors, except where a supplier Environmental Product Declaration is used for a material with no published DESNZ row. Location-based electricity uses the UK grid generation factor. Market-based electricity uses the contractual instrument recorded on each activity (supplier-specific factor, REGO / 100% renewable tariff, or residual mix). ${dual.residualMixMissing ? 'A GB residual-mix factor has not been entered, so some market-based rows currently equal the location-based figure.' : ''}</p>
    <h2>UK energy use and associated GHG emissions</h2>
    <table>
      <thead><tr><th>Item</th><th>Quantity</th><th>Unit</th></tr></thead>
      <tbody>
        <tr><td>Purchased electricity</td><td>${formatNumber(dual.electricityKwh)}</td><td>kWh</td></tr>
        <tr><td>Purchased heat and steam</td><td>${formatNumber(dual.heatKwh)}</td><td>kWh</td></tr>
        <tr><td>Scope 1</td><td>${formatTco2e(summary.scope1, true)}</td><td>tCO₂e</td></tr>
        <tr><td>Scope 2 (location-based)</td><td>${formatTco2e(dual.locationTco2e || summary.scope2, true)}</td><td>tCO₂e</td></tr>
        <tr><td>Scope 2 (market-based)</td><td>${formatTco2e(dual.marketTco2e, true)}</td><td>tCO₂e</td></tr>
        <tr><td>Scope 1+2 location-based total</td><td>${formatTco2e(secrTotalLocation, true)}</td><td>tCO₂e</td></tr>
        <tr><td>Scope 1+2 market-based total</td><td>${formatTco2e(secrTotalMarket, true)}</td><td>tCO₂e</td></tr>
        <tr><td>Scope 3 (voluntary in this statement)</td><td>${formatTco2e(summary.scope3, true)}</td><td>tCO₂e</td></tr>
      </tbody>
    </table>
    <h2>Intensity ratios</h2>
    <ul>
      <li>${escapeHtml(intensity)}</li>
      <li>${escapeHtml(fte)}</li>
    </ul>
    <h2>Energy efficiency action</h2>
    <ul>${summary.insights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    <h2>Directors’ statement</h2>
    <p>The directors confirm that this statement has been prepared from the organisation’s Carbon Logic inventory for ${year}. It is a management estimate to support statutory reporting. It is not a limited-assurance or reasonable-assurance opinion. Underlying activity rows, evidence links, and emission factors are available to the organisation’s appointed auditor.</p>
    <p class="footnote">SECR applies to quoted companies and to large unquoted companies and LLPs meeting the Companies Act thresholds. Confirm with your company secretary whether this organisation is in scope. Factors: DESNZ/DEFRA 2026. Dual Scope 2: GHG Protocol Scope 2 Guidance.</p>
  `
  openPrint(`${org} — SECR ${year}`, body)
}

export function printPpnCarbonReductionPlan(entries: EmissionEntry[], context: ReportContext) {
  const summary = summarizeInventory(entries)
  const dual = summarizeScope2(entries, context.residualMixKg ?? 0, 0.13096)
  const org = context.organizationName || 'Organisation'
  const year = context.year ?? new Date().getFullYear()
  const baseline = context.baselineTco2e ?? 0
  const netZero = context.netZeroYear ?? 2050
  const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const reduction = baseline > 0 ? ((baseline - summary.total) / baseline) * 100 : null
  const body = `
    <p class="kicker">PPN 06/21 · Carbon Reduction Plan</p>
    <h1>${escapeHtml(org)}</h1>
    <p class="muted">Procurement Policy Note 06/21 · reporting year ${year} · prepared ${escapeHtml(generated)}</p>
    <h2>Commitment to achieving Net Zero</h2>
    <p>${escapeHtml(org)} is committed to achieving Net Zero emissions by ${netZero}. This Carbon Reduction Plan is produced to support bids for UK government contracts above £5 million per annum, in line with PPN 06/21.</p>
    <h2>Baseline emissions footprint</h2>
    <p>${
      baseline > 0
        ? `The baseline organisational footprint is ${formatTco2e(baseline, true)} (tCO₂e), as recorded in Carbon Logic.`
        : 'A baseline tCO₂e has not been entered yet. Set it in Organisation settings so this plan can show progress against a fixed year.'
    }</p>
    <h2>Current emissions reporting</h2>
    <table>
      <thead><tr><th>GHG Protocol</th><th>tCO₂e</th></tr></thead>
      <tbody>
        <tr><td>Scope 1</td><td>${formatTco2e(summary.scope1, true)}</td></tr>
        <tr><td>Scope 2 (location-based)</td><td>${formatTco2e(dual.locationTco2e || summary.scope2, true)}</td></tr>
        <tr><td>Scope 2 (market-based)</td><td>${formatTco2e(dual.marketTco2e, true)}</td></tr>
        <tr><td>Scope 3 (logged categories)</td><td>${formatTco2e(summary.scope3, true)}</td></tr>
        <tr class="section"><td>Total reported</td><td>${formatTco2e(summary.total, true)}</td></tr>
      </tbody>
    </table>
    ${
      reduction != null
        ? `<p>Reported emissions are ${formatPercent(reduction)} ${reduction >= 0 ? 'below' : 'above'} the baseline.</p>`
        : ''
    }
    <h2>Carbon reduction projects</h2>
    <p>The following actions follow from the current inventory. They are management recommendations, not a guarantee of future reductions.</p>
    <ul>
      ${summary.insights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      ${
        summary.hotspots[0]
          ? `<li>Priority source: ${escapeHtml(summary.hotspots[0].code)} ${escapeHtml(summary.hotspots[0].name)} (${formatPercent(summary.hotspots[0].percent, 0)} of the reported total).</li>`
          : ''
      }
    </ul>
    <h2>Declaration and sign off</h2>
    <p>This Carbon Reduction Plan has been completed in accordance with PPN 06/21 and associated guidance and reporting standard for Carbon Reduction Plans. Emissions have been reported and recorded in accordance with the published reporting standard for Carbon Reduction Plans and the GHG Protocol Corporate Accounting and Reporting Standard, and use the appropriate government emission conversion factors for greenhouse gas company reporting. Scope 1 and Scope 2 emissions have been reported in accordance with SECR requirements, and the required subset of Scope 3 emissions have been reported in accordance with the published reporting standard for Carbon Reduction Plans and the Corporate Value Chain (Scope 3) Standard, where data has been logged.</p>
    <p>This Carbon Reduction Plan has been reviewed and is intended to be signed by the board of directors (or equivalent management body).</p>
    <p>Signed on behalf of the supplier: ___________________________ &nbsp;&nbsp; Date: _______________</p>
    <p class="footnote">This document is generated from the organisation’s Carbon Logic inventory. It is not a third-party verification statement. Empty Scope 3 categories mean not yet logged, not a calculated zero.</p>
  `
  openPrint(`${org} — PPN 06/21 CRP ${year}`, body)
}
