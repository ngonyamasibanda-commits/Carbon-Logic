const ARTICLES = [
  {
    title: 'Scope 1 for construction plant',
    body: 'Owned generators, excavators, and fleet fuel are Scope 1. Log litres of diesel or gas oil and keep delivery notes as evidence.',
  },
  {
    title: 'Freight and ISO 14083',
    body: 'Contracted road, rail, sea, and air movements are Scope 3. Record cargo tonnes and distance so the activity amount is tonne-kilometres.',
  },
  {
    title: 'Embodied carbon in bulk materials',
    body: 'Concrete, steel, timber, and asphalt belong in Additional Scope 3. Prefer EC3 or EPD factors over placeholders before you report.',
  },
  {
    title: 'How the calculation works',
    body: 'tCO₂e = (Activity Amount × Conversion Value) / 1000. Conversion values are kg CO₂e per unit, stored in emission_factors.',
  },
]

export default function LearningHubPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">Learning Hub</h1>
        <p className="mt-2 text-sm text-muted">
          Guides for construction and logistics carbon accounting. This hub is fully unlocked.
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
