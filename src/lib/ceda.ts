import type { EmissionFactor } from './types'
import { formatFactor, formatNumber } from './format'

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

/**
 * Open CEDA GHG_t_Raw United Kingdom rows (kg CO₂e per 2023 producer-price US dollar)
 * plus the matching purchaser–producer conversion and 2025 BEA sector price index
 * from the same workbook. Construction, mining, and logistics sectors only.
 */
export const CEDA_GBR_SECTORS = [
  { key: 'ceda_gbr_2332c0_usd', code: '2332C0', name: 'Transportation structures and highways and streets', kgPerUsd: 0.3214925507, purchaserProducer: 0.8563989562, priceIndex2025: 110.37 },
  { key: 'ceda_gbr_233230_usd', code: '233230', name: 'Manufacturing structures', kgPerUsd: 0.2101637188, purchaserProducer: 0.8563989562, priceIndex2025: 93.22 },
  { key: 'ceda_gbr_2332d0_usd', code: '2332D0', name: 'Other nonresidential structures', kgPerUsd: 0.2906051233, purchaserProducer: 0.8563989562, priceIndex2025: 102.89 },
  { key: 'ceda_gbr_2332a0_usd', code: '2332A0', name: 'Office and commercial structures', kgPerUsd: 0.2307772714, purchaserProducer: 0.8563989562, priceIndex2025: 93.02 },
  { key: 'ceda_gbr_230301_usd', code: '230301', name: 'Nonresidential maintenance and repair', kgPerUsd: 0.328491471, purchaserProducer: 0.8563989562, priceIndex2025: 107.69 },
  { key: 'ceda_gbr_212100_usd', code: '212100', name: 'Coal mining', kgPerUsd: 7.740643083, purchaserProducer: 0.714840875, priceIndex2025: 103.45 },
  { key: 'ceda_gbr_212230_usd', code: '212230', name: 'Copper, nickel, lead, and zinc mining', kgPerUsd: 0.3009418924, purchaserProducer: 0.8573045267, priceIndex2025: 115.23 },
  { key: 'ceda_gbr_2122a0_usd', code: '2122A0', name: 'Iron, gold, silver, and other metal ore mining', kgPerUsd: 0.2317610029, purchaserProducer: 0.8353304418, priceIndex2025: 100.16 },
  { key: 'ceda_gbr_212310_usd', code: '212310', name: 'Stone mining and quarrying', kgPerUsd: 0.5068083838, purchaserProducer: 0.7234921103, priceIndex2025: 114.56 },
  { key: 'ceda_gbr_2123a0_usd', code: '2123A0', name: 'Other nonmetallic mineral mining and quarrying', kgPerUsd: 0.8528703394, purchaserProducer: 0.6038201565, priceIndex2025: 120.85 },
  { key: 'ceda_gbr_21311a_usd', code: '21311A', name: 'Other support activities for mining', kgPerUsd: 0.3022355277, purchaserProducer: 0.8563989562, priceIndex2025: 93.5 },
  { key: 'ceda_gbr_327320_usd', code: '327320', name: 'Ready-mix concrete manufacturing', kgPerUsd: 0.8546521694, purchaserProducer: 0.5974999509, priceIndex2025: 104.14 },
  { key: 'ceda_gbr_324121_usd', code: '324121', name: 'Asphalt paving mixture and block manufacturing', kgPerUsd: 1.594679212, purchaserProducer: 0.7888358209, priceIndex2025: 97.31 },
  { key: 'ceda_gbr_327200_usd', code: '327200', name: 'Glass and glass product manufacturing', kgPerUsd: 0.7718288475, purchaserProducer: 0.7088139095, priceIndex2025: 112.68 },
  { key: 'ceda_gbr_321100_usd', code: '321100', name: 'Sawmills and wood preservation', kgPerUsd: 0.3593590506, purchaserProducer: 0.8057632023, priceIndex2025: 127.69 },
  { key: 'ceda_gbr_326120_usd', code: '326120', name: 'Plastics pipe, pipe fitting, and unlaminated profile shape manufacturing', kgPerUsd: 0.7155004457, purchaserProducer: 0.7776738801, priceIndex2025: 83.51 },
  { key: 'ceda_gbr_484000_usd', code: '484000', name: 'Truck transportation', kgPerUsd: 0.6004651426, purchaserProducer: 0.8563989562, priceIndex2025: 100.31 },
  { key: 'ceda_gbr_482000_usd', code: '482000', name: 'Rail transportation', kgPerUsd: 0.3120188187, purchaserProducer: 0.8563989562, priceIndex2025: 103.66 },
  { key: 'ceda_gbr_483000_usd', code: '483000', name: 'Water transportation', kgPerUsd: 1.586310238, purchaserProducer: 0.8563989562, priceIndex2025: 99.8 },
  { key: 'ceda_gbr_481000_usd', code: '481000', name: 'Air transportation', kgPerUsd: 1.945450688, purchaserProducer: 0.8563989562, priceIndex2025: 100.96 },
  { key: 'ceda_gbr_493000_usd', code: '493000', name: 'Warehousing and storage', kgPerUsd: 0.1302957075, purchaserProducer: 0.8563989562, priceIndex2025: 109.66 },
  { key: 'ceda_gbr_492000_usd', code: '492000', name: 'Couriers and messengers', kgPerUsd: 0.1672749998, purchaserProducer: 0.8563989562, priceIndex2025: 96.53 },
  { key: 'ceda_gbr_541300_usd', code: '541300', name: 'Architectural, engineering, and related services', kgPerUsd: 0.1314409547, purchaserProducer: 0.8563989562, priceIndex2025: 100.07 },
  { key: 'ceda_gbr_532400_usd', code: '532400', name: 'Commercial and industrial machinery and equipment rental and leasing', kgPerUsd: 0.1852635299, purchaserProducer: 0.8563989562, priceIndex2025: 107.38 },
  { key: 'ceda_gbr_562000_usd', code: '562000', name: 'Waste management and remediation services', kgPerUsd: 1.021732876, purchaserProducer: 0.8563989562, priceIndex2025: 109.83 },
  { key: 'ceda_gbr_333120_usd', code: '333120', name: 'Construction machinery manufacturing', kgPerUsd: 0.7792369598, purchaserProducer: 0.730220179, priceIndex2025: 103.99 },
  { key: 'ceda_gbr_333130_usd', code: '333130', name: 'Mining and oil and gas field machinery manufacturing', kgPerUsd: 1.002547368, purchaserProducer: 0.5896589659, priceIndex2025: 109.81 },
  { key: 'ceda_gbr_221300_usd', code: '221300', name: 'Water, sewage and other systems', kgPerUsd: 0.2360783098, purchaserProducer: 0.8563989562, priceIndex2025: 99.34 },
] as const

export type CedaSector = (typeof CEDA_GBR_SECTORS)[number]

export const CEDA_SECTOR_OPTIONS = CEDA_GBR_SECTORS.map((row) => row.name)

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
