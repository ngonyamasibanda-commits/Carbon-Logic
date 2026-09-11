/** On-screen and export figures use at most three decimal places. */
export const DISPLAY_DECIMALS = 3

/**
 * Format a quantity so it fits in KPI cards and tables.
 * Values of 0.001 and above show at most three decimal places.
 * Smaller non-zero values use three significant figures so they do not
 * collapse to 0.000.
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs < 0.001) {
    return String(Number(value.toPrecision(3)))
  }
  return value.toLocaleString('en-GB', {
    maximumFractionDigits: DISPLAY_DECIMALS,
    minimumFractionDigits: 0,
  })
}

export function formatTco2e(value: number, withUnit = false): string {
  const formatted = formatNumber(value)
  return withUnit ? `${formatted} tCO₂e` : formatted
}

/**
 * Published conversion factors and calculator working. KPI cards stay on
 * {@link formatNumber}; this keeps DESNZ digits (1.27043, 2.58354, 0.855928…)
 * so the working does not look like 1,000 × 2.584 = 2,583.54.
 */
export function formatFactor(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  const abs = Math.abs(value)
  return value.toLocaleString('en-GB', {
    maximumFractionDigits: 12,
    minimumFractionDigits: 0,
    useGrouping: abs >= 1000,
  })
}

export function formatWorkingTco2e(value: number): string {
  return `${formatFactor(value)} tCO₂e`
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—'
  return `${value.toLocaleString('en-GB', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  })}%`
}

/** Stable spreadsheet cell: three decimal places, no grouping commas. */
export function formatCsvNumber(value: number): string {
  if (!Number.isFinite(value)) return ''
  return roundDisplay(value).toFixed(DISPLAY_DECIMALS)
}

export function roundDisplay(value: number): number {
  if (!Number.isFinite(value)) return 0
  const abs = Math.abs(value)
  if (abs > 0 && abs < 0.001) return Number(value.toPrecision(3))
  return Number(value.toFixed(DISPLAY_DECIMALS))
}
