import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import { ToastContext, type ToastTone } from '../lib/toast-context'

type Toast = {
  id: number
  tone: ToastTone
  message: string
}

const TONE: Record<
  ToastTone,
  { wrap: string; icon: typeof Info; label: string }
> = {
  success: {
    wrap: 'border-accent/40 bg-white text-accent-dark',
    icon: CheckCircle2,
    label: 'Success',
  },
  error: {
    wrap: 'border-red-200 bg-white text-red-800',
    icon: CircleAlert,
    label: 'Error',
  },
  info: {
    wrap: 'border-sky-200 bg-white text-ink',
    icon: Info,
    label: 'Notice',
  },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (input: { message: string; tone?: ToastTone } | string, tone: ToastTone = 'success') => {
      const next: Toast = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        tone: typeof input === 'string' ? tone : (input.tone ?? tone),
        message: typeof input === 'string' ? input : input.message,
      }
      setToasts((prev) => [...prev.slice(-4), next])
      window.setTimeout(() => dismiss(next.id), 5000)
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      push,
      success: (message: string) => push(message, 'success'),
      error: (message: string) => push(message, 'error'),
      info: (message: string) => push(message, 'info'),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => {
          const style = TONE[toast.tone]
          const Icon = style.icon
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-3 py-3 text-sm shadow-lg ${style.wrap}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 font-medium leading-5">{toast.message}</p>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-muted hover:text-ink"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
