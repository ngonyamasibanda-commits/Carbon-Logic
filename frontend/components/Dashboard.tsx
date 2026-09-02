"use client"
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Plus, CheckCircle, AlertCircle, TrendingUp, TrendingDown, X, Flame, Zap, Truck, Plane, Ship, Factory, Loader2, BarChart3 } from 'lucide-react'
import EmissionsPieChart from './EmissionsPieChart'
import ComplianceTrackerRow from './ComplianceTrackerRow'
import LogShipmentModal from './LogShipmentModal'
import { calculateFreighting, healthCheck } from '@/lib/api'
import type { EmissionData, CarbonAlert, ShipmentData, ComplianceRow, CategoryEmission } from './types'

const anim = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

export default function Dashboard() {
  const [showLogShipment, setShowLogShipment] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<EmissionData>({
    totalFootprint: 0,
    scope1: 0,
    scope2: 0,
    scope3: 0,
    mtdEmissions: 0,
    previousFootprint: 0,
    complianceRows: [],
    emissionsByCategory: [],
    carbonAlerts: [],
  })

  useEffect(() => {
    async function loadData() {
      try {
        // Check backend health
        await healthCheck()
        
        // In production, load real data from API
        // For now, using structured mock data that can be replaced
        const mockData: EmissionData = {
          totalFootprint: 1234.567,
          scope1: 234.123,
          scope2: 456.789,
          scope3: 543.655,
          mtdEmissions: 89.234,
          previousFootprint: 1145.678,
          complianceRows: [
            { category: 'Sea Freight', actual: 234.123, limit: 250, status: 'warn', pct: 93.6 },
            { category: 'Air Freight', actual: 156.789, limit: 150, status: 'over', pct: 104.5 },
            { category: 'Road Transport', actual: 89.456, limit: 100, status: 'ok', pct: 89.5 },
            { category: 'Facilities', actual: 234.567, limit: 300, status: 'ok', pct: 78.2 },
            { category: 'Vehicles', actual: 67.890, limit: 80, status: 'ok', pct: 84.9 },
          ],
          emissionsByCategory: [
            { name: 'Sea Freight', value: 234.123 },
            { name: 'Air Freight', value: 156.789 },
            { name: 'Road Transport', value: 89.456 },
            { name: 'Facilities', value: 234.567 },
            { name: 'Vehicles', value: 67.890 },
            { name: 'Rail', value: 45.234 },
            { name: 'Ocean', value: 123.456 },
          ],
          carbonAlerts: [
            { icon: 'alert', label: 'Air Freight emissions exceeded Q3 limits', detail: '156.789 tCO2e / 150.000 tCO2e limit', type: 'bad', path: '/emissions' },
            { icon: 'success', label: '14 days since last high-emission shipment', detail: 'Last high-emission: Dec 1, 2024', type: 'good', path: '/emissions' },
            { icon: 'warning', label: 'Sea Freight approaching annual limit', detail: '93.6% of annual capacity used', type: 'warn', path: '/emissions' },
          ],
        }
        
        setData(mockData)
        setIsLoading(false)
      } catch (err) {
        setError('Failed to load data. Please check if the backend is running.')
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const footprintChange = data.totalFootprint - data.previousFootprint

  const handleShipmentSubmit = async (shipmentData: ShipmentData) => {
    try {
      // Call the FastAPI backend to calculate emissions
      const result = await calculateFreighting({
        weight: shipmentData.cargoWeight,
        distance: shipmentData.distance,
        mode: shipmentData.transportMode,
      })

      // Update the data with the new emission
      const newEmission = result.emissions_tco2e
      
      setData(prev => ({
        ...prev,
        totalFootprint: prev.totalFootprint + newEmission,
        scope3: prev.scope3 + newEmission,
        mtdEmissions: prev.mtdEmissions + newEmission,
        emissionsByCategory: [
          ...prev.emissionsByCategory,
          { name: shipmentData.transportMode, value: newEmission },
        ],
      }))

      console.log('Shipment logged:', shipmentData, 'Emissions:', result)
    } catch (error) {
      console.error('Failed to log shipment:', error)
      // Show error to user
    }
  }

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'alert': return <AlertCircle size={15} />
      case 'success': return <CheckCircle size={15} />
      case 'warning': return <AlertCircle size={15} />
      default: return <AlertCircle size={15} />
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={48} />
          <p className="text-muted-foreground">Loading Carbon Logic Dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle size={48} className="text-destructive mx-auto mb-4" />
          <p className="text-destructive font-medium mb-2">Error Loading Data</p>
          <p className="text-muted-foreground">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 lg:space-y-5 p-4 lg:p-6">
      {showLogShipment && <LogShipmentModal onClose={() => setShowLogShipment(false)} onSubmit={handleShipmentSubmit} />}

      {/* Header */}
      <motion.div {...anim} className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <h2 className="text-2xl lg:text-3xl font-light tracking-tight mt-0.5 text-foreground">Dashboard Overview</h2>
        </div>
        <button 
          onClick={() => setShowLogShipment(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-full text-sm font-medium shadow-lg shadow-primary/20 active:scale-95 transition-all"
        >
          <Plus size={15} /> Log Shipment
        </button>
      </motion.div>

      {/* Hero — Total Carbon Footprint card */}
      <motion.div {...anim} transition={{ delay: 0.02 }} className="aurora-hero rounded-3xl p-6">
        <div className="relative">
          <div className="text-[10px] uppercase tracking-[0.15em] font-semibold text-white/40">Total Carbon Footprint (tCO2e)</div>
          <div className={`text-4xl lg:text-5xl font-light mt-1 metric-num tracking-tight text-white`}>
            {data.totalFootprint.toFixed(3)}
          </div>
          {footprintChange !== 0 && (
            <div className={`text-xs mt-1.5 font-medium ${footprintChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {footprintChange >= 0 ? '▲' : '▼'} {Math.abs(footprintChange).toFixed(3)} tCO2e vs last period
            </div>
          )}
          <div className="grid grid-cols-3 gap-0 mt-5 pt-5 border-t border-white/10">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">Scope 1 (Direct)</div>
              <div className="text-lg font-light text-white mt-0.5 metric-num">{data.scope1.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">Scope 2 (Energy)</div>
              <div className="text-lg font-light text-white mt-0.5 metric-num">{data.scope2.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">Scope 3 (Supply Chain)</div>
              <div className="text-lg font-light text-white mt-0.5 metric-num">{data.scope3.toFixed(3)}</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 lg:gap-4">
        <motion.div {...anim} transition={{ delay: 0.04 }}
          className="glass-card rounded-3xl p-5 border border-border/60 shadow-sm bg-card text-card-foreground"
          style={{ backdropFilter: 'blur(16px)' }}
        >
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${data.mtdEmissions >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
              {data.mtdEmissions >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">This Month</div>
          </div>
          <div className={`text-2xl lg:text-3xl font-light mt-3 metric-num ${data.mtdEmissions >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {data.mtdEmissions >= 0 ? '+' : ''}{data.mtdEmissions.toFixed(3)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-2">tCO2e MTD</div>
        </motion.div>

        <motion.div {...anim} transition={{ delay: 0.05 }}
          className="glass-card rounded-3xl p-5 border border-emerald-500/30 shadow-sm bg-card text-card-foreground"
          style={{ backdropFilter: 'blur(16px)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-600">
              <Truck size={16} />
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Active Shipments</div>
          </div>
          <div className="text-2xl lg:text-3xl font-light mt-3 metric-num text-emerald-600">24</div>
          <div className="text-[11px] text-muted-foreground mt-2">In transit</div>
        </motion.div>
      </div>

      {/* Emissions Breakdown — Pie */}
      <motion.div {...anim} transition={{ delay: 0.06 }}
        className="glass-card rounded-3xl p-5 lg:p-6 border border-border/60 shadow-sm bg-card text-card-foreground"
        style={{ backdropFilter: 'blur(20px)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm tracking-tight text-foreground">Emissions Breakdown</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">By category (tCO2e)</p>
          </div>
        </div>
        <EmissionsPieChart emissionsByCategory={data.emissionsByCategory} totalEmissions={data.totalFootprint} />
      </motion.div>

      {/* Compliance Tracker */}
      <motion.div {...anim} transition={{ delay: 0.07 }}
        className="glass-card rounded-3xl p-5 lg:p-6 border border-border/60 shadow-sm bg-card text-card-foreground"
        style={{ backdropFilter: 'blur(20px)' }}
      >
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="font-semibold text-sm tracking-tight text-foreground">Compliance Tracker</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Emissions vs regulatory limits</p>
          </div>
        </div>

        <div className="divide-y divide-black/[0.04]">
          {data.complianceRows.map((row, i) => (
            <ComplianceTrackerRow key={i} row={row} />
          ))}
        </div>

        {/* Summary line */}
        <div className="flex justify-between items-center pt-3 mt-2 border-t border-black/[0.04]">
          <span className="text-xs text-muted-foreground">
            {data.complianceRows.filter(r => r.status === 'over').length > 0
              ? `⚠ ${data.complianceRows.filter(r => r.status === 'over').length} categor${data.complianceRows.filter(r => r.status === 'over').length > 1 ? 'ies' : 'y'} over limit`
              : data.complianceRows.filter(r => r.status === 'warn').length > 0
              ? `${data.complianceRows.filter(r => r.status === 'warn').length} categor${data.complianceRows.filter(r => r.status === 'warn').length > 1 ? 'ies' : 'y'} near limit`
              : '✓ All categories within limits'}
          </span>
          <span className="text-xs metric-num font-medium">{data.totalFootprint.toFixed(3)} tCO2e total</span>
        </div>
      </motion.div>

      {/* Carbon Action Items */}
      {data.carbonAlerts.length > 0 && (
        <motion.div {...anim} transition={{ delay: 0.08 }}
          className="glass-card rounded-3xl p-5 border border-border/60 shadow-sm bg-card text-card-foreground"
          style={{ backdropFilter: 'blur(20px)' }}
        >
          <h3 className="font-semibold text-sm mb-3 tracking-tight text-foreground">Action Items</h3>
          <div className="space-y-0">
            {data.carbonAlerts.map((alert, i) => {
              const iconBg = alert.type === 'bad' ? 'bg-red-50 text-red-500' : alert.type === 'good' ? 'bg-emerald-50 text-emerald-600' : alert.type === 'warn' ? 'bg-amber-50 text-amber-600' : 'bg-secondary text-muted-foreground'
              return (
                <button key={i} className="w-full flex items-center gap-3 py-3 border-b border-black/[0.04] last:border-0 hover:bg-black/[0.02] transition rounded-xl px-1 -mx-1 text-left">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                    {getIcon(alert.icon)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate text-foreground">{alert.label}</div>
                    {alert.detail && <div className="text-[11px] text-muted-foreground">{alert.detail}</div>}
                  </div>
                  <ArrowRight size={13} className="text-muted-foreground/50 shrink-0" />
                </button>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}
