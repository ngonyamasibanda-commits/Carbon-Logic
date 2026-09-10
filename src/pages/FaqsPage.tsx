export default function FaqsPage() {
  const items = [
    {
      q: 'How is tCO₂e calculated?',
      a: 'Every entry uses (Activity Amount × Conversion Value) / 1000. Conversion values are kg CO₂e per unit, loaded from the emission factors database. Combined Results and Analysis show GHG Protocol totals, not the calculation working for each row.',
    },
    {
      q: 'Which activities are in Scope 1, 2, and 3?',
      a: 'Scope 1 covers owned site fuel, heavy machinery, explosives used in blasting, fleet vehicles, refrigerant leaks, and mine methane. Scope 2 covers purchased site electricity and heat/steam. Scope 3 covers freight (road, rail, sea, air), site waste (including construction arisings, waste rock, and tailings), water, wastewater, crew transport, employee commuting, business travel, bulk materials (embodied carbon), purchased goods & services, and subcontracted logistics.',
    },
    {
      q: 'Where do emission factors come from?',
      a: 'Fuel, energy, freight, waste, water, travel, and most construction-material factors come from the DEFRA/DESNZ UK GHG Conversion Factors 2026 (published 11 June 2026, flat file revised 31 July 2026). Where DESNZ has no equivalent, embodied carbon uses ICE Database v4.1 (October 2025). Spend-based factors use Defra SIC-19 multipliers to 2023 (published 30 June 2026). Mine methane uses IPCC AR5 GWP 28. Explosives combustion uses the Australian NPI explosives detonation mass-balance factors. All factors show their source, source family, and verification date. You can add your own factors from EPDs or other sources.',
    },
    {
      q: 'Can I log data by project site?',
      a: 'Yes. Add sites under Facilities, then assign each entry a site, tags, custom fields, and file evidence. The Analysis page lets you filter by site, category, month, and tag.',
    },
    {
      q: 'What is the difference between SECR and full GHG Protocol reporting?',
      a: 'UK SECR requires Scope 1 + 2 plus an intensity metric (tCO₂e per £M revenue). The full GHG Protocol also requires material Scope 3 categories. Use the reporting framework filter in Analysis to see which entries are mandatory for each framework.',
    },
    {
      q: 'How do I choose the right unit of measure?',
      a: 'Each category offers relevant unit options — litres or m³ for fuels, kWh or MWh for energy, tonnes or kg for materials, km or miles for distances. The system automatically converts your entry to the factor\'s base unit before calculating emissions.',
    },
    {
      q: 'What are well-to-tank (WTT) emissions?',
      a: 'WTT factors account for emissions from extracting, refining, and transporting fuel before it reaches your site. They are Scope 3 and are included in this tool\'s factor catalog. They are separate from the combustion emissions (Scope 1) to avoid double-counting.',
    },
    {
      q: 'What is PAS 2080 and why does it matter for construction?',
      a: 'PAS 2080 is the UK standard for managing infrastructure carbon. It requires whole-life carbon assessment across stages A1–A5 (product and construction), B1–B7 (use), and C1–C4 (end of life). This tool covers A1–A3 (cradle-to-gate embodied carbon) via the Bulk Materials category.',
    },
    {
      q: 'How should mining companies log blasting and methane?',
      a: 'Use Explosives & blasting for ANFO, emulsion, or other blasting agents (Scope 1 combustion CO₂). Use Mine methane & ventilation for drained coal-mine gas or ventilation air methane after converting mixed air to CH₄. Haul trucks, drills, and LHDs go under Heavy Machinery. Processing-plant power is Site Electricity. Tailings and waste rock go under Site Waste.',
    },
    {
      q: 'What is the difference between Combined Results and Analysis?',
      a: 'Combined Results is your GHG Protocol inventory: Scope 1, Scope 2, and Scope 3 Categories 1–15, including empty categories so a report looks complete. Analysis is for decisions: mix, hotspots, trends, and what to log next. Individual activity rows stay on each data-input form as the audit trail.',
    },
    {
      q: 'Why did I not get an invite or confirmation email?',
      a: 'Carbon Logic does not send invitation emails. The person who invited you should share a signup link. You must create an account with that exact email to join their organisation. Confirmation, magic-link, and password-reset messages come from Supabase, not Carbon Logic, and often never arrive until Custom SMTP is configured. Until then, a Carbon Logic owner can turn off Confirm email in Supabase Authentication.',
    },
    {
      q: 'Can I use spend-based factors for Scope 3?',
      a: 'Yes — Purchased Goods & Services uses Defra’s spend-based SIC-19 multipliers (kg CO₂e per £, shown in the catalogue as kg CO₂e per £1,000). Activity-based methods (material weights, fuel volumes, tkm) are always more accurate and should be preferred when data is available.',
    },
  ]

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-ink">FAQs</h1>
      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <article key={item.q} className="rounded-xl border border-line bg-white p-5">
            <h2 className="font-semibold text-ink">{item.q}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{item.a}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
