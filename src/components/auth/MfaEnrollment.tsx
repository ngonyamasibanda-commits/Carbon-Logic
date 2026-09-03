import { useCallback, useState, type FormEvent } from 'react'
import { Alert, FormField, inputClass, primaryButtonClass } from './AuthLayout'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'

type Stage = 'idle' | 'scanning' | 'done'

/**
 * TOTP enrolment. `enroll` creates an unverified factor and returns the QR code; the
 * factor only becomes active once a generated code is verified, which also promotes
 * the current session to aal2.
 */
export default function MfaEnrollment({ onComplete }: { onComplete?: () => void }) {
  const { refreshMfaState } = useAuth()
  const [stage, setStage] = useState<Stage>('idle')
  const [factorId, setFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      // Clear out any half-finished attempt, otherwise enrolment hits a name clash.
      const { data: existing } = await supabase.auth.mfa.listFactors()
      for (const factor of existing?.all ?? []) {
        if (factor.factor_type === 'totp' && factor.status !== 'verified') {
          await supabase.auth.mfa.unenroll({ factorId: factor.id })
        }
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      })
      if (enrollError || !data) {
        setError(enrollError?.message ?? 'Could not start enrolment.')
        return
      }
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setStage('scanning')
    } finally {
      setBusy(false)
    }
  }, [])

  const verify = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      setBusy(true)
      setError(null)
      try {
        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId,
          code: code.trim(),
        })
        if (verifyError) {
          setError('That code was not accepted. Check your device clock and try the next code.')
          setCode('')
          return
        }
        await refreshMfaState()
        setStage('done')
        onComplete?.()
      } finally {
        setBusy(false)
      }
    },
    [factorId, code, refreshMfaState, onComplete],
  )

  if (stage === 'done') {
    return <Alert tone="success">Two-step verification is on for your account.</Alert>
  }

  if (stage === 'idle') {
    return (
      <div className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <p className="text-sm text-muted">
          Use an authenticator app such as 1Password, Authy, Google Authenticator or Microsoft
          Authenticator. You will be asked for a code each time you sign in on a new session.
        </p>
        <button type="button" onClick={() => void start()} disabled={busy} className={primaryButtonClass}>
          {busy ? 'Preparing…' : 'Set up two-step verification'}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="rounded-lg border border-line bg-white p-4 text-center">
        {qrCode ? <img src={qrCode} alt="Authenticator QR code" className="mx-auto h-44 w-44" /> : null}
        <p className="mt-3 text-xs text-muted">Cannot scan? Enter this key manually:</p>
        <code className="mt-1 block break-all rounded bg-page px-2 py-1.5 font-mono text-xs text-ink">
          {secret}
        </code>
      </div>
      <FormField label="Enter the 6-digit code to confirm">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          autoFocus
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          className={`${inputClass} text-center text-2xl tracking-[0.4em]`}
          placeholder="000000"
        />
      </FormField>
      <button type="submit" disabled={busy || code.length !== 6} className={primaryButtonClass}>
        {busy ? 'Verifying…' : 'Turn on two-step verification'}
      </button>
    </form>
  )
}
