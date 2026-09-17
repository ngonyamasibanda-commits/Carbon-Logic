import { useEffect, useState } from 'react'
import { inventoryBackendReady } from '../../lib/entries'
import { useAuth } from '../../lib/auth-context'

/** Shown only to Carbon Logic owners until the one-time database script has been applied. */
export default function InventorySetupNotice() {
  const { canCreateOrganizations } = useAuth()
  const [ready, setReady] = useState(true)

  useEffect(() => {
    if (!canCreateOrganizations) return
    let cancelled = false
    void inventoryBackendReady().then((ok) => {
      if (!cancelled) setReady(ok)
    })
    return () => {
      cancelled = true
    }
  }, [canCreateOrganizations])

  if (!canCreateOrganizations || ready) return null

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-950">
      Logged activities are not reaching the organisation database yet. Run{' '}
      <code className="rounded bg-amber-100 px-1">supabase/fix_entry_save.sql</code> once in the
      Supabase SQL editor, then{' '}
      <code className="rounded bg-amber-100 px-1">supabase/fix_inventory_governance.sql</code> for
      year-end close. After that, every log is saved automatically — nobody runs this when they
      enter data.
    </div>
  )
}
