export default function FaqsPage() {
  const items = [
    {
      q: 'How is tCO₂e calculated?',
      a: 'Every entry uses (Activity Amount × Conversion Value) / 1000. Conversion values are kg CO₂e per unit, loaded from the emission_factors table — never guessed in the interface.',
    },
    {
      q: 'Which activities are in Scope 1, 2, and 3?',
      a: 'Scope 1 covers owned site fuel, heavy machinery, fleet, and refrigerants. Scope 2 covers purchased site electricity and heat. Scope 3 covers freight, waste, water, crew transport, subcontracted logistics, and embodied carbon in bulk materials.',
    },
    {
      q: 'Where do emission factors come from?',
      a: 'Fuel and electricity factors should be sourced from DEFRA or EPA. Freight should follow GLEC / ISO 14083. Construction materials should cite EC3 or an EPD. If a factor is missing, the form shows “factor needed” instead of substituting a number.',
    },
    {
      q: 'Can I log data by project site?',
      a: 'Yes. Add sites under Multi-site & Team, then assign each entry a site, tags, custom fields, and file evidence. Analysis filters use those fields.',
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
