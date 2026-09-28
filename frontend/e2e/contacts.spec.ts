import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

import { createCompany, createContact, findCompany, login, unique } from './support/api.ts'
import { API_URL, authFile } from './support/env.ts'

test.use({ storageState: authFile('admin') })

const contactDialog = (page: Page) => page.getByRole('dialog', { name: /Add contact|Edit contact/ })

async function companyWithContacts(request: APIRequestContext, contacts: { full_name: string; email: string }[] = []) {
  const { access } = await login(request, 'admin')
  const company = await createCompany(request, access, { name: unique('Contacts Co') })
  for (const contact of contacts) await createContact(request, access, { company: company.id, ...contact })
  return { company, access }
}

async function openAddContact(page: Page, companyId: number) {
  await page.goto(`/companies/${companyId}`)
  await page.getByRole('button', { name: 'Add contact' }).click()
  await expect(contactDialog(page)).toBeVisible()
  return contactDialog(page)
}

async function fillContact(page: Page, values: { name?: string; email?: string; phone?: string; role?: string }) {
  const dialog = contactDialog(page)
  if (values.name !== undefined) await dialog.getByLabel('Full name').fill(values.name)
  if (values.email !== undefined) await dialog.getByLabel('Email').fill(values.email)
  if (values.phone !== undefined) await dialog.getByLabel('Phone').fill(values.phone)
  if (values.role !== undefined) await dialog.getByLabel('Role').fill(values.role)
}

const submit = (page: Page) => contactDialog(page).getByRole('button', { name: /Add contact|Save changes/ }).click()

test.describe('contact form validation', () => {
  test('full name and email are required', async ({ page, request }) => {
    const { company } = await companyWithContacts(request)
    const dialog = await openAddContact(page, company.id)
    await submit(page)
    await expect(dialog.getByText('Full name is required.')).toBeVisible()
    await expect(dialog.getByText('Email is required.')).toBeVisible()
  })

  test('a name made only of spaces is rejected', async ({ page, request }) => {
    const { company } = await companyWithContacts(request)
    const dialog = await openAddContact(page, company.id)
    await fillContact(page, { name: '    ', email: 'spaces@example.com' })
    await submit(page)
    await expect(dialog.getByText('Full name is required.')).toBeVisible()
  })

  for (const email of ['john', 'john@', 'john@example', 'john smith@example.com', 'john@@example.com', '@example.com']) {
    test(`rejects invalid email "${email}"`, async ({ page, request }) => {
      const { company } = await companyWithContacts(request)
      const dialog = await openAddContact(page, company.id)
      await fillContact(page, { name: 'John Smith', email })
      await submit(page)
      await expect(dialog.getByText('Enter a valid email address.')).toBeVisible()
    })
  }

  const badPhones = [
    ['too short (7 digits)', '1234567'],
    ['letters', 'abcdefgh'],
    ['dashes', '050-123-4567'],
    ['spaces', '050 123 4567'],
    ['plus sign', '+971501234567'],
    ['brackets', '(050)1234567'],
    ['digits with a trailing letter', '12345678a'],
  ]
  for (const [label, phone] of badPhones) {
    test(`rejects phone with ${label}`, async ({ page, request }) => {
      const { company } = await companyWithContacts(request)
      const dialog = await openAddContact(page, company.id)
      await fillContact(page, { name: 'Phone Test', email: 'phone@example.com', phone })
      await submit(page)
      await expect(dialog.getByText('Phone must be 8 to 15 digits (numbers only).')).toBeVisible()
    })
  }

  test('phone field does not accept more than 15 characters', async ({ page, request }) => {
    const { company } = await companyWithContacts(request)
    const dialog = await openAddContact(page, company.id)
    await dialog.getByLabel('Phone').pressSequentially('1234567890123456789')
    await expect(dialog.getByLabel('Phone')).toHaveValue('123456789012345')
  })

  test('an error disappears as soon as the field is corrected', async ({ page, request }) => {
    const { company } = await companyWithContacts(request)
    const dialog = await openAddContact(page, company.id)
    await fillContact(page, { name: 'Fix Me', email: 'fix@', phone: '12' })
    await submit(page)
    await expect(dialog.getByText('Enter a valid email address.')).toBeVisible()
    await expect(dialog.getByText('Phone must be 8 to 15 digits (numbers only).')).toBeVisible()

    await dialog.getByLabel('Email').fill('fix@example.com')
    await expect(dialog.getByText('Enter a valid email address.')).toBeHidden()
    await expect(dialog.getByText('Phone must be 8 to 15 digits (numbers only).')).toBeVisible()
  })
})

test.describe('adding contacts', () => {
  test('phone is optional', async ({ page, request }) => {
    const { company } = await companyWithContacts(request)
    await openAddContact(page, company.id)
    await fillContact(page, { name: 'No Phone', email: 'nophone@example.com' })
    await submit(page)
    await expect(page.getByText('Contact added.')).toBeVisible()
    await expect(page.getByRole('row', { name: /No Phone/ })).toContainText('—')
  })

  for (const phone of ['12345678', '123456789012345', '00971501234567']) {
    test(`accepts boundary / leading-zero phone ${phone}`, async ({ page, request }) => {
      const { company } = await companyWithContacts(request)
      await openAddContact(page, company.id)
      await fillContact(page, { name: 'Phone Ok', email: `ok${phone}@example.com`, phone })
      await submit(page)
      await expect(page.getByRole('row', { name: /Phone Ok/ })).toContainText(phone)
    })
  }

  test('email is trimmed and saved in lowercase', async ({ page, request }) => {
    const { company } = await companyWithContacts(request)
    await openAddContact(page, company.id)
    await fillContact(page, { name: 'Case Person', email: '  Mixed.Case@Example.COM  ', role: '  Buyer  ' })
    await submit(page)
    const row = page.getByRole('row', { name: /Case Person/ })
    await expect(row).toContainText('mixed.case@example.com')
    await expect(row).toContainText('Buyer')
  })

  test('the same email twice in one company is rejected, even with different case', async ({ page, request }) => {
    const { company } = await companyWithContacts(request, [{ full_name: 'First', email: 'dup@example.com' }])
    const dialog = await openAddContact(page, company.id)
    await fillContact(page, { name: 'Second', email: 'DUP@example.com' })
    await submit(page)
    await expect(dialog.getByText('A contact with this email already exists in this company.')).toBeVisible()
    await expect(dialog.getByLabel('Full name')).toHaveValue('Second')
  })

  test('the same email is allowed in a different company', async ({ page, request }) => {
    const { access } = await companyWithContacts(request, [{ full_name: 'Elsewhere', email: 'shared@example.com' }])
    const other = await createCompany(request, access, { name: unique('Other Co') })
    await openAddContact(page, other.id)
    await fillContact(page, { name: 'Also Here', email: 'shared@example.com' })
    await submit(page)
    await expect(page.getByText('Contact added.')).toBeVisible()
  })

  test('a deleted contact’s email can be used again', async ({ page, request }) => {
    const { company } = await companyWithContacts(request, [{ full_name: 'Gone Soon', email: 'reuse@example.com' }])
    await page.goto(`/companies/${company.id}`)
    await page.getByRole('button', { name: 'Delete Gone Soon' }).click()
    await page.getByRole('dialog', { name: 'Delete contact' }).getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('No contacts yet')).toBeVisible()

    await page.getByRole('button', { name: 'Add contact' }).click()
    await fillContact(page, { name: 'Came Back', email: 'reuse@example.com' })
    await submit(page)
    await expect(page.getByRole('row', { name: /Came Back/ })).toBeVisible()
  })
})

test.describe('editing and deleting contacts', () => {
  test('saving without changing the email does not trigger the duplicate check', async ({ page, request }) => {
    const { company } = await companyWithContacts(request, [{ full_name: 'Keep Email', email: 'keep@example.com' }])
    await page.goto(`/companies/${company.id}`)
    await page.getByRole('button', { name: 'Edit Keep Email' }).click()
    await fillContact(page, { role: 'Promoted' })
    await submit(page)
    await expect(page.getByText('Contact updated.')).toBeVisible()
    await expect(page.getByRole('row', { name: /Keep Email/ })).toContainText('Promoted')
  })

  test('changing the email to a colleague’s email is rejected', async ({ page, request }) => {
    const { company } = await companyWithContacts(request, [
      { full_name: 'Alice', email: 'alice@example.com' },
      { full_name: 'Bob', email: 'bob@example.com' },
    ])
    await page.goto(`/companies/${company.id}`)
    await page.getByRole('button', { name: 'Edit Bob' }).click()
    await fillContact(page, { email: 'Alice@Example.com' })
    await submit(page)
    await expect(contactDialog(page).getByText('A contact with this email already exists in this company.')).toBeVisible()
  })

  test('delete asks for confirmation and updates the count', async ({ page, request }) => {
    const { company } = await companyWithContacts(request, [
      { full_name: 'Stay', email: 'stay@example.com' },
      { full_name: 'Leave', email: 'leave@example.com' },
    ])
    await page.goto(`/companies/${company.id}`)
    await expect(page.getByText('2 total')).toBeVisible()

    await page.getByRole('button', { name: 'Delete Leave' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete contact' })
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('2 total')).toBeVisible()

    await page.getByRole('button', { name: 'Delete Leave' }).click()
    await dialog.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Contact deleted successfully.')).toBeVisible()
    await expect(page.getByText('1 total')).toBeVisible()
    await expect(page.getByRole('row', { name: /Leave/ })).toHaveCount(0)
  })

  test('contact search filters the panel and shows an empty state', async ({ page, request }) => {
    const { company } = await companyWithContacts(request, [
      { full_name: 'Maria Lopez', email: 'maria@example.com' },
      { full_name: 'Tom Hardy', email: 'tom@example.com' },
    ])
    await page.goto(`/companies/${company.id}`)
    await page.getByPlaceholder('Search contacts…').fill('mari')
    await expect(page.getByRole('row', { name: /Maria Lopez/ })).toBeVisible()
    await expect(page.getByRole('row', { name: /Tom Hardy/ })).toHaveCount(0)

    await page.getByPlaceholder('Search contacts…').fill('nobody-here')
    await expect(page.getByText('No contacts match your search')).toBeVisible()
  })
})

test.describe('server-side validation when the UI is bypassed', () => {
  test('API rejects invalid email and phone even without the form', async ({ request }) => {
    const { company, access } = await companyWithContacts(request)
    const response = await request.post(`${API_URL}/contacts/`, {
      headers: { Authorization: `Bearer ${access}` },
      data: { company: company.id, full_name: 'Direct', email: 'not-an-email', phone: '12-34' },
    })
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(Object.keys(body.errors)).toEqual(expect.arrayContaining(['email', 'phone']))
  })

  test('API refuses to attach a contact to another organization’s company', async ({ request }) => {
    const { access } = await login(request, 'admin')
    const globex = await login(request, 'globexAdmin')
    const foreign = await findCompany(request, globex.access, 'Alpine Lodges')
    const response = await request.post(`${API_URL}/contacts/`, {
      headers: { Authorization: `Bearer ${access}` },
      data: { company: foreign.id, full_name: 'Sneaky', email: 'sneaky@example.com' },
    })
    expect(response.status()).toBe(400)
    expect((await response.json()).errors).toHaveProperty('company')
  })
})
