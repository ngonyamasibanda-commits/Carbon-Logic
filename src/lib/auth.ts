import { supabase } from './supabase'
import { isRateLimitError } from './security-errors'

export type OrgRole = 'owner' | 'admin' | 'editor' | 'viewer'

export const ORG_ROLES: OrgRole[] = ['owner', 'admin', 'editor', 'viewer']

export const ROLE_RANK: Record<OrgRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
}

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: 'CEO / owner — full control, including people, organisation settings and billing.',
  admin: 'Manager — add, remove and change access for colleagues; manage factors and targets.',
  editor: 'Editor — log and edit this organisation’s emissions data.',
  viewer: 'Viewer — read-only access to this organisation’s dashboards and reports.',
}

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'CEO / Owner',
  admin: 'Manager',
  editor: 'Editor',
  viewer: 'Viewer',
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
export const PLATFORM_OWNER_EMAILS = [
  FOUNDER_EMAIL,
  'founders@usecarbonlogic.com',
  'founders@carbonlogichq.com',
] as const

export function isPlatformOwnerEmail(email: string | null | undefined): boolean {
  return PLATFORM_OWNER_EMAILS.includes(
    (email ?? '').trim().toLowerCase() as (typeof PLATFORM_OWNER_EMAILS)[number],
  )
}

export function isFounderEmail(email: string | null | undefined): boolean {
  return isPlatformOwnerEmail(email)
}

export function inviteSignupUrl(email: string, origin = window.location.origin) {
  const url = new URL('/login', origin)
  url.searchParams.set('email', email.trim().toLowerCase())
  url.searchParams.set('invite', '1')
  return url.toString()
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

function mapMembershipRow(row: unknown): Membership {
  const record = row as {
    id: string
    organization_id: string
    user_id: string
    role: OrgRole
    created_at: string
    organizations?: OrganizationRow | OrganizationRow[] | null
  }
  const orgRow = Array.isArray(record.organizations) ? record.organizations[0] : record.organizations
  return {
    id: record.id,
    organizationId: record.organization_id,
    userId: record.user_id,
    role: record.role,
    createdAt: record.created_at,
    organization: orgRow
      ? toOrganization(orgRow)
      : {
          id: record.organization_id,
          name: HOME_ORGANIZATION_NAME,
          slug: 'workspace',
          allowedEmailDomains: [],
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
 * Loads real database memberships. Never invents a local workspace — that path
 * cannot invite people or persist access.
 *
 * `reliable` is false when every membership query failed. In that case we must
 * not create a new organisation: the user may already have one we could not see.
 */
export async function ensureHomeOrganization(
  userId: string,
  email: string | null | undefined,
  existing: Membership[],
  options?: { reliable?: boolean },
): Promise<Membership[]> {
  if (existing.length > 0) return existing
  if (options?.reliable === false) return existing
  if (!isFounderEmail(email)) return existing

  const { error } = await supabase.rpc('create_organization', { p_name: HOME_ORGANIZATION_NAME })
  if (error) return existing
  const { memberships } = await loadMemberships(userId, email)
  return memberships
}

async function attachPlatformOrganizations(
  userId: string,
  email: string | null | undefined,
  memberships: Membership[],
): Promise<Membership[]> {
  if (!isPlatformOwnerEmail(email)) return memberships

  const selects = [
    'id, name, slug, allowed_email_domains, require_mfa, session_idle_minutes, session_absolute_hours, created_at',
    'id, name, slug, created_at',
    'id, name, slug',
  ]

  for (const select of selects) {
    const { data, error } = await supabase.from('organizations').select(select).order('name', { ascending: true })
    if (error || !data) continue

    const seen = new Set(memberships.map((membership) => membership.organizationId))
    const extras: Membership[] = []
    for (const row of data) {
      const org = toOrganization(row as unknown as OrganizationRow)
      if (seen.has(org.id)) continue
      extras.push({
        id: `platform:${org.id}`,
        organizationId: org.id,
        userId,
        role: 'owner',
        createdAt: String((row as unknown as { created_at?: string }).created_at ?? ''),
        organization: org,
      })
    }
    return [...memberships, ...extras]
  }

  return memberships
}

export async function loadMemberships(
  userId: string,
  email?: string | null,
): Promise<{ memberships: Membership[]; reliable: boolean }> {
  const selects = [
    'id, organization_id, user_id, role, created_at, organizations!inner(id, name, slug, allowed_email_domains, require_mfa, session_idle_minutes, session_absolute_hours)',
    'id, organization_id, user_id, role, created_at, organizations!inner(id, name, slug)',
    'id, organization_id, user_id, role, created_at',
  ]

  for (const select of selects) {
    const query = supabase.from('memberships').select(select).eq('user_id', userId).order('created_at', {
      ascending: true,
    })
    const { data, error } = await query
    if (error || !data) continue
    // An inner join that returns no rows can mean the organisation embed failed,
    // not that the user has no memberships. Try the next, simpler select.
    if (data.length === 0 && select.includes('organizations!inner')) continue

    const mapped = data.map((row) => mapMembershipRow(row))
    const missingOrg = mapped.filter((membership) => membership.organization.slug === 'workspace')
    if (missingOrg.length === 0) {
      return {
        memberships: await attachPlatformOrganizations(userId, email, mapped),
        reliable: true,
      }
    }

    const ids = [...new Set(missingOrg.map((membership) => membership.organizationId))]
    const { data: orgs } = await supabase.from('organizations').select('id, name, slug').in('id', ids)
    const byId = new Map((orgs ?? []).map((org) => [org.id as string, org]))
    const filled = mapped.map((membership) => {
      const org = byId.get(membership.organizationId)
      if (!org) return membership
      return {
        ...membership,
        organization: {
          ...membership.organization,
          id: org.id as string,
          name: (org.name as string) ?? membership.organization.name,
          slug: (org.slug as string) ?? membership.organization.slug,
        },
      }
    })
    return {
      memberships: await attachPlatformOrganizations(userId, email, filled),
      reliable: true,
    }
  }

  const fallback = await attachPlatformOrganizations(userId, email, [])
  return { memberships: fallback, reliable: fallback.length > 0 }
}

export async function fetchMemberships(userId: string, email?: string | null): Promise<Membership[]> {
  const { memberships } = await loadMemberships(userId, email)
  return memberships
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

export async function inviteMember(
  organizationId: string,
  email: string,
  role: OrgRole,
): Promise<{ error: string | null; addedImmediately: boolean }> {
  if (isLocalOrganizationId(organizationId)) {
    return {
      error:
        'This tab is still on a local workspace, which cannot invite people. Run supabase/fix_invite_rpc.sql in the Supabase SQL editor, then refresh — do not stay on a workspace named from this browser only.',
      addedImmediately: false,
    }
  }

  const normalised = email.trim().toLowerCase()
  if (!normalised || !normalised.includes('@')) {
    return { error: 'Enter a valid work email address.', addedImmediately: false }
  }

  const attempts: Array<{ name: string; args: Record<string, string> }> = [
    { name: 'invite_org_member', args: { p_org: organizationId, p_email: normalised, p_role: role } },
    { name: 'invite_member', args: { p_org: organizationId, p_email: normalised, p_role: role } },
  ]

  let lastMessage = ''
  for (const attempt of attempts) {
    const { error: rpcError } = await supabase.rpc(attempt.name, attempt.args)
    if (!rpcError) {
      const members = await fetchOrgMembers(organizationId)
      return {
        error: null,
        addedImmediately: members.some((member) => member.email.toLowerCase() === normalised),
      }
    }
    lastMessage = rpcError.message
    if (!/could not find the function|schema cache/i.test(rpcError.message)) {
      return { error: explainInviteFailure(rpcError.message), addedImmediately: false }
    }
  }

  return { error: explainInviteFailure(lastMessage), addedImmediately: false }
}

export async function setMemberRole(membershipId: string, role: OrgRole): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('set_member_role', {
    p_membership: membershipId,
    p_role: role,
  })
  return { error: error?.message ?? null }
}

export async function removeOrgMember(membershipId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('remove_member', { p_membership: membershipId })
  return { error: error?.message ?? null }
}

export async function deleteOrganization(organizationId: string): Promise<{ error: string | null }> {
  if (isLocalOrganizationId(organizationId)) {
    return { error: 'A local workspace cannot be deleted from the server.' }
  }
  const { error } = await supabase.rpc('delete_organization', { p_org: organizationId })
  if (!error) return { error: null }
  if (/could not find the function|schema cache/i.test(error.message)) {
    return {
      error:
        'Organisation deletion is not registered on the database yet. In the Supabase SQL editor, paste supabase/fix_platform_owners.sql, click Run, then refresh.',
    }
  }
  return { error: error.message }
}

export async function revokeInvitation(invitationId: string): Promise<{ error: string | null }> {
  const { error: rpcError } = await supabase.rpc('revoke_invitation', { p_invitation: invitationId })
  if (!rpcError) return { error: null }
  return { error: explainInviteFailure(rpcError.message) }
}

function explainInviteFailure(message: string): string {
  if (isRateLimitError({ message })) {
    return 'This organisation has reached its hourly invite limit. Wait before sending more.'
  }
  if (/schema cache|could not find the function|row-level security|violates row-level/i.test(message)) {
    return 'Invites are not registered on the database yet. In the Supabase dashboard open SQL → New query, paste the full contents of supabase/fix_invite_rpc.sql, click Run, then refresh this page. Saving the app does not install that function.'
  }
  return message
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

/**
 * Clears session-only workspace cache on sign-out. Emission entries, sites, and
 * the last organisation must survive: a failed cloud write previously lived only
 * in localStorage, so wiping it made logged work vanish on the next login.
 */
export function clearLocalWorkspaceData() {
  const prefixes = ['carbon-logic-']
  const keepExact = new Set([
    'carbon-logic-auth',
    'carbon-logic-profile',
    'carbon-logic-sites',
    'carbon-logic-active-org',
    'carbon-logic-entry-meta',
    'carbon-logic-revenue',
  ])
  const keepPrefixes = [
    'carbon-logic-entries:',
    'carbon-logic-sites:',
    'carbon-logic-revenue:',
  ]
  const doomed: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key) continue
    if (keepExact.has(key) || keepPrefixes.some((prefix) => key.startsWith(prefix))) continue
    if (prefixes.some((prefix) => key.startsWith(prefix))) doomed.push(key)
  }
  for (const key of doomed) localStorage.removeItem(key)
}
