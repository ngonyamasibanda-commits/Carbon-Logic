import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { chromium } = require(path.join(root, 'tutorial/.tools/node_modules/playwright'))

const html = path.join(root, 'scripts', 'tutorial-walkthrough.html')
const outDir = path.join(root, 'public', 'tutorials')
const workDir = path.join(root, 'tutorial', '.tools', 'tmp', 'tutorial-vids')
const ffmpeg = path.join(root, 'tutorial', '.tools', 'node_modules', 'ffmpeg-static', 'ffmpeg')

mkdirSync(outDir, { recursive: true })
mkdirSync(workDir, { recursive: true })

const topics = ['data-entry', 'organization', 'sbti']

for (const topic of topics) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: { dir: workDir, size: { width: 1280, height: 720 } },
  })
  const page = await context.newPage()
  const url = `${pathToFileURL(html).href}?topic=${topic}`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1')
  await page.waitForTimeout(10500)
  const video = page.video()
  await context.close()
  const saved = await video.path()
  await browser.close()

  const webm = path.join(outDir, `${topic}.webm`)
  const mp4 = path.join(outDir, `${topic}.mp4`)
  copyFileSync(saved, webm)
  if (existsSync(ffmpeg)) {
    const result = spawnSync(
      ffmpeg,
      ['-y', '-i', saved, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', mp4],
      { encoding: 'utf8' },
    )
    if (result.status !== 0) {
      console.warn('ffmpeg failed for', topic, result.stderr?.slice(-400))
    } else {
      console.log('wrote', mp4)
    }
  }
  console.log('wrote', webm)
}

console.log('done')
