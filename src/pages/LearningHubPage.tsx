const ARTICLES = [
  {
    title: 'Scope 1 — Direct emissions from owned assets',
    body: 'Owned generators, excavators, haul trucks, drills, blasting explosives, fleet vehicles, refrigerant leaks, and mine methane are Scope 1. Log litres of diesel, gas oil, petrol, LPG, or natural gas consumed and keep delivery notes as evidence. HVO (hydrotreated vegetable oil) emits significantly less CO₂ than fossil diesel.',
  },
  {
    title: 'Scope 2 — Purchased energy',
    body: 'Site electricity and purchased heat/steam are Scope 2. Location-based reporting uses the DESNZ UK grid factor, or the US eGRID 2024 average if you select that source. Market-based reporting uses the GHG Protocol hierarchy: supplier-specific factor, retired REGO/GoO/REC, residual mix, then location. SECR requires both. On-site renewable generation is zero under both approaches for that kWh. T&D is a separate Scope 3 line.',
  },
  {
    title: 'Scope 3 — Upstream & downstream value chain',
    body: 'Scope 3 is usually a large share of a construction, mining, or logistics company\'s footprint. It covers: freight transport (road, rail, sea, air), embodied carbon in materials (concrete, steel, timber, lime), waste disposal including waste rock and tailings, water, employee commuting, business travel, and purchased goods & services. The GHG Protocol defines 15 categories — this tool covers the most material ones.',
  },
  {
    title: 'Freight and the GLEC Framework / ISO 14083',
    body: 'Contracted road, rail, sea, and air movements are Scope 3. Record cargo weight (tonnes) and distance (km) — the activity amount is tonne-kilometres (tkm). The GLEC Framework (now ISO 14083) provides standardised methods for calculating logistics emissions.',
  },
  {
    title: 'Embodied carbon in construction materials (PAS 2080)',
    body: 'Concrete, steel, timber, asphalt, cement, glass, aluminium, and insulation carry embodied carbon from extraction and manufacturing (life-cycle stages A1–A3). PAS 2080 provides a framework for managing infrastructure carbon, and EN 15978 covers building-level whole-life carbon assessment. Use DESNZ 2026 material-use factors where published. For steel, rebar, cement, aluminium, copper, and lime, paste a supplier EPD (EN 15804 A1–A3) — the app does not vendor ICE.',
  },
  {
    title: 'Well-to-tank (WTT) emissions',
    body: 'WTT factors account for emissions from extracting, refining, and transporting fuel before it reaches your site. WTT is Scope 3 and is mandatory for complete GHG reporting. This tool includes DESNZ/DEFRA 2026 WTT factors for diesel, petrol, LPG, gas oil, natural gas, and UK electricity generation.',
  },
  {
    title: 'UK reporting: SECR and PPN 06/21',
    body: 'SECR requires large UK companies to report Scope 1 and Scope 2, both location-based and market-based, plus energy use in kWh and at least one intensity ratio. PPN 06/21 asks suppliers bidding for major UK government contracts to publish a Carbon Reduction Plan. Use Organisation settings to close a reporting year, then download both documents from Reports. The Combined Results page remains the GHG Protocol inventory annex.',
  },
  {
    title: 'Science Based Targets (SBTi)',
    body: 'The Science Based Targets initiative validates corporate emission reduction targets against climate science. Near-term targets cover 5–10 years, and the Corporate Net-Zero Standard requires companies to reach net-zero by 2050. Use the Targets page to calculate your reduction pathway using the SBTi dynamic linear annual reduction rate (dLARR) method.',
  },
  {
    title: 'How the calculation works',
    body: 'Each activity has extra conversion steps first (tkm, pkm, GWP, unit conversion, CEDA spend FX and price-year). The last DESNZ step is tCO₂e = activity × (kg CO₂e per unit) ÷ 1,000. The data-input form shows the working before you save. CEDA spend rows are attributed as CEDA by Watershed.',
  },
  {
    title: 'Tips for construction companies',
    body: '(1) Track diesel and gas oil per machine using fuel cards or tank dips. (2) Get monthly electricity invoices for each site compound. (3) Require ready-mix, steel, and cement suppliers to provide EPDs; paste A1–A3 GWP on Bulk Materials for steel, rebar, cement, and aluminium. (4) Weigh skip loads and record disposal routes. (5) Add all subcontractor haulage under Scope 3. (6) Benchmark tCO₂e per £M contract value across projects.',
  },
  {
    title: 'Tips for mining companies',
    body: '(1) Log diesel for haul trucks, drills, and LHDs under Heavy Machinery, not Fleet Vehicles. (2) Record blasting agents under Explosives & blasting. (3) Convert ventilation air to methane before logging Mine methane & ventilation. (4) Assign electricity to the mine and the processing plant as separate facilities. (5) Put lime and grinding media in Bulk Materials using supplier EPDs; put ore and concentrate movements in freight. (6) Record waste rock and tailings under Site Waste with the disposal route.',
  },
  {
    title: 'Tips for logistics companies',
    body: '(1) Use tkm (tonne-kilometres) as your primary activity metric. (2) Track fuel consumption per vehicle/route. (3) Report Scope 1 (own fleet), Scope 3 (subcontracted transport). (4) Include well-to-tank (WTT) factors for completeness. (5) Benchmark tCO₂e per tkm against GLEC benchmarks. (6) Consider modal shift analysis (road → rail → sea).',
  },
]

export default function LearningHubPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">Learning Hub</h1>
        <p className="mt-2 text-sm text-muted">
          Guides for construction, mining, and logistics carbon accounting. Covers GHG Protocol, SECR, PAS 2080, SBTi, and practical tips.
        </p>
      </div>
      {ARTICLES.map((article) => (
        <article key={article.title} className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-semibold text-ink">{article.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{article.body}</p>
        </article>
      ))}
    </div>
  )
}
