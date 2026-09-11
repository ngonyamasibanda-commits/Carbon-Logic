import type { EmissionFactor } from './types'
import { formatFactor, formatNumber } from './format'
import { CEDA_GBR_SECTORS, type CedaSector } from './ceda-data'

export { CEDA_GBR_SECTORS }
export type { CedaSector }

type Step = { label: string; value: string }

export const CEDA_ATTRIBUTION = 'CEDA by Watershed'
export const CEDA_VERSION = 'CEDA 2025'
export const CEDA_LICENSE = 'CC BY-SA 4.0'
export const CEDA_RELEASE = '2025-11-11'
export const CEDA_BASE_YEAR = 2023
export const CEDA_PRICE_YEAR = 2025
/** Open CEDA Exchange rates sheet, United Kingdom 2025, local currency per USD. */
export const CEDA_FX_GBP_PER_USD_2025 = 0.765396
export const CEDA_PRICE_INDEX_BASE = 100

export const CEDA_SECTOR_OPTIONS = CEDA_GBR_SECTORS.map((row) => row.name)

const GROUP_ORDER = [
  'Agriculture, forestry, fishing, and hunting',
  'Mining',
  'Utilities',
  'Construction',
  'Manufacturing',
  'Wholesale trade',
  'Retail trade',
  'Transportation and warehousing',
  'Information',
  'Finance and insurance',
  'Real estate and rental',
  'Professional, scientific, and technical services',
  'Management of companies',
  'Administrative, support, and waste services',
  'Educational services',
  'Health care and social assistance',
  'Arts, entertainment, and recreation',
  'Accommodation and food services',
  'Other services',
  'Public administration',
  'Other / special industries',
]

const groupedLabels = new Set(GROUP_ORDER)
const extraGroups = [...new Set(CEDA_GBR_SECTORS.map((row) => row.group).filter((label) => !groupedLabels.has(label)))]

export const CEDA_SECTOR_GROUPS = [...GROUP_ORDER, ...extraGroups]
  .map((label) => ({
    label,
    options: CEDA_GBR_SECTORS.filter((row) => row.group === label).map((row) => row.name),
  }))
  .filter((group) => group.options.length > 0)

export function cedaSectorByName(name: string): CedaSector | undefined {
  return CEDA_GBR_SECTORS.find((row) => row.name === name)
}

export function cedaSectorByKey(key: string): CedaSector | undefined {
  return CEDA_GBR_SECTORS.find((row) => row.key === key)
}

export function isCedaFactor(factor: Pick<EmissionFactor, 'key' | 'method'>): boolean {
  return factor.method === 'spend' || factor.key.startsWith('ceda_')
}

export type SpendCurrency = 'GBP' | 'USD'

export type CedaSpendWorking = {
  producerUsd2023: number
  steps: Step[]
}

/**
 * Open CEDA Cover method: convert spend into 2023 producer-price USD, then
 * multiply by GHG_t_Raw (kg CO₂e / 2023 USD). Purchaser prices are the usual
 * invoice amount, so the BEA purchaser–producer ratio is applied. 2026 spend
 * uses the latest published 2025 price index — the workbook has no 2026 index.
 */
export function cedaProducerUsd2023(input: {
  spend: number
  currency: SpendCurrency
  fxGbpPerUsd?: number
  priceIndex2025?: number
  purchaserProducer?: number
}): CedaSpendWorking {
  const fx = input.fxGbpPerUsd ?? CEDA_FX_GBP_PER_USD_2025
  const priceIndex = input.priceIndex2025 ?? CEDA_PRICE_INDEX_BASE
  const purchaserProducer = input.purchaserProducer ?? 1
  const steps: Step[] = []
  let usd = input.spend
  if (input.currency === 'GBP') {
    usd = input.spend / fx
    steps.push({
      label: `Convert £ to USD (CEDA 2025 FX ${formatFactor(fx)} GBP per $)`,
      value: `£${formatNumber(input.spend)} ÷ ${formatFactor(fx)} = ${formatFactor(usd)} USD`,
    })
  } else {
    steps.push({
      label: 'Spend in factor currency (USD)',
      value: `${formatFactor(usd)} USD`,
    })
  }
  const usd2023 = priceIndex === 0 ? usd : usd * (CEDA_PRICE_INDEX_BASE / priceIndex)
  steps.push({
    label: `Deflate to CEDA base year ${CEDA_BASE_YEAR} (2025 price index ${formatFactor(priceIndex)}, base 100)`,
    value: `${formatFactor(usd)} × ${CEDA_PRICE_INDEX_BASE} ÷ ${formatFactor(priceIndex)} = ${formatFactor(usd2023)} 2023 USD`,
  })
  const producerUsd2023 = usd2023 * purchaserProducer
  steps.push({
    label: `Purchaser → producer price (BEA ratio ${formatFactor(purchaserProducer)})`,
    value: `${formatFactor(usd2023)} × ${formatFactor(purchaserProducer)} = ${formatFactor(producerUsd2023)} producer-price 2023 USD`,
  })
  return { producerUsd2023, steps }
}

export function buildCedaFactors(meta: { year: string; verifiedAt: string }): EmissionFactor[] {
  return CEDA_GBR_SECTORS.map((row) => ({
    key: row.key,
    name: `Spend — ${row.name} (UK, CEDA)`,
    category: 'Purchased goods',
    scope: 'Scope 3',
    conversionValue: row.kgPerUsd,
    unit: '$',
    sourceFamily: 'EIO',
    source: `${CEDA_ATTRIBUTION}, ${CEDA_VERSION} (${CEDA_LICENSE}; released ${CEDA_RELEASE}). GHG_t_Raw United Kingdom, BEA sector ${row.code}, kg CO₂e per 2023 producer-price US dollar (${row.kgPerUsd}). Purchaser–producer ${row.purchaserProducer}; 2025 price index ${row.priceIndex2025} (base 2023 = 100). tCO₂e = 2023 producer-price USD × kg/$ ÷ 1,000. Attribution: ${CEDA_ATTRIBUTION}. Spend-based only — not an A1–A3 material EPD.`,
    sourceUrl: '',
    region: 'United Kingdom',
    validFrom: `${meta.year}-01-01`,
    lastVerifiedAt: meta.verifiedAt,
    isPlaceholder: false,
    method: 'spend',
    spendCurrency: 'USD',
    fxGbpPerUsd: CEDA_FX_GBP_PER_USD_2025,
    purchaserProducer: row.purchaserProducer,
    priceIndex: row.priceIndex2025,
    cedaCode: row.code,
  }))
}
