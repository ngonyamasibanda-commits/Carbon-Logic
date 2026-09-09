import type { EmissionEntry } from './types'

/**
 * Science Based Targets initiative — corporate near-term and net-zero target setting.
 *
 * Near-term ambition uses the absolute contraction approach with the dynamic rate
 * adjustment introduced in Corporate Net-Zero Standard v1.3.1 (effective 14 April 2026),
 * which replaced the earlier post-2020 base year ratchet. Equation numbers below refer to
 * the CNZS v1.3.1 Method Appendix.
 */

export const SBTI_SOURCES = {
  methodAppendix: {
    label: 'CNZS v1.3.1 Method Appendix (April 2026)',
    url: 'https://files.sciencebasedtargets.org/production/files/CNZS-V1.3.1-Method-Appendix.pdf',
  },
  acaUpdate: {
    label: 'SBTi announcement: updated absolute contraction approach',
    url: 'https://sciencebasedtargets.org/news/the-sbti-updates-the-absolute-contraction-approach-to-improve-consistency-and-implementation-while-maintaining-net-zero-ambition',
  },
  criteria: {
    label: 'Near-term criteria v5.1',
    url: 'https://files.sciencebasedtargets.org/production/files/SBTi-criteria-v5.1.pdf',
  },
  manual: {
    label: 'SBTi Corporate Manual v2.1',
    url: 'https://files.sciencebasedtargets.org/production/files/SBTi-Corporate-Manual-v2.1.pdf',
  },
  standards: {
    label: 'SBTi standards and guidance',
    url: 'https://sciencebasedtargets.org/standards-and-guidance',
  },
} as const

/**
 * Pathway parameters, CNZS v1.3.1 Method Appendix Table 2.
 * NZA = net-zero ambition, NZY = net-zero year, larrMin = minimum linear annual reduction rate.
 */
export const PATHWAY_PARAMS = {
  scope1: { label: 'Scope 1', nza: 0.9, nzy: 2050, larrMin: 0.042 },
  scope2: { label: 'Scope 2', nza: 1, nzy: 2040, larrMin: 0.042 },
  scope3_15c: { label: 'Scope 3 (1.5°C)', nza: 0.9, nzy: 2050, larrMin: 0.042 },
  scope3_wb2c: { label: 'Scope 3 (well-below 2°C)', nza: 0.75, nzy: 2050, larrMin: 0.025 },
  flag: { label: 'FLAG', nza: 0.72, nzy: 2050, larrMin: 0.0303 },
} as const

export const EARLIEST_BASE_YEAR = 2015
export const MIN_TARGET_HORIZON_YEARS = 5
export const MAX_TARGET_HORIZON_YEARS = 10
export const SCOPE3_MATERIALITY_THRESHOLD = 0.4
export const SCOPE3_MIN_COVERAGE = 0.67
export const SCOPE12_MIN_COVERAGE = 0.95
export const NET_ZERO_MIN_REDUCTION = 0.9
export const NET_ZERO_LATEST_YEAR = 2050
export const NET_ZERO_SCOPE3_MIN_COVERAGE = 0.9

/** Equation 1 — initial dLARR from the most recent year to the pathway net-zero year. */
export function initialDlarr(nza: number, nzy: number, mostRecentYear: number): number {
  const years = nzy - mostRecentYear
  if (years <= 0) return nza
  return nza / years
}

export type DynamicTargetInput = {
  baseYear: number
  targetYear: number
  mostRecentYear: number
  baseEmissions: number
  mostRecentEmissions: number
  /** Blended (scope 1+2) or single-pathway initial dLARR from Equation 1. */
  initialRate: number
  larrMin: number
}

export type DynamicTargetResult = {
  initialRate: number
  /** Equation 2 — ambition measured from the most recent year. */
  initialAmbition: number
  /** Equation 3 — implied target year emissions before rebasing. */
  initialTargetEmissions: number
  /** Equation 4 — ambition restated against the base year. */
  convertedAmbition: number
  /** Equation 5 — the rate actually applied, after the minimum rate floor. */
  rate: number
  floorApplied: boolean
  /** Equation 6 — headline reduction a company publishes. */
  adjustedAmbition: number
  /** Equation 8 — target year emissions. */
  targetEmissions: number
}

/** Equations 2–8 of the dynamic rate adjustment. */
export function dynamicTarget(input: DynamicTargetInput): DynamicTargetResult {
  const {
    baseYear,
    targetYear,
    mostRecentYear,
    baseEmissions,
    mostRecentEmissions,
    initialRate,
    larrMin,
  } = input

  const targetSpan = targetYear - baseYear
  const initialAmbition = initialRate * Math.max(0, targetYear - mostRecentYear)
  const initialTargetEmissions = mostRecentEmissions * (1 - initialAmbition)
  const convertedAmbition =
    baseEmissions > 0 ? (baseEmissions - initialTargetEmissions) / baseEmissions : 0
  const unflooredRate = targetSpan > 0 ? convertedAmbition / targetSpan : 0
  const rate = Math.max(larrMin, unflooredRate)
  const adjustedAmbition = Math.min(1, Math.max(0, rate * targetSpan))

  return {
    initialRate,
    initialAmbition,
    initialTargetEmissions,
    convertedAmbition,
    rate,
    floorApplied: rate > unflooredRate,
    adjustedAmbition,
    targetEmissions: baseEmissions * (1 - adjustedAmbition),
  }
}

export type Scope3Ambition = '1.5C' | 'WB2C'

export type SbtiConfig = {
  baseYear: number
  targetYear: number
  submissionYear: number
  netZeroYear: number
  useLiveInventory: boolean
  /** Null means the field has not been entered yet (blank in the form). */
  baseScope1: number | null
  baseScope2: number | null
  baseScope3: number | null
  mostRecentYear: number
  recentScope1: number | null
  recentScope2: number | null
  recentScope3: number | null
  scope3Ambition: Scope3Ambition
  scope12Coverage: number
  scope3Coverage: number
  scope2Approach: 'location-based' | 'market-based'
  renewableElectricityTarget: boolean
  renewableShareBaseYear: number
  sellsFossilFuels: boolean
}

export type InventoryYear = {
  year: number
  scope1: number
  scope2: number
  scope3: number
  total: number
}

/** Aggregate logged entries into an annual scope inventory. */
export function inventoryByYear(entries: EmissionEntry[]): InventoryYear[] {
  const map = new Map<number, InventoryYear>()
  for (const entry of entries) {
    const year = new Date(entry.created_at).getFullYear()
    if (!Number.isFinite(year)) continue
    const row = map.get(year) ?? { year, scope1: 0, scope2: 0, scope3: 0, total: 0 }
    if (entry.scope === 'Scope 1') row.scope1 += entry.emissions_tco2e
    else if (entry.scope === 'Scope 2') row.scope2 += entry.emissions_tco2e
    else if (entry.scope === 'Scope 3') row.scope3 += entry.emissions_tco2e
    row.total += entry.emissions_tco2e
    map.set(year, row)
  }
  return [...map.values()].sort((a, b) => a.year - b.year)
}

export type TargetLeg = DynamicTargetResult & {
  label: string
  ambitionLabel: string
  baseEmissions: number
  absoluteCut: number
}

export type PathwayPoint = {
  year: number
  /** Near-term contraction. Omitted after the target year so the chart does not drop to zero. */
  required?: number
  /** Long-term net-zero contraction. Omitted before the target year. */
  netZero?: number
  actual?: number
}

function tonnes(value: number | null | undefined): number {
  return value == null || !Number.isFinite(value) ? 0 : value
}

/** When filling from logged entries, pull tonnes for the years the user chose. */
export function alignConfigWithInventory(config: SbtiConfig, inventory: InventoryYear[]): SbtiConfig {
  if (!config.useLiveInventory) return config
  const byYear = new Map(inventory.map((row) => [row.year, row]))
  const baseRow = byYear.get(config.baseYear)
  const recentRow = byYear.get(config.mostRecentYear)
  return {
    ...config,
    baseScope1: baseRow?.scope1 ?? 0,
    baseScope2: baseRow?.scope2 ?? 0,
    baseScope3: baseRow?.scope3 ?? 0,
    recentScope1: recentRow?.scope1 ?? 0,
    recentScope2: recentRow?.scope2 ?? 0,
    recentScope3: recentRow?.scope3 ?? 0,
  }
}

export type CriterionCheck = {
  id: string
  criterion: string
  label: string
  status: 'pass' | 'fail' | 'warn' | 'info'
  detail: string
}

export type SbtiResult = {
  baseTotal: number
  scope12Base: number
  scope3Base: number
  scope3Share: number
  scope3TargetRequired: boolean
  scope1Rate: number
  scope2Rate: number
  scope1Share: number
  s12: TargetLeg
  s3: TargetLeg
  netZeroEmissions: number
  pathway: PathwayPoint[]
  checks: CriterionCheck[]
  targetLanguage: string[]
}

function buildPathway(
  config: SbtiConfig,
  s12: TargetLeg,
  s3: TargetLeg,
  actualByYear: Map<number, number>,
): PathwayPoint[] {
  const baseTotal = s12.baseEmissions + s3.baseEmissions
  const targetTotal = s12.targetEmissions + s3.targetEmissions
  const netZeroTotal = baseTotal * (1 - NET_ZERO_MIN_REDUCTION)
  const points: PathwayPoint[] = []
  const lastYear = Math.max(config.netZeroYear, config.targetYear)

  for (let year = config.baseYear; year <= lastYear; year += 1) {
    const point: PathwayPoint = { year }

    if (year <= config.targetYear) {
      // Equation 8 applied to any year between the base year and the target year.
      const s12Year = s12.baseEmissions * (1 - s12.rate * (year - config.baseYear))
      const s3Year = s3.baseEmissions * (1 - s3.rate * (year - config.baseYear))
      point.required = Number((Math.max(0, s12Year) + Math.max(0, s3Year)).toFixed(3))
    }

    if (year >= config.targetYear && config.netZeroYear > config.targetYear) {
      const span = config.netZeroYear - config.targetYear
      const progress = span > 0 ? (year - config.targetYear) / span : 1
      point.netZero = Number((targetTotal + (netZeroTotal - targetTotal) * progress).toFixed(3))
    } else if (year === config.targetYear) {
      point.netZero = Number(targetTotal.toFixed(3))
    }

    if (actualByYear.has(year)) {
      point.actual = Number((actualByYear.get(year) ?? 0).toFixed(3))
    }

    points.push(point)
  }
  return points
}

function buildChecks(
  config: SbtiConfig,
  result: Omit<SbtiResult, 'checks' | 'targetLanguage'>,
): CriterionCheck[] {
  const checks: CriterionCheck[] = []
  const horizon = config.targetYear - config.submissionYear
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`

  checks.push({
    id: 'base-year',
    criterion: 'C13',
    label: 'Base year is 2015 or later',
    status: config.baseYear >= EARLIEST_BASE_YEAR ? 'pass' : 'fail',
    detail:
      config.baseYear >= EARLIEST_BASE_YEAR
        ? `Base year ${config.baseYear} is eligible.`
        : `Base year ${config.baseYear} is earlier than ${EARLIEST_BASE_YEAR} and cannot be validated.`,
  })

  const horizonOk = horizon >= MIN_TARGET_HORIZON_YEARS && horizon <= MAX_TARGET_HORIZON_YEARS
  checks.push({
    id: 'target-horizon',
    criterion: 'C13',
    label: 'Target year is 5–10 years from submission',
    status: horizonOk ? 'pass' : 'fail',
    detail: horizonOk
      ? `${horizon} years from a ${config.submissionYear} submission.`
      : `${horizon} years from a ${config.submissionYear} submission. Near-term targets must cover ${MIN_TARGET_HORIZON_YEARS}–${MAX_TARGET_HORIZON_YEARS} years; anything longer is assessed as a long-term target under the Net-Zero Standard.`,
  })

  checks.push({
    id: 'recent-year',
    criterion: 'C14',
    label: 'Recent year inventory provided',
    status: config.mostRecentYear >= config.baseYear ? 'pass' : 'fail',
    detail: `Progress is measured from the ${config.mostRecentYear} inventory. The dynamic rate uses this year to embed progress made since the base year.`,
  })

  checks.push({
    id: 'scope12-coverage',
    criterion: 'C5',
    label: 'Scope 1 + 2 boundary covers at least 95%',
    status: config.scope12Coverage / 100 >= SCOPE12_MIN_COVERAGE ? 'pass' : 'fail',
    detail: `Declared coverage ${config.scope12Coverage}%. No more than 5% of combined scope 1 and 2 emissions may be excluded.`,
  })

  checks.push({
    id: 'scope3-materiality',
    criterion: 'C4',
    label: 'Scope 3 target required when scope 3 is 40% or more of the inventory',
    status: result.scope3TargetRequired ? 'warn' : 'info',
    detail: result.scope3TargetRequired
      ? `Scope 3 is ${pct(result.scope3Share)} of total scope 1, 2 and 3 emissions, so a scope 3 target is mandatory.`
      : `Scope 3 is ${pct(result.scope3Share)} of total emissions, below the 40% threshold. A scope 3 target is encouraged but not required.`,
  })

  if (result.scope3TargetRequired) {
    checks.push({
      id: 'scope3-coverage',
      criterion: 'C6',
      label: 'Scope 3 targets cover at least 67% of scope 3 emissions',
      status: config.scope3Coverage / 100 >= SCOPE3_MIN_COVERAGE ? 'pass' : 'fail',
      detail: `Declared coverage ${config.scope3Coverage}% of total reported and excluded scope 3 emissions.`,
    })
  }

  checks.push({
    id: 's12-ambition',
    criterion: 'C15 / C16',
    label: 'Scope 1 + 2 ambition is 1.5°C aligned',
    status: result.s12.rate + 1e-9 >= PATHWAY_PARAMS.scope1.larrMin ? 'pass' : 'fail',
    detail: `${pct(result.s12.rate)} per year from ${config.baseYear} to ${config.targetYear}, blended from a ${pct(result.scope1Rate)} scope 1 rate and a ${pct(result.scope2Rate)} scope 2 rate at a ${(result.scope1Share * 100).toFixed(0)}:${((1 - result.scope1Share) * 100).toFixed(0)} emissions ratio.${result.s12.floorApplied ? ' The 4.2% minimum rate floor applies.' : ''}`,
  })

  checks.push({
    id: 's3-ambition',
    criterion: 'C18',
    label: 'Scope 3 ambition is at least well-below 2°C aligned',
    status: 'pass',
    detail: `${pct(result.s3.rate)} per year on the ${result.s3.ambitionLabel} pathway.${result.s3.floorApplied ? ` The ${pct(config.scope3Ambition === '1.5C' ? PATHWAY_PARAMS.scope3_15c.larrMin : PATHWAY_PARAMS.scope3_wb2c.larrMin)} minimum rate floor applies.` : ''}`,
  })

  checks.push({
    id: 'net-zero-year',
    criterion: 'Net-Zero Standard',
    label: 'Net-zero reached by 2050 at the latest',
    status: config.netZeroYear <= NET_ZERO_LATEST_YEAR ? 'pass' : 'fail',
    detail: `Long-term target set for ${config.netZeroYear}, requiring at least a ${pct(NET_ZERO_MIN_REDUCTION)} absolute cut before residual emissions are neutralised. Scope 3 long-term coverage must reach ${pct(NET_ZERO_SCOPE3_MIN_COVERAGE)}.`,
  })

  checks.push({
    id: 'scope2-2040',
    criterion: 'CNZS v1.3.1',
    label: 'Scope 2 modelled to zero by 2040',
    status: 'info',
    detail:
      'The dynamic rate assumes the power system decarbonises by 2040, so scope 2 uses a 100% ambition on a 2040 net-zero year while scope 1 uses 90% on 2050.',
  })

  checks.push({
    id: 'scope2-approach',
    criterion: 'C8',
    label: 'Scope 2 accounting approach disclosed',
    status: 'info',
    detail: `Using the ${config.scope2Approach} approach. The same approach must be used for target setting and progress tracking.`,
  })

  if (config.renewableElectricityTarget) {
    checks.push({
      id: 'renewable-electricity',
      criterion: 'C21',
      label: 'Renewable electricity alternative to a scope 2 target',
      status: 'info',
      detail: `Currently ${config.renewableShareBaseYear}% renewable. SBTi thresholds are 80% renewable electricity by 2025 and 100% by 2030.`,
    })
  }

  if (config.sellsFossilFuels) {
    checks.push({
      id: 'fossil-fuel-sales',
      criterion: 'C22',
      label: 'Use of sold products target for fossil fuel sales',
      status: 'warn',
      detail:
        'Companies that sell, transmit or distribute fossil fuels must set a 1.5°C aligned scope 3 target for use of sold products, regardless of its share of the inventory.',
    })
  }

  checks.push({
    id: 'recalculation',
    criterion: 'C26',
    label: 'Targets reviewed at least every 5 years',
    status: 'info',
    detail: `Review and, if needed, recalculate and revalidate by ${config.submissionYear + 5}. A significance threshold of 5% or less applies to base year recalculations.`,
  })

  return checks
}

function buildTargetLanguage(
  organisation: string,
  config: SbtiConfig,
  result: Omit<SbtiResult, 'checks' | 'targetLanguage'>,
): string[] {
  const org = organisation.trim() || 'The company'
  const round = (value: number) => Math.round(value * 100)
  const lines = [
    `${org} commits to reduce absolute scope 1 and 2 GHG emissions ${round(result.s12.adjustedAmbition)}% by ${config.targetYear} from a ${config.baseYear} base year.`,
  ]

  if (result.scope3TargetRequired) {
    lines.push(
      `${org} also commits to reduce absolute scope 3 GHG emissions ${round(result.s3.adjustedAmbition)}% within the same timeframe.`,
    )
  }

  if (config.renewableElectricityTarget) {
    lines.push(
      `${org} commits to increase annual sourcing of renewable electricity from ${config.renewableShareBaseYear}% in ${config.baseYear} to 100% by 2030.`,
    )
  }

  lines.push(
    `${org} commits to reach net-zero greenhouse gas emissions across the value chain by ${config.netZeroYear}.`,
  )

  return lines
}

export function calculateSbti(
  config: SbtiConfig,
  organisation: string,
  actualByYear: Map<number, number>,
): SbtiResult {
  const baseScope1 = tonnes(config.baseScope1)
  const baseScope2 = tonnes(config.baseScope2)
  const baseScope3 = tonnes(config.baseScope3)
  const recentScope1 = tonnes(config.recentScope1)
  const recentScope2 = tonnes(config.recentScope2)
  const recentScope3 = tonnes(config.recentScope3)
  const scope12Base = baseScope1 + baseScope2
  const scope3Base = baseScope3
  const baseTotal = scope12Base + scope3Base
  const scope3Share = baseTotal > 0 ? scope3Base / baseTotal : 0
  const scope3TargetRequired = scope3Share >= SCOPE3_MATERIALITY_THRESHOLD || config.sellsFossilFuels

  // Equation 1 per scope, then blended by the scope 1 : scope 2 emissions ratio.
  const scope1Rate = initialDlarr(
    PATHWAY_PARAMS.scope1.nza,
    Math.min(PATHWAY_PARAMS.scope1.nzy, config.netZeroYear),
    config.mostRecentYear,
  )
  const scope2Rate = initialDlarr(
    PATHWAY_PARAMS.scope2.nza,
    Math.min(PATHWAY_PARAMS.scope2.nzy, config.netZeroYear),
    config.mostRecentYear,
  )
  const scope1Share = scope12Base > 0 ? baseScope1 / scope12Base : 1
  const blendedRate = scope1Rate * scope1Share + scope2Rate * (1 - scope1Share)

  const s12Core = dynamicTarget({
    baseYear: config.baseYear,
    targetYear: config.targetYear,
    mostRecentYear: config.mostRecentYear,
    baseEmissions: scope12Base,
    mostRecentEmissions: recentScope1 + recentScope2,
    initialRate: blendedRate,
    larrMin: PATHWAY_PARAMS.scope1.larrMin,
  })

  const s3Params =
    config.scope3Ambition === '1.5C' ? PATHWAY_PARAMS.scope3_15c : PATHWAY_PARAMS.scope3_wb2c
  const s3Core = dynamicTarget({
    baseYear: config.baseYear,
    targetYear: config.targetYear,
    mostRecentYear: config.mostRecentYear,
    baseEmissions: scope3Base,
    mostRecentEmissions: recentScope3,
    initialRate: initialDlarr(
      s3Params.nza,
      Math.min(s3Params.nzy, config.netZeroYear),
      config.mostRecentYear,
    ),
    larrMin: s3Params.larrMin,
  })

  const s12: TargetLeg = {
    ...s12Core,
    label: 'Scope 1 + 2',
    ambitionLabel: '1.5°C',
    baseEmissions: scope12Base,
    absoluteCut: scope12Base * s12Core.adjustedAmbition,
  }
  const s3: TargetLeg = {
    ...s3Core,
    label: 'Scope 3',
    ambitionLabel: config.scope3Ambition === '1.5C' ? '1.5°C' : 'well-below 2°C',
    baseEmissions: scope3Base,
    absoluteCut: scope3Base * s3Core.adjustedAmbition,
  }

  const core = {
    baseTotal,
    scope12Base,
    scope3Base,
    scope3Share,
    scope3TargetRequired,
    scope1Rate,
    scope2Rate,
    scope1Share,
    s12,
    s3,
    netZeroEmissions: baseTotal * (1 - NET_ZERO_MIN_REDUCTION),
    pathway: buildPathway(config, s12, s3, actualByYear),
  }

  return {
    ...core,
    checks: buildChecks(config, core),
    targetLanguage: buildTargetLanguage(organisation, config, core),
  }
}
