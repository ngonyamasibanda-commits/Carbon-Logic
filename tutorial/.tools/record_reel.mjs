import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(dir, '..', '.work', 'pw')
mkdirSync(outDir, { recursive: true })

const url = process.env.REEL_URL || 'http://127.0.0.1:5180/demo.html#/reel'
const holdMs = Number(process.env.REEL_MS || 48000)

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: { dir: outDir, size: { width: 1920, height: 1080 } },
})
const page = await context.newPage()
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-reel-ready="1"]', { timeout: 15000 })
await page.waitForTimeout(holdMs)
const video = page.video()
await context.close()
const saved = await video.path()
console.log(saved)
await browser.close()
