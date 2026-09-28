import { expect, type Page, test } from '@playwright/test'

import { apiCall, createCompany, createContact, findCompany, login, unique } from './support/api.ts'
import { authFile } from './support/env.ts'

/** Seed companies can be pushed off page 1 by other tests, so search for one. */
async function openSkyline(page: Page) {
  await page.goto('/companies')
  await page.getByPlaceholder('Search name, industry or country…').fill('Skyline Airways')
}

test.describe('Staff: read and create only', () => {
  test.use({ storageState: authFile('staff') })

  test('sees no edit/delete controls and no activity log link', async ({ page }) => {
    await openSkyline(page)
    await expect(page.getByRole('cell', { name: 'Skyline Airways', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New company' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Activity log' })).toHaveCount(0)

    await page.getByRole('cell', { name: 'Skyline Airways', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Skyline Airways')
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add contact' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^(Edit|Delete) Sara Khan/ })).toHaveCount(0)
  })

  test('typing /activity directly shows "Access restricted"', async ({ page }) => {
    await page.goto('/activity')
    await expect(page.getByText('Access restricted')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Activity log' })).toHaveCount(0)
  })

  test('dashboard hides the activity widgets', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Acme Travels' })).toBeVisible()
    await expect(page.getByText('Changes (7 days)')).toHaveCount(0)
    await expect(page.getByText('Recent activity')).toHaveCount(0)
  })

  test('can create a company and add a contact', async ({ page }) => {
    const name = unique('Staff Made')
    await page.goto('/companies')
    await page.getByRole('button', { name: 'New company' }).click()
    await page.getByLabel('Company name').fill(name)
    await page.getByRole('button', { name: 'Create company' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)

    await page.getByRole('button', { name: 'Add contact' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add contact' })
    await dialog.getByLabel('Full name').fill('Staff Contact')
    await dialog.getByLabel('Email').fill('staffcontact@example.com')
    await dialog.getByRole('button', { name: 'Add contact' }).click()
    await expect(page.getByRole('row', { name: /Staff Contact/ })).toBeVisible()
  })

  test('the API refuses edits, deletes and the activity log even if called directly', async ({ request }) => {
    const staff = await login(request, 'staff')
    const admin = await login(request, 'admin')
    const company = await createCompany(request, admin.access, { name: unique('Staff Target') })
    const contact = await createContact(request, admin.access, {
      company: company.id,
      full_name: 'Target',
      email: `${Date.now()}@target.example`,
    })
    const api = apiCall(request, staff.access)

    expect((await api.patch(`/companies/${company.id}/`, { name: 'Hacked' })).status()).toBe(403)
    expect((await api.delete(`/companies/${company.id}/`)).status()).toBe(403)
    expect((await api.patch(`/contacts/${contact.id}/`, { role: 'Hacked' })).status()).toBe(403)
    expect((await api.delete(`/contacts/${contact.id}/`)).status()).toBe(403)
    expect((await api.get('/activity-logs/')).status()).toBe(403)
    expect((await api.get('/users/')).status()).toBe(403)
  })
})

test.describe('Manager: edit but not delete', () => {
  test.use({ storageState: authFile('manager') })

  test('sees edit controls but no delete controls', async ({ page }) => {
    await openSkyline(page)
    await expect(page.getByRole('button', { name: 'Edit Skyline Airways' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0)

    await page.getByRole('cell', { name: 'Skyline Airways', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit Sara Khan' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete Sara Khan' })).toHaveCount(0)
  })

  test('can open the activity log', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Activity log' }).first().click()
    await expect(page.getByRole('heading', { name: 'Activity log' })).toBeVisible()
  })

  test('the API refuses deletes', async ({ request }) => {
    const manager = await login(request, 'manager')
    const company = await createCompany(request, manager.access, { name: unique('Manager Target') })
    const api = apiCall(request, manager.access)
    expect((await api.patch(`/companies/${company.id}/`, { industry: 'Updated' })).status()).toBe(200)
    expect((await api.delete(`/companies/${company.id}/`)).status()).toBe(403)
  })
})

test.describe('Admin: full control', () => {
  test.use({ storageState: authFile('admin') })

  test('sees both edit and delete controls', async ({ page }) => {
    await openSkyline(page)
    await expect(page.getByRole('button', { name: 'Edit Skyline Airways' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete Skyline Airways' })).toBeVisible()
  })

  test('nobody can edit or delete activity log entries', async ({ request }) => {
    const admin = await login(request, 'admin')
    const api = apiCall(request, admin.access)
    const logs = await (await api.get('/activity-logs/')).json()
    const id = logs.data[0].id
    expect((await api.patch(`/activity-logs/${id}/`, { action: 'CREATE' })).status()).toBe(405)
    expect((await api.delete(`/activity-logs/${id}/`)).status()).toBe(405)
  })
})

test.describe('tenant isolation', () => {
  test.use({ storageState: authFile('globexAdmin') })

  test('Globex sees only its own organization, companies and numbers', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Globex Tours' })).toBeVisible()
    await expect(page.getByText('Basic').first()).toBeVisible()

    await page.goto('/companies')
    await expect(page.getByRole('cell', { name: 'Alpine Lodges', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Skyline Airways', exact: true })).toHaveCount(0)

    await page.getByPlaceholder('Search name, industry or country…').fill('Skyline')
    await expect(page.getByText('No companies match your filters')).toBeVisible()
  })

  test('an Acme company URL is "not found" for Globex', async ({ page, request }) => {
    const acme = await login(request, 'admin')
    const acmeCompany = await findCompany(request, acme.access, 'Skyline Airways')
    await page.goto(`/companies/${acmeCompany.id}`)
    await expect(page.getByText('Company not found')).toBeVisible()
  })

  test('the API hides and protects the other tenant’s records', async ({ request }) => {
    const acme = await login(request, 'admin')
    const globex = await login(request, 'globexAdmin')
    const acmeCompany = await findCompany(request, acme.access, 'Nordic Cruises')
    const api = apiCall(request, globex.access)

    expect((await api.get(`/companies/${acmeCompany.id}/`)).status()).toBe(404)
    expect((await api.patch(`/companies/${acmeCompany.id}/`, { name: 'Stolen' })).status()).toBe(404)
    expect((await api.delete(`/companies/${acmeCompany.id}/`)).status()).toBe(404)

    const contacts = await (await api.get(`/contacts/?company=${acmeCompany.id}`)).json()
    expect(contacts.data).toEqual([])

    const logs = await (await api.get('/activity-logs/?search=Nordic')).json()
    expect(logs.data).toEqual([])

    expect((await apiCall(request, acme.access).get(`/companies/${acmeCompany.id}/`)).status()).toBe(200)
  })
})
