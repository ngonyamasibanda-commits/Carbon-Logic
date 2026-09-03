import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { MailPlus, Trash2 } from 'lucide-react'
import { Alert, FormField, inputClass } from '../components/auth/AuthLayout'
import {
  ORG_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_RANK,
  fetchAuditLog,
  fetchOrgMembers,
  fetchPendingInvitations,
  type AuditEvent,
  type OrgMember,
  type OrgRole,
  type PendingInvitation,
} from '../lib/auth'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'

export default function PeoplePage() {
  const { organization, role, user, reloadWorkspace } = useAuth()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const orgId = organization?.id

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

  // The database enforces this too; mirroring it here keeps impossible options hidden.
  const grantableRoles = useMemo(
    () => ORG_ROLES.filter((candidate) => (role ? ROLE_RANK[candidate] <= ROLE_RANK[role] : false)),
    [role],
  )

  async function changeRole(membershipId: string, nextRole: OrgRole) {
    setError(null)
    setNotice(null)
    const { error: rpcError } = await supabase.rpc('set_member_role', {
      p_membership: membershipId,
      p_role: nextRole,
    })
    if (rpcError) setError(rpcError.message)
    else {
      setNotice('Role updated.')
      await load()
      await reloadWorkspace()
    }
  }

  async function removeMember(membershipId: string, email: string) {
    if (!window.confirm(`Remove ${email} from ${organization?.name}?`)) return
    setError(null)
    setNotice(null)
    const { error: rpcError } = await supabase.rpc('remove_member', { p_membership: membershipId })
    if (rpcError) setError(rpcError.message)
    else {
      setNotice(`${email} was removed.`)
      await load()
      await reloadWorkspace()
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="px-6 py-7">
          <h1 className="text-2xl font-semibold text-brand">People and access</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Roles are enforced by the database, not the interface. Someone with the viewer role
            cannot write emissions data even if they call the API directly.
          </p>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-brand to-accent" />
      </section>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <InviteCard organizationId={orgId} grantableRoles={grantableRoles} onInvited={load} />

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Members</h2>
        {loading ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-page text-muted">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Joined</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isSelf = member.userId === user?.id
                  const canEdit = role ? ROLE_RANK[member.role] <= ROLE_RANK[role] : false
                  return (
                    <tr key={member.membershipId} className="border-t border-line">
                      <td className="px-3 py-2 font-medium">
                        {member.fullName || '—'}
                        {isSelf ? <span className="ml-2 text-xs text-muted">(you)</span> : null}
                      </td>
                      <td className="px-3 py-2 text-muted">{member.email}</td>
                      <td className="px-3 py-2">
                        <select
                          value={member.role}
                          disabled={!canEdit}
                          onChange={(event) =>
                            void changeRole(member.membershipId, event.target.value as OrgRole)
                          }
                          className="rounded-md border border-line px-2 py-1 text-sm disabled:bg-page disabled:text-muted"
                        >
                          {grantableRoles.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                          {!grantableRoles.includes(member.role) ? (
                            <option value={member.role}>{member.role}</option>
                          ) : null}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={!canEdit && !isSelf}
                          onClick={() => void removeMember(member.membershipId, member.email)}
                          className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40"
                        >
                          <Trash2 size={13} />
                          {isSelf ? 'Leave' : 'Remove'}
                        </button>
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
              <div className="text-xs font-semibold uppercase tracking-wide text-brand">{option}</div>
              <p className="mt-1 text-xs text-muted">{ROLE_DESCRIPTIONS[option]}</p>
            </div>
          ))}
        </div>
      </section>

      {invitations.length > 0 ? (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Pending invitations</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium">{invitation.email}</span>
                <span className="text-muted">
                  {invitation.role} · expires {new Date(invitation.expiresAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            An invitation is redeemed automatically when that address signs up.
          </p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Activity log</h2>
        <p className="mt-1 text-sm text-muted">
          Append-only record of access changes. Nobody, including owners, can edit or delete entries.
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
    </div>
  )
}

function InviteCard({
  organizationId,
  grantableRoles,
  onInvited,
}: {
  organizationId?: string
  grantableRoles: OrgRole[]
  onInvited: () => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrgRole>('viewer')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!organizationId) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { error: rpcError } = await supabase.rpc('invite_member', {
        p_org: organizationId,
        p_email: email.trim().toLowerCase(),
        p_role: role,
      })
      if (rpcError) {
        setError(rpcError.message)
        return
      }
      setNotice(`${email} can now join as ${role} by signing up with that address.`)
      setEmail('')
      await onInvited()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-lg font-semibold text-ink">Invite someone</h2>
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
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
        <div className="w-40">
          <FormField label="Role">
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as OrgRole)}
              className={inputClass}
            >
              {grantableRoles.map((option) => (
                <option key={option} value={option}>
                  {option}
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
          {busy ? 'Inviting…' : 'Send invitation'}
        </button>
      </form>
      {error ? <div className="mt-3"><Alert tone="error">{error}</Alert></div> : null}
      {notice ? <div className="mt-3"><Alert tone="success">{notice}</Alert></div> : null}
    </section>
  )
}
