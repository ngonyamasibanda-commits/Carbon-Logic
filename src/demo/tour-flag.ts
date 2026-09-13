const TOUR_KEY = 'carbon-logic-product-tour'

/** Dev-only workspace used to film the product tour against real screens. */
export function isProductTourWorkspace() {
  if (!import.meta.env.DEV) return false
  try {
    return sessionStorage.getItem(TOUR_KEY) === '1'
  } catch {
    return false
  }
}

export function enableProductTourWorkspace() {
  sessionStorage.setItem(TOUR_KEY, '1')
}
