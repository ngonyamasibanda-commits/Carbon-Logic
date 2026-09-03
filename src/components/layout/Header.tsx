import { useEffect, useRef, useState } from 'react'
import { BookOpen, Building2, Check, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ROLE_DESCRIPTIONS } from '../../lib/auth'
import { useAuth } from '../../lib/auth-context'

export default function Header() {
  const { profile, user, organization, memberships, role, switchOrganization, signOut, hasVerifiedMfa } =
    useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const displayName = profile?.fullName || user?.email || 'Account'
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U'

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <header className="flex h-14 items-center justify-end gap-3 border-b border-line bg-white px-6">
      <div className="mr-auto flex items-center gap-2 text-sm text-muted">
        <Building2 size={15} className="text-brand" />
        <span className="font-medium text-ink">{organization?.name ?? 'No organisation'}</span>
        {role ? (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand">
            {role}
          </span>
        ) : null}
      </div>

      <Link
        to="/learn"
        className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-page"
      >
        <BookOpen size={13} className="text-brand" />
        Learning Hub
      </Link>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white"
        >
          {initial}
          <span className="sr-only">Open account menu</span>
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-xl border border-line bg-white shadow-lg"
          >
            <div className="border-b border-line px-4 py-3">
              <div className="truncate text-sm font-semibold text-ink">{displayName}</div>
              <div className="truncate text-xs text-muted">{user?.email}</div>
              {role ? <div className="mt-1.5 text-xs text-muted">{ROLE_DESCRIPTIONS[role]}</div> : null}
            </div>

            {memberships.length > 1 ? (
              <div className="border-b border-line py-1.5">
                <div className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Organisations
                </div>
                {memberships.map((membership) => (
                  <button
                    key={membership.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      switchOrganization(membership.organizationId)
                      setOpen(false)
                    }}
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-page"
                  >
                    <span className="truncate">{membership.organization.name}</span>
                    {membership.organizationId === organization?.id ? (
                      <Check size={14} className="shrink-0 text-accent-dark" />
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="py-1.5">
              <Link
                to="/account"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-page"
              >
                <UserRound size={15} className="text-muted" />
                Account
              </Link>
              <Link
                to="/account"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-2 px-4 py-2 text-sm hover:bg-page"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck size={15} className="text-muted" />
                  Two-step verification
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    hasVerifiedMfa ? 'bg-accent-soft text-accent-dark' : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {hasVerifiedMfa ? 'On' : 'Off'}
                </span>
              </Link>
            </div>

            <div className="border-t border-line py-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => void signOut('user')}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  )
}
