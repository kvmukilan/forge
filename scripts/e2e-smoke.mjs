import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const executablePath = process.env.BROWSER_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const artifactDir = path.join(os.tmpdir(), 'forge-e2e-smoke')
await mkdir(artifactDir, { recursive: true })

const browser = await chromium.launch({ executablePath, headless: true })
const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  extraHTTPHeaders: protectionBypass
    ? {
        'x-vercel-protection-bypass': protectionBypass,
        'x-vercel-set-bypass-cookie': 'true',
      }
    : undefined,
})
const page = await context.newPage()
const runtimeErrors = []
let oauthChecked = false
const isVercelPreviewFeedback = url => url.startsWith('https://vercel.live/_next-live/feedback/')
page.on('pageerror', error => runtimeErrors.push(`page: ${error.message}`))
page.on('console', message => {
  if (message.type() === 'error') {
    const location = message.location().url
    if (isVercelPreviewFeedback(location)) return
    runtimeErrors.push(`console: ${message.text()}${location ? ` @ ${location}` : ''}`)
  }
})
page.on('requestfailed', request => {
  const failure = request.failure()?.errorText ?? 'failed'
  if (failure === 'net::ERR_ABORTED' || isVercelPreviewFeedback(request.url())) return
  runtimeErrors.push(`request: ${failure} @ ${request.url()}`)
})
page.on('response', response => {
  if (response.status() >= 500) runtimeErrors.push(`http ${response.status()}: ${response.url()}`)
})

const username = `smk${Date.now().toString(36)}`
const password = `Forge-${Date.now()}-safe`
let testUserId = null

try {
  const login = await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  assert.equal(login?.status(), 200)
  if (process.env.CHECK_GOOGLE_OAUTH === '1') {
    await context.setExtraHTTPHeaders({})
    await page.getByRole('button', { name: 'Continue with Google' }).click()
    await page.waitForURL(url => url.hostname === 'accounts.google.com', { timeout: 30_000 })
    let decodedOauthUrl = page.url()
    for (let index = 0; index < 4; index += 1) {
      decodedOauthUrl = decodeURIComponent(decodedOauthUrl)
    }
    assert.ok(
      decodedOauthUrl.includes(`${baseUrl}/api/auth/callback/google`),
      `Google authorization URL did not contain the expected callback: ${decodedOauthUrl}`,
    )
    oauthChecked = true
    const returnToLogin = await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
    assert.equal(returnToLogin?.status(), 200)
  }
  await page.getByRole('button', { name: 'Create an account' }).click()
  await page.locator('input[autocomplete="username"]').fill(username)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  try {
    await page.waitForURL(url => url.pathname === '/onboarding', { timeout: 30_000 })
  } catch {
    throw new Error(`Signup did not reach onboarding. Visible page:\n${await page.locator('body').innerText()}`)
  }
  const signupSession = await (await context.request.get(`${baseUrl}/api/auth/session`)).json()
  testUserId = signupSession?.user?.id ?? null

  await page.getByRole('heading', { name: 'What are you ready to develop?' }).waitFor()
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(artifactDir, '01-onboarding-mobile.png'), fullPage: true })
  assert.equal(await page.locator('header:visible').count(), 0, 'Onboarding should not render the application header')
  assert.equal(await page.locator('aside[aria-label="Primary navigation"]:visible').count(), 0, 'Onboarding should not render the desktop sidebar')
  assert.equal(await page.locator('nav[aria-label="Primary navigation"]:visible').count(), 0, 'Onboarding should not render the mobile tab bar')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({ path: path.join(artifactDir, '01b-onboarding-desktop.png'), fullPage: true })
  assert.equal(await page.locator('aside[aria-label="Primary navigation"]:visible').count(), 0, 'Desktop onboarding should remain immersive')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /^Strength/ }).click()
  await page.getByRole('button', { name: /^Focus/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: /^Balanced/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  const firstQuestName = page.getByLabel('Quest 1 name')
  await firstQuestName.fill('Browser smoke quest')
  await page.getByLabel('Quest 1 schedule').selectOption('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
  await page.getByLabel('Strength starting value').evaluate(element => {
    element.value = '6'
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.screenshot({ path: path.join(artifactDir, '02-program-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'Activate program' }).click()
  await page.waitForURL(url => url.pathname === '/', { timeout: 30_000 })
  await page.getByText('Daily plan', { exact: true }).waitFor({ timeout: 30_000 })

  const characterMobileLink = page.locator('a[href="/character"]:visible').first()
  assert.equal(await characterMobileLink.isVisible(), true)
  const forgePlanButton = page.getByRole('button', { name: "Forge today's plan" })
  if (await forgePlanButton.isDisabled()) {
    throw new Error(`Daily plan had no selectable quests. Visible page:\n${await page.locator('body').innerText()}`)
  }
  await forgePlanButton.click()
  await page.getByText("Today's mission", { exact: true }).waitFor()
  const missionButton = page.getByRole('button', { name: /Browser smoke quest/ }).first()
  await missionButton.click()
  try {
    await page.getByText('How did it feel?', { exact: true }).waitFor({ timeout: 15_000 })
  } catch {
    throw new Error(`Completion feedback did not appear. Errors: ${runtimeErrors.join(' | ')}\nVisible page:\n${await page.locator('body').innerText()}`)
  }
  await page.getByRole('button', { name: 'Right' }).click()
  await page.screenshot({ path: path.join(artifactDir, '03-today-complete-mobile.png'), fullPage: true })

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('Browser smoke quest', { exact: false }).first().waitFor()
  await characterMobileLink.click()
  await page.waitForURL(url => url.pathname === '/character')
  await page.getByRole('heading', { name: /Visible growth/ }).waitFor()
  assert.equal(
    await page.locator('.fixed.inset-0:visible').count(),
    0,
    'Character page was obscured by an unexpected full-screen overlay',
  )
  await page.locator('.animate-fade-in').first().evaluate(element => Promise.all(
    element.getAnimations().map(animation => animation.finished),
  ))
  await page.screenshot({ path: path.join(artifactDir, '04-character-mobile.png'), fullPage: true })

  await page.getByRole('button', { name: 'Open more destinations' }).click()
  await page.getByRole('heading', { name: 'Your Forge' }).waitFor()
  const rewardsSheetLink = page.locator('[role="dialog"] a[href="/rewards"]')
  assert.equal(await rewardsSheetLink.isVisible(), true)
  assert.equal(await page.locator('[role="dialog"] a[href="/settings"]').isVisible(), true)
  const sheetTargetHeights = await page.locator('[role="dialog"] a:visible, [role="dialog"] button:visible').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height))
  assert.ok(sheetTargetHeights.every(height => height >= 44), 'More sheet contains a touch target shorter than 44px')
  await page.screenshot({ path: path.join(artifactDir, '05-more-mobile.png'), fullPage: true })
  await rewardsSheetLink.click()
  await page.waitForURL(url => url.pathname === '/rewards')
  await page.getByRole('heading', { name: /Progress should unlock/ }).waitFor()
  await page.waitForTimeout(350)
  assert.equal(
    await page.locator('.fixed.inset-0:visible').count(),
    0,
    'Rewards page was obscured by the closing navigation sheet',
  )
  await page.screenshot({ path: path.join(artifactDir, '06-rewards-mobile.png'), fullPage: true })

  await page.goto(`${baseUrl}/habits`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Quests' }).waitFor()
  await page.setViewportSize({ width: 375, height: 667 })
  const bottomTargetHeights = await page.locator('nav[aria-label="Primary navigation"] a:visible, nav[aria-label="Primary navigation"] button:visible').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height))
  assert.ok(bottomTargetHeights.every(height => height >= 44), 'Bottom navigation contains a touch target shorter than 44px')
  const questTargetHeights = await page.locator('main button:visible').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height))
  assert.ok(questTargetHeights.every(height => height >= 44), 'Quests page contains a visible button shorter than 44px')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await page.screenshot({ path: path.join(artifactDir, '07-quests-375.png'), fullPage: true })

  const addHabitButton = page.getByRole('button', { name: 'Add Habit', exact: true }).first()
  assert.equal(await addHabitButton.isVisible(), true)
  await addHabitButton.click()
  const addHabitDialog = page.getByRole('dialog')
  try {
    await addHabitDialog.waitFor({ timeout: 10_000 })
  } catch {
    throw new Error(`Habit editor did not open. Dialog count: ${await addHabitDialog.count()}\nVisible page:\n${await page.locator('body').innerText()}`)
  }
  await addHabitDialog.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
  const editorTargets = await addHabitDialog.locator('button:visible, input:visible, select:visible').evaluateAll(elements => elements.map(element => ({
    height: element.getBoundingClientRect().height,
    tag: element.tagName,
    label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 40) || element.getAttribute('name'),
  })))
  const shortEditorTargets = editorTargets.filter(target => target.height < 44)
  assert.deepEqual(shortEditorTargets, [], `Habit editor contains short touch targets: ${JSON.stringify(shortEditorTargets)}`)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await page.screenshot({ path: path.join(artifactDir, '08-add-habit-mobile.png'), fullPage: false })
  await addHabitDialog.getByRole('button', { name: 'Close' }).click()
  await addHabitDialog.waitFor({ state: 'detached' })

  await page.evaluate(() => { document.documentElement.style.fontSize = '32px' })
  await page.evaluate(() => window.scrollTo(0, 0))
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await page.screenshot({ path: path.join(artifactDir, '09-quests-large-text.png'), fullPage: false })
  await page.evaluate(() => { document.documentElement.style.fontSize = '' })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  assert.equal(await page.locator('.animate-fade-in').first().evaluate(element => getComputedStyle(element).animationName), 'none')
  await page.setViewportSize({ width: 844, height: 390 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await page.screenshot({ path: path.join(artifactDir, '10-today-landscape.png'), fullPage: false })
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  assert.equal(await page.locator('a[href="/journey"]:visible').first().isVisible(), true)
  const desktopSidebar = page.locator('aside[aria-label="Primary navigation"]')
  assert.equal(await desktopSidebar.isVisible(), true)
  assert.ok(await desktopSidebar.locator('a:visible').count() <= 5, 'Desktop sidebar exposes too many destinations before Library is opened')
  assert.equal(await desktopSidebar.locator('a[aria-current="page"]').getAttribute('href'), '/')
  await page.screenshot({ path: path.join(artifactDir, '11-today-desktop.png'), fullPage: true })

  for (const asset of ['/manifest.webmanifest', '/sw.js', '/api/auth/session', '/api/auth/providers']) {
    const response = await context.request.get(`${baseUrl}${asset}`)
    assert.ok(response.status() < 400, `${asset} returned ${response.status()}`)
  }

  assert.deepEqual(runtimeErrors, [])
  const session = await (await context.request.get(`${baseUrl}/api/auth/session`)).json()
  assert.ok(session?.user?.id)
  const deleted = await context.request.post(`${baseUrl}/api/user/delete`, {
    data: { userId: session.user.id },
  })
  assert.equal(deleted.status(), 200)
  testUserId = null
  console.log(JSON.stringify({ ok: true, baseUrl, artifactDir, checks: [
    'credentials signup and login',
    ...(oauthChecked ? ['Google OAuth authorization redirect and canonical callback'] : []),
    'mobile assessment and edited program',
    'daily plan and transactional completion',
    'effort feedback and persistence after refresh',
    'mobile character, bottom navigation, and grouped More sheet',
    'mobile Quests, habit editor, and Rewards without horizontal overflow',
    'large-text, landscape, touch-target, and reduced-motion behavior',
    'desktop today layout and collapsed Library navigation',
    'PWA and auth API assets',
    'test account cleanup',
  ] }, null, 2))
} finally {
  if (testUserId) {
    await context.request.post(`${baseUrl}/api/user/delete`, {
      data: { userId: testUserId },
    }).catch(() => {})
  }
  await browser.close()
}
