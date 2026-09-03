import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout, {
  Alert,
  FormField,
  inputClass,
  primaryButtonClass,
} from '../../components/auth/AuthLayout'
import { assessPassword, MIN_PASSWORD_LENGTH } from '../../lib/auth'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'

export default function ResetPasswordPage() {
  const { status, user, signOutEverywhere } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const check = assessPassword(password, user?.email ?? '')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    if (!check.valid) {
      setError(check.problems[0])
      return
    }

    setBusy(true)
    setError(null)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      setDone(true)
      // A password change should not leave old sessions alive elsewhere.
      await signOutEverywhere()
      window.setTimeout(() => navigate('/login', { replace: true }), 2500)
    } finally {
      setBusy(false)
    }
  }

  if (status === 'signed-out' && !done) {
    return (
      <AuthLayout title="Reset link expired" subtitle="Request a new password reset email.">
        <Alert tone="error">
          This reset link is no longer valid. Reset links can only be used once and expire after a
          short period.
        </Alert>
        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className={`${primaryButtonClass} mt-4`}
        >
          Back to sign in
        </button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Choose a new password" subtitle={user?.email ?? undefined}>
      {done ? (
        <Alert tone="success">
          Password updated. You have been signed out everywhere for safety — sign in again with your
          new password.
        </Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <FormField
            label="New password"
            hint={`At least ${MIN_PASSWORD_LENGTH} characters. Longer beats more complicated.`}
          >
            <input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="Confirm new password">
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className={inputClass}
            />
          </FormField>
          <button type="submit" disabled={busy} className={primaryButtonClass}>
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
