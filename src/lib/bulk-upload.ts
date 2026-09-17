import type { CategoryConfig, FormField, UnitOption } from './types'

export type BulkColumn = {
  key: string
  header: string
  example: string
  options?: string[]
  hint?: string
  /** Form field type when this column maps to a category field. */
  kind: 'select' | 'number' | 'text' | 'unit' | 'meta'
}

export type BulkCellError = {
  /** Spreadsheet row number (header is row 1). */
  row: number
  /** 1-based column index in the uploaded file when known, else template order. */
  column: number
  header: string
  value: string
  message: string
}

const META_COLUMNS: BulkColumn[] = [
  { key: 'site', header: 'Site', example: '', kind: 'meta' },
  { key: 'comment', header: 'Comments', example: '', kind: 'meta' },
  { key: 'link', header: 'Link', example: '', kind: 'meta' },
  { key: 'tags', header: 'Tags', example: 'tag1;tag2', kind: 'meta' },
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
    kind: 'unit',
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
      kind: field.type,
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
    if (key) values[key] = cell.trim()
  }
  return values
}

function findUnit(units: UnitOption[], raw: string | undefined): UnitOption | null {
  if (raw == null || !raw.trim()) return null
  const value = raw.trim()
  return (
    units.find((unit) => unit.value === value) ||
    units.find((unit) => unit.label === value) ||
    units.find((unit) => normalizeHeader(unit.value) === normalizeHeader(value)) ||
    units.find((unit) => normalizeHeader(unit.label) === normalizeHeader(value)) ||
    null
  )
}

function findSelectOption(options: string[], raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  const exact = options.find((option) => option === value)
  if (exact) return exact
  // Case-insensitive full-string match only — never fuzzy-substring match,
  // or "gas" would incorrectly become "Diesel / gas oil".
  const lower = value.toLowerCase()
  const caseInsensitive = options.find((option) => option.toLowerCase() === lower)
  if (caseInsensitive) return caseInsensitive
  const normalised = normalizeHeader(value)
  const matches = options.filter((option) => normalizeHeader(option) === normalised)
  return matches.length === 1 ? matches[0] : null
}

/** Resolve unit labels/values into the `*_unit_factor` values CategoryForm uses. */
export function applyUnitFactors(
  values: Record<string, string>,
  category: CategoryConfig,
): Record<string, string> {
  const next = { ...values }
  const fieldKeys = new Set(category.fields.map((field) => field.key))

  if (category.unitOptions?.length && !fieldKeys.has('unit')) {
    const chosen =
      findUnit(category.unitOptions, next.unit) ?? category.unitOptions[0]
    next.unit = chosen.value
    next.unit_factor = String(chosen.toBase)
  }

  for (const field of category.fields) {
    if (!field.unitOptions?.length) continue
    const unitKey = `${field.key}_unit`
    const chosen = findUnit(field.unitOptions, next[unitKey]) ?? field.unitOptions[0]
    next[unitKey] = chosen.value
    next[`${field.key}_unit_factor`] = String(chosen.toBase)
  }

  return next
}

export function parseBulkAmount(raw: string | undefined): number {
  if (raw == null || raw.trim() === '') return Number.NaN
  // Allow "1,250.5" / "1 250" style amounts from spreadsheets
  const cleaned = raw.replace(/[\s,]/g, '').trim()
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return Number.NaN
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

function columnIndexFor(
  key: string,
  category: CategoryConfig,
  headerIndexes: Map<string, number>,
): { column: number; header: string } {
  const columns = bulkColumnsForCategory(category)
  const templateIndex = columns.findIndex((column) => column.key === key)
  const column = columns[templateIndex]
  const header = column?.header ?? key
  const fromFile = headerIndexes.get(key)
  return {
    column: fromFile ?? (templateIndex >= 0 ? templateIndex + 1 : 1),
    header,
  }
}

function buildHeaderIndexes(
  row: Record<string, string>,
  category: CategoryConfig,
): Map<string, number> {
  const indexes = new Map<string, number>()
  Object.keys(row).forEach((header, index) => {
    const key = resolveBulkHeader(header, category)
    if (key && !indexes.has(key)) indexes.set(key, index + 1)
  })
  return indexes
}

/**
 * Validate one CSV data row against this category’s form rules.
 * Invalid select / unit / number cells are rejected — they must not be
 * silently mapped onto a default factor and calculated.
 */
export function validateBulkRow(
  row: Record<string, string>,
  category: CategoryConfig,
  spreadsheetRow: number,
): BulkCellError[] {
  const values = normalizeBulkRow(row, category)
  const headerIndexes = buildHeaderIndexes(row, category)
  const errors: BulkCellError[] = []
  const columns = bulkColumnsForCategory(category)

  function push(key: string, value: string, message: string) {
    const loc = columnIndexFor(key, category, headerIndexes)
    errors.push({
      row: spreadsheetRow,
      column: loc.column,
      header: loc.header,
      value,
      message,
    })
  }

  for (const column of columns) {
    if (column.kind === 'meta') continue
    const raw = values[column.key] ?? ''

    if (column.kind === 'select') {
      if (!raw.trim()) {
        push(column.key, raw, 'this value is required.')
        continue
      }
      const matched = findSelectOption(column.options ?? [], raw)
      if (!matched) {
        push(
          column.key,
          raw,
          `“${raw}” is not a valid option. Allowed: ${(column.options ?? []).join(', ')}.`,
        )
        continue
      }
      values[column.key] = matched
      continue
    }

    if (column.kind === 'number') {
      if (!raw.trim()) {
        push(column.key, raw, 'enter a number greater than zero.')
        continue
      }
      // Reject letters mixed into numeric cells (e.g. "100L", "approx 12").
      if (/[a-zA-Z]/.test(raw)) {
        push(column.key, raw, `“${raw}” is not a valid number. Use digits only in this column.`)
        continue
      }
      const amount = parseBulkAmount(raw)
      if (!Number.isFinite(amount)) {
        push(column.key, raw, `“${raw}” is not a valid number.`)
        continue
      }
      if (amount <= 0) {
        push(column.key, raw, 'enter a number greater than zero.')
        continue
      }
      values[column.key] = String(amount)
      continue
    }

    if (column.kind === 'text') {
      if (!raw.trim()) {
        push(column.key, raw, 'this value is required.')
      }
      continue
    }

    if (column.kind === 'unit') {
      // Unit is required when the category exposes a unit column — do not
      // silently default an empty or invented unit and invent a calculation.
      if (!raw.trim()) {
        push(column.key, raw, 'choose a unit from the allowed list.')
        continue
      }
      const units =
        column.key === 'unit'
          ? category.unitOptions ?? []
          : category.fields.find((field) => `${field.key}_unit` === column.key)?.unitOptions ?? []
      if (!findUnit(units, raw)) {
        push(
          column.key,
          raw,
          `“${raw}” is not a valid unit. Allowed: ${(column.options ?? []).join(', ')}.`,
        )
      }
    }
  }

  return errors
}

export function formatBulkCellError(category: CategoryConfig, error: BulkCellError): string {
  const shown = error.value.trim() ? `“${error.value}”` : '(empty)'
  return `${category.name} — Row ${error.row}, Column ${error.column} (“${error.header}”): ${shown} — ${error.message}`
}

/** Map + validate + apply units. Returns values only when the row is fully valid. */
export function prepareBulkRow(
  row: Record<string, string>,
  category: CategoryConfig,
  spreadsheetRow: number,
): { values: Record<string, string>; errors: BulkCellError[] } {
  const errors = validateBulkRow(row, category, spreadsheetRow)
  if (errors.length > 0) return { values: {}, errors }

  const values = applyUnitFactors(normalizeBulkRow(row, category), category)
  // Canonicalise select spellings after unit factors
  for (const field of category.fields) {
    if (field.type !== 'select' || !field.options?.length) continue
    const matched = findSelectOption(field.options, values[field.key] ?? '')
    if (matched) values[field.key] = matched
  }
  return { values, errors: [] }
}
