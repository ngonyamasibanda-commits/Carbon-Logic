import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react'
import { getTutorial, type TutorialId } from '../../lib/tutorials'
import TutorialScreencast from './TutorialScreencast'

type Props = {
  topicId: TutorialId
  /** Shown in the header, e.g. category name */
  subtitle?: string
  onClose: () => void
}

export default function Tutorial({ topicId, subtitle, onClose }: Props) {
  const tutorial = getTutorial(topicId)
  const [step, setStep] = useState(0)
  const [showVideo, setShowVideo] = useState(false)
  const [fileVideoOk, setFileVideoOk] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const current = tutorial.steps[step]
  const onLastNote = step >= tutorial.steps.length - 1

  useEffect(() => {
    setStep(0)
    setShowVideo(false)
    setFileVideoOk(false)
  }, [topicId])

  useEffect(() => {
    if (showVideo && fileVideoOk) videoRef.current?.play().catch(() => {})
  }, [showVideo, fileVideoOk])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              Tutorial{subtitle ? ` · ${subtitle}` : ''}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{tutorial.title}</h2>
            <p className="mt-1 text-sm text-muted">{tutorial.outcome}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tutorial"
            className="shrink-0 text-muted hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {!showVideo ? (
            <>
              <h3 className="text-lg font-semibold text-ink">{current.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{current.body}</p>
              <ol className="mt-4 space-y-1.5">
                {tutorial.steps.map((item, index) => (
                  <li
                    key={item.title}
                    className={`text-xs ${index === step ? 'font-semibold text-brand' : 'text-muted'}`}
                  >
                    {index + 1}. {item.title}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <div>
              <p className="mb-3 text-sm text-muted">
                Silent walkthrough of the actions for this tab. Follow along in the product after it
                ends.
              </p>
              <video
                ref={videoRef}
                className={
                  fileVideoOk ? 'aspect-video w-full rounded-lg border border-line bg-black' : 'hidden'
                }
                controls
                playsInline
                preload="metadata"
                onLoadedData={() => setFileVideoOk(true)}
                onError={() => setFileVideoOk(false)}
              >
                <source src={tutorial.videoSrc.replace(/\.webm$/, '.mp4')} type="video/mp4" />
                <source src={tutorial.videoSrc} type="video/webm" />
              </video>
              {!fileVideoOk ? <TutorialScreencast topicId={topicId} /> : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          {!showVideo ? (
            <>
              <span className="text-xs text-muted">
                {step + 1} of {tutorial.steps.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={step === 0}
                  onClick={() => setStep((value) => value - 1)}
                  className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Back
                </button>
                {onLastNote ? (
                  <button
                    type="button"
                    onClick={() => setShowVideo(true)}
                    className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    <Play size={14} /> Watch video
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep((value) => value + 1)}
                    className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowVideo(false)}
                className="rounded-md border border-line px-3 py-1.5 text-sm"
              >
                Back to notes
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
