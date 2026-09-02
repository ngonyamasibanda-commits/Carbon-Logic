import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Plus, X, Truck, Plane, Ship, Car, Factory, Flame, TrendingUp } from 'lucide-react'
import LogShipmentModal from '@/components/LogShipmentModal'
import { calculateFreighting, calculateFlights, calculateCars } from '@/lib/api'
import type { ShipmentData } from '@/components/types'

const anim = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

export default function EmissionsPage() {
  const [showLogShipment, setShowLogShipment] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('freight')

  const categories = [
    { id: 'freight', name: 'Freighting', icon: Truck, description: 'Road, rail, ocean, and air freight' },
    { id: 'flights', name: 'Flights', icon: Plane, description: 'Business air travel' },
    { id: 'vehicles', name: 'Company Vehicles', icon: Car, description: 'Company-owned fleet' },
    { id: 'facilities', name: 'Facilities', icon: Factory, description: 'Building energy consumption' },
  ]

  const handleShipmentSubmit = async (shipmentData: ShipmentData) => {
    try {
      const result = await calculateFreighting({
        weight: shipmentData.cargoWeight,
        distance: shipmentData.distance,
        mode: shipmentData.transportMode,
      })
      console.log('Emissions calculated:', result)
    } catch (error) {
      console.error('Failed to calculate emissions:', error)
    }
  }

  return (
    <div className="space-y-4 lg:space-y-5 p-4 lg:p-6">
      {showLogShipment && <LogShipmentModal onClose={() => setShowLogShipment(false)} onSubmit={handleShipmentSubmit} />}

      {/* Header */}
      <motion.div {...anim} className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl lg:text-3xl font-light tracking-tight text-foreground">Emissions Tracking</h2>
          <p className="text-muted-foreground mt-1">Log and track carbon emissions across all scopes</p>
        </div>
        <button 
          onClick={() => setShowLogShipment(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-full text-sm font-medium shadow-lg shadow-primary/20 active:scale-95 transition-all"
        >
          <Plus size={15} /> Log Emission
        </button>
      </motion.div>

      {/* Category Cards */}
      <motion.div {...anim} transition={{ delay: 0.02 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat, i) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + (i * 0.05) }}
            onClick={() => setSelectedCategory(cat.id)}
            className={`glass-card rounded-3xl p-5 cursor-pointer transition-all hover:border-primary/50 ${
              selectedCategory === cat.id ? 'border-primary' : ''
            }`}
            style={{ backdropFilter: 'blur(16px)' }}
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <cat.icon size={24} className="text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">{cat.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{cat.description}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Category-specific content */}
      <motion.div {...anim} transition={{ delay: 0.15 }} className="glass-card rounded-3xl p-6 border border-border/60" style={{ backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Truck size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Freighting Emissions</h3>
            <p className="text-sm text-muted-foreground">Log shipments and calculate emissions</p>
          </div>
        </div>

        <div className="text-center py-12 text-muted-foreground">
          <Flame size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No emissions data yet</p>
          <p className="text-sm">Click "Log Emission" to add your first shipment</p>
        </div>
      </motion.div>
    </div>
  )
}
