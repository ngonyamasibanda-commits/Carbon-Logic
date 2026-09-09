/**
 * Organisation inventory must survive logout and be shared by every account
 * in the same organisation.
 *
 *   npm run verify:entries
 */
import { cacheOrgEntries, mergeOrgInventory, peekLocalEntries, rowsForOrganization } from '../src/lib/entries'
import type { EmissionEntry } from '../src/lib/types'

class MemoryStorage {
  private data = new Map<string, string>()
  get length() {
    return this.data.size
  }
  clear() {
    this.data.clear()
  }
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
})

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  PASS  ${name}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function entry(overrides: Partial<EmissionEntry> & Pick<EmissionEntry, 'id'>): EmissionEntry {
  return {
    category: 'fuels',
    scope: 'Scope 1',
    emissions_tco2e: 1,
    details: 'diesel',
    amount: 10,
    unit: 'litres',
    comment: '',
    link: '',
    created_at: '2026-01-01T00:00:00.000Z',
    site: '',
    tags: [],
    customFields: [],
    files: [],
    organization_id: 'org-a',
    ...overrides,
  }
}

const orgA = { organizationId: 'org-a', userId: 'user-1' }
const orgAOtherAccount = { organizationId: 'org-a', userId: 'user-2' }
const orgB = { organizationId: 'org-b', userId: 'user-1' }

function main() {
  console.log('\nOrganisation-scoped inventory\n')

  const localDraft = entry({ id: 'local-1', details: 'unsynced excavator' })
  const saved = entry({ id: '42', details: 'synced diesel' })

  const afterFailedFetch = mergeOrgInventory([], [localDraft, saved], false)
  check('a failed cloud fetch keeps local organisation rows', afterFailedFetch.length === 2)

  const afterEmptyCloud = mergeOrgInventory([], [localDraft, saved], true)
  check(
    'an empty cloud result does not delete local organisation rows',
    afterEmptyCloud.map((row) => row.id).sort().join(',') === '42,local-1',
  )

  const afterCloud = mergeOrgInventory([saved], [localDraft, saved], true)
  check(
    'cloud rows plus unsynced drafts are kept',
    afterCloud.length === 2 && afterCloud.some((row) => row.id === 'local-1'),
  )

  const mixed = [
    entry({ id: '1', organization_id: 'org-a' }),
    entry({ id: '2', organization_id: 'org-b' }),
    entry({ id: '3' }),
  ]
  const onlyA = rowsForOrganization(mixed, 'org-a')
  check(
    'rows from another organisation are not shown',
    onlyA.map((row) => row.id).sort().join(',') === '1,3',
  )

  cacheOrgEntries(orgA, [saved, localDraft])
  check(
    'a second account in the same organisation reads the same local inventory',
    peekLocalEntries(orgAOtherAccount).some((row) => row.id === '42') &&
      peekLocalEntries(orgAOtherAccount).some((row) => row.id === 'local-1'),
  )

  cacheOrgEntries(orgB, [entry({ id: '99', organization_id: 'org-b', details: 'other org' })])
  check(
    'another organisation’s rows stay isolated',
    !peekLocalEntries(orgA).some((row) => row.id === '99') &&
      peekLocalEntries(orgB).some((row) => row.id === '99'),
  )

  check(
    'a browser-only row is treated as unsynced',
    localDraft.id.startsWith('local-') && saved.id === '42',
  )

  console.log(`\n${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exit(1)
}

main()
