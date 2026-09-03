import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type UserConfig } from 'vite'

function securityHeaders(strict: boolean): Record<string, string> {
  const connect = strict
    ? "'self' https://*.supabase.co wss://*.supabase.co"
    : "'self' http://127.0.0.1:5173 ws://127.0.0.1:5173 http://localhost:5173 ws://localhost:5173 https://*.supabase.co wss://*.supabase.co"
  const csp = [
    "default-src 'self'",
    `connect-src ${connect}`,
    "img-src 'self' data: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(strict ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': csp,
    ...(strict
      ? { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload' }
      : {}),
  }
}

export default defineConfig(({ command, mode }): UserConfig => {
  const strict = command === 'build' || mode === 'production'
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      headers: securityHeaders(false),
    },
    preview: {
      headers: securityHeaders(strict),
    },
  }
})
