/**
 * Published catalogue values must match DESNZ/DEFRA 2026, Defra spend
 * multipliers to 2023, and NPI / IPCC rows. ICE material rows are not shipped.
 *
 *   npm run verify:factors
 */
import { FACTOR_CATALOG, FACTOR_VERIFIED_AT, FACTOR_YEAR } from '../src/lib/factor-catalog'
import { calculateTco2e } from '../src/lib/calculate'
import { mergeFactorMaps, parseFactorSpreadsheet } from '../src/lib/factors-store'
import {
  EPD_REQUIRED_MATERIALS,
  conversionToPerTonne,
  epdTemplateCsv,
  isEpdRequiredKey,
} from '../src/lib/epd-materials'
import { CEDA_ATTRIBUTION, CEDA_FX_GBP_PER_USD_2025, cedaSectorByKey } from '../src/lib/ceda'
import { EPA_US_EGRID_AVG_KG_PER_KWH, EPA_US_TD_KG_PER_KWH } from '../src/lib/epa-catalog'

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
  'lastVerifiedAt is 2026-09-11 so published rows replace stale caches',
  FACTOR_VERIFIED_AT === '2026-09-11',
  FACTOR_VERIFIED_AT,
)

const keys = FACTOR_CATALOG.map((row) => row.key)
check('keys are unique', new Set(keys).size === keys.length, String(keys.length))
check(
  'every row is dated 2026 and verified 2026-09-11',
  FACTOR_CATALOG.every(
    (row) => row.validFrom.startsWith('2026') && row.lastVerifiedAt === '2026-09-11' && !row.isPlaceholder,
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
expectValue('freight_air_tkm', 1.27835)
expectValue('freight_air_tkm_no_rf', 0.75539)
expectValue('waste_landfill_kg', 1.27043)
expectValue('waste_recycling_kg', 1.01398)
expectValue('waste_combustion_kg', 4.65358)
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
expectValue('taxi_pkm', 0.14861)
expectValue('hotel_uk_night', 10.4)
expectValue('hotel_usa_night', 16.1)
expectValue('purchased_goods_gbp', 0.8559280439858236)
expectValue('capital_goods_gbp', 0.6987898127964011)
expectValue('freight_van_tkm', 0.63511)
expectValue('freight_road_rigid_tkm', 0.19947)
expectValue('freight_sea_bulk_tkm', 0.00353)
expectValue('wtt_electricity_td_kwh', 0.00359)
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
expectValue('hgv_nr_rigid_gt3_5_7_5_tonnes_average_laden_km', 0.49944)
expectValue('van_class_i_up_to_1_305_tonnes_diesel_km', 0.15833)
expectValue('homeworking_homeworking_office_equipment_heating_hour', 0.32393)
expectValue('homeworking_office_equipment_hour', 0.02159)
expectValue('homeworking_heating_hour', 0.30234)
expectValue('explosives_anfo_kg', 0.22)
expectValue('explosives_emulsion_kg', 0.14)
expectValue('mine_ch4_t', 28000)
expectValue('mine_ch4_kg', 28)
expectValue('mine_ch4_m3', 20.08)

const grid = byKey('electricity_grid_kwh')
const wttElec = byKey('wtt_electricity_kwh')
const spend = byKey('purchased_goods_gbp')
const taxi = byKey('taxi_pkm')
const soil = byKey('material_soil_t')
const usaHotel = byKey('hotel_usa_night')

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
    '£10,000 purchased goods is about 8.56 tCO₂e using kg CO₂e per £',
    Math.abs(calculateTco2e(10_000, spend.conversionValue) - 8.559280439858236) < 1e-9,
    String(calculateTco2e(10_000, spend.conversionValue)),
  )
  check('spend unit is pounds, not thousands', spend.unit === '£')
}
if (taxi) {
  check('taxi default is passenger.km', taxi.unit === 'pkm' && taxi.conversionValue === 0.14861)
}
if (soil) {
  check('soils primary production is withdrawn (0), not invented', soil.conversionValue === 0)
}
if (usaHotel) {
  check('US hotel uses the published 16.1 kg/night row, not an overseas mean', usaHotel.conversionValue === 16.1)
}

const cedaHighways = byKey('ceda_gbr_2332c0_usd')
if (cedaHighways) {
  check('CEDA highways unit is USD, not pounds', cedaHighways.unit === '$')
  check('CEDA highways family is EIO', cedaHighways.sourceFamily === 'EIO')
  check(
    'CEDA attribution is in the source citation',
    cedaHighways.source.includes(CEDA_ATTRIBUTION),
    cedaHighways.source.slice(0, 80),
  )
  check('CEDA FX is the 2025 workbook GBP per USD rate', cedaHighways.fxGbpPerUsd === CEDA_FX_GBP_PER_USD_2025)
  const sector = cedaSectorByKey('ceda_gbr_2332c0_usd')
  check(
    'CEDA highways kg/$ matches GHG_t_Raw GBR',
    sector != null && Math.abs(cedaHighways.conversionValue - sector.kgPerUsd) < 1e-12,
    String(cedaHighways.conversionValue),
  )
}
check(
  'Defra spend stays on £ and is not replaced by CEDA',
  spend?.unit === '£' && spend.conversionValue === 0.8559280439858236,
)

const usGrid = byKey('electricity_us_egrid_kwh')
const ukGrid = byKey('electricity_grid_kwh')
if (usGrid && ukGrid) {
  check('US eGRID does not overwrite the UK DESNZ electricity key', ukGrid.conversionValue === 0.13096)
  check(
    'US eGRID average matches EPA Hub 2026 Table 6 converted with AR6 GWPs',
    Math.abs(usGrid.conversionValue - EPA_US_EGRID_AVG_KG_PER_KWH) < 1e-12,
    String(usGrid.conversionValue),
  )
  check('US eGRID region is United States', usGrid.region === 'United States')
  check('US T&D uses 4.4% gross loss, not the UK T&D row', byKey('electricity_us_td_kwh')?.conversionValue === EPA_US_TD_KG_PER_KWH)
}
expectValue('r410a_kg', 1924)
expectValue('r410a_epa_kg', 2256)
expectValue('r134a_epa_kg', 1530)
expectValue('r404a_epa_kg', 4728)
expectValue('mine_ch4_kg', 28)
expectValue('mine_ch4_epa_fossil_kg', 29.8)
expectValue('diesel_us_gallon', 10.21)

const stale = FACTOR_CATALOG.filter(
  (row) =>
    row.source.includes('2025 (DESNZ') ||
    row.source.includes('ICE) Database v3.0') ||
    row.sourceUrl.includes('conversion-factors-2025'),
)
check('no leftover 2025 / ICE v3.0 citations', stale.length === 0, stale.map((row) => row.key).join(', '))

for (const row of EPD_REQUIRED_MATERIALS) {
  check(
    `${row.key} is not vendored in the published catalogue`,
    !FACTOR_CATALOG.some((factor) => factor.key === row.key),
  )
}
check(
  'catalogue has no ICE source family rows',
  FACTOR_CATALOG.every((factor) => factor.sourceFamily !== 'ICE'),
)

const iceSteel = {
  key: 'material_steel_t',
  name: 'Structural steel',
  category: 'Bulk materials',
  scope: 'Scope 3' as const,
  conversionValue: 1550,
  unit: 't',
  sourceFamily: 'ICE' as const,
  source: 'ICE Database v4.1, Circular Ecology',
  sourceUrl: '',
  region: 'United Kingdom',
  validFrom: '2026-01-01',
  lastVerifiedAt: '2026-09-10',
  isPlaceholder: false,
}
const epdSteel = {
  ...iceSteel,
  conversionValue: 1400,
  sourceFamily: 'EPD' as const,
  source: 'EPD-STEEL-2026 EN 15804',
  lastVerifiedAt: '2026-09-11',
}
const droppedIce = mergeFactorMaps(FACTOR_CATALOG, [iceSteel], [])
const keptEpd = mergeFactorMaps(FACTOR_CATALOG, [epdSteel], [])
check(
  'a cached ICE steel row is dropped',
  !droppedIce.has('material_steel_t'),
)
check(
  'a tenant EPD steel row is kept',
  keptEpd.get('material_steel_t')?.conversionValue === 1400,
  String(keptEpd.get('material_steel_t')?.conversionValue),
)
check('1.55 kg CO₂e/kg becomes 1550 kg/t', conversionToPerTonne(1.55, 'kg') === 1550)
check('910 kg CO₂e/t stays 910', conversionToPerTonne(910, 't') === 910)

const imported = parseFactorSpreadsheet(
  [
    'key,name,gwp_a1_a3,declared_unit,conversion_value,unit,source_family,source,source_url',
    'material_steel_t,Structural steel,1.55,kg CO2e/kg,,t,EPD,EPD-STEEL-2026,',
  ].join('\n'),
)
const importedSteel = imported.find((row) => row.key === 'material_steel_t')
check(
  'EPD spreadsheet import converts per-kg GWP to per tonne',
  importedSteel?.conversionValue === 1550 && importedSteel.unit === 't',
  String(importedSteel?.conversionValue),
)
check(
  'EPD template lists every required material key',
  EPD_REQUIRED_MATERIALS.every((row) => epdTemplateCsv().includes(row.key)),
)
check('steel is treated as EPD-required', isEpdRequiredKey('material_steel_t'))
check('concrete is not EPD-required', !isEpdRequiredKey('material_concrete_t'))

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
    lastVerifiedAt: '2026-09-12',
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

const detailSamples = [
  'hgv_nr_rigid_gt3_5_7_5_tonnes_average_laden_km',
  'van_class_i_up_to_1_305_tonnes_diesel_km',
  'waste_soils_landfill_t',
  'ref_hfc_32_kg',
  'sea_chemical_tanker_average_tkm',
  'flight_international_economy_class_rf_pkm',
]
for (const key of detailSamples) {
  check(`catalogue includes DESNZ detail row ${key}`, FACTOR_CATALOG.some((row) => row.key === key))
}

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
