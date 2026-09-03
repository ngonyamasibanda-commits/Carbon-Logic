import { supabase } from './supabase'

export type OrgRole = 'owner' | 'admin' | 'editor' | 'viewer'

export const ORG_ROLES: OrgRole[] = ['owner', 'admin', 'editor', 'viewer']

export const ROLE_RANK: Record<OrgRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
}

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: 'Full control, including organisation settings and billing.',
  admin: 'Manage people, emission factors and targets.',
  editor: 'Log and edit emissions data.',
  viewer: 'Read-only access to dashboards and reports.',
}

/**
 * Least privilege: every guarded action names the lowest role that may perform it.
 * These checks mirror the Row Level Security policies, which are the real enforcement
 * point. Anything here is only about not showing people buttons that would fail.
 */
export type Permission =
  | 'entries:read'
  | 'entries:write'
  | 'factors:read'
  | 'factors:write'
  | 'targets:read'
  | 'targets:write'
  | 'members:read'
  | 'members:manage'
  | 'audit:read'
  | 'org:manage'

const MINIMUM_ROLE: Record<Permission, OrgRole> = {
  'entries:read': 'viewer',
  'entries:write': 'editor',
  'factors:read': 'viewer',
  'factors:write': 'admin',
  'targets:read': 'viewer',
  'targets:write': 'admin',
  'members:read': 'viewer',
  'members:manage': 'admin',
  'audit:read': 'admin',
  'org:manage': 'owner',
}

export function roleAllows(role: OrgRole | null, permission: Permission): boolean {
  if (!role) return false
  return ROLE_RANK[role] >= ROLE_RANK[MINIMUM_ROLE[permission]]
}

export function requiredRoleFor(permission: Permission): OrgRole {
  return MINIMUM_ROLE[permission]
}

// OWASP puts idle timeouts at 15-30 minutes for low-risk applications and absolute
// timeouts at 4-8 hours. Emissions reporting is business data rather than financial
// transactions, so we sit at the permissive end and let each organisation tighten it.
export const DEFAULT_IDLE_MINUTES = 30
export const DEFAULT_ABSOLUTE_HOURS = 12
export const IDLE_WARNING_SECONDS = 90

export const HOME_ORGANIZATION_NAME = 'Carbon Logic'
export const FOUNDER_EMAIL = 'ngonyamasibanda@gmail.com'

export function isFounderEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === FOUNDER_EMAIL
}

export type Organization = {
  id: string
  name: string
  slug: string
  allowedEmailDomains: string[]
  requireMfa: boolean
  sessionIdleMinutes: number
  sessionAbsoluteHours: number
}

export type Profile = {
  id: string
  email: string
  fullName: string
  jobTitle: string
}

export type Membership = {
  id: string
  organizationId: string
  userId: string
  role: OrgRole
  createdAt: string
  organization: Organization
}

export type OrgMember = {
  membershipId: string
  userId: string
  email: string
  fullName: string
  role: OrgRole
  createdAt: string
}

export type PendingInvitation = {
  id: string
  email: string
  role: OrgRole
  expiresAt: string
  createdAt: string
}

export type AuditEvent = {
  id: number
  action: string
  actorEmail: string | null
  targetType: string | null
  targetId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

type OrganizationRow = {
  id: string
  name: string
  slug: string
  allowed_email_domains: string[] | null
  require_mfa: boolean | null
  session_idle_minutes: number | null
  session_absolute_hours: number | null
}

function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    allowedEmailDomains: row.allowed_email_domains ?? [],
    requireMfa: Boolean(row.require_mfa),
    sessionIdleMinutes: row.session_idle_minutes ?? DEFAULT_IDLE_MINUTES,
    sessionAbsoluteHours: row.session_absolute_hours ?? DEFAULT_ABSOLUTE_HOURS,
  }
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, job_title')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null
  return {
    id: data.id as string,
    email: (data.email as string) ?? '',
    fullName: (data.full_name as string) ?? '',
    jobTitle: (data.job_title as string) ?? '',
  }
}

function localFounderMembership(userId: string): Membership {
  return {
    id: `local-membership-${userId}`,
    organizationId: `local-org-${userId}`,
    userId,
    role: 'owner',
    createdAt: new Date().toISOString(),
    organization: {
      id: `local-org-${userId}`,
      name: HOME_ORGANIZATION_NAME,
      slug: 'carbon-logic',
      allowedEmailDomains: ['gmail.com'],
      requireMfa: false,
      sessionIdleMinutes: DEFAULT_IDLE_MINUTES,
      sessionAbsoluteHours: DEFAULT_ABSOLUTE_HOURS,
    },
  }
}

export function isLocalOrganizationId(organizationId: string | null | undefined): boolean {
  return Boolean(organizationId?.startsWith('local-org-'))
}

/**
 * Makes sure the signed-in founder has Carbon Logic. Prefers the database RPC so
 * the membership is real; if the tenancy migration has not been applied yet, fall
 * back to a local workspace so they are not locked out of the app.
 */
export async function ensureHomeOrganization(
  userId: string,
  email: string | null | undefined,
  existing: Membership[],
): Promise<Membership[]> {
  if (existing.length > 0) return existing
  if (!isFounderEmail(email)) return existing

  const { error } = await supabase.rpc('create_organization', { p_name: HOME_ORGANIZATION_NAME })
  if (!error) {
    const created = await fetchMemberships(userId)
    if (created.length > 0) return created
  }

  return [localFounderMembership(userId)]
}

export async function fetchMemberships(userId: string): Promise<Membership[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select(
      'id, organization_id, user_id, role, created_at, organizations!inner(id, name, slug, allowed_email_domains, require_mfa, session_idle_minutes, session_absolute_hours)',
    )
    .eq('user_id', userId)

  if (error || !data) return []

  return data.map((row) => {
    const record = row as unknown as {
      id: string
      organization_id: string
      user_id: string
      role: OrgRole
      created_at: string
      organizations: OrganizationRow
    }
    return {
      id: record.id,
      organizationId: record.organization_id,
      userId: record.user_id,
      role: record.role,
      createdAt: record.created_at,
      organization: toOrganization(record.organizations),
    }
  })
}

export async function fetchOrgMembers(organizationId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('id, user_id, role, created_at, profiles!inner(id, email, full_name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map((row) => {
    const record = row as unknown as {
      id: string
      user_id: string
      role: OrgRole
      created_at: string
      profiles: { email: string; full_name: string | null }
    }
    return {
      membershipId: record.id,
      userId: record.user_id,
      email: record.profiles.email,
      fullName: record.profiles.full_name ?? '',
      role: record.role,
      createdAt: record.created_at,
    }
  })
}

export async function fetchPendingInvitations(
  organizationId: string,
): Promise<PendingInvitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, role, expires_at, created_at, accepted_at')
    .eq('organization_id', organizationId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data.map((row) => ({
    id: row.id as string,
    email: row.email as string,
    role: row.role as OrgRole,
    expiresAt: row.expires_at as string,
    createdAt: row.created_at as string,
  }))
}

export async function fetchAuditLog(organizationId: string, limit = 50): Promise<AuditEvent[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, action, actor_email, target_type, target_id, metadata, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data.map((row) => ({
    id: Number(row.id),
    action: row.action as string,
    actorEmail: (row.actor_email as string) ?? null,
    targetType: (row.target_type as string) ?? null,
    targetId: (row.target_id as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  }))
}

export async function recordAuditEvent(
  organizationId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata: Record<string, unknown> = {},
) {
  // Audit writes must never block or break the action they describe.
  try {
    await supabase.rpc('record_audit_event', {
      p_org: organizationId,
      p_action: action,
      p_target_type: targetType ?? null,
      p_target_id: targetId ?? null,
      p_metadata: metadata,
    })
  } catch {
    // Swallowed deliberately.
  }
}

/**
 * NIST SP 800-63B: length is what matters, and blocklists beat composition rules.
 * Rotation and forced special characters are explicitly discouraged there.
 */
export const MIN_PASSWORD_LENGTH = 12

const COMMON_PASSWORDS = [
  'password',
  'passw0rd',
  '123456789012',
  'qwertyuiop',
  'letmein',
  'welcome',
  'iloveyou',
  'admin',
  'carbonlogic',
]

export type PasswordAssessment = {
  valid: boolean
  score: 0 | 1 | 2 | 3 | 4
  problems: string[]
}

export function assessPassword(password: string, email = ''): PasswordAssessment {
  const problems: string[] = []
  const lower = password.toLowerCase()

  if (password.length < MIN_PASSWORD_LENGTH) {
    problems.push(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
  if (COMMON_PASSWORDS.some((common) => lower.includes(common))) {
    problems.push('This contains a commonly guessed word.')
  }
  const localPart = email.split('@')[0]?.toLowerCase()
  if (localPart && localPart.length > 2 && lower.includes(localPart)) {
    problems.push('Do not include your email address.')
  }
  if (/^(.)\1+$/.test(password)) {
    problems.push('Do not repeat a single character.')
  }

  let score = 0
  if (password.length >= MIN_PASSWORD_LENGTH) score += 1
  if (password.length >= 16) score += 1
  if (/[^A-Za-z0-9]/.test(password) || /\s/.test(password)) score += 1
  if (new Set(password).size >= 10) score += 1

  return {
    valid: problems.length === 0,
    score: Math.min(4, score) as PasswordAssessment['score'],
    problems,
  }
}

/** Clears cached workspace data so a signed-out browser keeps nothing readable. */
export function clearLocalWorkspaceData() {
  const prefixes = ['carbon-logic-']
  const keep = new Set(['carbon-logic-auth', 'carbon-logic-profile', 'carbon-logic-sites'])
  const doomed: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key || keep.has(key)) continue
    if (prefixes.some((prefix) => key.startsWith(prefix))) doomed.push(key)
  }
  for (const key of doomed) localStorage.removeItem(key)
}
