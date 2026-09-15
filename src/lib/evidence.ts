import { supabase } from './supabase'
import type { AttachedFile, CustomField } from './types'

export const EVIDENCE_FILES_LABEL = '_evidence_files'
export const MAX_EVIDENCE_FILES = 5
export const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024
export const EVIDENCE_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,.csv,.txt,.doc,.docx,.xls,.xlsx,application/pdf,image/png,image/jpeg,image/webp'

const DB_NAME = 'carbon-logic-evidence'
const STORE = 'files'

export function newFileId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function fileMeta(file: AttachedFile): AttachedFile {
  return {
    id: file.id || newFileId(),
    name: file.name,
    size: file.size,
    type: file.type,
    dataUrl: '',
    storagePath: file.storagePath,
  }
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

export async function attachedFromFile(file: File): Promise<AttachedFile> {
  if (file.size <= 0) throw new Error('That file is empty.')
  if (file.size > MAX_EVIDENCE_BYTES) {
    throw new Error(`“${file.name}” is larger than 8 MB. Compress it or attach a smaller scan.`)
  }
  const dataUrl = await readAsDataUrl(file)
  return {
    id: newFileId(),
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    dataUrl,
  }
}

export function parseEvidenceFiles(value: string | undefined): AttachedFile[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
      .map((row) => ({
        id: String(row.id || newFileId()),
        name: String(row.name || 'evidence'),
        size: Number(row.size) || 0,
        type: String(row.type || ''),
        dataUrl: typeof row.dataUrl === 'string' ? row.dataUrl : '',
        storagePath: typeof row.storagePath === 'string' ? row.storagePath : undefined,
      }))
  } catch {
    return []
  }
}

export function filesFromCustomFields(fields: CustomField[] | undefined): AttachedFile[] {
  return parseEvidenceFiles(fields?.find((field) => field.label === EVIDENCE_FILES_LABEL)?.value)
}

export function customFieldsWithEvidence(
  fields: CustomField[] | undefined,
  files: AttachedFile[] | undefined,
): CustomField[] {
  const rest = (fields ?? []).filter((field) => field.label !== EVIDENCE_FILES_LABEL)
  if (!files?.length) return rest
  return [
    ...rest,
    {
      label: EVIDENCE_FILES_LABEL,
      value: JSON.stringify(files.map(fileMeta)),
    },
  ]
}

export function filesForEntry(entry: {
  files?: AttachedFile[]
  customFields?: CustomField[]
}): AttachedFile[] {
  if (entry.files?.length) return entry.files
  return filesFromCustomFields(entry.customFields)
}

export function hasEvidence(entry: {
  link?: string
  files?: AttachedFile[]
  customFields?: CustomField[]
}) {
  if (entry.link?.trim()) return true
  return filesForEntry(entry).length > 0
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('File storage is not available in this browser.'))
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open file storage.'))
  })
}

export async function stashEvidenceBlobs(files: AttachedFile[]) {
  const withData = files.filter((file) => file.dataUrl)
  if (withData.length === 0) return
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const file of withData) store.put(file.dataUrl, file.id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Could not save the file locally.'))
    })
    db.close()
  } catch {
    // Private mode / quota: keep dataUrl on the in-memory entry only.
  }
}

export async function loadEvidenceBlob(id: string): Promise<string | undefined> {
  try {
    const db = await openDb()
    const value = await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(id)
      request.onsuccess = () =>
        resolve(typeof request.result === 'string' ? request.result : undefined)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return value
  } catch {
    return undefined
  }
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'evidence'
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) return null
  try {
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: match[1] })
  } catch {
    return null
  }
}

export async function uploadEvidenceFiles(
  organizationId: string | undefined,
  files: AttachedFile[],
): Promise<AttachedFile[]> {
  if (!organizationId || files.length === 0) return files
  const next: AttachedFile[] = []
  for (const file of files) {
    if (file.storagePath || !file.dataUrl) {
      next.push(file)
      continue
    }
    const blob = dataUrlToBlob(file.dataUrl)
    if (!blob) {
      next.push(file)
      continue
    }
    const path = `${organizationId}/${file.id}/${safeFileName(file.name)}`
    const { error } = await supabase.storage.from('evidence').upload(path, blob, {
      contentType: file.type || blob.type || 'application/octet-stream',
      upsert: true,
    })
    next.push(error ? file : { ...file, storagePath: path })
  }
  return next
}

export async function resolveEvidenceUrl(file: AttachedFile): Promise<string | undefined> {
  if (file.dataUrl) return file.dataUrl
  const local = file.id ? await loadEvidenceBlob(file.id) : undefined
  if (local) return local
  if (!file.storagePath) return undefined
  const { data, error } = await supabase.storage.from('evidence').createSignedUrl(file.storagePath, 60 * 10)
  if (error || !data?.signedUrl) return undefined
  return data.signedUrl
}

export async function downloadEvidenceFile(file: AttachedFile) {
  const url = await resolveEvidenceUrl(file)
  if (!url) throw new Error(`Could not open ${file.name}.`)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  if (!url.startsWith('data:')) anchor.target = '_blank'
  anchor.rel = 'noreferrer'
  anchor.click()
}
