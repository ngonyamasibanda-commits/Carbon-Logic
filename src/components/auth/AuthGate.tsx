import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import AuthLayout, { Alert, FormField, inputClass, primaryButtonClass } from './AuthLayout'
import MfaChallenge from './MfaChallenge'
import MfaEnrollment from './MfaEnrollment'
import { useAuth } from '../../lib/auth-context'
import { LogoMark } from '../brand/Logo'

/**
 * The single place that decides whether the application shell may render. Every
 * non-ready state returns its own screen, so protected UI never flashes on screen
 * while the session is still being resolved.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <SplashScreen />

  if (status === 'signed-out') {
    const from = `${location.pathname}${location.search}`
    return <Navigate to="/login" replace state={from === '/' ? undefined : { from }} />
  }

  if (status === 'mfa-challenge') return <MfaChallenge />
  if (status === 'mfa-enrollment') return <ForcedMfaEnrollment />
  if (status === 'no-organization') return <NoOrganization />

  return <>{children}</>
}

function SplashScreen() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-page">
      <LogoMark size={52} />
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand" />
      <span className="sr-only">Loading</span>
    </div>
  )
}

function ForcedMfaEnrollment() {
  const { organization, signOut } = useAuth()
  return (
    <AuthLayout
      title="Two-step verification required"
      subtitle={`${organization?.name ?? 'Your organisation'} requires all members to use an authenticator app.`}
      footer={
        <button type="button" onClick={() => void signOut()} className="text-brand hover:underline">
          Sign out
        </button>
      }
    >
      <MfaEnrollment />
    </AuthLayout>
  )
}

function NoOrganization() {
  const { user, createOrganization, signOut, reloadWorkspace } = useAuth()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error: createError } = await createOrganization(name)
      if (createError) setError(createError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="No workspace yet"
      subtitle={`${user?.email ?? 'You'} is not a member of any organisation.`}
      footer={
        <div className="space-x-3">
          <button type="button" onClick={() => void reloadWorkspace()} className="text-brand hover:underline">
            Check again
          </button>
          <button type="button" onClick={() => void signOut()} className="text-brand hover:underline">
            Sign out
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Alert tone="info">
          If a colleague has invited you, ask them to send the invitation to this exact address, then
          choose &ldquo;Check again&rdquo;. Otherwise create your own organisation below and invite
          your team.
        </Alert>
        <form onSubmit={submit} className="space-y-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <FormField label="Organisation name">
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="Acme Construction Ltd"
            />
          </FormField>
          <button type="submit" disabled={busy || !name.trim()} className={primaryButtonClass}>
            {busy ? 'Creating…' : 'Create organisation'}
          </button>
        </form>
      </div>
    </AuthLayout>
  )
}
