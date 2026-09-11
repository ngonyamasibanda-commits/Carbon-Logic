import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Building2, Copy, MailPlus, Search, Shield, Trash2, UserMinus } from 'lucide-react'
import { Alert, FormField, inputClass } from '../components/auth/AuthLayout'
import {
  ORG_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_RANK,
  fetchAuditLog,
  fetchOrgMembers,
  fetchPendingInvitations,
  inviteMember,
  inviteSignupUrl,
  isPlatformOwnerEmail,
  removeOrgMember,
  revokeInvitation,
  setMemberRole,
  type AuditEvent,
  type Membership,
  type OrgMember,
  type OrgRole,
  type PendingInvitation,
} from '../lib/auth'
import { useAuth } from '../lib/auth-context'

export default function PeoplePage() {
  const { organization, role, user, memberships, canCreateOrganizations, switchOrganization, reloadWorkspace, deleteOrganization } =
    useAuth()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const orgId = organization?.id
  const isPlatformOwner = isPlatformOwnerEmail(user?.email)
  const canManage = isPlatformOwner || role === 'owner' || role === 'admin'
  const canChooseOrg = canCreateOrganizations
  const choosableOrgs = useMemo(
    () => (canCreateOrganizations ? memberships : []),
    [canCreateOrganizations, memberships],
  )

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [nextMembers, nextInvites, nextAudit] = await Promise.all([
        fetchOrgMembers(orgId),
        fetchPendingInvitations(orgId),
        fetchAuditLog(orgId, 25),
      ])
      setMembers(nextMembers)
      setInvitations(nextInvites)
      setAudit(nextAudit)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    void load()
  }, [load])

  const grantableRoles = useMemo(
    () =>
      isPlatformOwner
        ? ORG_ROLES
        : ORG_ROLES.filter((candidate) => (role ? ROLE_RANK[candidate] <= ROLE_RANK[role] : false)),
    [isPlatformOwner, role],
  )

  const visibleMembers = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return members
    return members.filter(
      (member) =>
        member.email.toLowerCase().includes(needle) ||
        member.fullName.toLowerCase().includes(needle) ||
        member.role.includes(needle) ||
        ROLE_LABELS[member.role].toLowerCase().includes(needle),
    )
  }, [members, query])

  async function changeRole(membershipId: string, nextRole: OrgRole) {
    setError(null)
    setNotice(null)
    const { error: rpcError } = await setMemberRole(membershipId, nextRole)
    if (rpcError) setError(rpcError)
    else {
      setNotice('Access updated.')
      await load()
      await reloadWorkspace()
    }
  }

  async function removeMember(membershipId: string, email: string, isSelf: boolean) {
    const label = isSelf
      ? `Leave ${organization?.name}? You will lose access to this organisation’s data.`
      : `Remove ${email} from ${organization?.name}? They will immediately lose access to this organisation’s data.`
    if (!window.confirm(label)) return
    setError(null)
    setNotice(null)
    const { error: rpcError } = await removeOrgMember(membershipId)
    if (rpcError) setError(rpcError)
    else {
      setNotice(isSelf ? 'You left the organisation.' : `${email} was removed.`)
      await load()
      await reloadWorkspace()
    }
  }

  async function cancelInvite(id: string, email: string) {
    if (!window.confirm(`Revoke the invitation to ${email}?`)) return
    setError(null)
    setNotice(null)
    const { error: rpcError } = await revokeInvitation(id)
    if (rpcError) setError(rpcError)
    else {
      setNotice(`Invitation to ${email} was revoked.`)
      await load()
    }
  }

  async function destroyOrganization() {
    if (!orgId || !organization) return
    const confirmed = window.prompt(
      `This permanently deletes ${organization.name}, its people, invitations, and logged emissions. Type the organisation name to confirm.`,
    )
    if (confirmed !== organization.name) {
      if (confirmed !== null) setError('Organisation name did not match. Nothing was deleted.')
      return
    }
    setError(null)
    setNotice(null)
    const { error: rpcError } = await deleteOrganization(orgId)
    if (rpcError) setError(rpcError)
    else setNotice(`${organization.name} was deleted.`)
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="px-6 py-7">
          <h1 className="text-2xl font-semibold text-brand">People and access</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Carbon Logic owners can see every organisation, invite or remove people in them, and
            delete organisations. Everyone else can only manage people inside this organisation.
            That isolation is enforced in the database.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3 py-1.5 text-sm text-brand">
            <Building2 size={14} />
            <span className="font-semibold">{organization?.name ?? 'No organisation'}</span>
            <span className="text-brand/70">· {members.length} people</span>
          </div>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-brand to-accent" />
      </section>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {isPlatformOwner && orgId ? (
        <section className="rounded-2xl border border-red-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Delete organisation</h2>
          <p className="mt-1 text-sm text-muted">
            Permanently remove {organization?.name}, including its people, invitations, and emissions
            data. Only Carbon Logic owners can do this.
          </p>
          <button
            type="button"
            onClick={() => void destroyOrganization()}
            className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
          >
            <Trash2 size={14} />
            Delete {organization?.name}
          </button>
        </section>
      ) : null}

      {canManage ? (
        <InviteCard
          organizationId={orgId}
          organizationName={organization?.name}
          grantableRoles={grantableRoles}
          canChooseOrg={canChooseOrg}
          choosableOrgs={choosableOrgs}
          onSelectOrg={switchOrganization}
          onInvited={load}
        />
      ) : (
        <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">
          You can view who belongs to {organization?.name}, but only a manager or CEO can change
          access.
        </p>
      )}

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Members</h2>
            <p className="mt-1 text-xs text-muted">Only people in {organization?.name}.</p>
          </div>
          <label className="flex min-w-[220px] items-center gap-2 rounded-md border border-line bg-page px-3 py-2 text-sm">
            <Search size={14} className="text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email or role"
              className="w-full bg-transparent outline-none"
            />
          </label>
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : visibleMembers.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No people match that search.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-page text-muted">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Access</th>
                  <th className="px-3 py-2">Joined</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map((member) => {
                  const isSelf = member.userId === user?.id
                  const canEditOther =
                    canManage && role !== null && ROLE_RANK[member.role] <= ROLE_RANK[role] && !isSelf
                  return (
                    <tr key={member.membershipId} className="border-t border-line">
                      <td className="px-3 py-2 font-medium">
                        {member.fullName || '—'}
                        {isSelf ? <span className="ml-2 text-xs text-muted">(you)</span> : null}
                      </td>
                      <td className="px-3 py-2 text-muted">{member.email}</td>
                      <td className="px-3 py-2">
                        {canEditOther ? (
                          <select
                            value={member.role}
                            onChange={(event) =>
                              void changeRole(member.membershipId, event.target.value as OrgRole)
                            }
                            className="rounded-md border border-line px-2 py-1 text-sm"
                            aria-label={`Access for ${member.email}`}
                          >
                            {grantableRoles.map((option) => (
                              <option key={option} value={option}>
                                {ROLE_LABELS[option]}
                              </option>
                            ))}
                            {!grantableRoles.includes(member.role) ? (
                              <option value={member.role}>{ROLE_LABELS[member.role]}</option>
                            ) : null}
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-page px-2 py-1 text-xs font-medium">
                            <Shield size={11} className="text-brand" />
                            {ROLE_LABELS[member.role]}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {canEditOther || isSelf ? (
                          <button
                            type="button"
                            onClick={() => void removeMember(member.membershipId, member.email, isSelf)}
                            className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          >
                            {isSelf ? <UserMinus size={13} /> : <Trash2 size={13} />}
                            {isSelf ? 'Leave' : 'Remove access'}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ORG_ROLES.map((option) => (
            <div key={option} className="rounded-lg bg-page px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand">
                {ROLE_LABELS[option]}
              </div>
              <p className="mt-1 text-xs text-muted">{ROLE_DESCRIPTIONS[option]}</p>
            </div>
          ))}
        </div>
      </section>

      {canManage ? (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Pending invitations</h2>
          {invitations.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No outstanding invitations for this organisation.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <span className="font-medium">{invitation.email}</span>
                    <span className="ml-2 text-muted">
                      {ROLE_LABELS[invitation.role]} · expires{' '}
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyLinkButton url={inviteSignupUrl(invitation.email)} />
                    <button
                      type="button"
                      onClick={() => void cancelInvite(invitation.id, invitation.email)}
                      className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={12} />
                      Revoke
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            If they already have a Carbon Logic account, they are added immediately. Otherwise share
            the signup link — Carbon Logic does not email them. They join this organisation when they
            create an account with that exact email.
          </p>
        </section>
      ) : null}

      {canManage ? (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Activity log</h2>
          <p className="mt-1 text-sm text-muted">
            Access changes and inventory writes for {organization?.name} only. Activities can be
            deleted while a reporting year is open. Closed years cannot be changed until an
            administrator reopens them.
          </p>
          {audit.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {audit.map((event) => (
                <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span>
                    <span className="font-mono text-xs text-brand">{event.action}</span>
                    {event.actorEmail ? <span className="ml-2 text-muted">by {event.actorEmail}</span> : null}
                  </span>
                  <span className="text-xs text-muted">{new Date(event.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this signup link', url)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-brand hover:bg-page"
    >
      <Copy size={12} />
      {copied ? 'Copied' : 'Copy signup link'}
    </button>
  )
}

function InviteCard({
  organizationId,
  organizationName,
  grantableRoles,
  canChooseOrg,
  choosableOrgs,
  onSelectOrg,
  onInvited,
}: {
  organizationId?: string
  organizationName?: string
  grantableRoles: OrgRole[]
  canChooseOrg: boolean
  choosableOrgs: Membership[]
  onSelectOrg: (organizationId: string) => void
  onInvited: () => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrgRole>('viewer')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!grantableRoles.includes(role)) {
      setRole(grantableRoles[0] ?? 'viewer')
    }
  }, [grantableRoles, role])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!organizationId) return
    setBusy(true)
    setError(null)
    setNotice(null)
    setShareUrl(null)
    try {
      const result = await inviteMember(organizationId, email, role)
      if (result.error) {
        setError(result.error)
        return
      }
      const invitedEmail = email.trim().toLowerCase()
      if (result.addedImmediately) {
        setNotice(
          `${invitedEmail} already had an account and now has ${ROLE_LABELS[role]} access to ${organizationName}. No email was sent.`,
        )
      } else {
        const url = inviteSignupUrl(invitedEmail)
        setShareUrl(url)
        setNotice(
          `${invitedEmail} is invited to ${organizationName} as ${ROLE_LABELS[role]}. Carbon Logic does not email them. Copy the signup link and send it yourself — they must create an account with that exact email.`,
        )
      }
      setEmail('')
      await onInvited()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-lg font-semibold text-ink">Add or invite someone</h2>
      <p className="mt-1 text-sm text-muted">
        {canChooseOrg
          ? 'Choose the organisation this person should join. Only Carbon Logic owners can see or select other companies.'
          : `This invite can only add someone to ${organizationName}. You cannot see or place them in another organisation.`}
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
        {canChooseOrg && choosableOrgs.length > 0 ? (
          <div className="w-56">
            <FormField label="Organisation">
              <select
                value={organizationId}
                onChange={(event) => onSelectOrg(event.target.value)}
                className={inputClass}
              >
                {choosableOrgs.map((membership) => (
                  <option key={membership.organizationId} value={membership.organizationId}>
                    {membership.organization.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        ) : (
          <div className="min-w-[180px]">
            <FormField label="Organisation">
              <input readOnly value={organizationName ?? ''} className={`${inputClass} bg-page text-muted`} />
            </FormField>
          </div>
        )}
        <div className="min-w-[240px] flex-1">
          <FormField label="Work email">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              placeholder="colleague@company.com"
            />
          </FormField>
        </div>
        <div className="w-48">
          <FormField label="Access level">
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as OrgRole)}
              className={inputClass}
            >
              {grantableRoles.map((option) => (
                <option key={option} value={option}>
                  {ROLE_LABELS[option]}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <MailPlus size={15} />
          {busy ? 'Saving…' : 'Grant access'}
        </button>
      </form>
      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
      {notice ? (
        <div className="mt-3">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {shareUrl ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-page px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{shareUrl}</span>
          <CopyLinkButton url={shareUrl} />
        </div>
      ) : null}
    </section>
  )
}
