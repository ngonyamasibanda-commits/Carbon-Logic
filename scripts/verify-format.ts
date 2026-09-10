/**
 * Display rounding: at most three decimal places (or three significant
 * figures for values below 0.001).
 *
 *   npm run verify:format
 */
import { formatCsvNumber, formatNumber, formatPercent, formatTco2e, roundDisplay } from '../src/lib/format'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  PASS  ${name}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function fractionDigits(value: string) {
  const plain = value.replaceAll(',', '')
  if (/e/i.test(plain)) return 0
  const part = plain.split('.')[1]
  return part ? part.length : 0
}

console.log('\nDisplay number formatting\n')

check('caps a long float at three decimal places', formatNumber(1.23456789) === '1.235', formatNumber(1.23456789))
check('does not pad whole numbers with zeros', formatNumber(12) === '12', formatNumber(12))
check('keeps a trailing useful decimal', formatNumber(12.5) === '12.5', formatNumber(12.5))
check('zero is a short zero', formatNumber(0) === '0')
check('non-finite values are an em dash', formatNumber(Number.NaN) === '—' && formatNumber(Infinity) === '—')
check(
  'floating-point noise does not spill past three decimals',
  fractionDigits(formatNumber(0.1 + 0.2)) <= 3,
  formatNumber(0.1 + 0.2),
)
check(
  'a tiny factor keeps three significant figures instead of 0.000',
  formatNumber(0.0001234) === '0.000123',
  formatNumber(0.0001234),
)
check('tCO₂e helper can include the unit', formatTco2e(1.23456, true) === '1.235 tCO₂e', formatTco2e(1.23456, true))
check('percentages stay at one decimal by default', formatPercent(12.34) === '12.3%', formatPercent(12.34))
check('CSV cells use three fixed decimals and no grouping', formatCsvNumber(1234.5) === '1234.500', formatCsvNumber(1234.5))
check('roundDisplay matches the three-decimal cap', roundDisplay(1.23456) === 1.235, String(roundDisplay(1.23456)))
check(
  'a large KPI figure stays compact with grouping',
  formatNumber(123456.7890123) === '123,456.789',
  formatNumber(123456.7890123),
)

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
