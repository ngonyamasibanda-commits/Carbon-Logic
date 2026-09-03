import { useMemo, useState } from 'react'
import { ChevronDown, Users } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { LogoMark } from '../brand/Logo'
import { INPUT_CATEGORIES, SCOPE3_CATEGORIES } from '../../lib/categories'
import { CATEGORY_ICONS } from '../../lib/icons'
import { useEntries } from '../../lib/entries-context'
import { useAuth } from '../../lib/auth-context'

function countLabel(count: number) {
  return count === 1 ? '(1 entry)' : `(${count} entries)`
}

function navClass(active: boolean) {
  return [
    'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
    active ? 'bg-brand-soft font-semibold text-brand-dark' : 'text-ink hover:bg-page',
  ].join(' ')
}

export default function Sidebar() {
  const { entries } = useEntries()
  const { profile, user, organization, can } = useAuth()
  const location = useLocation()
  const displayName = profile?.fullName || user?.email || 'Account'
  const [inputOpen, setInputOpen] = useState(true)
  const [scope3Open, setScope3Open] = useState(true)

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of entries) {
      map.set(entry.category, (map.get(entry.category) ?? 0) + 1)
    }
    return map
  }, [entries])

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-line bg-white">
      <div className="border-b border-line px-5 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <LogoMark size={34} />
          <div>
            <div className="text-lg font-bold leading-none tracking-tight text-brand">
              Carbon Logic
            </div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-accent-dark">
              Construction & logistics
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <NavLink to="/" end className={({ isActive }) => navClass(isActive)}>
          {({ isActive }) => {
            const Icon = CATEGORY_ICONS.dashboard
            return (
              <>
                <Icon size={16} className={isActive ? 'text-brand' : 'text-muted'} />
                Dashboard
              </>
            )
          }}
        </NavLink>

        <NavLink to="/input" end className={({ isActive }) => navClass(isActive)}>
          {({ isActive }) => {
            const Icon = CATEGORY_ICONS.input
            return (
              <>
                <Icon size={16} className={isActive ? 'text-brand' : 'text-muted'} />
                Data Input
              </>
            )
          }}
        </NavLink>

        <div className="my-3 border-t border-line" />

        <NavLink to="/facilities" className={({ isActive }) => navClass(isActive || location.pathname === '/sites')}>
          {({ isActive }) => {
            const Icon = CATEGORY_ICONS.sites
            const active = isActive || location.pathname === '/sites'
            return (
              <>
                <Icon size={16} className={active ? 'text-brand' : 'text-muted'} />
                Facilities
              </>
            )
          }}
        </NavLink>

        <NavLink to="/factors" className={({ isActive }) => navClass(isActive)}>
          {({ isActive }) => {
            const Icon = CATEGORY_ICONS.factors
            return (
              <>
                <Icon size={16} className={isActive ? 'text-brand' : 'text-muted'} />
                Emission Factors
              </>
            )
          }}
        </NavLink>

        <NavLink to="/targets" className={({ isActive }) => navClass(isActive)}>
          {({ isActive }) => {
            const Icon = CATEGORY_ICONS.targets
            return (
              <>
                <Icon size={16} className={isActive ? 'text-brand' : 'text-muted'} />
                Science Based Targets
              </>
            )
          }}
        </NavLink>

        <button
          type="button"
          className="mt-3 flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted"
          onClick={() => setInputOpen((open) => !open)}
        >
          Input
          <ChevronDown size={14} className={inputOpen ? 'rotate-180' : ''} />
        </button>
        {inputOpen
          ? INPUT_CATEGORIES.map((category) => {
              const Icon = CATEGORY_ICONS[category.id]
              const count = counts.get(category.id) ?? 0
              const active = location.pathname === `/input/${category.id}`
              return (
                <NavLink
                  key={category.id}
                  to={`/input/${category.id}`}
                  className={navClass(active)}
                >
                  {Icon ? (
                    <Icon size={16} className={active ? 'text-brand' : 'text-brand'} />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  <span className="text-[11px] font-normal text-muted">{countLabel(count)}</span>
                </NavLink>
              )
            })
          : null}

        <button
          type="button"
          className="mt-3 flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted"
          onClick={() => setScope3Open((open) => !open)}
        >
          Additional Scope 3
          <ChevronDown size={14} className={scope3Open ? 'rotate-180' : ''} />
        </button>
        {scope3Open
          ? SCOPE3_CATEGORIES.map((category) => {
              const Icon = CATEGORY_ICONS[category.id]
              const count = counts.get(category.id) ?? 0
              const active = location.pathname === `/input/${category.id}`
              return (
                <NavLink
                  key={category.id}
                  to={`/input/${category.id}`}
                  className={navClass(active)}
                >
                  {Icon ? <Icon size={16} className="text-brand" /> : null}
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  <span className="text-[11px] font-normal text-muted">{countLabel(count)}</span>
                </NavLink>
              )
            })
          : null}

        <div className="mt-4 space-y-1 border-t border-line pt-3">
          <NavLink to="/analysis" className={({ isActive }) => navClass(isActive)}>
            {({ isActive }) => {
              const Icon = CATEGORY_ICONS.analysis
              return (
                <>
                  <Icon size={16} className={isActive ? 'text-brand' : 'text-muted'} />
                  Analysis
                </>
              )
            }}
          </NavLink>
          <NavLink to="/combined" className={({ isActive }) => navClass(isActive)}>
            {({ isActive }) => {
              const Icon = CATEGORY_ICONS.combined
              return (
                <>
                  <Icon size={16} className={isActive ? 'text-brand' : 'text-muted'} />
                  Combined Results
                </>
              )
            }}
          </NavLink>
          <NavLink to="/learn" className={({ isActive }) => navClass(isActive)}>
            {({ isActive }) => {
              const Icon = CATEGORY_ICONS.learn
              return (
                <>
                  <Icon size={16} className={isActive ? 'text-brand' : 'text-muted'} />
                  Learning Hub
                </>
              )
            }}
          </NavLink>
          <NavLink to="/faqs" className={({ isActive }) => navClass(isActive)}>
            {({ isActive }) => {
              const Icon = CATEGORY_ICONS.faqs
              return (
                <>
                  <Icon size={16} className={isActive ? 'text-brand' : 'text-muted'} />
                  FAQs
                </>
              )
            }}
          </NavLink>
          {can('members:manage') ? (
            <NavLink to="/people" className={({ isActive }) => navClass(isActive)}>
              {({ isActive }) => (
                <>
                  <Users size={16} className={isActive ? 'text-brand' : 'text-muted'} />
                  People &amp; Access
                </>
              )}
            </NavLink>
          ) : null}
        </div>
      </nav>

      <div className="border-t border-line px-4 py-3">
        <Link to="/account" className="flex items-center gap-3 rounded-md p-1 hover:bg-page">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
            {displayName.trim().charAt(0).toUpperCase() || 'N'}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{displayName}</div>
            <div className="truncate text-xs text-muted">{organization?.name ?? 'No organisation'}</div>
          </div>
        </Link>
      </div>
    </aside>
  )
}
