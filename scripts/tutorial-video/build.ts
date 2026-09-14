import { spawn } from 'node:child_process'
import { mkdir, writeFile, copyFile, rm, readFile } from 'node:fs/promises'
import path from 'node:path'
import { captureTour, type SceneTiming } from './capture'
import { SCENES } from './scenes'

const ROOT = path.resolve('.')
const CACHE = path.resolve('scripts/tutorial-video/.cache')
const AUDIO = path.join(CACHE, 'audio')
const CLIPS = path.join(CACHE, 'clips')
const PUBLIC_DIR = path.resolve('public/tutorial')
const ARTIFACTS = '/opt/cursor/artifacts'
const VOICE = 'en-US-AndrewMultilingualNeural'

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
  await run('bash', [
    '-lc',
    'fuser -k 5173/tcp >/dev/null 2>&1 || true; lsof -ti tcp:5173 | xargs -r kill -9 >/dev/null 2>&1 || true; sleep 0.5',
  ]).catch(() => undefined)
  const child = spawn(
    'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
    {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'public-anon-key-for-tour-capture',
    },
  })
  child.stdout?.on('data', (chunk) => process.stdout.write(chunk))
  child.stderr?.on('data', (chunk) => process.stderr.write(chunk))
  await waitForServer('http://127.0.0.1:5173/')
  return child
}

async function ensureEdgeTts() {
  try {
    await run('python3', ['-c', 'import edge_tts'])
  } catch {
    await run('python3', ['-m', 'pip', 'install', '--user', 'edge-tts'])
  }
}

async function synthesize() {
  await mkdir(AUDIO, { recursive: true })
  const durations: Record<string, number> = {}
  for (const scene of SCENES) {
    const file = path.join(AUDIO, `${scene.id}.mp3`)
    await run('python3', [
      '-m',
      'edge_tts',
      '--voice',
      VOICE,
      '--rate=-4%',
      '--text',
      scene.voice,
      '--write-media',
      file,
    ])
    durations[scene.id] = await probeDuration(file)
  }
  return durations
}

async function muxClips(rawPath: string, timings: SceneTiming[]) {
  await mkdir(CLIPS, { recursive: true })
  const list: string[] = []
  const chapters: { time: number; title: string }[] = []
  let cursor = 0

  for (const scene of SCENES) {
    const timing = timings.find((item) => item.id === scene.id)
    if (!timing) throw new Error(`Missing timing for ${scene.id}`)
    const audio = path.join(AUDIO, `${scene.id}.mp3`)
    const clip = path.join(CLIPS, `${scene.id}.mp4`)
    const audioSeconds = await probeDuration(audio)
    const start = Math.max(timing.start, 0)
    const end = Math.max(timing.end, start + 0.8)
    const duration = audioSeconds + 0.25
    if (!chapters.some((chapter) => chapter.title === scene.chapter)) {
      chapters.push({ time: Number(cursor.toFixed(2)), title: scene.chapter })
    }
    cursor += duration

    await run('ffmpeg', [
      '-y',
      '-ss',
      start.toFixed(3),
      '-to',
      end.toFixed(3),
      '-i',
      rawPath,
      '-i',
      audio,
      '-filter_complex',
      [
        `[0:v]fps=30,scale=1920:1080:flags=lanczos:force_original_aspect_ratio=decrease,`,
        `pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p,`,
        `tpad=stop_mode=clone:stop=-1[v]`,
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
      '-t',
      duration.toFixed(3),
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
    '18',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    finalFile,
  ])
  await run('ffmpeg', [
    '-y',
    '-ss',
    '0.4',
    '-i',
    finalFile,
    '-frames:v',
    '1',
    '-q:v',
    '3',
    path.join(PUBLIC_DIR, 'how-to-use-carbon-logic.jpg'),
  ])
  await writeFile(path.join(PUBLIC_DIR, 'chapters.json'), JSON.stringify(chapters, null, 2))
  return { finalFile, chapters, duration: cursor }
}

async function copyArtifacts(finalFile: string) {
  await mkdir(ARTIFACTS, { recursive: true })
  await copyFile(finalFile, path.join(ARTIFACTS, 'carbon_logic_tour_actions.mp4'))
  await copyFile(
    path.join(PUBLIC_DIR, 'how-to-use-carbon-logic.jpg'),
    path.join(ARTIFACTS, 'carbon_logic_tour_actions_poster.jpg'),
  )
}

export async function main() {
  await rm(CACHE, { recursive: true, force: true })
  await mkdir(CACHE, { recursive: true })
  await ensureEdgeTts()

  let vite: ReturnType<typeof spawn> | null = null
  try {
    const durations = await synthesize()
    vite = await startVite()
    const recorded = await captureTour(durations)
    const meta = JSON.parse(await readFile(path.join(CACHE, 'timings.json'), 'utf8')) as {
      rawPath: string
      timings: SceneTiming[]
    }
    const rawPath = recorded.rawPath || meta.rawPath
    const result = await muxClips(rawPath, recorded.timings)
    await copyArtifacts(result.finalFile)
    console.log(`Tutorial video ready: ${result.finalFile} (${result.duration.toFixed(1)}s)`)
    console.log(JSON.stringify(result.chapters, null, 2))
  } finally {
    if (vite?.pid) {
      try {
        process.kill(-vite.pid, 'SIGTERM')
      } catch {
        vite.kill('SIGTERM')
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('build.ts')) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
