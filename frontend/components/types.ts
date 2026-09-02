export interface EmissionData {
  totalFootprint: number
  scope1: number
  scope2: number
  scope3: number
  mtdEmissions: number
  previousFootprint: number
  complianceRows: ComplianceRow[]
  emissionsByCategory: CategoryEmission[]
  carbonAlerts: CarbonAlert[]
}

export interface ComplianceRow {
  category: string
  actual: number
  limit: number
  status: 'ok' | 'warn' | 'over' | 'unbudgeted'
  pct: number
}

export interface CategoryEmission {
  name: string
  value: number
}

export interface CarbonAlert {
  icon: string
  label: string
  detail: string
  type: 'bad' | 'good' | 'warn' | 'neutral'
  path: string
}

export interface ShipmentData {
  shipmentId: string
  transportMode: string
  distance: number
  cargoWeight: number
}
