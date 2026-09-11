import type { ReactNode } from 'react'
import { Info, Lightbulb } from 'lucide-react'

type Tone = 'info' | 'tip'

const STYLES: Record<Tone, { wrap: string; badge: string; icon: typeof Info; label: string }> = {
  info: {
    wrap: 'border-sky-200 bg-sky-50 text-sky-950',
    badge: 'bg-sky-700 text-white',
    icon: Info,
    label: 'Info',
  },
  tip: {
    wrap: 'border-amber-200 bg-amber-50 text-amber-950',
    badge: 'bg-amber-700 text-white',
    icon: Lightbulb,
    label: 'Tip',
  },
}

export default function Callout({
  tone,
  children,
}: {
  tone: Tone
  children: ReactNode
}) {
  const style = STYLES[tone]
  const Icon = style.icon
  return (
    <div
      role="status"
      className={`flex gap-3 rounded-md border px-3 py-3 text-sm leading-6 ${style.wrap}`}
    >
      <span
        className={`mt-0.5 inline-flex h-5 shrink-0 items-center gap-1 rounded px-1.5 text-[10px] font-bold uppercase tracking-wide ${style.badge}`}
      >
        <Icon size={11} />
        {style.label}
      </span>
      <div className="min-w-0 font-normal">{children}</div>
    </div>
  )
}
