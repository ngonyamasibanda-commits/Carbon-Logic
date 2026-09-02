import { motion } from 'framer-motion'
import type { ComplianceRow } from './types'

interface ComplianceTrackerRowProps {
  row: ComplianceRow
}

export default function ComplianceTrackerRow({ row }: ComplianceTrackerRowProps) {
  const pct = Math.min(100, row.pct || 0)
  const barColor = row.status === 'over' ? '#ef4444' : row.status === 'warn' ? '#f59e0b' : '#6366f1'
  const statusLabel = row.status === 'over' ? 'Over' : row.status === 'warn' ? 'Near' : row.status === 'unbudgeted' ? '—' : 'OK'
  const statusColor = row.status === 'over' ? 'text-red-500' : row.status === 'warn' ? 'text-amber-500' : 'text-emerald-600'

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-foreground">{row.category}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground metric-num">
            {row.actual.toFixed(3)} tCO2e{row.limit > 0 ? ` / ${row.limit.toFixed(3)} tCO2e` : ''}
          </span>
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${statusColor}`}>{statusLabel}</span>
        </div>
      </div>
      {row.limit > 0 && (
        <div className="h-1.5 rounded-full bg-black/[0.05] overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: 'easeOut' }}
            className="h-full rounded-full" style={{ background: barColor }} />
        </div>
      )}
    </div>
  )
}
