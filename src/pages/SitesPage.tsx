import { useState, type FormEvent } from 'react'
import { Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useOrg } from '../providers/OrgProvider'
import type { Site } from '../lib/org'

export default function SitesPage() {
  const { sites, addSite, removeSite } = useOrg()
  const [siteForm, setSiteForm] = useState({ name: '', type: 'construction_site', region: 'United Kingdom' })

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-ink">Facilities</h1>
        <p className="mt-2 text-sm text-muted">
          Construction sites, mines, processing plants, depots, warehouses, and offices. Facilities
          appear on the dashboard chart, in every data-entry form, and in Analysis filters.
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
            <option value="mine">Mine</option>
            <option value="processing_plant">Processing plant</option>
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
        <p className="mt-2 text-sm text-muted">
          People and their roles now live under People &amp; Access, where they are backed by real
          accounts and enforced by the database rather than stored in this browser.
        </p>
        <Link
          to="/people"
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          <Users size={15} />
          Manage people and access
        </Link>
      </section>

    </div>
  )
}
