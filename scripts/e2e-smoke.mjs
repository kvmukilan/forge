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
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
const runtimeErrors = []
page.on('pageerror', error => runtimeErrors.push(`page: ${error.message}`))
page.on('response', response => {
  if (response.status() >= 500) runtimeErrors.push(`http ${response.status()}: ${response.url()}`)
})

const username = `smk${Date.now().toString(36)}`
const password = `Forge-${Date.now()}-safe`

try {
  const login = await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  assert.equal(login?.status(), 200)
  await page.getByRole('button', { name: 'Create an account' }).click()
  await page.locator('input[autocomplete="username"]').fill(username)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  try {
    await page.waitForURL(url => url.pathname === '/onboarding', { timeout: 30_000 })
  } catch {
    throw new Error(`Signup did not reach onboarding. Visible page:\n${await page.locator('body').innerText()}`)
  }

  await page.screenshot({ path: path.join(artifactDir, '01-onboarding-mobile.png'), fullPage: true })
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
  await page.getByRole('button', { name: 'Begin campaign' }).click()
  await page.waitForURL(url => url.pathname === '/', { timeout: 30_000 })
  await page.getByText('Daily Forge', { exact: true }).waitFor({ timeout: 30_000 })

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
  await page.screenshot({ path: path.join(artifactDir, '04-character-mobile.png'), fullPage: true })

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  assert.equal(await page.locator('a[href="/journey"]:visible').first().isVisible(), true)
  await page.screenshot({ path: path.join(artifactDir, '05-today-desktop.png'), fullPage: true })

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
  console.log(JSON.stringify({ ok: true, baseUrl, artifactDir, checks: [
    'credentials signup and login',
    'mobile assessment and edited program',
    'daily plan and transactional completion',
    'effort feedback and persistence after refresh',
    'mobile character and primary navigation',
    'desktop today layout',
    'PWA and auth API assets',
    'test account cleanup',
  ] }, null, 2))
} finally {
  await browser.close()
}
