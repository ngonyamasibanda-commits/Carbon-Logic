import { Paperclip, Plus, Tag, X } from 'lucide-react'
import type { AdditionalState, AttachedFile } from '../../lib/types'
import { useOrg } from '../../providers/OrgProvider'

type Props = {
  value: AdditionalState
  onChange: (next: AdditionalState) => void
}

const MAX_FILE_BYTES = 1_500_000

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

  async function onFiles(fileList: FileList | null) {
    if (!fileList) return
    const next: AttachedFile[] = [...value.files]
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_BYTES) {
        window.alert(`${file.name} is larger than 1.5 MB and was skipped.`)
        continue
      }
      const dataUrl = await readFile(file)
      next.push({ name: file.name, size: file.size, type: file.type, dataUrl })
    }
    update({ files: next })
  }

  return (
    <aside className="space-y-4">
      <h3 className="text-base font-semibold text-ink">Additional Data</h3>

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
        Link
        <input
          value={value.link}
          onChange={(event) => update({ link: event.target.value })}
          placeholder="e.g. Sharepoint or Google Drive"
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
          File Uploads & Storage
        </div>
        <input
          type="file"
          multiple
          className="mt-2 w-full text-xs"
          onChange={(event) => void onFiles(event.target.files)}
        />
        <ul className="mt-2 space-y-1 text-xs text-ink">
          {value.files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2">
              <a href={file.dataUrl} download={file.name} className="truncate text-sky-700 hover:underline">
                {file.name}
              </a>
              <button
                type="button"
                onClick={() => update({ files: value.files.filter((_, i) => i !== index) })}
                aria-label={`Remove ${file.name}`}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-md border border-brand/30 px-3 py-3">
        <div className="text-sm font-semibold text-brand-dark">Custom Fields</div>
        <div className="mt-2 space-y-2">
          {value.customFields.map((field, index) => (
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

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
