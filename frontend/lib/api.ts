const API_BASE_URL = 'http://localhost:8000'

export interface ApiResponse<T> {
  emissions_kg: number
  emissions_tco2e: number
  details: string
}

// Calculate freighting emissions
export async function calculateFreighting(data: {
  weight: number
  distance: number
  mode: string
}): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/api/v1/calculate/freighting`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error('Failed to calculate freighting emissions')
  }

  return response.json()
}

// Calculate electricity emissions
export async function calculateElectricity(data: {
  usage_kwh: number
  renewable: boolean
}): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/api/v1/calculate/electricity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error('Failed to calculate electricity emissions')
  }

  return response.json()
}

// Calculate natural gas emissions
export async function calculateNaturalGas(data: {
  amount: number
  unit: string
}): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/api/v1/calculate/natural-gas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error('Failed to calculate natural gas emissions')
  }

  return response.json()
}

// Calculate fuel emissions
export async function calculateFuel(data: {
  amount: number
  fuel_type: string
  unit: string
}): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/api/v1/calculate/fuel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error('Failed to calculate fuel emissions')
  }

  return response.json()
}

// Calculate cars emissions
export async function calculateCars(data: {
  amount: number
  fuel_type: string
  unit: string
  vehicle_type: string
  knows_fuel: boolean
}): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/api/v1/calculate/cars`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error('Failed to calculate car emissions')
  }

  return response.json()
}

// Calculate flights emissions
export async function calculateFlights(data: {
  distance: number
  flight_class: string
  passengers: number
  is_return: boolean
}): Promise<ApiResponse<any>> {
  const response = await fetch(`${API_BASE_URL}/api/v1/calculate/flights`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error('Failed to calculate flight emissions')
  }

  return response.json()
}

// Health check
export async function healthCheck(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/health`)
  if (!response.ok) {
    throw new Error('Backend health check failed')
  }
  return response.json()
}
