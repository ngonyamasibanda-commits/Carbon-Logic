import type { EmissionFactor } from './types'

/**
 * Materials with no DESNZ/DEFRA 2026 published factor. The catalogue does not
 * vendor ICE (commercial use ended 30 September 2026). Users must supply an
 * EPD or other verified factor before these activities can be calculated.
 */
export const EPD_REQUIRED_MATERIALS = [
  {
    key: 'material_steel_t',
    options: ['Steel', 'Grinding media (steel)'],
    name: 'Structural steel sections (A1–A3)',
    typicalEpdUnit: 'kg CO₂e per kg',
  },
  {
    key: 'material_rebar_t',
    options: ['Rebar'],
    name: 'Reinforcing steel (A1–A3)',
    typicalEpdUnit: 'kg CO₂e per kg',
  },
  {
    key: 'material_cement_t',
    options: ['Cement'],
    name: 'Cement CEM I / Portland (A1–A3)',
    typicalEpdUnit: 'kg CO₂e per kg',
  },
  {
    key: 'material_aluminium_t',
    options: ['Aluminium'],
    name: 'Aluminium (primary production)',
    typicalEpdUnit: 'kg CO₂e per kg',
  },
  {
    key: 'material_copper_t',
    options: ['Copper'],
    name: 'Copper (primary)',
    typicalEpdUnit: 'kg CO₂e per kg',
  },
  {
    key: 'material_lime_t',
    options: ['Lime'],
    name: 'Lime (general)',
    typicalEpdUnit: 'kg CO₂e per kg',
  },
] as const

export function isEpdRequiredKey(key: string) {
  return EPD_REQUIRED_MATERIALS.some((row) => row.key === key)
}

export function isEpdRequiredOption(option: string) {
  return EPD_REQUIRED_MATERIALS.some((row) => (row.options as readonly string[]).includes(option))
}

export function epdMaterialForKey(key: string) {
  return EPD_REQUIRED_MATERIALS.find((row) => row.key === key)
}

/** Keep a stored steel/cement/… row only when it is a tenant EPD or user factor, not a vendored ICE number. */
export function isTenantMaterialOverride(factor: EmissionFactor) {
  if (!isEpdRequiredKey(factor.key)) return true
  if (factor.sourceFamily === 'User' || factor.sourceFamily === 'EPD') return true
  const text = `${factor.source} ${factor.sourceFamily}`.toUpperCase()
  return text.includes('EPD') || text.includes('EN 15804') || text.includes('IC+')
}

export const EPD_DECLARED_UNITS = [
  { value: 'kg', label: 'kg CO₂e per kg (most metal and cement EPDs)', toPerTonne: 1000 },
  { value: 't', label: 'kg CO₂e per tonne', toPerTonne: 1 },
] as const

export function conversionToPerTonne(gwp: number, declaredUnit: string): number | null {
  if (!Number.isFinite(gwp) || gwp <= 0) return null
  const normalised = declaredUnit.trim().toLowerCase().replaceAll('₂', '2').replace(/\s+/g, ' ')
  const perKg =
    normalised === 'kg' ||
    normalised.includes('per kg') ||
    normalised.includes('/kg') ||
    normalised === 'kg co2e/kg' ||
    normalised === 'kg co2e per kg'
  const perTonne =
    normalised === 't' ||
    normalised === 'tonne' ||
    normalised === 'tonnes' ||
    normalised.includes('per tonne') ||
    normalised.includes('/t') ||
    normalised.includes('/tonne') ||
    normalised === 'kg co2e/t' ||
    normalised === 'kg co2e per tonne'
  if (perKg) return gwp * 1000
  if (perTonne) return gwp
  return null
}

export function factorFromEpd(input: {
  key: string
  name?: string
  conversionValue: number
  source: string
  sourceUrl?: string
}): EmissionFactor | null {
  const spec = epdMaterialForKey(input.key)
  if (!spec || !Number.isFinite(input.conversionValue) || input.conversionValue <= 0) return null
  const today = new Date().toISOString().slice(0, 10)
  return {
    key: spec.key,
    name: input.name?.trim() || spec.name,
    category: 'Bulk materials',
    scope: 'Scope 3',
    conversionValue: input.conversionValue,
    unit: 't',
    sourceFamily: 'EPD',
    source: input.source.trim() || 'Environmental Product Declaration (EN 15804 A1–A3)',
    sourceUrl: input.sourceUrl?.trim() || '',
    region: 'United Kingdom',
    validFrom: today,
    lastVerifiedAt: today,
    isPlaceholder: false,
  }
}

export function epdTemplateCsv() {
  const header = [
    'key',
    'name',
    'gwp_a1_a3',
    'declared_unit',
    'conversion_value',
    'unit',
    'source_family',
    'source',
    'source_url',
  ].join(',')
  const rows = EPD_REQUIRED_MATERIALS.map((row) =>
    [
      row.key,
      csvCell(row.name),
      '',
      'kg CO2e/kg',
      '',
      't',
      'EPD',
      csvCell('EPD: paste programme name and number (EN 15804 A1–A3)'),
      '',
    ].join(','),
  )
  return [header, ...rows].join('\n')
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}
