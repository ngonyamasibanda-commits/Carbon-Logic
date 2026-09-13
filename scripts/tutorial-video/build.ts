import { spawn } from 'node:child_process'
import { mkdir, writeFile, copyFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { captureFrames } from './capture'
import { SCENES } from './scenes'

const ROOT = path.resolve('.')
const CACHE = path.resolve('scripts/tutorial-video/.cache')
const AUDIO = path.join(CACHE, 'audio')
const CLIPS = path.join(CACHE, 'clips')
const FRAMES = path.join(CACHE, 'frames')
const PUBLIC_DIR = path.resolve('public/tutorial')
const ARTIFACTS = '/opt/cursor/artifacts'
const VOICE = 'en-GB-SoniaNeural'

function run(command: string, args: string[], opts: { cwd?: string } = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts.cwd ?? ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} failed (${code}): ${stderr.slice(-2000)}`))
    })
  })
}

function probeDuration(file: string) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      file,
    ])
    let out = ''
    child.stdout.on('data', (chunk) => {
      out += String(chunk)
    })
    child.on('exit', (code) => {
      const value = Number.parseFloat(out.trim())
      if (code === 0 && Number.isFinite(value)) resolve(value)
      else reject(new Error(`ffprobe failed for ${file}`))
    })
  })
}

async function waitForServer(url: string, timeoutMs = 90000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' })
      if (response.ok || response.status === 302 || response.status === 304) return
    } catch {
      // still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  throw new Error(`Dev server did not start at ${url}`)
}

async function startVite() {
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout?.on('data', (chunk) => process.stdout.write(chunk))
  child.stderr?.on('data', (chunk) => process.stderr.write(chunk))
  await waitForServer('http://127.0.0.1:5173/')
  return child
}

async function synthesize() {
  await mkdir(AUDIO, { recursive: true })
  for (const scene of SCENES) {
    const file = path.join(AUDIO, `${scene.id}.mp3`)
    await run('edge-tts', [
      '--voice',
      VOICE,
      '--rate',
      '-8%',
      '--pitch',
      '-2Hz',
      '--text',
      scene.voice,
      '--write-media',
      file,
    ])
  }
}

async function renderClips() {
  await mkdir(CLIPS, { recursive: true })
  const chapters: { time: number; title: string }[] = []
  let cursor = 0
  const list: string[] = []

  for (const scene of SCENES) {
    const audio = path.join(AUDIO, `${scene.id}.mp3`)
    const frame = path.join(FRAMES, `${scene.id}.png`)
    const clip = path.join(CLIPS, `${scene.id}.mp4`)
    const audioSeconds = await probeDuration(audio)
    const duration = Math.max(audioSeconds + 0.65, 4)
    const frames = Math.round(duration * 30)
    const fadeOut = Math.max(duration - 0.32, 0.4)
    if (!chapters.some((chapter) => chapter.title === scene.chapter)) {
      chapters.push({ time: Number(cursor.toFixed(2)), title: scene.chapter })
    }
    cursor += duration

    await run('ffmpeg', [
      '-y',
      '-loop',
      '1',
      '-i',
      frame,
      '-i',
      audio,
      '-filter_complex',
      [
        `[0:v]scale=1920:1080:flags=lanczos,`,
        `zoompan=z='min(1.07,1+0.00032*on)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=30,`,
        `format=yuv420p,`,
        `fade=t=in:st=0:d=0.28,`,
        `fade=t=out:st=${fadeOut.toFixed(2)}:d=0.28[v]`,
      ].join(''),
      '-map',
      '[v]',
      '-map',
      '1:a',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '18',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-shortest',
      '-movflags',
      '+faststart',
      clip,
    ])
    list.push(`file '${clip}'`)
  }

  const concatList = path.join(CACHE, 'concat.txt')
  await writeFile(concatList, `${list.join('\n')}\n`)
  const joined = path.join(CACHE, 'joined.mp4')
  await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', joined])

  await mkdir(PUBLIC_DIR, { recursive: true })
  const finalFile = path.join(PUBLIC_DIR, 'how-to-use-carbon-logic.mp4')
  await run('ffmpeg', [
    '-y',
    '-i',
    joined,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '20',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-movflags',
    '+faststart',
    finalFile,
  ])
  await run('ffmpeg', [
    '-y',
    '-i',
    path.join(FRAMES, 'title.png'),
    '-vf',
    'scale=1920:1080:flags=lanczos',
    '-q:v',
    '3',
    path.join(PUBLIC_DIR, 'how-to-use-carbon-logic.jpg'),
  ])
  await writeFile(path.join(PUBLIC_DIR, 'chapters.json'), JSON.stringify(chapters, null, 2))
  return { finalFile, chapters, duration: cursor }
}

async function copyArtifacts(finalFile: string) {
  await mkdir(ARTIFACTS, { recursive: true })
  const dest = path.join(ARTIFACTS, 'how_to_use_carbon_logic.mp4')
  await copyFile(finalFile, dest)
  await copyFile(
    path.join(PUBLIC_DIR, 'how-to-use-carbon-logic.jpg'),
    path.join(ARTIFACTS, 'how_to_use_carbon_logic_poster.jpg'),
  )
}

async function ensureEdgeTts() {
  try {
    await run('edge-tts', ['--version'])
  } catch {
    await run('python3', ['-m', 'pip', 'install', '--user', 'edge-tts'])
  }
}

export async function main() {
  await rm(CACHE, { recursive: true, force: true })
  await mkdir(CACHE, { recursive: true })
  await ensureEdgeTts()

  let vite: ReturnType<typeof spawn> | null = null
  try {
    vite = await startVite()
    await captureFrames()
    await synthesize()
    const result = await renderClips()
    await copyArtifacts(result.finalFile)
    console.log(`Tutorial video ready: ${result.finalFile} (${result.duration.toFixed(1)}s)`)
    console.log(JSON.stringify(result.chapters, null, 2))
  } finally {
    vite?.kill('SIGTERM')
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('build.ts')) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
