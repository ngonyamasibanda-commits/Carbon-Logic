import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium, type Page } from 'playwright'
import { SCENES } from './scenes'

const BASE = process.env.TOUR_BASE_URL ?? 'http://127.0.0.1:5173'
const OUT = path.resolve('scripts/tutorial-video/.cache/frames')

async function waitForApp(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => undefined)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(700)
}

async function injectCaption(page: Page, chapter: string, caption: string) {
  await page.evaluate(
    ({ chapter: chapterLabel, caption: captionText }) => {
      document.getElementById('tour-caption')?.remove()
      const bar = document.createElement('div')
      bar.id = 'tour-caption'
      bar.style.cssText = [
        'position:fixed',
        'left:40px',
        'right:40px',
        'bottom:28px',
        'z-index:2147483647',
        'display:flex',
        'flex-direction:column',
        'gap:6px',
        'padding:18px 22px',
        'border-radius:16px',
        'background:linear-gradient(180deg, rgba(2,35,78,0.92), rgba(1,18,40,0.96))',
        'box-shadow:0 18px 40px rgba(2,20,46,0.35)',
        'border:1px solid rgba(255,255,255,0.12)',
        'font-family:Inter, ui-sans-serif, system-ui, sans-serif',
        'pointer-events:none',
      ].join(';')
      bar.innerHTML = `
        <div style="font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#6cbe2c">${chapterLabel}</div>
        <div style="font-size:22px;line-height:1.25;font-weight:600;color:#ffffff">${captionText}</div>
      `
      document.body.appendChild(bar)
    },
    { chapter, caption },
  )
}

async function highlight(page: Page, selectors: string[]) {
  await page.evaluate((list) => {
    for (const selector of list) {
      document.querySelectorAll(selector).forEach((node) => {
        const el = node as HTMLElement
        el.style.outline = '3px solid #6cbe2c'
        el.style.outlineOffset = '4px'
        el.style.boxShadow = '0 0 0 8px rgba(108,190,44,0.18)'
        el.style.borderRadius = '10px'
      })
    }
  }, selectors)
}

async function fillFuelForm(page: Page, stage: 'empty' | 'working' | 'evidence' | 'saved') {
  if (stage === 'empty') {
    await page.getByRole('button', { name: 'Tutorial' }).click()
    await page.waitForTimeout(400)
    return
  }

  await page.getByLabel('Fuel (DESNZ 2026)').selectOption('Diesel (average biofuel blend)')
  await page.waitForTimeout(250)
  const amount = page.getByLabel('Fuel amount')
  await amount.fill('12500')
  await page.waitForTimeout(400)

  if (stage === 'working') {
    await highlight(page, ['form .rounded-md.border.border-brand\\/30', 'form ol'])
    return
  }

  await page.getByLabel('Site', { exact: true }).selectOption({ label: 'Riverside Interchange' })
  await page.locator('input[placeholder="SharePoint, Drive, or invoice URL"]').fill(
    'https://files.northridge.example/invoices/diesel-apr-2026.pdf',
  )
  const comment = page.locator('textarea')
  if (await comment.count()) {
    await comment.first().fill('April tank dip, Riverside compound bowser.')
  }

  if (stage === 'evidence') {
    await highlight(page, ['aside'])
    return
  }

  await page.getByRole('button', { name: 'Calculate & add to footprint' }).click()
  await page.getByText(/Added .* to your footprint/i).waitFor({ timeout: 8000 })
}

async function renderTitleCard(page: Page, scene: (typeof SCENES)[number], file: string) {
  const card = scene.titleCard!
  await page.setContent(
    `<!doctype html>
    <html>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&display=swap" rel="stylesheet" />
        <style>
          html, body { margin: 0; height: 100%; }
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
  await page.waitForTimeout(400)
  await injectCaption(page, scene.chapter, scene.caption)
  await page.screenshot({ path: file, type: 'png' })
}

export async function captureFrames() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage', '--font-render-hinting=none'],
  })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  })
  await context.addInitScript(() => {
    sessionStorage.setItem('carbon-logic-product-tour', '1')
  })
  const page = await context.newPage()

  for (const scene of SCENES) {
    const file = path.join(OUT, `${scene.id}.png`)
    if (scene.titleCard) {
      await renderTitleCard(page, scene, file)
      continue
    }

    await page.goto(`${BASE}${scene.route}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitForApp(page)

    if (scene.id.startsWith('fuel-')) {
      await fillFuelForm(page, scene.id.replace('fuel-', '') as 'empty' | 'working' | 'evidence' | 'saved')
      await page.waitForTimeout(500)
    }

    if (scene.id === 'dashboard') {
      await highlight(page, ['main section.grid'])
    }
    if (scene.id === 'facilities') {
      await highlight(page, ['form', 'h1'])
    }
    if (scene.id === 'organisation') {
      await highlight(page, ['form'])
    }
    if (scene.id === 'input') {
      await highlight(page, ['h1', 'input[placeholder="Search categories..."]'])
    }
    if (scene.id === 'reports') {
      await highlight(page, ['section.grid'])
    }
    if (scene.id === 'analysis') {
      await page.waitForTimeout(600)
    }

    await injectCaption(page, scene.chapter, scene.caption)
    await page.screenshot({ path: file, type: 'png' })
  }

  await browser.close()
  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(SCENES.map((scene) => scene.id), null, 2))
}
