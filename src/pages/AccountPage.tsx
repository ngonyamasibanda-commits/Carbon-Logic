import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { LogOut, ShieldCheck, ShieldOff } from 'lucide-react'
import { Alert, FormField, inputClass } from '../components/auth/AuthLayout'
import MfaEnrollment from '../components/auth/MfaEnrollment'
import { assessPassword, MIN_PASSWORD_LENGTH, recordAuditEvent } from '../lib/auth'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'

export default function AccountPage() {
  const {
    user,
    profile,
    organization,
    role,
    hasVerifiedMfa,
    reloadWorkspace,
    refreshMfaState,
    signOutEverywhere,
  } = useAuth()

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="px-6 py-7">
          <h1 className="text-2xl font-semibold text-brand">Account and security</h1>
          <p className="mt-2 text-sm text-muted">
            {user?.email} · {role ?? 'no role'} in {organization?.name ?? 'no organisation'}
          </p>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-brand to-accent" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileCard
          fullName={profile?.fullName ?? ''}
          jobTitle={profile?.jobTitle ?? ''}
          userId={user?.id ?? ''}
          onSaved={reloadWorkspace}
        />
        <PasswordCard email={user?.email ?? ''} />
        <MfaCard
          enabled={hasVerifiedMfa}
          organizationId={organization?.id}
          onChanged={refreshMfaState}
        />
        <SessionCard
          idleMinutes={organization?.sessionIdleMinutes}
          absoluteHours={organization?.sessionAbsoluteHours}
          onSignOutEverywhere={signOutEverywhere}
        />
      </div>
    </div>
  )
}

function Card({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 mb-4 text-sm text-muted">{description}</p>
      {children}
    </section>
  )
}

function ProfileCard({
  fullName,
  jobTitle,
  userId,
  onSaved,
}: {
  fullName: string
  jobTitle: string
  userId: string
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(fullName)
  const [title, setTitle] = useState(jobTitle)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    setName(fullName)
    setTitle(jobTitle)
  }, [fullName, jobTitle])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setStatus(null)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: name.trim(), job_title: title.trim() })
        .eq('id', userId)
      setStatus(error ? 'Could not save the profile. Try again.' : 'Profile saved.')
      if (!error) await onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Your profile" description="How colleagues see you across the workspace.">
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Full name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Job title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </FormField>
        {status ? <Alert tone={status === 'Profile saved.' ? 'success' : 'error'}>{status}</Alert> : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </Card>
  )
}

function PasswordCard({ email }: { email: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const check = assessPassword(password, email)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    if (!check.valid) {
      setError(check.problems[0])
      return
    }
    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      setDone(true)
      setPassword('')
      setConfirm('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title="Password"
      description={`At least ${MIN_PASSWORD_LENGTH} characters. Length matters far more than symbols.`}
    >
      <form onSubmit={submit} className="space-y-4">
        <FormField label="New password">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField label="Confirm new password">
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </FormField>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {done ? <Alert tone="success">Password updated.</Alert> : null}
        <button
          type="submit"
          disabled={busy || !password}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </Card>
  )
}

function MfaCard({
  enabled,
  organizationId,
  onChanged,
}: {
  enabled: boolean
  organizationId?: string
  onChanged: () => Promise<void>
}) {
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function disable() {
    setRemoving(true)
    setError(null)
    try {
      const { data } = await supabase.auth.mfa.listFactors()
      for (const factor of data?.totp ?? []) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
        if (unenrollError) {
          setError(unenrollError.message)
          return
        }
      }
      if (organizationId) {
        await recordAuditEvent(organizationId, 'auth.mfa_disabled', 'user')
      }
      await onChanged()
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Card
      title="Two-step verification"
      description="A time-based code from an authenticator app, required in addition to your password."
    >
      {enabled ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-accent-dark">
            <ShieldCheck size={16} />
            Two-step verification is on.
          </div>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <button
            type="button"
            onClick={() => void disable()}
            disabled={removing}
            className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            <ShieldOff size={15} />
            {removing ? 'Removing…' : 'Turn off two-step verification'}
          </button>
        </div>
      ) : (
        <MfaEnrollment
          onComplete={() => {
            if (organizationId) void recordAuditEvent(organizationId, 'auth.mfa_enabled', 'user')
          }}
        />
      )}
    </Card>
  )
}

function SessionCard({
  idleMinutes,
  absoluteHours,
  onSignOutEverywhere,
}: {
  idleMinutes?: number
  absoluteHours?: number
  onSignOutEverywhere: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  return (
    <Card
      title="Sessions"
      description="Your organisation's session policy, and a way to revoke access everywhere at once."
    >
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Signed out after inactivity</dt>
          <dd className="font-medium text-ink">{idleMinutes ?? 30} minutes</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Maximum session length</dt>
          <dd className="font-medium text-ink">{absoluteHours ?? 12} hours</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-muted">
        Signing out everywhere revokes every refresh token on your account, so any other browser or
        device is logged out the next time it calls the API.
      </p>
      <button
        type="button"
        onClick={() => {
          setBusy(true)
          void onSignOutEverywhere()
        }}
        disabled={busy}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        <LogOut size={15} />
        {busy ? 'Signing out…' : 'Sign out on all devices'}
      </button>
    </Card>
  )
}
