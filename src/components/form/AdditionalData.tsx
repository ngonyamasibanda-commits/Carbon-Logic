import { Paperclip, Plus, Tag, X } from 'lucide-react'
import type { AdditionalState } from '../../lib/types'
import { useOrg } from '../../providers/OrgProvider'

type Props = {
  value: AdditionalState
  onChange: (next: AdditionalState) => void
}

export default function AdditionalData({ value, onChange }: Props) {
  const { sites } = useOrg()

  function update(partial: Partial<AdditionalState>) {
    onChange({ ...value, ...partial })
  }

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag || value.tags.includes(tag)) return
    update({ tags: [...value.tags, tag] })
  }

  return (
    <aside className="space-y-4">
      <h3 className="text-base font-semibold text-ink">Additional Data</h3>

      <label className="block text-sm font-semibold text-ink">
        Activity date
        <input
          type="date"
          value={value.activity_date}
          onChange={(event) => update({ activity_date: event.target.value })}
          className="mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm font-normal"
          required
        />
        <span className="mt-1 block text-xs font-normal text-muted">
          The date this activity happened. Totals, YTD, and science-based targets use this, not the
          moment you typed it in.
        </span>
      </label>

      <label className="block text-sm font-semibold text-ink">
        Site
        <select
          value={value.site}
          onChange={(event) => update({ site: event.target.value })}
          className="mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm font-normal"
        >
          <option value="">All / unassigned</option>
          {sites.map((site) => (
            <option key={site.id} value={site.name}>
              {site.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-semibold text-ink">
        Evidence link
        <input
          value={value.link}
          onChange={(event) => update({ link: event.target.value })}
          placeholder="SharePoint, Drive, or invoice URL"
          className="mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm font-normal"
        />
      </label>

      <label className="block text-sm font-semibold text-ink">
        Comments
        <textarea
          value={value.comment}
          onChange={(event) => update({ comment: event.target.value })}
          rows={3}
          className="mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm font-normal"
        />
      </label>

      <div className="rounded-md border border-brand/30 bg-brand-soft/40 px-3 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
          <Paperclip size={14} />
          Evidence files
        </div>
        <p className="mt-2 text-xs leading-5 text-muted">
          Files are not uploaded here. Paste a SharePoint, Google Drive, or document-system link so
          every colleague and your auditor can open the same evidence. Completeness on the dashboard
          tracks how many rows have a link.
        </p>
      </div>

      <div className="rounded-md border border-brand/30 px-3 py-3">
        <div className="text-sm font-semibold text-brand-dark">Custom Fields</div>
        <div className="mt-2 space-y-2">
          {value.customFields
            .map((field, index) => ({ field, index }))
            .filter(({ field }) => !field.label.startsWith('_'))
            .map(({ field, index }) => (
            <div key={index} className="flex gap-2">
              <input
                value={field.label}
                placeholder="Field name"
                onChange={(event) => {
                  const customFields = value.customFields.map((item, i) =>
                    i === index ? { ...item, label: event.target.value } : item,
                  )
                  update({ customFields })
                }}
                className="w-1/2 rounded-md border border-line bg-page px-2 py-1.5 text-xs"
              />
              <input
                value={field.value}
                placeholder="Value"
                onChange={(event) => {
                  const customFields = value.customFields.map((item, i) =>
                    i === index ? { ...item, value: event.target.value } : item,
                  )
                  update({ customFields })
                }}
                className="w-1/2 rounded-md border border-line bg-page px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() =>
                  update({ customFields: value.customFields.filter((_, i) => i !== index) })
                }
                aria-label="Remove field"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand"
          onClick={() => update({ customFields: [...value.customFields, { label: '', value: '' }] })}
        >
          <Plus size={12} /> Add field
        </button>
      </div>

      <div className="rounded-md border border-violet-300 px-3 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
          <Tag size={14} />
          Data Tags
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {value.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-800"
              onClick={() => update({ tags: value.tags.filter((item) => item !== tag) })}
            >
              {tag} <X size={10} />
            </button>
          ))}
        </div>
        <input
          placeholder="Type a tag and press Enter"
          className="mt-2 w-full rounded-md border border-line bg-page px-2 py-1.5 text-xs"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addTag(event.currentTarget.value)
              event.currentTarget.value = ''
            }
          }}
        />
      </div>
    </aside>
  )
}
