import { expect, type Page, test } from '@playwright/test'

import { login } from './support/api.ts'
import { API_URL, APP_URL, DEMO_PASSWORD, USERS, authFile } from './support/env.ts'

const emailInput = (page: Page) => page.getByLabel('Email')
const passwordInput = (page: Page) => page.getByLabel('Password')
const signIn = (page: Page) => page.getByRole('button', { name: 'Sign in' })

async function fillLogin(page: Page, email: string, password: string) {
  await emailInput(page).fill(email)
  await passwordInput(page).fill(password)
}

test.describe('login form validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('empty submit shows both field errors and sends no request', async ({ page }) => {
    let loginRequests = 0
    page.on('request', (request) => {
      if (request.url().includes('/auth/login/')) loginRequests += 1
    })

    await signIn(page).click()

    await expect(page.getByText('Enter a valid email address.')).toBeVisible()
    await expect(page.getByText('Password is required.')).toBeVisible()
    await expect(emailInput(page)).toHaveAttribute('aria-invalid', 'true')
    expect(loginRequests).toBe(0)
  })

  for (const badEmail of ['admin', 'admin@acme', 'admin acme.test', '@acme.test', 'admin@@acme.test']) {
    test(`rejects malformed email "${badEmail}"`, async ({ page }) => {
      await fillLogin(page, badEmail, DEMO_PASSWORD)
      await signIn(page).click()
      await expect(page.getByText('Enter a valid email address.')).toBeVisible()
      await expect(page).toHaveURL(/\/login$/)
    })
  }

  test('wrong password shows the server error and stays on login', async ({ page }) => {
    await fillLogin(page, USERS.admin, 'WrongPass1!')
    await signIn(page).click()
    await expect(page.getByRole('alert').filter({ hasText: /no active account/i })).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('unknown account gets the same generic error (no user enumeration)', async ({ page }) => {
    await fillLogin(page, 'nobody@acme.test', DEMO_PASSWORD)
    await signIn(page).click()
    await expect(page.getByRole('alert').filter({ hasText: /no active account/i })).toBeVisible()
  })

  test('password is case sensitive and not trimmed', async ({ page }) => {
    await fillLogin(page, USERS.admin, DEMO_PASSWORD.toLowerCase())
    await signIn(page).click()
    await expect(page.getByRole('alert').filter({ hasText: /no active account/i })).toBeVisible()

    await passwordInput(page).fill(`${DEMO_PASSWORD} `)
    await signIn(page).click()
    await expect(page.getByRole('alert').filter({ hasText: /no active account/i })).toBeVisible()
  })

  test('email with capitals and surrounding spaces still signs in', async ({ page }) => {
    await fillLogin(page, `   ${USERS.admin.toUpperCase()}  `, DEMO_PASSWORD)
    await signIn(page).click()
    await expect(page).toHaveURL(`${APP_URL}/`)
    await expect(page.getByRole('heading', { name: 'Acme Travels' })).toBeVisible()
  })

  test('pressing Enter submits the form', async ({ page }) => {
    await fillLogin(page, USERS.admin, DEMO_PASSWORD)
    await passwordInput(page).press('Enter')
    await expect(page.getByRole('heading', { name: 'Acme Travels' })).toBeVisible()
  })

  test('double-clicking Sign in sends a single login request', async ({ page }) => {
    let loginRequests = 0
    page.on('request', (request) => {
      if (request.url().includes('/auth/login/')) loginRequests += 1
    })
    await fillLogin(page, USERS.admin, DEMO_PASSWORD)
    await signIn(page).dblclick()
    await expect(page.getByRole('heading', { name: 'Acme Travels' })).toBeVisible()
    expect(loginRequests).toBe(1)
  })

  test('fixing a field error and resubmitting works', async ({ page }) => {
    await fillLogin(page, 'admin@acme', DEMO_PASSWORD)
    await signIn(page).click()
    await expect(page.getByText('Enter a valid email address.')).toBeVisible()

    await emailInput(page).fill(USERS.admin)
    await signIn(page).click()
    await expect(page.getByRole('heading', { name: 'Acme Travels' })).toBeVisible()
  })
})

test.describe('routing and session', () => {
  test('protected page redirects to login, then back to the requested page', async ({ page }) => {
    await page.goto('/companies')
    await expect(page).toHaveURL(/\/login$/)

    await fillLogin(page, USERS.admin, DEMO_PASSWORD)
    await signIn(page).click()
    await expect(page).toHaveURL(/\/companies$/)
    await expect(page.getByRole('heading', { name: 'Companies' })).toBeVisible()
  })

  test.describe('when signed in', () => {
    test.use({ storageState: authFile('admin') })

    test('visiting /login sends a signed-in user to the dashboard', async ({ page }) => {
      await page.goto('/login')
      await expect(page).toHaveURL(`${APP_URL}/`)
    })

    test('unknown URL shows the not-found page', async ({ page }) => {
      await page.goto('/this/does/not/exist')
      await expect(page.getByText('Page not found')).toBeVisible()
      await page.getByRole('link', { name: 'Back to dashboard' }).click()
      await expect(page.getByRole('heading', { name: 'Acme Travels' })).toBeVisible()
    })
  })

  test('sign out clears the session and the back button does not reveal data', async ({ page }) => {
    await page.goto('/login')
    await fillLogin(page, USERS.admin, DEMO_PASSWORD)
    await signIn(page).click()
    await expect(page.getByRole('heading', { name: 'Acme Travels' })).toBeVisible()
    await page.getByRole('link', { name: 'Companies' }).first().click()
    await expect(page.getByRole('heading', { name: 'Companies' })).toBeVisible()

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('crm-auth') ?? '{}').state?.accessToken)).toBeNull()

    await page.goBack()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Companies' })).toHaveCount(0)
  })

  test('refresh token is revoked on sign out', async ({ page, request }) => {
    await page.goto('/login')
    await fillLogin(page, USERS.admin, DEMO_PASSWORD)
    await signIn(page).click()
    await expect(page.getByRole('heading', { name: 'Acme Travels' })).toBeVisible()
    const refresh = await page.evaluate(() => JSON.parse(localStorage.getItem('crm-auth')!).state.refreshToken as string)

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)

    const reuse = await request.post(`${API_URL}/auth/refresh/`, { data: { refresh } })
    expect(reuse.status()).toBe(401)
  })

  test('an expired access token is refreshed silently', async ({ page }) => {
    await page.goto('/login')
    await fillLogin(page, USERS.admin, DEMO_PASSWORD)
    await signIn(page).click()
    await expect(page.getByRole('heading', { name: 'Acme Travels' })).toBeVisible()

    await page.evaluate(() => {
      const stored = JSON.parse(localStorage.getItem('crm-auth')!)
      stored.state.accessToken = 'expired.or.tampered'
      localStorage.setItem('crm-auth', JSON.stringify(stored))
    })
    await page.goto('/companies')

    await expect(page.getByRole('heading', { name: 'Companies' })).toBeVisible()
    await expect(page.getByText('Skyline Airways')).toBeVisible()
    const access = await page.evaluate(() => JSON.parse(localStorage.getItem('crm-auth')!).state.accessToken)
    expect(access).not.toBe('expired.or.tampered')
  })

  test('when both tokens are invalid the user is sent back to login', async ({ page, request }) => {
    const session = await login(request, 'admin')
    await page.addInitScript((user) => {
      localStorage.setItem(
        'crm-auth',
        JSON.stringify({ state: { accessToken: 'bad', refreshToken: 'also-bad', user }, version: 0 }),
      )
    }, session.user)

    await page.goto('/companies')
    await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 })
  })
})
