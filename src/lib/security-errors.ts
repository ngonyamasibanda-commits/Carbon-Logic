/**
 * Errors that must not be papered over with a localStorage fallback.
 * A permission or quota refusal from Postgres is the real answer.
 */

export function isRateLimitError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const message = (error.message ?? '').toLowerCase()
  return (
    message.includes('rate limit') ||
    message.includes('too many') ||
    error.code === 'P0001' && message.includes('limit')
  )
}

export function isPermissionError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42501' || error.code === 'PGRST301') return true
  const message = (error.message ?? '').toLowerCase()
  return (
    message.includes('row-level security') ||
    message.includes('violates row level') ||
    message.includes('jwt') ||
    message.includes('permission denied') ||
    message.includes('not authenticated') ||
    message.includes('not a member of this organisation')
  )
}

export class PermissionDeniedError extends Error {
  constructor(message = 'You do not have permission to change this data.') {
    super(message)
    this.name = 'PermissionDeniedError'
  }
}

export class RateLimitError extends Error {
  constructor(
    message = 'This organisation has reached its hourly limit. Wait before trying again.',
  ) {
    super(message)
    this.name = 'RateLimitError'
  }
}

export class CloudSaveError extends Error {
  constructor(
    message = 'Could not save this activity to your organisation. Try again in a moment.',
  ) {
    super(message)
    this.name = 'CloudSaveError'
  }
}

export function throwIfUnsafeToFallback(error: { message?: string; code?: string } | null) {
  if (isRateLimitError(error)) throw new RateLimitError()
  if (isPermissionError(error)) throw new PermissionDeniedError()
}
