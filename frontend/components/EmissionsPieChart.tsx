import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { CategoryEmission } from './types'

const PIE_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316',
  '#8b5cf6', '#06b6d4', '#84cc16', '#e11d48',
]

interface EmissionsPieChartProps {
  emissionsByCategory: CategoryEmission[]
  totalEmissions: number
}

export default function EmissionsPieChart({ emissionsByCategory, totalEmissions }: EmissionsPieChartProps) {
  const pieData = emissionsByCategory
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  if (pieData.length === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-muted-foreground/40 text-sm">
        No emissions data available
      </div>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const pct = ((payload[0].value / totalEmissions) * 100).toFixed(0)
    return (
      <div className="rounded-2xl px-3 py-2 text-xs border border-white/60 shadow-lg"
        style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="font-semibold">{payload[0].name}</div>
        <div className="text-muted-foreground">{payload[0].value.toFixed(3)} tCO2e · {pct}%</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-6">
      <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie data={pieData} cx={65} cy={65} innerRadius={44} outerRadius={65} dataKey="value" strokeWidth={0} paddingAngle={2}>
              {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] uppercase tracking-wider text-white/40">Total</div>
          <div className="text-sm font-semibold metric-num text-white">{totalEmissions.toFixed(3)}</div>
        </div>
      </div>
      <div className="flex-1 w-full space-y-1.5">
        {pieData.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="text-xs text-muted-foreground flex-1 truncate">{d.name}</span>
            <span className="text-xs font-medium metric-num">{((d.value / totalEmissions) * 100).toFixed(0)}%</span>
            <span className="text-xs text-muted-foreground metric-num w-16 text-right">{d.value.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
