import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import {
  DEFAULT_ABSOLUTE_HOURS,
  DEFAULT_IDLE_MINUTES,
  IDLE_WARNING_SECONDS,
  clearLocalWorkspaceData,
  ensureHomeOrganization,
  loadMemberships,
  fetchProfile,
  isPlatformOwnerEmail,
  recordAuditEvent,
  roleAllows,
  type Membership,
  type Organization,
  type Permission,
  type Profile,
} from '../lib/auth'
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
  type SignOutReason,
} from '../lib/auth-context'
import { pushLocalEntries } from '../lib/entries'
import { supabase } from '../lib/supabase'

const ACTIVE_ORG_KEY = 'carbon-logic-active-org'
// Shared across tabs so working in one tab does not let another tab time you out.
const LAST_ACTIVITY_KEY = 'carbon-logic-last-activity'
const SESSION_START_KEY = 'carbon-logic-session-start'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'focus'] as const

function readTimestamp(key: string): number {
  const raw = localStorage.getItem(key)
  const value = raw ? Number(raw) : Number.NaN
  return Number.isFinite(value) ? value : 0
}

function friendlyError(message: string): string {
  const normalised = message.toLowerCase()
  // Never reveal whether an address exists — that turns the form into an account oracle.
  if (normalised.includes('invalid login credentials')) {
    return 'That email and password combination is not correct.'
  }
  if (normalised.includes('email not confirmed')) {
    return 'This address is not confirmed yet. Check spam for a message from Supabase, or ask a Carbon Logic owner to turn off Confirm email until Custom SMTP is set up.'
  }
  if (normalised.includes('rate limit') || normalised.includes('too many')) {
    return 'Too many attempts. Wait a minute before trying again.'
  }
  if (normalised.includes('only carbon logic owners')) {
    return 'Only Carbon Logic owners can add organisations. Ask to be invited to an existing workspace instead.'
  }
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_ORG_KEY),
  )
  const [bootstrapping, setBootstrapping] = useState(true)
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const [aal, setAal] = useState<{ current: string | null; next: string | null }>({
    current: null,
    next: null,
  })
  const [verifiedFactors, setVerifiedFactors] = useState(0)
  const [lastSignOutReason, setLastSignOutReason] = useState<SignOutReason | null>(null)
  const [idleWarningSecondsLeft, setIdleWarningSecondsLeft] = useState<number | null>(null)

  const signingOut = useRef(false)

  const refreshMfaState = useCallback(async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    setAal({ current: data?.currentLevel ?? null, next: data?.nextLevel ?? null })
    const { data: factorData } = await supabase.auth.mfa.listFactors()
    const totp = factorData?.totp ?? []
    setVerifiedFactors(totp.filter((factor) => factor.status === 'verified').length)
  }, [])

  const loadWorkspace = useCallback(
    async (userId: string, email?: string | null, preferredOrgId?: string | null) => {
      setWorkspaceLoading(true)
      try {
        const [nextProfile, loaded] = await Promise.all([
          fetchProfile(userId),
          loadMemberships(userId),
        ])
        const resolvedEmail = email ?? nextProfile?.email
        const nextMemberships = await ensureHomeOrganization(
          userId,
          resolvedEmail,
          loaded.memberships,
          { reliable: loaded.reliable },
        )
        setProfile(
          nextProfile ??
            (resolvedEmail
              ? {
                  id: userId,
                  email: resolvedEmail,
                  fullName: resolvedEmail.split('@')[0] ?? '',
                  jobTitle: '',
                }
              : null),
        )
        setMemberships(nextMemberships)
        setActiveOrgId((current) => {
          const realMemberships = nextMemberships.filter((m) => !m.organizationId.startsWith('local-org-'))
          const preferredOk =
            preferredOrgId && realMemberships.some((m) => m.organizationId === preferredOrgId)
          const stillValid = realMemberships.some((m) => m.organizationId === current)
          const next = preferredOk
            ? preferredOrgId
            : stillValid
              ? current
              : (realMemberships[0]?.organizationId ?? nextMemberships[0]?.organizationId ?? null)
          if (next) localStorage.setItem(ACTIVE_ORG_KEY, next)
          else localStorage.removeItem(ACTIVE_ORG_KEY)
          return next
        })
        void supabase
          .from('profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', userId)
      } finally {
        setWorkspaceLoading(false)
      }
    },
    [],
  )

  // Session lifecycle. onAuthStateChange also fires from other tabs, so a sign-out
  // anywhere propagates here without extra plumbing.
  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setBootstrapping(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setBootstrapping(false)

      if (event === 'SIGNED_IN') {
        if (!localStorage.getItem(SESSION_START_KEY)) {
          localStorage.setItem(SESSION_START_KEY, String(Date.now()))
        }
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
      }
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        setMemberships([])
        setAal({ current: null, next: null })
        setVerifiedFactors(0)
        localStorage.removeItem(SESSION_START_KEY)
      }
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setMemberships([])
      setWorkspaceLoading(false)
      return
    }
    void loadWorkspace(userId, user?.email)
    void refreshMfaState()
  }, [userId, user?.email, loadWorkspace, refreshMfaState])

  const organization = useMemo<Organization | null>(() => {
    const match = memberships.find((m) => m.organizationId === activeOrgId)
    return match?.organization ?? memberships[0]?.organization ?? null
  }, [memberships, activeOrgId])

  const role = useMemo(() => {
    const match = memberships.find((m) => m.organizationId === organization?.id)
    return match?.role ?? null
  }, [memberships, organization])

  const signOut = useCallback(
    async (reason: SignOutReason = 'user') => {
      if (signingOut.current) return
      signingOut.current = true
      try {
        const orgId = organization?.id
        if (orgId && user && reason !== 'expired') {
          await recordAuditEvent(orgId, 'auth.signed_out', 'session', undefined, { reason })
        }
        if (orgId && user) {
          await Promise.race([
            pushLocalEntries({ organizationId: orgId, userId: user.id }),
            new Promise<void>((resolve) => setTimeout(resolve, 4000)),
          ])
        }
        // 'local' revokes this session's refresh token at Supabase; 'global' kills
        // every session the user has anywhere.
        await supabase.auth.signOut({ scope: reason === 'everywhere' ? 'global' : 'local' })
      } finally {
        clearLocalWorkspaceData()
        localStorage.removeItem(SESSION_START_KEY)
        localStorage.removeItem(LAST_ACTIVITY_KEY)
        sessionStorage.clear()
        setLastSignOutReason(reason)
        setIdleWarningSecondsLeft(null)
        signingOut.current = false
      }
    },
    [organization, user],
  )

  const signOutEverywhere = useCallback(() => signOut('everywhere'), [signOut])

  // Idle and absolute session limits. The browser cannot be trusted to enforce these
  // on its own, which is why the real backstop is the short-lived access token plus
  // server-side revocation on sign-out; this is the usability half of the control.
  const idleMinutes = organization?.sessionIdleMinutes ?? DEFAULT_IDLE_MINUTES
  const absoluteHours = organization?.sessionAbsoluteHours ?? DEFAULT_ABSOLUTE_HOURS

  const keepSessionAlive = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
    setIdleWarningSecondsLeft(null)
  }, [])

  useEffect(() => {
    if (!session) return

    const markActivity = () => {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
    }
    markActivity()
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActivity, { passive: true })
    }

    const idleMs = idleMinutes * 60_000
    const warnMs = Math.min(IDLE_WARNING_SECONDS * 1000, idleMs / 2)
    const absoluteMs = absoluteHours * 3_600_000

    const timer = window.setInterval(() => {
      const now = Date.now()
      const started = readTimestamp(SESSION_START_KEY) || now
      const lastActivity = readTimestamp(LAST_ACTIVITY_KEY) || now

      if (now - started >= absoluteMs) {
        void signOut('expired')
        return
      }

      const idleFor = now - lastActivity
      if (idleFor >= idleMs) {
        void signOut('idle')
        return
      }
      if (idleFor >= idleMs - warnMs) {
        setIdleWarningSecondsLeft(Math.max(0, Math.ceil((idleMs - idleFor) / 1000)))
      } else {
        setIdleWarningSecondsLeft((current) => (current == null ? current : null))
      }
    }, 5_000)

    return () => {
      window.clearInterval(timer)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActivity)
      }
    }
  }, [session, idleMinutes, absoluteHours, signOut])

  const status = useMemo<AuthStatus>(() => {
    if (bootstrapping) return 'loading'
    if (!session) return 'signed-out'
    if (aal.current === 'aal1' && aal.next === 'aal2') return 'mfa-challenge'
    if (workspaceLoading && memberships.length === 0) return 'loading'
    if (organization?.requireMfa && verifiedFactors === 0) return 'mfa-enrollment'
    if (memberships.length === 0) return 'no-organization'
    return 'ready'
  }, [bootstrapping, session, aal, workspaceLoading, memberships, organization, verifiedFactors])

  const can = useCallback((permission: Permission) => roleAllows(role, permission), [role])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    return { error: error ? friendlyError(error.message) : null }
  }, [])

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    return { error: error ? friendlyError(error.message) : null }
  }, [])

  const signInWithSso = useCallback(async (email: string) => {
    const domain = email.includes('@') ? email.split('@')[1]?.trim().toLowerCase() : email.trim()
    if (!domain) return { error: 'Enter your work email address so we can find your provider.' }

    const { data, error } = await supabase.auth.signInWithSSO({
      domain,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      const normalised = error.message.toLowerCase()
      if (normalised.includes('no sso provider') || normalised.includes('not found')) {
        return { error: `Single sign-on is not set up for ${domain}. Use your password instead.` }
      }
      return { error: friendlyError(error.message) }
    }
    if (data?.url) {
      window.location.assign(data.url)
      return { error: null }
    }
    return { error: 'Could not start single sign-on.' }
  }, [])

  const signUpWithPassword = useCallback(
    async (email: string, password: string, fullName: string) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) return { error: friendlyError(error.message), needsConfirmation: false }
      return { error: null, needsConfirmation: !data.session }
    },
    [],
  )

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset`,
    })
    return { error: error ? friendlyError(error.message) : null }
  }, [])

  const resendSignupConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    return { error: error ? friendlyError(error.message) : null }
  }, [])

  const switchOrganization = useCallback((organizationId: string) => {
    // Same class of bug as “change ?studentId= in the URL”: the client must not
    // adopt an organisation the session is not a member of. RLS would still
    // return empty rows, but the UI should refuse the switch outright.
    if (!isPlatformOwnerEmail(user?.email ?? profile?.email)) return
    if (!memberships.some((membership) => membership.organizationId === organizationId)) return
    localStorage.setItem(ACTIVE_ORG_KEY, organizationId)
    setActiveOrgId(organizationId)
  }, [memberships, user?.email, profile?.email])

  const createOrganization = useCallback(
    async (name: string) => {
      if (!isPlatformOwnerEmail(user?.email ?? profile?.email)) {
        return { error: 'Only Carbon Logic owners can add organisations. Ask to be invited to an existing workspace instead.' }
      }
      const { data, error } = await supabase.rpc('create_organization', { p_name: name.trim() })
      if (error) return { error: friendlyError(error.message) }
      const createdId = typeof data === 'string' ? data : null
      if (userId) await loadWorkspace(userId, user?.email, createdId)
      return { error: null }
    },
    [userId, user?.email, profile?.email, loadWorkspace],
  )

  const reloadWorkspace = useCallback(async () => {
    if (userId) await loadWorkspace(userId, user?.email)
  }, [userId, user?.email, loadWorkspace])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user,
      profile,
      organization,
      memberships,
      role,
      can,
      hasVerifiedMfa: verifiedFactors > 0,
      lastSignOutReason,
      idleWarningSecondsLeft,
      keepSessionAlive,
      signInWithPassword,
      signInWithMagicLink,
      signInWithSso,
      signUpWithPassword,
      requestPasswordReset,
      resendSignupConfirmation,
      signOut,
      signOutEverywhere,
      switchOrganization,
      createOrganization,
      canCreateOrganizations: isPlatformOwnerEmail(user?.email ?? profile?.email),
      reloadWorkspace,
      refreshMfaState,
    }),
    [
      status,
      session,
      user,
      profile,
      organization,
      memberships,
      role,
      can,
      verifiedFactors,
      lastSignOutReason,
      idleWarningSecondsLeft,
      keepSessionAlive,
      signInWithPassword,
      signInWithMagicLink,
      signInWithSso,
      signUpWithPassword,
      requestPasswordReset,
      resendSignupConfirmation,
      signOut,
      signOutEverywhere,
      switchOrganization,
      createOrganization,
      reloadWorkspace,
      refreshMfaState,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
