/**
 * Per-activity conversion steps, then DESNZ kg→tonne.
 *
 *   npm run verify:emissions
 */
import { getCategory } from '../src/lib/categories'
import { FACTOR_CATALOG } from '../src/lib/factor-catalog'
import { calculateTco2e } from '../src/lib/calculate'
import { workingFromForm, inventoryTco2e } from '../src/lib/emissions'
import type { EmissionFactor } from '../src/lib/types'

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

function factor(key: string): EmissionFactor {
  const row = FACTOR_CATALOG.find((item) => item.key === key)
  if (!row) throw new Error(`missing ${key}`)
  return row
}

console.log('\nEmissions calculator\n')

check(
  'DESNZ last step is activity × kg ÷ 1,000',
  inventoryTco2e(1000, 0.13096) === 0.13096 && calculateTco2e(1000, 0.13096) === 0.13096,
)

const diesel = getCategory('site_fuel')
if (diesel) {
  const working = workingFromForm(
    diesel,
    { fuel: 'Diesel / gas oil', amount: '1000', unit: 'L', unit_factor: '1' },
    factor('diesel_litre'),
  )
  check(
    '1,000 L diesel is 2.584 tCO₂e (litres × 2.58354 ÷ 1,000)',
    Math.abs(working.tco2e - 2.58354) < 1e-9,
    String(working.tco2e),
  )
}

const waste = getCategory('waste')
if (waste) {
  const tonnes = workingFromForm(
    waste,
    { route: 'Landfill', amount: '1', unit: 't', unit_factor: '1' },
    factor('waste_landfill_kg'),
  )
  check(
    '1 tonne construction landfill matches DESNZ 1.27043 kg/t → 0.00127043 tCO₂e',
    Math.abs(tonnes.tco2e - 0.00127043) < 1e-12,
    String(tonnes.tco2e),
  )
  check(
    'waste working shows the published 1.27043 factor, not a 3-decimal 1.27',
    tonnes.formula.includes('1.27043') && tonnes.formula.includes('0.00127043'),
    tonnes.formula,
  )
  const kg = workingFromForm(
    waste,
    { route: 'Landfill', amount: '1000', unit: 'kg', unit_factor: '0.001' },
    factor('waste_landfill_kg'),
  )
  check('1,000 kg waste converts to 1 t then uses the per-tonne factor', Math.abs(kg.tco2e - tonnes.tco2e) < 1e-12)
}

const freight = getCategory('road_freight')
if (freight) {
  const working = workingFromForm(
    freight,
    {
      mode: 'HGV rigid',
      weight: '10',
      weight_unit: 't',
      weight_unit_factor: '1',
      distance: '100',
      distance_unit: 'km',
      distance_unit_factor: '1',
    },
    factor('freight_road_rigid_tkm'),
  )
  check(
    '10 t × 100 km rigid HGV is 1,000 tkm × 0.19947 ÷ 1,000',
    Math.abs(working.tco2e - 0.19947) < 1e-9,
    String(working.tco2e),
  )
  check('freight working names tonne-kilometres', working.steps.some((step) => /tonne-kilometre/i.test(step.label)))
}

const flights = getCategory('business_travel')
if (flights) {
  const working = workingFromForm(
    flights,
    { type: 'Short-haul flight', passengers: '2', amount: '500' },
    factor('flight_shorthaul_pkm'),
  )
  check(
    '2 passengers × 500 km short-haul with RF is 1,000 pkm × 0.12576 ÷ 1,000',
    Math.abs(working.tco2e - 0.12576) < 1e-9,
    String(working.tco2e),
  )
  const taxi = workingFromForm(
    flights,
    { type: 'Taxi', passengers: '1', amount: '10' },
    factor('taxi_pkm'),
  )
  check(
    'taxi uses passenger.km 0.14861 not vehicle-km 0.20806',
    Math.abs(taxi.tco2e - 0.0014861) < 1e-9,
    String(taxi.tco2e),
  )
  const hotel = workingFromForm(
    flights,
    { type: 'Hotel', hotel_country: 'United States', amount: '2' },
    factor('hotel_usa_night'),
  )
  check(
    '2 US hotel nights use 16.1 kg/night, not an overseas average',
    Math.abs(hotel.tco2e - 0.0322) < 1e-9,
    String(hotel.tco2e),
  )
}

const spend = getCategory('purchased_goods')
if (spend) {
  const working = workingFromForm(
    spend,
    { type: 'Purchased goods & services', amount: '10000' },
    factor('purchased_goods_gbp'),
  )
  check(
    '£10,000 spend uses kg/£ not kg/£k',
    Math.abs(working.tco2e - 8.559280439858236) < 1e-9,
    String(working.tco2e),
  )
}

const gas = getCategory('refrigerants')
if (gas) {
  const working = workingFromForm(
    gas,
    { gas: 'R-134A', amount: '2', unit: 'kg', unit_factor: '1' },
    factor('r134a_kg'),
  )
  check(
    '2 kg R-134a is GWP 1300 → 2.6 tCO₂e',
    Math.abs(working.tco2e - 2.6) < 1e-9,
    String(working.tco2e),
  )
}

const air = getCategory('air_freight')
if (air) {
  const withRf = workingFromForm(
    air,
    {
      weight: '1',
      weight_unit_factor: '1',
      distance: '1',
      distance_unit_factor: '1',
      rf: 'With RF (DESNZ default)',
    },
    factor('freight_air_tkm'),
  )
  check('short-haul air freight with RF is 1.27835 kg/tkm', Math.abs(withRf.tco2e - 0.00127835) < 1e-12)
}

if (failed) {
  console.log(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed, 0 failed`)
