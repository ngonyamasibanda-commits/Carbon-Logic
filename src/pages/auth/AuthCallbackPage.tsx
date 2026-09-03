import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout, { Alert } from '../../components/auth/AuthLayout'
import { useAuth } from '../../lib/auth-context'

/**
 * Landing point for magic links, SSO returns and email confirmations. The Supabase
 * client exchanges the PKCE code automatically, so this screen only has to wait for
 * the session to settle and surface any provider error.
 */
export default function AuthCallbackPage() {
  const { status } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.search,
    )
    const description = params.get('error_description') ?? params.get('error')
    if (description) {
      setError(description.replaceAll('+', ' '))
      return
    }

    if (status === 'signed-out') {
      // Give the client a moment to finish the exchange before giving up.
      const timer = window.setTimeout(() => {
        setError('That sign-in link is no longer valid. Request a new one.')
      }, 6000)
      return () => window.clearTimeout(timer)
    }

    if (status !== 'loading') {
      navigate('/', { replace: true })
    }
  }, [status, navigate])

  return (
    <AuthLayout
      title={error ? 'Sign-in failed' : 'Signing you in'}
      subtitle={error ? undefined : 'One moment while we finish setting up your session.'}
      footer={
        <button type="button" onClick={() => navigate('/login', { replace: true })} className="text-brand hover:underline">
          Back to sign in
        </button>
      }
    >
      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : (
        <div className="flex justify-center py-4">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
        </div>
      )}
    </AuthLayout>
  )
}
