import { useCallback, useEffect, useState, type FormEvent } from 'react'
import AuthLayout, { Alert, FormField, inputClass, primaryButtonClass } from './AuthLayout'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'

/**
 * Step-up authentication. The user already proved one factor, so the session exists
 * at aal1; until they clear this screen the JWT carries aal1 and any policy that
 * requires aal2 will refuse them at the database.
 */
export default function MfaChallenge() {
  const { signOut, refreshMfaState, user } = useAuth()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) {
        setError(listError.message)
        return
      }
      const verified = (data?.totp ?? []).find((factor) => factor.status === 'verified')
      if (!verified) {
        setError('No verified authenticator is registered on this account.')
        return
      }
      setFactorId(verified.id)
    })()
  }, [])

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      if (!factorId) return
      setBusy(true)
      setError(null)
      try {
        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId,
          code: code.trim(),
        })
        if (verifyError) {
          setError('That code was not accepted. Codes expire after 30 seconds.')
          setCode('')
          return
        }
        await refreshMfaState()
      } finally {
        setBusy(false)
      }
    },
    [factorId, code, refreshMfaState],
  )

  return (
    <AuthLayout
      title="Two-step verification"
      subtitle={`Enter the 6-digit code from your authenticator app for ${user?.email ?? 'your account'}.`}
      footer={
        <button type="button" onClick={() => void signOut()} className="text-brand hover:underline">
          Sign in as someone else
        </button>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <FormField label="Verification code">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            className={`${inputClass} text-center text-2xl tracking-[0.4em]`}
            placeholder="000000"
          />
        </FormField>
        <button type="submit" disabled={busy || code.length !== 6 || !factorId} className={primaryButtonClass}>
          {busy ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </AuthLayout>
  )
}
