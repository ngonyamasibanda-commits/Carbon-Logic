import type { CategoryConfig, FormField, UnitOption } from './types'

export type BulkColumn = {
  key: string
  header: string
  example: string
  options?: string[]
  hint?: string
}

const META_COLUMNS: BulkColumn[] = [
  { key: 'site', header: 'Site', example: '' },
  { key: 'comment', header: 'Comments', example: '' },
  { key: 'link', header: 'Link', example: '' },
  { key: 'tags', header: 'Tags', example: 'tag1;tag2' },
]

function exampleForField(field: FormField): string {
  if (field.type === 'select') return field.options?.[0] ?? ''
  if (field.type === 'number') return '100'
  return field.placeholder || 'example'
}

function unitColumn(key: string, header: string, units: UnitOption[]): BulkColumn {
  return {
    key,
    header,
    example: units[0]?.value ?? '',
    options: units.map((unit) => unit.value),
    hint: `Allowed: ${units.map((unit) => unit.value).join(', ')}`,
  }
}

/** Columns required to fill this category the same way as the on-screen form. */
export function bulkColumnsForCategory(category: CategoryConfig): BulkColumn[] {
  const columns: BulkColumn[] = []
  const fieldKeys = new Set(category.fields.map((field) => field.key))

  for (const field of category.fields) {
    columns.push({
      key: field.key,
      header: field.label,
      example: exampleForField(field),
      options: field.options,
      hint: field.hint,
    })
    if (field.unitOptions?.length) {
      columns.push(
        unitColumn(`${field.key}_unit`, `${field.label} unit`, field.unitOptions),
      )
    }
  }

  // Category-level unit selector (shown as "Unit of measure" on the form).
  // Skip when the category already has a field named `unit` (Custom).
  if (category.unitOptions?.length && !fieldKeys.has('unit')) {
    columns.push(unitColumn('unit', 'Unit of measure', category.unitOptions))
  }

  columns.push(...META_COLUMNS)
  return columns
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** Header + example row so each category template is ready to fill in. */
export function buildCategoryTemplate(category: CategoryConfig): string {
  const columns = bulkColumnsForCategory(category)
  // Use form labels as headers so the spreadsheet matches the on-screen form.
  // Import still accepts either labels or keys.
  const headers = columns.map((column) => csvEscape(column.header))
  const example = columns.map((column) => csvEscape(column.example)).join(',')
  return `${headers.join(',')}\n${example}\n`
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

/** Map a CSV header (key or form label) onto the stable field key. */
export function resolveBulkHeader(header: string, category: CategoryConfig): string | null {
  const raw = header.trim()
  if (!raw) return null
  const columns = bulkColumnsForCategory(category)
  const byKey = columns.find((column) => column.key === raw)
  if (byKey) return byKey.key
  const byHeader = columns.find((column) => column.header === raw)
  if (byHeader) return byHeader.key

  const normalised = normalizeHeader(raw)
  const fuzzy = columns.find(
    (column) =>
      normalizeHeader(column.key) === normalised ||
      normalizeHeader(column.header) === normalised,
  )
  if (fuzzy) return fuzzy.key

  // Common aliases people type into Excel
  if (normalised === 'amount' || normalised === 'fuelamount' || normalised === 'usage') {
    return category.amountField
  }
  if (normalised === 'unitofmeasure' || normalised === 'uom') {
    return 'unit'
  }
  return null
}

export function normalizeBulkRow(
  row: Record<string, string>,
  category: CategoryConfig,
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [header, cell] of Object.entries(row)) {
    const key = resolveBulkHeader(header, category)
    if (key) values[key] = cell
  }
  return applyUnitFactors(values, category)
}

function matchUnit(units: UnitOption[], raw: string | undefined): UnitOption | undefined {
  if (!raw?.trim()) return units[0]
  const value = raw.trim()
  return (
    units.find((unit) => unit.value === value) ||
    units.find((unit) => unit.label === value) ||
    units.find((unit) => normalizeHeader(unit.value) === normalizeHeader(value)) ||
    units.find((unit) => normalizeHeader(unit.label) === normalizeHeader(value)) ||
    units[0]
  )
}

/** Resolve unit labels/values into the `*_unit_factor` values CategoryForm uses. */
export function applyUnitFactors(
  values: Record<string, string>,
  category: CategoryConfig,
): Record<string, string> {
  const next = { ...values }
  const fieldKeys = new Set(category.fields.map((field) => field.key))

  if (category.unitOptions?.length && !fieldKeys.has('unit')) {
    const chosen = matchUnit(category.unitOptions, next.unit)
    if (chosen) {
      next.unit = chosen.value
      next.unit_factor = String(chosen.toBase)
    }
  }

  for (const field of category.fields) {
    if (!field.unitOptions?.length) continue
    const unitKey = `${field.key}_unit`
    const chosen = matchUnit(field.unitOptions, next[unitKey])
    if (chosen) {
      next[unitKey] = chosen.value
      next[`${field.key}_unit_factor`] = String(chosen.toBase)
    }
  }

  return next
}

export function parseBulkAmount(raw: string | undefined): number {
  if (raw == null || raw.trim() === '') return Number.NaN
  // Allow "1,250.5" / "1 250" style amounts from spreadsheets
  const cleaned = raw.replace(/[\s,]/g, '').trim()
  return Number(cleaned)
}

export function activityAmountFromBulkRow(
  values: Record<string, string>,
  category: CategoryConfig,
): number {
  const rawAmount = parseBulkAmount(values[category.amountField] ?? values.amount)
  const unitFactor = Number(values.unit_factor ?? 1) || 1
  const amount = rawAmount * unitFactor
  return category.resolveActivityAmount
    ? category.resolveActivityAmount(values, amount)
    : amount
}
