export type Scope = 'Scope 1' | 'Scope 2' | 'Scope 3' | 'Custom'

export const SOURCE_FAMILIES = [
  'DEFRA',
  'DESNZ',
  'BEIS',
  'ICE',
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
  hint?: string
  placeholder?: string
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
  resolveFactorKey: (values: Record<string, string>) => string
  resolveUnit: (values: Record<string, string>) => string
  resolveDetails: (values: Record<string, string>, amount: number) => string
  resolveActivityAmount?: (values: Record<string, string>, amount: number) => number
}

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
}

export type AdditionalState = {
  link: string
  comment: string
  site: string
  tags: string[]
  customFields: CustomField[]
  files: AttachedFile[]
}

export const emptyAdditional = (): AdditionalState => ({
  link: '',
  comment: '',
  site: '',
  tags: [],
  customFields: [],
  files: [],
})
