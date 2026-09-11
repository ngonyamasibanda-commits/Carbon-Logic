import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SCOPE_NAV_ORDER, categoriesForScope } from '../lib/categories'
import { CATEGORY_ICONS } from '../lib/icons'
import { useEntries } from '../lib/entries-context'

export default function DataInput() {
  const { entries } = useEntries()
  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of entries) {
      map.set(entry.category, (map.get(entry.category) ?? 0) + 1)
    }
    return map
  }, [entries])

  const visibleByScope = SCOPE_NAV_ORDER.map((scope) => ({
    scope,
    categories: categoriesForScope(scope).filter((category) =>
      category.name.toLowerCase().includes(query.toLowerCase()),
    ),
  })).filter((group) => group.categories.length > 0)

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white px-6 py-8">
        <h1 className="text-3xl font-semibold text-ink">Data input</h1>
        <p className="mt-2 text-sm text-muted">
          Choose a category to log construction, mining, and logistics activity. Most entries use
          published DESNZ/DEFRA conversion values. Steel, cement, aluminium, and a few other
          materials need a supplier EPD on the form or on Emission factors.
        </p>
        <label className="mt-5 flex max-w-xl items-center gap-2 rounded-full border border-line bg-page px-4 py-2.5">
          <Search size={16} className="text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search categories..."
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
      </section>

      <section className="space-y-6">
        {visibleByScope.map((group) => (
          <div key={group.scope}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{group.scope}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {group.categories.map((category) => {
                const Icon = CATEGORY_ICONS[category.id]
                const count = counts.get(category.id) ?? 0
                return (
                  <Link
                    key={category.id}
                    to={`/input/${category.id}`}
                    className="rounded-xl border border-line bg-white p-4 text-center shadow-sm hover:border-brand/40"
                  >
                    {Icon ? <Icon size={26} className="mx-auto text-brand" /> : null}
                    <div className="mt-2 text-sm font-semibold">{category.name}</div>
                    <div className="text-xs text-muted">
                      {count} {count === 1 ? 'entry' : 'entries'}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
