import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Membership, OrgRole, Organization, Permission, Profile } from './auth'

/**
 * Every state the shell can be in. Anything other than 'ready' renders a gate rather
 * than the application, so there is no window where protected UI is briefly visible.
 */
export type AuthStatus =
  | 'loading'
  | 'signed-out'
  | 'mfa-challenge'
  | 'mfa-enrollment'
  | 'no-organization'
  | 'ready'

export type SignOutReason = 'user' | 'idle' | 'expired' | 'everywhere'

export type AuthResult = { error: string | null }

export type AuthContextValue = {
  status: AuthStatus
  session: Session | null
  user: User | null
  profile: Profile | null
  organization: Organization | null
  memberships: Membership[]
  role: OrgRole | null
  can: (permission: Permission) => boolean
  hasVerifiedMfa: boolean
  lastSignOutReason: SignOutReason | null
  idleWarningSecondsLeft: number | null
  keepSessionAlive: () => void
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>
  signInWithMagicLink: (email: string) => Promise<AuthResult>
  signInWithSso: (email: string) => Promise<AuthResult>
  signUpWithPassword: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<AuthResult & { needsConfirmation: boolean }>
  requestPasswordReset: (email: string) => Promise<AuthResult>
  signOut: (reason?: SignOutReason) => Promise<void>
  signOutEverywhere: () => Promise<void>
  switchOrganization: (organizationId: string) => void
  createOrganization: (name: string) => Promise<AuthResult>
  canCreateOrganizations: boolean
  reloadWorkspace: () => Promise<void>
  refreshMfaState: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
