import { useState, type FormEvent } from 'react'
import { Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useOrg } from '../providers/OrgProvider'
import type { Site } from '../lib/org'

export default function SitesPage() {
  const { sites, addSite, removeSite, loading, error } = useOrg()
  const [siteForm, setSiteForm] = useState({ name: '', type: 'construction_site', region: 'United Kingdom' })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function onAddSite(event: FormEvent) {
    event.preventDefault()
    if (!siteForm.name.trim()) return
    setBusy(true)
    setFormError(null)
    const result = await addSite({
      name: siteForm.name.trim(),
      type: siteForm.type as Site['type'],
      region: siteForm.region,
    })
    setBusy(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    setSiteForm({ name: '', type: 'construction_site', region: 'United Kingdom' })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-ink">Facilities</h1>
        <p className="mt-2 text-sm text-muted">
          Construction sites, mines, processing plants, depots, warehouses, and offices. Facilities
          are stored on this organisation, so every colleague sees the same list on the dashboard,
          data-entry forms, and Analysis filters. Average FTE for intensity ratios is set on{' '}
          <Link to="/organisation" className="text-brand hover:underline">
            Organisation
          </Link>
          , not per site.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}
      {formError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</p>
      ) : null}

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold">Sites</h2>
        <form onSubmit={(event) => void onAddSite(event)} className="mt-3 grid gap-2 sm:grid-cols-4">
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
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Add site'}
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
            {loading && sites.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-muted">
                  Loading facilities…
                </td>
              </tr>
            ) : sites.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-muted">
                  No facilities yet. Add the sites this company reports against so staff can tag
                  every activity.
                </td>
              </tr>
            ) : (
              sites.map((site) => (
                <tr key={site.id} className="border-b border-line">
                  <td className="py-2">{site.name}</td>
                  <td>{site.type.replaceAll('_', ' ')}</td>
                  <td>{site.region}</td>
                  <td>
                    <button
                      type="button"
                      className="text-red-600"
                      onClick={() => void removeSite(site.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold">Team</h2>
        <p className="mt-2 text-sm text-muted">
          People and their roles live under People &amp; Access. Invites are stored in the database,
          so adding staff does not use this browser’s storage.
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
