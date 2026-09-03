import type { ReactNode } from 'react'
import { LogoLockup } from '../brand/Logo'

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col bg-page">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center">
            <LogoLockup width={150} />
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-brand to-accent" />
            <div className="px-7 py-7">
              <h1 className="text-xl font-semibold text-brand">{title}</h1>
              {subtitle ? <p className="mt-1.5 text-sm text-muted">{subtitle}</p> : null}
              <div className="mt-6">{children}</div>
            </div>
          </div>
          {footer ? <div className="mt-5 text-center text-sm text-muted">{footer}</div> : null}
        </div>
      </div>
      <footer className="pb-6 text-center text-xs text-muted">
        Carbon Logic · Construction &amp; logistics carbon accounting
      </footer>
    </div>
  )
}

export function FormField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      {children}
      {hint ? <span className="mt-1 block text-xs font-normal text-muted">{hint}</span> : null}
    </label>
  )
}

export const inputClass =
  'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/15'

export const primaryButtonClass =
  'w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60'

export function Alert({ tone, children }: { tone: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-accent/40 bg-accent-soft text-accent-dark',
    info: 'border-line bg-page text-ink',
  }[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  )
}
