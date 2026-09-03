import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { requiredRoleFor, type Permission } from '../../lib/auth'
import { useAuth } from '../../lib/auth-context'

/**
 * A courtesy, not a control. The matching Row Level Security policy is what actually
 * stops a viewer from writing; this just avoids showing them a page full of controls
 * that would fail.
 */
export default function RequireRole({
  permission,
  children,
}: {
  permission: Permission
  children: React.ReactNode
}) {
  const { can, role } = useAuth()
  if (can(permission)) return <>{children}</>

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-8 text-center">
      <ShieldAlert size={30} className="mx-auto text-muted" />
      <h1 className="mt-3 text-lg font-semibold text-ink">You do not have access to this</h1>
      <p className="mt-2 text-sm text-muted">
        This area needs the {requiredRoleFor(permission)} role or higher. Your role in this
        organisation is {role ?? 'unassigned'}. An owner or admin can change that under People.
      </p>
      <Link
        to="/"
        className="mt-5 inline-block rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
      >
        Back to dashboard
      </Link>
    </div>
  )
}
