import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium, type Locator, type Page } from 'playwright'
import { SCENES, type Scene } from './scenes'

const BASE = process.env.TOUR_BASE_URL ?? 'http://127.0.0.1:5173'
const OUT = path.resolve('scripts/tutorial-video/.cache')
const VIDEO_DIR = path.join(OUT, 'recordings')

export type SceneTiming = { id: string; start: number; end: number }

async function waitForApp(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => document.fonts.ready).catch(() => undefined)
  await page.waitForTimeout(350)
}

async function installPointer(page: Page) {
  await page.evaluate(() => {
    document.getElementById('tour-pointer')?.remove()
    const pointer = document.createElement('div')
    pointer.id = 'tour-pointer'
    pointer.innerHTML =
      '<svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path fill="#02234e" stroke="#ffffff" stroke-width="1.4" d="M4.8 2.8v17.2c0 .6.7 1 1.2.6l4.3-3.1 2.4 5.3c.2.4.6.6 1 .5l2.1-.8c.4-.1.6-.6.5-1l-2.4-5.3 5.3-.4c.7 0 1-1 .5-1.5L6.1 2.5c-.5-.4-1.3-.1-1.3.3z"/></svg>'
    Object.assign(pointer.style, {
      position: 'fixed',
      left: '40px',
      top: '40px',
      width: '34px',
      height: '34px',
      zIndex: '2147483646',
      pointerEvents: 'none',
      filter: 'drop-shadow(0 2px 4px rgba(2,35,78,0.35))',
      transition: 'left 90ms linear, top 90ms linear',
    })
    document.documentElement.appendChild(pointer)
  })
}

async function movePointer(page: Page, x: number, y: number, steps = 16) {
  await page.mouse.move(x, y, { steps })
  await page.evaluate(
    ({ left, top }) => {
      const pointer = document.getElementById('tour-pointer')
      if (pointer) {
        pointer.style.left = `${left}px`
        pointer.style.top = `${top}px`
      }
    },
    { left: x, top: y },
  )
}

async function pointAt(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (!box) return null
  const x = box.x + Math.min(Math.max(box.width / 2, 12), box.width - 8)
  const y = box.y + Math.min(Math.max(box.height / 2, 10), box.height - 6)
  await movePointer(page, x, y)
  return { x, y }
}

async function clickAt(page: Page, locator: Locator) {
  const point = await pointAt(page, locator)
  await page.waitForTimeout(160)
  if (point) await page.mouse.click(point.x, point.y)
  else await locator.click()
  await page.waitForTimeout(220)
}

async function typeInto(page: Page, locator: Locator, text: string, delay = 42) {
  await clickAt(page, locator)
  await locator.fill('')
  await locator.pressSequentially(text, { delay })
}

async function injectCaption(page: Page, chapter: string, caption: string) {
  await page.evaluate(
    ({ chapter: chapterLabel, caption: captionText }) => {
      document.getElementById('tour-caption')?.remove()
      const bar = document.createElement('div')
      bar.id = 'tour-caption'
      bar.style.cssText = [
        'position:fixed',
        'left:288px',
        'bottom:20px',
        'max-width:720px',
        'z-index:2147483645',
        'display:flex',
        'flex-direction:column',
        'gap:4px',
        'padding:12px 16px',
        'border-radius:14px',
        'background:rgba(2,35,78,0.94)',
        'box-shadow:0 12px 28px rgba(2,20,46,0.28)',
        'border:1px solid rgba(255,255,255,0.12)',
        'font-family:Inter, ui-sans-serif, system-ui, sans-serif',
        'pointer-events:none',
      ].join(';')
      bar.innerHTML = `
        <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#6cbe2c">${chapterLabel}</div>
        <div style="font-size:18px;line-height:1.3;font-weight:600;color:#ffffff">${captionText}</div>
      `
      document.body.appendChild(bar)
    },
    { chapter, caption },
  )
}

async function showTitleCard(page: Page, scene: Scene) {
  const card = scene.titleCard!
  await page.setContent(
    `<!doctype html>
    <html>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&display=swap" rel="stylesheet" />
        <style>
          html, body { margin: 0; height: 100%; overflow: hidden; }
          body {
            font-family: Inter, ui-sans-serif, system-ui, sans-serif;
            background:
              radial-gradient(1200px 600px at 80% -10%, rgba(108,190,44,0.22), transparent 55%),
              linear-gradient(160deg, #02234e 0%, #011428 55%, #071325 100%);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .wrap { width: 1280px; }
          img { height: 54px; width: auto; background: #fff; padding: 10px 14px; border-radius: 12px; }
          .eyebrow {
            margin-top: 36px;
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0.22em;
            text-transform: uppercase;
            color: #6cbe2c;
          }
          h1 {
            margin: 16px 0 0;
            font-size: 72px;
            line-height: 1.05;
            letter-spacing: -0.03em;
            font-weight: 600;
          }
          p {
            margin: 22px 0 0;
            max-width: 820px;
            font-size: 24px;
            line-height: 1.45;
            color: #c9d4e4;
            font-weight: 500;
          }
          .rule {
            margin-top: 40px;
            height: 6px;
            width: 220px;
            border-radius: 99px;
            background: linear-gradient(90deg, #02234e, #6cbe2c);
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <img src="${BASE}/brand/carbon-logic-lockup.png" alt="Carbon Logic" />
          <div class="eyebrow">${card.eyebrow}</div>
          <h1>${card.title}</h1>
          <p>${card.subtitle}</p>
          <div class="rule"></div>
        </div>
      </body>
    </html>`,
    { waitUntil: 'networkidle' },
  )
  await page.evaluate(() => document.fonts.ready)
  await injectCaption(page, scene.chapter, scene.caption)
}

async function prepareAppPage(page: Page, scene: Scene) {
  await waitForApp(page)
  await installPointer(page)
  await injectCaption(page, scene.chapter, scene.caption)
}

async function holdUntil(startedAt: number, minSeconds: number) {
  const remain = minSeconds * 1000 - (Date.now() - startedAt)
  if (remain > 0) await new Promise((resolve) => setTimeout(resolve, remain))
}

async function nav(page: Page, name: string, pathname: string) {
  const link = page.locator('aside nav').getByRole('link', { name, exact: true })
  await link.scrollIntoViewIfNeeded()
  await pointAt(page, link)
  await page.waitForTimeout(180)
  await link.click()
  await page.waitForURL((url) => url.pathname === pathname, { timeout: 15000 })
  await waitForApp(page)
  await installPointer(page)
}

async function playScene(page: Page, scene: Scene, minSeconds: number) {
  const startedAt = Date.now()

  if (scene.titleCard) {
    await showTitleCard(page, scene)
    await page.waitForTimeout(Math.max(minSeconds * 1000, 2500))
    return
  }

  if (scene.id === 'login') {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.getByRole('heading', { name: 'Sign in' }).waitFor({ timeout: 20000 })
    await prepareAppPage(page, scene)
    await typeInto(page, page.getByLabel('Email'), 'alex.morgan@northridge.example', 38)
    await page.waitForTimeout(400)
    await clickAt(page, page.getByRole('button', { name: 'Email me a sign-in link' }))
    await page.waitForTimeout(700)
    await clickAt(page, page.getByRole('button', { name: 'Sign in with a password' }))
    await page.waitForTimeout(500)
    await pointAt(page, page.getByRole('button', { name: 'Single sign-on (SAML)' }))
    await holdUntil(startedAt, minSeconds)
    return
  }

  if (scene.id === 'dashboard') {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.getByRole('heading', { name: /Good / }).waitFor({ timeout: 20000 })
    await prepareAppPage(page, scene)
    await page.waitForTimeout(800)
    await page.mouse.wheel(0, 420)
    await page.waitForTimeout(900)
    await page.mouse.wheel(0, 380)
    await page.waitForTimeout(800)
    await page.mouse.wheel(0, -700)
    await holdUntil(startedAt, minSeconds)
    return
  }

  if (scene.id === 'facilities') {
    await prepareAppPage(page, scene)
    await nav(page, 'Facilities', '/facilities')
    await injectCaption(page, scene.chapter, scene.caption)
    await typeInto(page, page.getByPlaceholder('Site name'), 'Thames Crossing', 55)
    await clickAt(page, page.locator('select').first())
    await page.locator('select').first().selectOption('construction_site')
    await typeInto(page, page.getByPlaceholder('Region'), 'London')
    await clickAt(page, page.getByRole('button', { name: 'Add site' }))
    await page.getByText('Thames Crossing').waitFor({ timeout: 8000 })
    await holdUntil(startedAt, minSeconds)
    return
  }

  if (scene.id === 'organisation') {
    await nav(page, 'Organisation', '/organisation')
    await injectCaption(page, scene.chapter, scene.caption)
    await installPointer(page)
    await clickAt(page, page.getByLabel('Reporting year'))
    await page.waitForTimeout(400)
    await clickAt(page, page.getByLabel('Baseline tCO₂e'))
    await page.mouse.wheel(0, 280)
    await page.waitForTimeout(600)
    await pointAt(page, page.getByRole('button', { name: 'Save settings' }))
    await holdUntil(startedAt, minSeconds)
    return
  }

  if (scene.id === 'input') {
    await nav(page, 'Data Input', '/input')
    await injectCaption(page, scene.chapter, scene.caption)
    await installPointer(page)
    await typeInto(page, page.getByPlaceholder('Search categories...'), 'site fuel', 55)
    await page.waitForTimeout(400)
    await clickAt(page, page.locator('main').getByRole('link', { name: /Site Fuel/ }))
    await page.getByRole('heading', { name: 'Site Fuel' }).waitFor({ timeout: 10000 })
    await holdUntil(startedAt, minSeconds)
    return
  }

  if (scene.id === 'fuel') {
    await installPointer(page)
    await injectCaption(page, scene.chapter, scene.caption)
    await clickAt(page, page.getByLabel('Fuel (DESNZ 2026)'))
    await page.getByLabel('Fuel (DESNZ 2026)').selectOption('Diesel (average biofuel blend)')
    await page.waitForTimeout(300)
    const published = page.getByRole('combobox', { name: 'Published unit' })
    if (await published.count()) {
      await clickAt(page, published)
      await published.selectOption('litres')
    }
    await typeInto(page, page.getByLabel('Fuel amount'), '12500', 70)
    await page.getByText('Calculation working').waitFor({ timeout: 8000 })
    await page.waitForTimeout(900)
    await clickAt(page, page.getByLabel('Assign to facility'))
    await page.getByLabel('Assign to facility').selectOption('Riverside Interchange')
    await typeInto(
      page,
      page.getByPlaceholder('SharePoint, Drive, or invoice URL'),
      'https://files.northridge.example/invoices/diesel-apr-2026.pdf',
      18,
    )
    await clickAt(page, page.getByRole('button', { name: 'Calculate & add to footprint' }))
    await page.getByText(/Added .* to your footprint/i).waitFor({ timeout: 8000 })
    await holdUntil(startedAt, minSeconds)
    return
  }

  if (scene.id === 'analysis') {
    await nav(page, 'Analysis', '/analysis')
    await injectCaption(page, scene.chapter, scene.caption)
    await installPointer(page)
    await page.waitForTimeout(500)
    const siteFilter = page.locator('label').filter({ hasText: /^Site$/ }).locator('select')
    if (await siteFilter.count()) {
      await clickAt(page, siteFilter)
      const hasRiverside = await siteFilter.locator('option', { hasText: 'Riverside Interchange' }).count()
      if (hasRiverside) await siteFilter.selectOption({ label: 'Riverside Interchange' })
      else await siteFilter.selectOption({ index: 1 })
    }
    await page.waitForTimeout(400)
    const bySource = page.getByRole('button', { name: 'By Source' })
    if (await bySource.count()) {
      await clickAt(page, bySource)
      await page.waitForTimeout(800)
    }
    const byScope = page.getByRole('button', { name: 'By Scope' })
    if (await byScope.count()) await clickAt(page, byScope)
    await holdUntil(startedAt, minSeconds)
    return
  }

  if (scene.id === 'combined') {
    await nav(page, 'Combined Results', '/combined')
    await injectCaption(page, scene.chapter, scene.caption)
    await installPointer(page)
    await page.waitForTimeout(600)
    await page.mouse.wheel(0, 520)
    await page.waitForTimeout(900)
    await page.mouse.wheel(0, 420)
    await holdUntil(startedAt, minSeconds)
    return
  }

  if (scene.id === 'reports') {
    await nav(page, 'Reports', '/reports')
    await injectCaption(page, scene.chapter, scene.caption)
    await installPointer(page)
    await page.waitForTimeout(500)
    await pointAt(page, page.getByRole('button', { name: 'Download SECR PDF' }))
    await page.waitForTimeout(700)
    await pointAt(page, page.getByRole('button', { name: 'Download CRP PDF' }))
    await page.waitForTimeout(700)
    await pointAt(page, page.getByRole('button', { name: 'Download auditor pack CSV' }).or(page.getByText('Download auditor pack CSV')))
    await holdUntil(startedAt, minSeconds)
    return
  }

  if (scene.id === 'targets') {
    await nav(page, 'Science Based Targets', '/targets')
    await injectCaption(page, scene.chapter, scene.caption)
    await installPointer(page)
    await page.waitForTimeout(700)
    await page.mouse.wheel(0, 360)
    await page.waitForTimeout(800)
    await page.mouse.wheel(0, 320)
    await holdUntil(startedAt, minSeconds)
    return
  }

  if (scene.id === 'learn') {
    await nav(page, 'Learning Hub', '/learn')
    await page.evaluate(() => document.querySelector('video')?.closest('article')?.remove())
    await injectCaption(page, scene.chapter, scene.caption)
    await installPointer(page)
    await page.waitForTimeout(500)
    await page.mouse.wheel(0, 480)
    await page.waitForTimeout(900)
    await page.mouse.wheel(0, 420)
    await holdUntil(startedAt, minSeconds)
    return
  }

  await page.goto(`${BASE}${scene.route}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await prepareAppPage(page, scene)
  await holdUntil(startedAt, minSeconds)
}

export async function captureTour(durations: Record<string, number>) {
  await mkdir(VIDEO_DIR, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage', '--font-render-hinting=none'],
  })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    recordVideo: { dir: VIDEO_DIR, size: { width: 1920, height: 1080 } },
  })
  await context.addInitScript(() => {
    sessionStorage.setItem('carbon-logic-product-tour', '1')
  })
  await context.route('**/*supabase.co/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })
  const page = await context.newPage()
  const timings: SceneTiming[] = []
  const origin = Date.now()
  let rawPath = ''

  try {
    for (const scene of SCENES) {
      console.log(`Recording ${scene.id}`)
      const start = (Date.now() - origin) / 1000
      const minSeconds = Math.max(durations[scene.id] ?? 4, 3.5) + 0.35
      try {
        await playScene(page, scene, minSeconds)
      } catch (error) {
        const shot = path.join(OUT, `fail-${scene.id}.png`)
        await page.screenshot({ path: shot, fullPage: true }).catch(() => undefined)
        console.error(`Scene ${scene.id} failed at ${page.url()}`)
        throw error
      }
      timings.push({ id: scene.id, start, end: (Date.now() - origin) / 1000 })
    }
  } finally {
    const rec = page.video()
    await page.close()
    rawPath = rec ? await rec.path() : ''
    await context.close()
    await browser.close()
    await writeFile(path.join(OUT, 'timings.json'), JSON.stringify({ rawPath, timings }, null, 2))
  }
  return { rawPath, timings }
}

export async function captureFrames() {
  throw new Error('Use captureTour — the tour is recorded as actions, not still frames.')
}
