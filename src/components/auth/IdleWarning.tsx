import { Clock } from 'lucide-react'
import { useAuth } from '../../lib/auth-context'

/** Warns before an inactivity sign-out so nobody loses half-entered data silently. */
export default function IdleWarning() {
  const { idleWarningSecondsLeft, keepSessionAlive, signOut } = useAuth()
  if (idleWarningSecondsLeft == null) return null

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4"
    >
      <div className="flex w-full max-w-lg flex-wrap items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-lg">
        <Clock size={20} className="text-amber-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">Still there?</p>
          <p className="text-sm text-amber-800">
            You will be signed out in {idleWarningSecondsLeft} second
            {idleWarningSecondsLeft === 1 ? '' : 's'} due to inactivity.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void signOut('user')}
            className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={keepSessionAlive}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  )
}
