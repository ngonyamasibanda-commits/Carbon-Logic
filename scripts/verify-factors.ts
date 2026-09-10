/**
 * Published catalogue values must match DESNZ/DEFRA 2026, Defra spend
 * multipliers to 2023, and the remaining ICE v4.1 / NPI / IPCC rows.
 *
 *   npm run verify:factors
 */
import { FACTOR_CATALOG, FACTOR_VERIFIED_AT, FACTOR_YEAR } from '../src/lib/factor-catalog'
import { calculateTco2e } from '../src/lib/calculate'
import { mergeFactorMaps } from '../src/lib/factors-store'

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

function byKey(key: string) {
  const factor = FACTOR_CATALOG.find((row) => row.key === key)
  if (!factor) {
    check(`catalog includes ${key}`, false)
    return null
  }
  return factor
}

function expectValue(key: string, value: number, digits = 10) {
  const factor = byKey(key)
  if (!factor) return
  const ok = Math.abs(factor.conversionValue - value) < 10 ** -digits
  check(
    `${key} = ${value}`,
    ok,
    `got ${factor.conversionValue}`,
  )
}

console.log('\nEmission factor catalogue (2026)\n')

check('reporting year is 2026', FACTOR_YEAR === '2026', FACTOR_YEAR)
check(
  'lastVerifiedAt is 2026-09-10 so it replaces cached 2025 rows',
  FACTOR_VERIFIED_AT === '2026-09-10',
  FACTOR_VERIFIED_AT,
)

const keys = FACTOR_CATALOG.map((row) => row.key)
check('keys are unique', new Set(keys).size === keys.length, String(keys.length))
check(
  'every row is dated 2026 and verified 2026-09-10',
  FACTOR_CATALOG.every(
    (row) => row.validFrom.startsWith('2026') && row.lastVerifiedAt === '2026-09-10' && !row.isPlaceholder,
  ),
)

expectValue('electricity_grid_kwh', 0.13096)
expectValue('electricity_renewable_kwh', 0)
expectValue('electricity_td_kwh', 0.01299)
expectValue('heat_steam_kwh', 0.17529)
expectValue('natural_gas_kwh', 0.18231)
expectValue('natural_gas_m3', 2.02633)
expectValue('diesel_litre', 2.58354)
expectValue('petrol_litre', 2.075)
expectValue('lpg_litre', 1.55713)
expectValue('hvo_litre', 0.03558)
expectValue('gas_oil_litre', 2.75541)
expectValue('marine_gas_oil_litre', 2.77139)
expectValue('aviation_turbine_litre', 2.54269)
expectValue('r404a_kg', 3943)
expectValue('r410a_kg', 1924)
expectValue('r134a_kg', 1300)
expectValue('co2_kg', 1)
expectValue('freight_road_tkm', 0.10356)
expectValue('freight_rail_tkm', 0.02583)
expectValue('freight_sea_tkm', 0.01612)
expectValue('freight_air_tkm', 0.75539)
expectValue('waste_landfill_kg', 0.00127043)
expectValue('waste_recycling_kg', 0.00101398)
expectValue('water_m3', 0.1913)
expectValue('wastewater_m3', 0.17088)
expectValue('crew_van_km', 0.16591)
expectValue('crew_bus_pkm', 0.10151)
expectValue('crew_rail_pkm', 0.03092)
expectValue('commute_car_km', 0.16591)
expectValue('commute_bus_pkm', 0.10151)
expectValue('commute_rail_pkm', 0.03092)
expectValue('commute_motorbike_km', 0.11367)
expectValue('taxi_km', 0.20806)
expectValue('material_concrete_t', 118.80307)
expectValue('material_timber_t', 269.50416)
expectValue('material_asphalt_t', 39.21249)
expectValue('material_aggregates_t', 7.80307)
expectValue('material_metals_t', 3821.94858)
expectValue('material_bricks_t', 241.80307)
expectValue('material_insulation_t', 1861.80307)
expectValue('material_plasterboard_t', 120.05)
expectValue('material_glass_t', 1402.76667)
expectValue('material_pvc_t', 2942.43735)
expectValue('material_soil_t', 0)
expectValue('wtt_diesel_litre', 0.61101)
expectValue('wtt_petrol_litre', 0.58094)
expectValue('wtt_lpg_litre', 0.18551)
expectValue('wtt_gas_oil_litre', 0.62665)
expectValue('wtt_natural_gas_kwh', 0.03021)
expectValue('wtt_electricity_kwh', 0.03682)
expectValue('flight_domestic_pkm', 0.22928)
expectValue('flight_shorthaul_pkm', 0.12576)
expectValue('flight_longhaul_economy_pkm', 0.11704)
expectValue('flight_longhaul_business_pkm', 0.3394)
expectValue('hotel_uk_night', 10.4)
expectValue('hotel_overseas_night', 40.28648648648648)
expectValue('purchased_goods_gbp', 855.9280439858236)
expectValue('capital_goods_gbp', 698.7898127964011)
expectValue('material_steel_t', 1550)
expectValue('material_rebar_t', 1990)
expectValue('material_cement_t', 910)
expectValue('material_aluminium_t', 13100)
expectValue('material_copper_t', 3830)
expectValue('material_lime_t', 760)
expectValue('explosives_anfo_kg', 0.22)
expectValue('explosives_emulsion_kg', 0.14)
expectValue('mine_ch4_t', 28000)
expectValue('mine_ch4_kg', 28)
expectValue('mine_ch4_m3', 20.08)

const grid = byKey('electricity_grid_kwh')
const wttElec = byKey('wtt_electricity_kwh')
const spend = byKey('purchased_goods_gbp')
const taxi = byKey('taxi_km')
const soil = byKey('material_soil_t')
const overseas = byKey('hotel_overseas_night')

if (grid) {
  check('UK electricity cites the 2026 GOV.UK publication', grid.sourceUrl.includes('conversion-factors-2026'))
  check('UK electricity is DESNZ', grid.sourceFamily === 'DESNZ')
  check(
    '1 MWh of UK grid electricity is 0.131 tCO₂e',
    Math.abs(calculateTco2e(1000, grid.conversionValue) - 0.13096) < 1e-12,
    String(calculateTco2e(1000, grid.conversionValue)),
  )
}
if (wttElec) {
  check(
    'WTT electricity is generation, not T&D',
    wttElec.name.includes('generation') && wttElec.source.toLowerCase().includes('generation'),
    wttElec.name,
  )
}
if (spend) {
  check('spend-based family is EIO', spend.sourceFamily === 'EIO')
  check(
    '£10k purchased goods is about 8.56 tCO₂e, not 0.004',
    Math.abs(calculateTco2e(10, spend.conversionValue) - 8.559280439858236) < 1e-9,
    String(calculateTco2e(10, spend.conversionValue)),
  )
}
if (taxi) {
  check('taxi uses the per-km official row', taxi.unit === 'km' && taxi.source.includes('vehicle-km'))
}
if (soil) {
  check('soils primary production is withdrawn (0), not invented', soil.conversionValue === 0)
}
if (overseas) {
  check('overseas hotel cites the 37-country mean', overseas.source.includes('37'))
}

const stale = FACTOR_CATALOG.filter(
  (row) =>
    row.source.includes('2025 (DESNZ') ||
    row.source.includes('ICE) Database v3.0') ||
    row.sourceUrl.includes('conversion-factors-2025'),
)
check('no leftover 2025 / ICE v3.0 citations', stale.length === 0, stale.map((row) => row.key).join(', '))

const catalogGrid = FACTOR_CATALOG.find((row) => row.key === 'electricity_grid_kwh')
if (catalogGrid) {
  const staleCache = {
    ...catalogGrid,
    conversionValue: 0.177,
    lastVerifiedAt: '2026-09-03',
    source: 'UK GHG Conversion Factors for Company Reporting 2025',
  }
  const newerOverride = {
    ...catalogGrid,
    conversionValue: 0.2,
    lastVerifiedAt: '2026-09-11',
    source: 'Organisation EPD override',
  }
  const replaced = mergeFactorMaps(FACTOR_CATALOG, [staleCache], [])
  const kept = mergeFactorMaps(FACTOR_CATALOG, [newerOverride], [])
  check(
    'a cached 2025 electricity row is replaced by the 2026 catalogue',
    replaced.get('electricity_grid_kwh')?.conversionValue === 0.13096,
    String(replaced.get('electricity_grid_kwh')?.conversionValue),
  )
  check(
    'a newer organisation override still wins',
    kept.get('electricity_grid_kwh')?.conversionValue === 0.2,
    String(kept.get('electricity_grid_kwh')?.conversionValue),
  )
}

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
