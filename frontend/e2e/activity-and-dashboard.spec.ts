import { expect, type Page, test } from '@playwright/test'

import { apiCall, createCompany, login, unique } from './support/api.ts'
import { authFile } from './support/env.ts'

test.use({ storageState: authFile('admin') })

const logRow = (page: Page, text: string, action: string) =>
  page.getByRole('row').filter({ hasText: text }).filter({ hasText: action })

test.describe('activity log', () => {
  test('create, update and delete are each recorded with the acting user', async ({ page, request }) => {
    const name = unique('Audited Co')

    await page.goto('/companies')
    await page.getByRole('button', { name: 'New company' }).click()
    await page.getByLabel('Company name').fill(name)
    await page.getByRole('button', { name: 'Create company' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)

    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel('Industry').fill('Audit')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Company updated.')).toBeVisible()

    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByRole('dialog', { name: 'Delete company' }).getByRole('button', { name: 'Delete' }).click()
    await expect(page).toHaveURL(/\/companies$/)

    await page.goto('/activity')
    for (const action of ['CREATE', 'UPDATE', 'DELETE']) {
      await expect(logRow(page, name, action)).toContainText('admin@acme.test')
    }

    await logRow(page, name, 'UPDATE').click()
    const industryChange = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'industry', exact: true }) })
    await expect(industryChange.last()).toContainText('Audit')

    const { access } = await login(request, 'admin')
    const logs = await (await apiCall(request, access).get(`/activity-logs/?search=${encodeURIComponent(name)}`)).json()
    expect(logs.data.map((log: { action: string }) => log.action).sort()).toEqual(['CREATE', 'DELETE', 'UPDATE'])
  })

  test('saving without changing anything does not create an entry', async ({ page, request }) => {
    const { access } = await login(request, 'admin')
    const company = await createCompany(request, access, { name: unique('No Change Co') })

    await page.goto(`/companies/${company.id}`)
    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Company updated.')).toBeVisible()

    const logs = await (
      await apiCall(request, access).get(`/activity-logs/?object_id=${company.id}&model_name=Company`)
    ).json()
    expect(logs.data.map((log: { action: string }) => log.action)).toEqual(['CREATE'])
  })

  test('filters by action and record type, and can be cleared', async ({ page, request }) => {
    const { access } = await login(request, 'admin')
    const company = await createCompany(request, access, { name: unique('Filter Co') })
    await apiCall(request, access).patch(`/companies/${company.id}/`, { country: 'Filterland' })

    await page.goto('/activity')
    await page.getByLabel('Filter by action').selectOption('UPDATE')
    await expect(logRow(page, company.name, 'UPDATE')).toBeVisible()
    await expect(logRow(page, company.name, 'CREATE')).toHaveCount(0)

    await page.getByLabel('Filter by record type').selectOption('Contact')
    await expect(logRow(page, company.name, 'UPDATE')).toHaveCount(0)

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByLabel('Filter by action')).toHaveValue('')
    await expect(logRow(page, company.name, 'CREATE')).toBeVisible()
  })

  test('a date range in the future shows the empty state', async ({ page }) => {
    await page.goto('/activity')
    await page.getByLabel('From date').fill('2099-01-01')
    await expect(page.getByText('No activity found')).toBeVisible()
    await expect(page.getByLabel('To date')).toHaveAttribute('min', '2099-01-01')
  })

  test('filtering by a user shows only that user’s actions', async ({ page }) => {
    await page.goto('/activity')
    await page.getByLabel('Filter by user').selectOption({ label: 'Staff Acme' })
    const rows = page.locator('tbody tr')
    await expect(rows.first()).toContainText('staff@acme.test')
    for (const text of await rows.allInnerTexts()) {
      expect(text).toContain('staff@acme.test')
    }
  })
})

test.describe('dashboard', () => {
  test('shows organization, plan, stats and recent items; links work', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Acme Travels' })).toBeVisible()
    await expect(page.getByText('Pro').first()).toBeVisible()
    for (const label of ['Companies', 'Contacts', 'Team members', 'Changes (7 days)']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }
    await expect(page.getByText('Recent activity')).toBeVisible()

    await page.getByRole('link', { name: 'Full activity log' }).click()
    await expect(page.getByRole('heading', { name: 'Activity log' })).toBeVisible()
  })

  test('a new company appears in "Recently added" after creation', async ({ page }) => {
    const name = unique('Fresh Dash Co')
    await page.goto('/companies')
    await page.getByRole('button', { name: 'New company' }).click()
    await page.getByLabel('Company name').fill(name)
    await page.getByRole('button', { name: 'Create company' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)

    await page.getByRole('link', { name: 'Dashboard' }).click()
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()
  })

  test('Globex numbers are its own (2 companies, 2 contacts, 3 members)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile('globexAdmin') })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Globex Tours' })).toBeVisible()
    const stat = (label: string) => page.locator('div.rounded-xl').filter({ hasText: label }).locator('p.text-3xl')
    await expect(stat('Companies')).toHaveText('2')
    await expect(stat('Contacts')).toHaveText('2')
    await expect(stat('Team members')).toHaveText('3')
    await context.close()
  })
})

test.describe('small screens', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('navigation opens from the menu button and closes after choosing a page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.getByRole('link', { name: 'Companies' }).click()
    await expect(page.getByRole('heading', { name: 'Companies' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveCount(0)
  })
})
