/**
 * Bulk-upload templates must include every form field and unit column
 * for each category, and imports must apply the same unit conversion
 * as the on-screen form.
 *
 *   npm run verify:bulk
 */
import { CATEGORIES, getCategory } from '../src/lib/categories'
import {
  activityAmountFromBulkRow,
  buildCategoryTemplate,
  bulkColumnsForCategory,
  normalizeBulkRow,
  parseBulkAmount,
  resolveBulkHeader,
} from '../src/lib/bulk-upload'
import { parseCsv } from '../src/lib/csv'

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

function main() {
  console.log('\nBulk upload templates\n')

  const siteFuel = getCategory('site_fuel')
  if (!siteFuel) throw new Error('site_fuel missing')

  const fuelColumns = bulkColumnsForCategory(siteFuel)
  check(
    'site_fuel template includes amount',
    fuelColumns.some((column) => column.key === 'amount'),
  )
  check(
    'site_fuel template includes unit of measure',
    fuelColumns.some((column) => column.key === 'unit' && column.header === 'Unit of measure'),
  )
  check(
    'site_fuel template includes fuel category',
    fuelColumns.some((column) => column.key === 'fuel'),
  )

  const csv = buildCategoryTemplate(siteFuel)
  const rows = parseCsv(csv)
  check('site_fuel template has an example data row', rows.length === 1)
  check(
    'site_fuel example row uses labelled amount and unit headers',
    rows[0]?.['Fuel amount'] === '100' && rows[0]?.['Unit of measure'] === 'L',
  )

  for (const category of CATEGORIES) {
    const columns = bulkColumnsForCategory(category)
    const keys = new Set(columns.map((column) => column.key))
    const missingFields = category.fields
      .map((field) => field.key)
      .filter((key) => !keys.has(key))
    check(
      `${category.id} includes every form field`,
      missingFields.length === 0,
      missingFields.join(','),
    )

    if (category.unitOptions?.length && !category.fields.some((field) => field.key === 'unit')) {
      check(`${category.id} includes category unit column`, keys.has('unit'))
    }

    for (const field of category.fields) {
      if (!field.unitOptions?.length) continue
      check(
        `${category.id} includes ${field.key}_unit`,
        keys.has(`${field.key}_unit`),
      )
    }
  }

  const road = getCategory('road_freight')
  if (!road) throw new Error('road_freight missing')
  const roadKeys = bulkColumnsForCategory(road).map((column) => column.key)
  check(
    'road_freight includes weight_unit and distance_unit',
    roadKeys.includes('weight_unit') && roadKeys.includes('distance_unit'),
  )

  check(
    'headers resolve from form labels',
    resolveBulkHeader('Fuel amount', siteFuel) === 'amount' &&
      resolveBulkHeader('Unit of measure', siteFuel) === 'unit',
  )

  const labelled = normalizeBulkRow(
    {
      'Fuel category': 'Diesel / gas oil',
      'Fuel amount': '1,250',
      'Unit of measure': 'm³',
    },
    siteFuel,
  )
  check('label headers map onto keys', labelled.fuel === 'Diesel / gas oil')
  check('comma-formatted amounts parse', parseBulkAmount(labelled.amount) === 1250)
  check(
    'm³ converts to litres for site_fuel activity amount',
    activityAmountFromBulkRow(labelled, siteFuel) === 1_250_000,
  )

  const freight = normalizeBulkRow(
    {
      mode: 'HGV rigid',
      weight: '10',
      weight_unit: 't',
      distance: '50',
      distance_unit: 'mi',
    },
    road,
  )
  const tkm = activityAmountFromBulkRow(freight, road)
  check(
    'road freight applies distance unit conversion to tkm',
    Math.abs(tkm - 10 * 50 * 1.60934) < 0.001,
    `got ${tkm}`,
  )

  console.log(`\n${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exit(1)
}

main()
