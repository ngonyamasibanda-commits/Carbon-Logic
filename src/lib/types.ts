export type Scope = 'Scope 1' | 'Scope 2' | 'Scope 3' | 'Custom'

export const SOURCE_FAMILIES = [
  'DEFRA',
  'DESNZ',
  'BEIS',
  'ICE',
  'EPD',
  'EIO',
  'EPA',
  'IPCC',
  'User',
] as const

export type SourceFamily = (typeof SOURCE_FAMILIES)[number]

export type FieldType = 'select' | 'number' | 'text'

export type FormField = {
  key: string
  label: string
  type: FieldType
  options?: string[]
  optionGroups?: Array<{ label: string; options: string[] }>
  optionsFrom?: (values: Record<string, string>) => string[]
  visibleWhen?:
    | { field: string; equals: string | string[] }
    | Array<{ field: string; equals: string | string[] }>
    | ((values: Record<string, string>) => boolean)
  hint?: string
  placeholder?: string
  /** Skip HTML required when the field is supporting data (water-positive volumes, optional GWP set). */
  optional?: boolean
  /** If set, a unit selector appears beside this number field. The chosen unit value is stored in `key + '_unit'`. */
  unitOptions?: UnitOption[]
}

/**
 * A selectable unit option for a category amount field.
 * `toBase` is the multiplier that converts the user-entered value into
 * the base unit that the emission factor expects (e.g. for a factor in
 * litres: m³ → toBase=1000, Imperial gallon → toBase=4.546).
 */
export type UnitOption = {
  label: string  // shown in the dropdown, e.g. "m³ (cubic metres)"
  value: string  // stored on the entry, e.g. "m³"
  toBase: number // multiply user amount by this to get base-unit amount
}

export type CategoryConfig = {
  id: string
  name: string
  scope: Scope
  group: 'input' | 'scope3'
  instructions: string
  fields: FormField[]
  amountField: string
  amountLabel: string
  /** Selectable units for the primary amount field. First entry is the default. */
  unitOptions?: UnitOption[]
  resolveFactorKey: (values: Record<string, string>) => string
  resolveUnit: (values: Record<string, string>) => string
  resolveDetails: (values: Record<string, string>, amount: number) => string
  resolveActivityAmount?: (values: Record<string, string>, amount: number) => number
  /** Hired fleet uses the same DESNZ km/litre rows but must be logged as Scope 3. */
  resolveScope?: (values: Record<string, string>) => Scope
  /** Optional extra lines to offer (WTT / T&D / wastewater) without mixing scopes on one row. */
  chainExtras?: Array<'wtt' | 'td' | 'treatment' | 'ev' | 'ev_td'>
}

/**
 * How a published factor is applied. DESNZ/EPA inventory factors are kg CO₂e
 * per activity unit; refrigerant and methane rows are GWPs; CEDA EEIO rows
 * convert spend into 2023 producer-price USD first.
 */
export type FactorMethod = 'kg_per_unit' | 'gwp' | 'spend'

export type EmissionFactor = {
  key: string
  name: string
  category: string
  scope: Scope | 'Custom'
  conversionValue: number
  unit: string
  sourceFamily: SourceFamily
  source: string
  sourceUrl: string
  region: string
  validFrom: string
  lastVerifiedAt: string
  isPlaceholder: boolean
  method?: FactorMethod
  /** Matching WTT factor for the same activity unit, when DESNZ publishes one. */
  wttKey?: string
  /** Matching T&D factor (electricity / heat), when DESNZ publishes one. */
  tdKey?: string
  /** DESNZ UK electricity for EVs (Scope 2), when the row is a PHEV/BEV km factor. */
  evKey?: string
  /** DESNZ UK electricity T&D for EVs (Scope 3). */
  evTdKey?: string
  /** CEDA / EEIO: published factor currency (Open CEDA GHG_t_Raw is USD). */
  spendCurrency?: 'GBP' | 'USD'
  /** Local currency units per 1 USD, from the CEDA exchange-rate sheet. */
  fxGbpPerUsd?: number
  /** BEA purchaser–producer ratio from Open CEDA (producer EF × ratio = purchaser EF). */
  purchaserProducer?: number
  /** Sector price index for the latest CEDA year (2025; base 2023 = 100). */
  priceIndex?: number
  cedaCode?: string
}

export type CustomField = {
  label: string
  value: string
}

export type AttachedFile = {
  name: string
  size: number
  type: string
  dataUrl: string
}

export type EmissionEntry = {
  id: string
  category: string
  scope: string
  emissions_tco2e: number
  details: string
  amount: number | null
  unit: string
  comment: string
  link: string
  created_at: string
  site: string
  tags: string[]
  customFields: CustomField[]
  files: AttachedFile[]
  /** Date the activity occurred (reporting period). Falls back to created_at. */
  activity_date?: string
  /** Set when the row is stored for an organisation; omitted on unsynced local drafts. */
  organization_id?: string
  /** Dual Scope 2 working for electricity and heat rows. */
  scope2?: {
    locationTco2e: number
    marketTco2e: number
    instrument: string
    marketFactorKg: number
    kwh: number
  }
}

export type AdditionalState = {
  link: string
  comment: string
  site: string
  tags: string[]
  customFields: CustomField[]
  files: AttachedFile[]
  activity_date: string
}

export const emptyAdditional = (): AdditionalState => ({
  link: '',
  comment: '',
  site: '',
  tags: [],
  customFields: [],
  files: [],
  activity_date: new Date().toISOString().slice(0, 10),
})
