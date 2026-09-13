import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogoLockup } from '../components/brand/Logo'

const FALLBACK_CHAPTERS = [
  { time: 0, title: 'Welcome' },
  { time: 18, title: 'Sign in' },
  { time: 36, title: 'Dashboard' },
  { time: 66, title: 'Facilities' },
  { time: 86, title: 'Organisation' },
  { time: 108, title: 'Data input' },
  { time: 128, title: 'Log activity' },
  { time: 196, title: 'Analysis' },
  { time: 222, title: 'Inventory' },
  { time: 240, title: 'Reports' },
  { time: 260, title: 'Targets' },
  { time: 278, title: 'Learning' },
]

export default function TourPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [chapters, setChapters] = useState(FALLBACK_CHAPTERS)
  const [active, setActive] = useState(0)

  useEffect(() => {
    void fetch('/tutorial/chapters.json')
      .then((response) => (response.ok ? response.json() : FALLBACK_CHAPTERS))
      .then((data: { time: number; title: string }[]) => {
        if (Array.isArray(data) && data.length > 0) setChapters(data)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTime = () => {
      const t = video.currentTime
      let index = 0
      for (let i = 0; i < chapters.length; i += 1) {
        if (t >= chapters[i].time) index = i
      }
      setActive(index)
    }
    video.addEventListener('timeupdate', onTime)
    return () => video.removeEventListener('timeupdate', onTime)
  }, [chapters])

  function seek(time: number) {
    const video = videoRef.current
    if (!video) return
    video.currentTime = time
    void video.play()
  }

  return (
    <div className="min-h-svh bg-[#071325] text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/login" className="rounded-md bg-white/95 px-3 py-2">
          <LogoLockup width={148} />
        </Link>
        <Link
          to="/login"
          className="rounded-md bg-[#6cbe2c] px-4 py-2 text-sm font-semibold text-[#02234e] hover:bg-[#7dce3d]"
        >
          Sign in to try it
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[#6cbe2c]">
          Product tour · 4 minutes
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          How to use Carbon Logic
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
          A guided walkthrough of the real product — sign in, set up the organisation, log activity
          with evidence, then download the inventory and report pack.
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_40px_80px_rgba(0,0,0,0.45)]">
          <video
            ref={videoRef}
            className="aspect-video w-full bg-black"
            controls
            preload="metadata"
            playsInline
            poster="/tutorial/how-to-use-carbon-logic.jpg"
          >
            <source src="/tutorial/how-to-use-carbon-logic.mp4" type="video/mp4" />
            Your browser cannot play this tutorial video.
          </video>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {chapters.map((chapter, index) => (
            <button
              key={chapter.title}
              type="button"
              onClick={() => seek(chapter.time)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                active === index
                  ? 'border-[#6cbe2c] bg-[#6cbe2c]/15'
                  : 'border-white/10 bg-white/5 hover:border-white/25'
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6cbe2c]">
                {String(index + 1).padStart(2, '0')}
              </div>
              <div className="mt-1 text-sm font-medium text-white">{chapter.title}</div>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
