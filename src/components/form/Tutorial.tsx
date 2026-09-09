import { useState } from 'react'
import { X } from 'lucide-react'

const STEPS = [
  {
    title: 'Choose the site',
    body: 'Assign the entry to a construction site, mine, processing plant, depot, or warehouse in Additional Data. Manage sites under Multi-site & Team.',
  },
  {
    title: 'Enter activity data',
    body: 'Fill the category fields (fuel litres, tonne-km, material tonnes, and so on). The amount must be greater than zero.',
  },
  {
    title: 'Add evidence',
    body: 'Attach bills or delivery notes, add custom fields such as project codes, and tag the row for later filtering.',
  },
  {
    title: 'Calculate',
    body: 'Click Calculate & add to footprint. tCO₂e = (Activity Amount × Conversion Value) / 1000.',
  },
  {
    title: 'Review and export',
    body: 'Open Analysis for the pie chart and scope breakdown, then export CSV or download a PDF report.',
  },
]

type Props = {
  categoryName: string
  onClose: () => void
}

export default function Tutorial({ categoryName, onClose }: Props) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            Tutorial · {categoryName}
          </p>
          <button type="button" onClick={onClose} aria-label="Close tutorial">
            <X size={18} />
          </button>
        </div>
        <h2 className="mt-2 text-xl font-semibold">{current.title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{current.body}</p>
        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs text-muted">
            {step + 1} of {STEPS.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((value) => value - 1)}
              className="rounded-md border border-line px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((value) => value + 1)}
                className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
