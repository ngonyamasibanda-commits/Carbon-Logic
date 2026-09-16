/**
 * Evidence attachments: CSV and Word files must be accepted, and uploads
 * must send a storage MIME type even when the browser leaves file.type empty.
 *
 *   npm run verify:evidence
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  EVIDENCE_ACCEPT,
  EVIDENCE_TYPES_LABEL,
  evidenceContentType,
  isAllowedEvidenceFile,
} from '../src/lib/evidence'

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

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const additional = readFileSync(join(root, 'src/components/form/AdditionalData.tsx'), 'utf8')
const bulk = readFileSync(join(root, 'src/components/form/BulkUpload.tsx'), 'utf8')
const storage = readFileSync(join(root, 'supabase/migrations/0008_evidence_storage.sql'), 'utf8')

console.log('\nEvidence file types\n')

check('file picker lists .csv', EVIDENCE_ACCEPT.includes('.csv'))
check('file picker lists .doc', EVIDENCE_ACCEPT.includes('.doc'))
check('file picker includes CSV MIME type', EVIDENCE_ACCEPT.includes('text/csv'))
check('file picker includes Word MIME type', EVIDENCE_ACCEPT.includes('application/msword'))
check(
  'helper copy names CSV and Word',
  EVIDENCE_TYPES_LABEL.includes('CSV') && EVIDENCE_TYPES_LABEL.includes('.doc'),
)
check('activity form mentions the supported types', additional.includes('EVIDENCE_TYPES_LABEL'))
check('CSV meter readings are allowed', isAllowedEvidenceFile('meter-readings.CSV'))
check('legacy Word delivery notes are allowed', isAllowedEvidenceFile('delivery note.doc'))
check('PDF invoices stay allowed', isAllowedEvidenceFile('invoice.pdf'))
check('unsupported executables are rejected', !isAllowedEvidenceFile('payload.exe'))
check(
  'empty browser MIME still uploads CSV as text/csv',
  evidenceContentType({ name: 'readings.csv', type: '' }) === 'text/csv',
)
check(
  'empty browser MIME still uploads Word as application/msword',
  evidenceContentType({ name: 'note.doc', type: '' }) === 'application/msword',
)
check('storage bucket allows text/csv', storage.includes("'text/csv'"))
check('storage bucket allows application/msword', storage.includes("'application/msword'"))
check(
  'bulk upload Choose file is a real button',
  bulk.includes('Choose file') && /<button[\s\S]*Choose file/.test(bulk) && !/<input[\s\S]*Choose file/.test(bulk),
)

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
