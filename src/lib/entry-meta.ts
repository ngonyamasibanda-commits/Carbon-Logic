import type { AttachedFile, CustomField, EmissionEntry } from './types'

const META_KEY = 'carbon-logic-entry-meta'

export type EntryMeta = {
  site: string
  tags: string[]
  customFields: CustomField[]
  files: AttachedFile[]
}

function emptyMeta(): EntryMeta {
  return { site: '', tags: [], customFields: [], files: [] }
}

function readAll(): Record<string, EntryMeta> {
  try {
    const raw = localStorage.getItem(META_KEY)
    return raw ? (JSON.parse(raw) as Record<string, EntryMeta>) : {}
  } catch {
    return {}
  }
}

export function getEntryMeta(id: string): EntryMeta {
  return readAll()[id] ?? emptyMeta()
}

export function setEntryMeta(id: string, meta: EntryMeta) {
  const all = readAll()
  all[id] = meta
  localStorage.setItem(META_KEY, JSON.stringify(all))
}

export function deleteEntryMeta(id: string) {
  const all = readAll()
  delete all[id]
  localStorage.setItem(META_KEY, JSON.stringify(all))
}

export function applyMeta(entry: EmissionEntry): EmissionEntry {
  const meta = getEntryMeta(entry.id)
  return {
    ...entry,
    site: entry.site || meta.site,
    tags: entry.tags.length ? entry.tags : meta.tags,
    customFields: entry.customFields.length ? entry.customFields : meta.customFields,
    files: entry.files.length ? entry.files : meta.files,
  }
}
