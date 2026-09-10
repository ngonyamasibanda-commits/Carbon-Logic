import type { CustomField, EmissionEntry } from './types'
import { readJson, writeJson } from './browser-storage'

const META_KEY = 'carbon-logic-entry-meta'

export type EntryMeta = {
  site: string
  tags: string[]
  customFields: CustomField[]
}

function emptyMeta(): EntryMeta {
  return { site: '', tags: [], customFields: [] }
}

function readAll(): Record<string, EntryMeta> {
  return readJson<Record<string, EntryMeta>>(META_KEY, {})
}

export function getEntryMeta(id: string): EntryMeta {
  return readAll()[id] ?? emptyMeta()
}

export function setEntryMeta(id: string, meta: EntryMeta) {
  const all = readAll()
  all[id] = {
    site: meta.site,
    tags: meta.tags,
    customFields: meta.customFields,
  }
  writeJson(META_KEY, all)
}

export function deleteEntryMeta(id: string) {
  const all = readAll()
  delete all[id]
  writeJson(META_KEY, all)
}

export function applyMeta(entry: EmissionEntry): EmissionEntry {
  const meta = getEntryMeta(entry.id)
  return {
    ...entry,
    site: entry.site || meta.site,
    tags: entry.tags.length ? entry.tags : meta.tags,
    customFields: entry.customFields.length ? entry.customFields : meta.customFields,
    files: [],
  }
}
