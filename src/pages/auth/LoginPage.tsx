import { useState, type FormEvent } from 'react'
import { Building2, KeyRound, Mail } from 'lucide-react'
import AuthLayout, {
  Alert,
  FormField,
  PasswordInput,
  inputClass,
  primaryButtonClass,
} from '../../components/auth/AuthLayout'
import { assessPassword, MIN_PASSWORD_LENGTH } from '../../lib/auth'
import { useAuth } from '../../lib/auth-context'

type Mode = 'password' | 'magic' | 'sso' | 'signup' | 'forgot'

const SIGN_OUT_MESSAGES: Record<string, string> = {
  idle: 'You were signed out after a period of inactivity.',
  expired: 'Your session reached its maximum length. Sign in again to continue.',
  everywhere: 'You were signed out on all of your devices.',
}

export default function LoginPage() {
  const {
    signInWithPassword,
    signInWithMagicLink,
    signInWithSso,
    signUpWithPassword,
    requestPasswordReset,
    lastSignOutReason,
  } = useAuth()

  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const passwordCheck = assessPassword(password, email)
  const signedOutNotice =
    lastSignOutReason && SIGN_OUT_MESSAGES[lastSignOutReason]
      ? SIGN_OUT_MESSAGES[lastSignOutReason]
      : null

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      if (mode === 'password') {
        const { error: signInError } = await signInWithPassword(email, password)
        if (signInError) setError(signInError)
        return
      }

      if (mode === 'magic') {
        const { error: linkError } = await signInWithMagicLink(email)
        if (linkError) setError(linkError)
        else setNotice(`If ${email} has an account, a sign-in link is on its way.`)
        return
      }

      if (mode === 'sso') {
        const { error: ssoError } = await signInWithSso(email)
        if (ssoError) setError(ssoError)
        return
      }

      if (mode === 'forgot') {
        const { error: resetError } = await requestPasswordReset(email)
        if (resetError) setError(resetError)
        else setNotice(`If ${email} has an account, a reset link is on its way.`)
        return
      }

      if (!acceptedTerms) {
        setError('You must accept the Terms & Conditions to create an account.')
        return
      }
      if (!passwordCheck.valid) {
        setError(passwordCheck.problems[0])
        return
      }
      const result = await signUpWithPassword(email, password, fullName)
      if (result.error) setError(result.error)
      else if (result.needsConfirmation) {
        setNotice('Check your inbox and confirm your email address to finish setting up.')
      }
    } finally {
      setBusy(false)
    }
  }

  const copy = {
    password: { title: 'Sign in', subtitle: 'Use your Carbon Logic account.', cta: 'Sign in' },
    magic: {
      title: 'Email me a link',
      subtitle: 'We will send a single-use link that signs you in.',
      cta: 'Send sign-in link',
    },
    sso: {
      title: 'Single sign-on',
      subtitle: 'Continue with your organisation identity provider.',
      cta: 'Continue with SSO',
    },
    signup: {
      title: 'Create your account',
      subtitle: 'You will join an organisation once someone invites you.',
      cta: 'Create account',
    },
    forgot: {
      title: 'Reset your password',
      subtitle: 'We will email you a link to choose a new one.',
      cta: 'Send reset link',
    },
  }[mode]

  return (
    <AuthLayout
      title={copy.title}
      subtitle={copy.subtitle}
      footer={
        mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <button type="button" onClick={() => switchMode('password')} className="font-medium text-brand hover:underline">
              Sign in
            </button>
          </>
        ) : (
          <>
            Need an account?{' '}
            <button type="button" onClick={() => switchMode('signup')} className="font-medium text-brand hover:underline">
              Create one
            </button>
          </>
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {signedOutNotice && !error && !notice ? <Alert tone="info">{signedOutNotice}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        {mode === 'signup' ? (
          <FormField label="Full name">
            <input
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className={inputClass}
            />
          </FormField>
        ) : null}

        <FormField label={mode === 'sso' ? 'Work email' : 'Email'}>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
            placeholder="you@company.com"
          />
        </FormField>

        {mode === 'password' || mode === 'signup' ? (
          <FormField
            label="Password"
            hint={
              mode === 'signup'
                ? `At least ${MIN_PASSWORD_LENGTH} characters. A memorable passphrase beats a short complex one.`
                : undefined
            }
          >
            <PasswordInput
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              value={password}
              onChange={setPassword}
            />
          </FormField>
        ) : null}

        {mode === 'signup' && password ? <PasswordMeter score={passwordCheck.score} problems={passwordCheck.problems} /> : null}

        {mode === 'signup' ? (
          <label className="flex items-start gap-2 text-xs leading-5 text-muted">
            <input
              type="checkbox"
              required
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              I agree to the{' '}
              <a href="/terms" target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
                Terms &amp; Conditions
              </a>
              , including the calculator disclaimer, liability limits, and privacy notice.
            </span>
          </label>
        ) : null}

        <button
          type="submit"
          disabled={busy || (mode === 'signup' && !acceptedTerms)}
          className={primaryButtonClass}
        >
          {busy ? 'Working…' : copy.cta}
        </button>

        {mode === 'password' ? (
          <div className="text-right">
            <button
              type="button"
              onClick={() => switchMode('forgot')}
              className="text-xs text-muted hover:text-brand hover:underline"
            >
              Forgot your password?
            </button>
          </div>
        ) : null}
      </form>

      {mode !== 'signup' ? (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="space-y-2">
            {mode !== 'password' ? (
              <AltButton icon={KeyRound} label="Sign in with a password" onClick={() => switchMode('password')} />
            ) : null}
            {mode !== 'magic' ? (
              <AltButton icon={Mail} label="Email me a sign-in link" onClick={() => switchMode('magic')} />
            ) : null}
            {mode !== 'sso' ? (
              <AltButton icon={Building2} label="Single sign-on (SAML)" onClick={() => switchMode('sso')} />
            ) : null}
          </div>
        </>
      ) : null}
    </AuthLayout>
  )
}

function AltButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Mail
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:border-brand/40 hover:bg-page"
    >
      <Icon size={15} className="text-brand" />
      {label}
    </button>
  )
}

function PasswordMeter({ score, problems }: { score: number; problems: string[] }) {
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
  return (
    <div>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full ${index < score ? 'bg-accent' : 'bg-line'}`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {labels[score]}
        {problems.length > 0 ? ` — ${problems[0]}` : ''}
      </p>
    </div>
  )
}
