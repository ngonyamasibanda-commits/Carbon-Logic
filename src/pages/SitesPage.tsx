import { useState, type FormEvent } from 'react'
import { useOrg } from '../providers/OrgProvider'
import type { Site, TeamMember } from '../lib/org'

export default function SitesPage() {
  const { sites, team, addSite, removeSite, addMember, removeMember } = useOrg()
  const [siteForm, setSiteForm] = useState({ name: '', type: 'construction_site', region: 'United Kingdom' })
  const [memberForm, setMemberForm] = useState({ name: '', email: '', role: 'editor' })

  function onAddSite(event: FormEvent) {
    event.preventDefault()
    if (!siteForm.name.trim()) return
    addSite({
      name: siteForm.name.trim(),
      type: siteForm.type as Site['type'],
      region: siteForm.region,
    })
    setSiteForm({ name: '', type: 'construction_site', region: 'United Kingdom' })
  }

  function onAddMember(event: FormEvent) {
    event.preventDefault()
    if (!memberForm.name.trim() || !memberForm.email.trim()) return
    addMember({
      name: memberForm.name.trim(),
      email: memberForm.email.trim(),
      role: memberForm.role as TeamMember['role'],
    })
    setMemberForm({ name: '', email: '', role: 'editor' })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-ink">Facilities</h1>
        <p className="mt-2 text-sm text-muted">
          Construction sites, depots, warehouses, and offices. Facilities appear on the dashboard
          chart, in every data-entry form, and in Analysis filters.
        </p>
      </div>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold">Sites</h2>
        <form onSubmit={onAddSite} className="mt-3 grid gap-2 sm:grid-cols-4">
          <input
            value={siteForm.name}
            onChange={(event) => setSiteForm({ ...siteForm, name: event.target.value })}
            placeholder="Site name"
            className="rounded-md border border-line px-3 py-2 text-sm"
            required
          />
          <select
            value={siteForm.type}
            onChange={(event) => setSiteForm({ ...siteForm, type: event.target.value })}
            className="rounded-md border border-line px-3 py-2 text-sm"
          >
            <option value="construction_site">Construction site</option>
            <option value="depot">Depot</option>
            <option value="warehouse">Warehouse</option>
            <option value="office">Office</option>
          </select>
          <input
            value={siteForm.region}
            onChange={(event) => setSiteForm({ ...siteForm, region: event.target.value })}
            placeholder="Region"
            className="rounded-md border border-line px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white">
            Add site
          </button>
        </form>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2">Name</th>
              <th>Type</th>
              <th>Region</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => (
              <tr key={site.id} className="border-b border-line">
                <td className="py-2">{site.name}</td>
                <td>{site.type.replaceAll('_', ' ')}</td>
                <td>{site.region}</td>
                <td>
                  <button type="button" className="text-red-600" onClick={() => removeSite(site.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold">Team</h2>
        <form onSubmit={onAddMember} className="mt-3 grid gap-2 sm:grid-cols-4">
          <input
            value={memberForm.name}
            onChange={(event) => setMemberForm({ ...memberForm, name: event.target.value })}
            placeholder="Name"
            className="rounded-md border border-line px-3 py-2 text-sm"
            required
          />
          <input
            type="email"
            value={memberForm.email}
            onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })}
            placeholder="Email"
            className="rounded-md border border-line px-3 py-2 text-sm"
            required
          />
          <select
            value={memberForm.role}
            onChange={(event) => setMemberForm({ ...memberForm, role: event.target.value })}
            className="rounded-md border border-line px-3 py-2 text-sm"
          >
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button type="submit" className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white">
            Invite
          </button>
        </form>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2">Name</th>
              <th>Email</th>
              <th>Role</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {team.map((member) => (
              <tr key={member.id} className="border-b border-line">
                <td className="py-2">{member.name}</td>
                <td>{member.email}</td>
                <td className="capitalize">{member.role}</td>
                <td>
                  <button type="button" className="text-red-600" onClick={() => removeMember(member.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
