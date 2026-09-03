/**
 * Checks the dLARR implementation against the reference rates published in
 * CNZS v1.3.1 Method Appendix, Table 1.
 */
import { calculateSbti, type SbtiConfig } from '../src/lib/sbti'

function config(overrides: Partial<SbtiConfig>): SbtiConfig {
  return {
    baseYear: 2025,
    targetYear: 2035,
    submissionYear: 2026,
    netZeroYear: 2050,
    useLiveInventory: false,
    baseScope1: 50,
    baseScope2: 50,
    baseScope3: 0,
    mostRecentYear: 2025,
    recentScope1: 50,
    recentScope2: 50,
    recentScope3: 0,
    scope3Ambition: 'WB2C',
    scope12Coverage: 100,
    scope3Coverage: 67,
    scope2Approach: 'location-based',
    renewableElectricityTarget: false,
    renewableShareBaseYear: 0,
    sellsFossilFuels: false,
    ...overrides,
  }
}

const cases: Array<{ name: string; actual: number; expected: number }> = []

for (const year of [2024, 2025, 2026]) {
  const shared = { baseYear: year, mostRecentYear: year }
  const expected5050 = { 2024: 4.86, 2025: 5.13, 2026: 5.45 }[year] as number
  const expected1000 = { 2024: 4.2, 2025: 4.2, 2026: 4.2 }[year] as number
  const expected0100 = { 2024: 6.25, 2025: 6.67, 2026: 7.14 }[year] as number
  const expectedWb2c = { 2024: 2.88, 2025: 3.0, 2026: 3.13 }[year] as number
  const expected15c = { 2024: 4.2, 2025: 4.2, 2026: 4.2 }[year] as number

  cases.push({
    name: `BY ${year} combined scope 1+2, 50:50 ratio`,
    actual: calculateSbti(config(shared), 'Test', new Map()).s12.rate * 100,
    expected: expected5050,
  })
  cases.push({
    name: `BY ${year} combined scope 1+2, 100:0 ratio (floored)`,
    actual:
      calculateSbti(
        config({ ...shared, baseScope1: 100, baseScope2: 0, recentScope1: 100, recentScope2: 0 }),
        'Test',
        new Map(),
      ).s12.rate * 100,
    expected: expected1000,
  })
  cases.push({
    name: `BY ${year} combined scope 1+2, 0:100 ratio`,
    actual:
      calculateSbti(
        config({ ...shared, baseScope1: 0, baseScope2: 100, recentScope1: 0, recentScope2: 100 }),
        'Test',
        new Map(),
      ).s12.rate * 100,
    expected: expected0100,
  })
  cases.push({
    name: `BY ${year} scope 3, well-below 2°C`,
    actual:
      calculateSbti(
        config({ ...shared, baseScope3: 100, recentScope3: 100 }),
        'Test',
        new Map(),
      ).s3.rate * 100,
    expected: expectedWb2c,
  })
  cases.push({
    name: `BY ${year} scope 3, 1.5°C (floored)`,
    actual:
      calculateSbti(
        config({ ...shared, baseScope3: 100, recentScope3: 100, scope3Ambition: '1.5C' }),
        'Test',
        new Map(),
      ).s3.rate * 100,
    expected: expected15c,
  })
}

let failed = 0
for (const item of cases) {
  const ok = Math.abs(item.actual - item.expected) < 0.006
  if (!ok) failed += 1
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${item.name.padEnd(48)} got ${item.actual.toFixed(2)}%  expected ${item.expected.toFixed(2)}%`,
  )
}

const headline = calculateSbti(config({}), 'Carbon Logic', new Map())
console.log(
  `\n2025 base year, 2035 target, 50:50 scope 1:2 -> ${(headline.s12.adjustedAmbition * 100).toFixed(1)}% reduction`,
)

process.exit(failed > 0 ? 1 : 0)
