const ARTICLES = [
  {
    title: 'Scope 1 — Direct emissions from owned assets',
    body: 'Owned generators, excavators, fleet vehicles, and refrigerant leaks are Scope 1. Log litres of diesel, gas oil, petrol, LPG, or natural gas consumed and keep delivery notes as evidence. HVO (hydrotreated vegetable oil) emits significantly less CO₂ than fossil diesel.',
  },
  {
    title: 'Scope 2 — Purchased energy',
    body: 'Site electricity and purchased heat/steam are Scope 2. Use kWh from utility bills or smart meter readings. If you generate renewable electricity on-site (e.g. solar panels), you can report zero Scope 2 for that generation using the location-based method.',
  },
  {
    title: 'Scope 3 — Upstream & downstream value chain',
    body: 'Scope 3 is usually the largest share of a construction or logistics company\'s footprint. It covers: freight transport (road, rail, sea, air), embodied carbon in materials (concrete, steel, timber), waste disposal, water, employee commuting, business travel, and purchased goods & services. The GHG Protocol defines 15 categories — this tool covers the most material ones.',
  },
  {
    title: 'Freight and the GLEC Framework / ISO 14083',
    body: 'Contracted road, rail, sea, and air movements are Scope 3. Record cargo weight (tonnes) and distance (km) — the activity amount is tonne-kilometres (tkm). The GLEC Framework (now ISO 14083) provides standardised methods for calculating logistics emissions.',
  },
  {
    title: 'Embodied carbon in construction materials (PAS 2080)',
    body: 'Concrete, steel, timber, asphalt, cement, glass, aluminium, and insulation carry embodied carbon from extraction and manufacturing (life-cycle stages A1–A3). PAS 2080 provides a framework for managing infrastructure carbon, and EN 15978 covers building-level whole-life carbon assessment. Prefer EPD (Environmental Product Declaration) values or the ICE Database for material factors.',
  },
  {
    title: 'Well-to-tank (WTT) emissions',
    body: 'WTT factors account for emissions from extracting, refining, and transporting fuel before it reaches your site. WTT is Scope 3 and is mandatory for complete GHG reporting. This tool includes DEFRA WTT factors for diesel, petrol, LPG, gas oil, and natural gas.',
  },
  {
    title: 'UK reporting: SECR and ESOS',
    body: 'The Streamlined Energy and Carbon Reporting (SECR) framework requires large UK companies to report Scope 1 + 2 emissions plus at least one intensity metric (e.g. tCO₂e per £M turnover). The Energy Savings Opportunity Scheme (ESOS) requires energy audits every four years. Use the "SECR" filter in Analysis to see only mandatory scopes.',
  },
  {
    title: 'Science Based Targets (SBTi)',
    body: 'The Science Based Targets initiative validates corporate emission reduction targets against climate science. Near-term targets cover 5–10 years, and the Corporate Net-Zero Standard requires companies to reach net-zero by 2050. Use the Targets page to calculate your reduction pathway using the SBTi dynamic linear annual reduction rate (dLARR) method.',
  },
  {
    title: 'How the calculation works',
    body: 'tCO₂e = (Activity Amount × Conversion Value) / 1000. Conversion values are kg CO₂e per unit, stored in the emission factors database. Every entry now shows the full calculation breakdown: activity amount × factor ÷ 1000 = result, with the factor name and source.',
  },
  {
    title: 'Tips for construction companies',
    body: '(1) Track diesel and gas oil per machine using fuel cards or tank dips. (2) Get monthly electricity invoices for each site compound. (3) Require ready-mix concrete suppliers to provide EPDs. (4) Weigh skip loads and record disposal routes. (5) Add all subcontractor haulage under Scope 3. (6) Benchmark tCO₂e per £M contract value across projects.',
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
          Guides for construction and logistics carbon accounting. Covers GHG Protocol, SECR, PAS 2080, SBTi, and practical tips.
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
