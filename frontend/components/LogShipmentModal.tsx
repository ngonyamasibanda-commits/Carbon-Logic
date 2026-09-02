import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Plus } from 'lucide-react'
import type { ShipmentData } from './types'

interface LogShipmentModalProps {
  onClose: () => void
  onSubmit: (data: ShipmentData) => void
}

export default function LogShipmentModal({ onClose, onSubmit }: LogShipmentModalProps) {
  const [form, setForm] = useState({
    shipmentId: '',
    transportMode: 'Road (Truck)',
    distance: '',
    cargoWeight: '',
  })

  const transportModes = [
    'Road (Truck)',
    'Rail',
    'Ocean',
    'Air',
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.shipmentId.trim() || !form.distance || !form.cargoWeight) return

    onSubmit({
      shipmentId: form.shipmentId,
      transportMode: form.transportMode,
      distance: Number(form.distance),
      cargoWeight: Number(form.cargoWeight),
    })
    onClose()
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-4 bg-black/20 backdrop-blur-md" 
      style={{ height: '100dvh' }} 
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, y: 30 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl p-5 shadow-2xl border border-border bg-card text-card-foreground"
        style={{ backdropFilter: 'blur(24px)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-base tracking-tight text-foreground">Log Shipment</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5 transition">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input 
            className="w-full bg-muted border-0 rounded-2xl px-3 py-2.5 text-sm text-foreground" 
            placeholder="Shipment ID" 
            value={form.shipmentId} 
            onChange={e => setForm({ ...form, shipmentId: e.target.value })} 
            required 
          />
          <select 
            className="w-full bg-muted border-0 rounded-2xl px-3 py-2.5 text-sm text-foreground" 
            value={form.transportMode} 
            onChange={e => setForm({ ...form, transportMode: e.target.value })}
          >
            {transportModes.map(mode => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input 
              type="number" 
              step="0.1" 
              className="flex-1 min-w-0 bg-muted border-0 rounded-2xl px-3 py-2.5 text-sm text-foreground" 
              placeholder="Distance (km)" 
              value={form.distance} 
              onChange={e => setForm({ ...form, distance: e.target.value })} 
              required 
            />
            <input 
              type="number" 
              step="0.1" 
              className="flex-1 min-w-0 bg-muted border-0 rounded-2xl px-3 py-2.5 text-sm text-foreground" 
              placeholder="Weight (tonnes)" 
              value={form.cargoWeight} 
              onChange={e => setForm({ ...form, cargoWeight: e.target.value })} 
              required 
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-primary text-primary-foreground py-3 rounded-full text-sm font-medium shadow-lg shadow-primary/20 active:scale-[0.98] transition-all mt-1"
          >
            Calculate & Add
          </button>
        </form>
      </motion.div>
    </div>
  )
}
