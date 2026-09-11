import { useMemo, useState, type FormEvent } from 'react'
import { Download, Upload } from 'lucide-react'
import { downloadText } from '../lib/export'
import { epdTemplateCsv, EPD_REQUIRED_MATERIALS } from '../lib/epd-materials'
import { formatNumber } from '../lib/format'
import { factorsToCsv, monthsStale, parseFactorSpreadsheet } from '../lib/factors-store'
import { safeHttpUrl } from '../lib/safe'
import { SOURCE_FAMILIES, type EmissionFactor, type Scope, type SourceFamily } from '../lib/types'
import { useEntries } from '../lib/entries-context'
import Callout from '../components/ui/Callout'

const SCOPES: Array<Scope | 'Custom'> = ['Scope 1', 'Scope 2', 'Scope 3', 'Custom']

const FAMILY_STYLE: Record<SourceFamily, string> = {
  DEFRA: 'bg-emerald-100 text-emerald-800',
  DESNZ: 'bg-teal-100 text-teal-800',
  BEIS: 'bg-sky-100 text-sky-800',
  ICE: 'bg-violet-100 text-violet-800',
  EPD: 'bg-indigo-100 text-indigo-800',
  EIO: 'bg-amber-100 text-amber-900',
  EPA: 'bg-orange-100 text-orange-800',
  IPCC: 'bg-slate-200 text-slate-800',
  User: 'bg-gray-100 text-gray-700',
}

const emptyForm = (): EmissionFactor => ({
  key: '',
  name: '',
  category: 'Custom',
  scope: 'Custom',
  conversionValue: 0,
  unit: '',
  sourceFamily: 'User',
  source: '',
  sourceUrl: '',
  region: 'United Kingdom',
  validFrom: new Date().toISOString().slice(0, 10),
  lastVerifiedAt: new Date().toISOString().slice(0, 10),
  isPlaceholder: false,
})

export default function FactorsPage() {
  const { factors, saveFactors } = useEntries()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<EmissionFactor | null>(null)
  const [form, setForm] = useState<EmissionFactor>(emptyForm)
  const [status, setStatus] = useState<string | null>(null)

  const rows = useMemo(() => {
    const list = [...factors.values()].sort((a, b) => a.name.localeCompare(b.name))
    const q = query.toLowerCase()
    return list.filter(
      (factor) =>
        factor.key.toLowerCase().includes(q) ||
        factor.name.toLowerCase().includes(q) ||
        factor.category.toLowerCase().includes(q) ||
        factor.source.toLowerCase().includes(q) ||
        factor.sourceFamily.toLowerCase().includes(q),
    )
  }, [factors, query])

  const staleCount = rows.filter((factor) => monthsStale(factor) || factor.isPlaceholder).length

  async function persist(next: EmissionFactor[]) {
    await saveFactors(next)
    setStatus(`Saved ${next.length} emission factors.`)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form.key.trim() || !Number.isFinite(form.conversionValue)) {
      setStatus('Key and conversion value are required.')
      return
    }
    const next = new Map(factors)
    next.set(form.key.trim(), {
      ...form,
      key: form.key.trim(),
      isPlaceholder: form.source.toUpperCase().includes('SEED') || form.source.toUpperCase().includes('PLACEHOLDER'),
    })
    await persist([...next.values()])
    setEditing(null)
    setForm(emptyForm())
  }

  async function onImport(file: File | undefined) {
    if (!file) return
    if (/\.xlsx?$/i.test(file.name)) {
      setStatus('Save the workbook as CSV or TSV first. Excel binary files cannot be imported directly.')
      return
    }
    const text = await file.text()
    const imported = parseFactorSpreadsheet(text)
    if (imported.length === 0) {
      setStatus('No valid rows found. Use columns key (or activity_type) and conversion_value (or co2e_factor).')
      return
    }
    const next = new Map(factors)
    for (const factor of imported) next.set(factor.key, factor)
    await persist([...next.values()])
    setStatus(`Imported ${imported.length} rows from ${file.name}.`)
  }

  function startEdit(factor: EmissionFactor) {
    setEditing(factor)
    setForm(factor)
  }

  async function removeFactor(key: string) {
    const next = [...factors.values()].filter((factor) => factor.key !== key)
    await persist(next)
    if (editing?.key === key) {
      setEditing(null)
      setForm(emptyForm())
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-ink">Emission factors</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Conversion values are kg CO₂e per activity unit. tCO₂e = (activity × conversion
            value) / 1000. Each row shows the publisher: DEFRA / DESNZ (UK government
            conversion factors 2026, formerly BEIS), EPD or user factors for steel, cement,
            and other materials without a DESNZ row, or EIO / EPA / IPCC for spend-based,
            explosives, and GWP sources.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm"
            onClick={() => downloadText('emission-factors.csv', factorsToCsv([...factors.values()]), 'text/csv')}
          >
            <Download size={14} /> Export spreadsheet
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white">
            <Upload size={14} /> Import EPD or spreadsheet
            <input
              type="file"
              accept=".csv,text/csv,.tsv,text/tab-separated-values"
              className="hidden"
              onChange={(event) => void onImport(event.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm"
            onClick={() => downloadText('epd-material-factors.csv', epdTemplateCsv(), 'text/csv')}
          >
            <Download size={14} /> EPD template
          </button>
          <button
            type="button"
            className="rounded-md border border-line px-3 py-2 text-sm"
            onClick={() => {
              setEditing(null)
              setForm(emptyForm())
            }}
          >
            New factor
          </button>
        </div>
      </div>

      {staleCount > 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {staleCount} factor{staleCount === 1 ? '' : 's'} are older than 12 months or still
          marked as seed/placeholder. Update them before using figures in a filing.
        </p>
      ) : null}
      <Callout tone="info">
        Steel, rebar, cement, aluminium, copper, and lime are not in the published DESNZ 2026
        library. Add them here from a supplier EPD (keep the keys{' '}
        {EPD_REQUIRED_MATERIALS.map((row) => row.key).join(', ')}
        ) so Bulk Materials can calculate. Generic ICE database values are not shipped in this
        product.
      </Callout>
      <Callout tone="tip">
        Download the EPD template, paste GWP A1–A3 into <span className="font-semibold">gwp_a1_a3</span>{' '}
        and set <span className="font-semibold">declared_unit</span> to kg CO2e/kg or kg CO2e per
        tonne. Import converts per-kg figures to kg CO₂e per tonne automatically. You can also
        fill conversion_value yourself if the EPD is already per tonne.
      </Callout>
      {status ? <p className="text-sm text-brand-dark">{status}</p> : null}

      <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Key" value={form.key} onChange={(value) => setForm({ ...form, key: value })} />
        <Field label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
        <Field label="Category" value={form.category} onChange={(value) => setForm({ ...form, category: value })} />
        <label className="text-sm font-medium">
          Scope
          <select
            value={form.scope}
            onChange={(event) => setForm({ ...form, scope: event.target.value as EmissionFactor['scope'] })}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 font-normal"
          >
            {SCOPES.map((scope) => (
              <option key={scope}>{scope}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Conversion value (kg CO2e / unit)
          <input
            type="number"
            step="any"
            value={form.conversionValue}
            onChange={(event) => setForm({ ...form, conversionValue: Number(event.target.value) })}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 font-normal"
            required
          />
        </label>
        <Field label="Unit" value={form.unit} onChange={(value) => setForm({ ...form, unit: value })} />
        <label className="text-sm font-medium">
          Source (publisher)
          <select
            value={form.sourceFamily}
            onChange={(event) =>
              setForm({ ...form, sourceFamily: event.target.value as SourceFamily })
            }
            className="mt-1 w-full rounded-md border border-line px-3 py-2 font-normal"
          >
            {SOURCE_FAMILIES.map((family) => (
              <option key={family}>{family}</option>
            ))}
          </select>
        </label>
        <Field label="Source citation" value={form.source} onChange={(value) => setForm({ ...form, source: value })} />
        <Field label="Source URL" value={form.sourceUrl} onChange={(value) => setForm({ ...form, sourceUrl: value })} />
        <Field label="Region" value={form.region} onChange={(value) => setForm({ ...form, region: value })} />
        <Field label="Valid from" value={form.validFrom} onChange={(value) => setForm({ ...form, validFrom: value })} />
        <Field
          label="Last verified"
          value={form.lastVerifiedAt}
          onChange={(value) => setForm({ ...form, lastVerifiedAt: value })}
        />
        <div className="flex items-end">
          <button type="submit" className="w-full rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white">
            {editing ? 'Update factor' : 'Add factor'}
          </button>
        </div>
      </form>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search factors or source (DEFRA, DESNZ, EPD, EIO)..."
        className="w-full rounded-md border border-line px-3 py-2 text-sm"
      />

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-page text-muted">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Key</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2">Value</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Verified</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((factor) => (
              <tr key={factor.key} className="border-t border-line">
                <td className="px-3 py-2">
                  {factor.name}
                  {factor.isPlaceholder ? (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                      seed
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{factor.key}</td>
                <td className="px-3 py-2">{factor.category}</td>
                <td className="px-3 py-2">{factor.scope}</td>
                <td className="px-3 py-2 tabular-nums">{formatNumber(factor.conversionValue)}</td>
                <td className="px-3 py-2">{factor.unit}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${FAMILY_STYLE[factor.sourceFamily]}`}
                  >
                    {factor.sourceFamily}
                  </span>
                  {safeHttpUrl(factor.sourceUrl) ? (
                    <a
                      href={safeHttpUrl(factor.sourceUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block max-w-[220px] truncate text-[11px] text-brand hover:underline"
                      title={factor.source}
                    >
                      {factor.source}
                    </a>
                  ) : (
                    <div className="mt-1 max-w-[220px] truncate text-[11px] text-muted" title={factor.source}>
                      {factor.source}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {factor.lastVerifiedAt}
                  {monthsStale(factor) ? <span className="ml-1 text-amber-700">stale</span> : null}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button type="button" className="text-brand hover:underline" onClick={() => startEdit(factor)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ml-3 text-muted hover:underline"
                    onClick={() => void removeFactor(factor.key)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-line px-3 py-2 font-normal"
      />
    </label>
  )
}
