import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle, BarChart3, PieChart } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts'

const anim = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316']

const SCOPE_COLORS = ['#6366f1', '#10b981', '#f59e0b']

interface ExecutiveData {
  totalEmissions: number
  yoyChange: number
  scopeBreakdown: { name: string; value: number }[]
  monthlyTrend: { month: string; emissions: number }[]
  kpis: {
    reductionTarget: number
    currentReduction: number
    complianceScore: number
    carbonIntensity: number
  }
}

export default function ExecutiveDashboard() {
  const [data, setData] = useState<ExecutiveData>({
    totalEmissions: 1234.567,
    yoyChange: -8.5,
    scopeBreakdown: [
      { name: 'Scope 1', value: 234.123 },
      { name: 'Scope 2', value: 456.789 },
      { name: 'Scope 3', value: 543.655 },
    ],
    monthlyTrend: [
      { month: 'Jan', emissions: 145.2 },
      { month: 'Feb', emissions: 132.8 },
      { month: 'Mar', emissions: 138.5 },
      { month: 'Apr', emissions: 125.3 },
      { month: 'May', emissions: 119.7 },
      { month: 'Jun', emissions: 112.1 },
      { month: 'Jul', emissions: 118.4 },
      { month: 'Aug', emissions: 115.6 },
      { month: 'Sep', emissions: 109.2 },
      { month: 'Oct', emissions: 102.8 },
      { month: 'Nov', emissions: 98.5 },
      { month: 'Dec', emissions: 89.2 },
    ],
    kpis: {
      reductionTarget: 15,
      currentReduction: 12.3,
      complianceScore: 87,
      carbonIntensity: 0.45,
    },
  })

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-2xl px-3 py-2 text-xs border border-white/60 shadow-lg"
        style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="font-semibold">{payload[0].name}</div>
        <div className="text-muted-foreground">{payload[0].value.toFixed(3)} tCO2e</div>
      </div>
    )
  }

  const BarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-2xl px-3 py-2 text-xs border border-white/60 shadow-lg"
        style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="font-semibold">{label}</div>
        <div className="text-muted-foreground">{payload[0].value.toFixed(3)} tCO2e</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 lg:space-y-5 p-4 lg:p-6">
      {/* Header */}
      <motion.div {...anim} className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl lg:text-3xl font-light tracking-tight text-foreground">Executive Dashboard</h2>
          <p className="text-muted-foreground mt-1">High-level carbon performance metrics</p>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div {...anim} transition={{ delay: 0.02 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-3xl p-5 border border-border/60" style={{ backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Target size={18} className="text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Emissions</span>
          </div>
          <div className="text-2xl font-light metric-num text-foreground">{data.totalEmissions.toFixed(3)}</div>
          <div className={`text-xs mt-1 font-medium ${data.yoyChange < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data.yoyChange < 0 ? '▼' : '▲'} {Math.abs(data.yoyChange)}% YoY
          </div>
        </div>

        <div className="glass-card rounded-3xl p-5 border border-border/60" style={{ backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={18} className="text-emerald-500" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Reduction Progress</span>
          </div>
          <div className="text-2xl font-light metric-num text-foreground">{data.kpis.currentReduction}%</div>
          <div className="text-xs text-muted-foreground mt-1">Target: {data.kpis.reductionTarget}%</div>
        </div>

        <div className="glass-card rounded-3xl p-5 border border-border/60" style={{ backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-emerald-500" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Compliance Score</span>
          </div>
          <div className="text-2xl font-light metric-num text-foreground">{data.kpis.complianceScore}</div>
          <div className="text-xs text-muted-foreground mt-1">Out of 100</div>
        </div>

        <div className="glass-card rounded-3xl p-5 border border-border/60" style={{ backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={18} className="text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Carbon Intensity</span>
          </div>
          <div className="text-2xl font-light metric-num text-foreground">{data.kpis.carbonIntensity}</div>
          <div className="text-xs text-muted-foreground mt-1">tCO2e / £1M revenue</div>
        </div>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scope Breakdown Donut */}
        <motion.div {...anim} transition={{ delay: 0.04 }} className="glass-card rounded-3xl p-6 border border-border/60" style={{ backdropFilter: 'blur(20px)' }}>
          <h3 className="font-semibold text-sm tracking-tight text-foreground mb-4">Emissions by Scope</h3>
          <div className="flex flex-col items-center gap-4">
            <div className="relative" style={{ width: 200, height: 200 }}>
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie data={data.scopeBreakdown} cx={100} cy={100} innerRadius={60} outerRadius={90} dataKey="value" strokeWidth={0} paddingAngle={2}>
                    {data.scopeBreakdown.map((_, i) => <Cell key={i} fill={SCOPE_COLORS[i % SCOPE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-[10px] uppercase tracking-wider text-white/40">Total</div>
                <div className="text-sm font-semibold metric-num text-white">{data.totalEmissions.toFixed(1)}</div>
              </div>
            </div>
            <div className="space-y-2">
              {data.scopeBreakdown.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: SCOPE_COLORS[i % SCOPE_COLORS.length] }} />
                  <span className="text-xs text-muted-foreground flex-1">{d.name}</span>
                  <span className="text-xs font-medium metric-num">{((d.value / data.totalEmissions) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Monthly Trend Bar Chart */}
        <motion.div {...anim} transition={{ delay: 0.05 }} className="glass-card rounded-3xl p-6 border border-border/60" style={{ backdropFilter: 'blur(20px)' }}>
          <h3 className="font-semibold text-sm tracking-tight text-foreground mb-4">Monthly Emissions Trend</h3>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#8B949E" 
                  style={{ fontSize: '12px' }}
                  tick={{ fill: '#8B949E' }}
                />
                <YAxis 
                  stroke="#8B949E" 
                  style={{ fontSize: '12px' }}
                  tick={{ fill: '#8B949E' }}
                />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="emissions" fill="#64748B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Alerts Section */}
      <motion.div {...anim} transition={{ delay: 0.06 }} className="glass-card rounded-3xl p-6 border border-border/60" style={{ backdropFilter: 'blur(20px)' }}>
        <h3 className="font-semibold text-sm tracking-tight text-foreground mb-4">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle size={20} className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-foreground">On Track</div>
              <div className="text-xs text-muted-foreground mt-1">12.3% reduction achieved, ahead of target</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-foreground">Attention Needed</div>
              <div className="text-xs text-muted-foreground mt-1">Scope 3 emissions increased 5% this quarter</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/20">
            <TrendingUp size={20} className="text-primary shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-foreground">Improving</div>
              <div className="text-xs text-muted-foreground mt-1">Carbon intensity down 8% YoY</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
