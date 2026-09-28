import { expect, type Page, test } from '@playwright/test'

import { apiCall, createCompany, createContact, findCompany, login, unique } from './support/api.ts'
import { authFile } from './support/env.ts'
import { files } from './support/files.ts'

test.use({ storageState: authFile('admin') })

const newCompanyDialog = (page: Page) => page.getByRole('dialog', { name: 'New company' })
const editCompanyDialog = (page: Page) => page.getByRole('dialog', { name: 'Edit company' })

async function openNewCompany(page: Page) {
  await page.goto('/companies')
  await page.getByRole('button', { name: 'New company' }).click()
  await expect(newCompanyDialog(page)).toBeVisible()
  return newCompanyDialog(page)
}

async function search(page: Page, text: string) {
  await page.getByPlaceholder('Search name, industry or country…').fill(text)
}

/** Many companies are listed again (the seed data alone has four). */
async function expectUnfilteredList(page: Page) {
  await expect.poll(() => page.locator('tbody tr').count()).toBeGreaterThanOrEqual(4)
}

test.describe('create company: validation', () => {
  test('name is required', async ({ page }) => {
    const dialog = await openNewCompany(page)
    await dialog.getByLabel('Industry').fill('Aviation')
    await page.getByRole('button', { name: 'Create company' }).click()
    await expect(dialog.getByText('Company name is required.')).toBeVisible()
    await expect(dialog.getByLabel('Industry')).toHaveValue('Aviation')
  })

  test('a name made only of spaces is rejected', async ({ page }) => {
    const dialog = await openNewCompany(page)
    await dialog.getByLabel('Company name').fill('     ')
    await page.getByRole('button', { name: 'Create company' }).click()
    await expect(dialog.getByText('Company name is required.')).toBeVisible()
  })

  test('duplicate name is rejected regardless of case and spacing', async ({ page }) => {
    const dialog = await openNewCompany(page)
    await dialog.getByLabel('Company name').fill('  sKyLiNe AIRWAYS  ')
    await dialog.getByLabel('Country').fill('Somewhere')
    await page.getByRole('button', { name: 'Create company' }).click()

    await expect(dialog.getByText('A company with this name already exists in your organization.')).toBeVisible()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Country')).toHaveValue('Somewhere')
  })

  test('the same name can exist in a different organization', async ({ page, request }) => {
    // "Coral Coast Diving" belongs to Globex in the seed data.
    const dialog = await openNewCompany(page)
    await dialog.getByLabel('Company name').fill('Coral Coast Diving')
    await page.getByRole('button', { name: 'Create company' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Coral Coast Diving')

    const { access } = await login(request, 'admin')
    const id = Number(page.url().split('/').pop())
    expect((await apiCall(request, access).delete(`/companies/${id}/`)).status()).toBe(200)
  })

  const rejectedFiles = [
    { label: 'PDF', file: files.pdf, message: 'Logo must be a PNG, JPEG or WebP image.' },
    { label: 'SVG (can carry scripts)', file: files.svg, message: 'Logo must be a PNG, JPEG or WebP image.' },
    { label: 'image over 2 MB', file: files.oversized, message: 'Logo must be 2 MB or smaller.' },
  ]
  for (const { label, file, message } of rejectedFiles) {
    test(`logo upload rejects ${label} before sending`, async ({ page }) => {
      const dialog = await openNewCompany(page)
      await dialog.locator('#company-logo').setInputFiles(file)
      await expect(dialog.getByText(message)).toBeVisible()
      await expect(dialog.getByRole('img')).toHaveCount(0)
    })
  }

  test('a text file renamed to .png is rejected by the server', async ({ page }) => {
    const dialog = await openNewCompany(page)
    await dialog.getByLabel('Company name').fill(unique('Fake Logo Co'))
    await dialog.locator('#company-logo').setInputFiles(files.fakePng)
    await page.getByRole('button', { name: 'Create company' }).click()
    await expect(dialog.getByText(/valid image/i)).toBeVisible()
    await expect(dialog).toBeVisible()
  })

  test('HTML in the name is shown as text, never executed', async ({ page }) => {
    const name = `<img src=x onerror="window.__xss=1"> ${unique('Xss')}`
    const dialog = await openNewCompany(page)
    await dialog.getByLabel('Company name').fill(name)
    await page.getByRole('button', { name: 'Create company' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  })
})

test.describe('create company: happy paths', () => {
  test('name only: trims spaces, opens the detail page and shows placeholders', async ({ page }) => {
    const name = unique('Minimal Co')
    const dialog = await openNewCompany(page)
    await dialog.getByLabel('Company name').fill(`   ${name}   `)
    await page.getByRole('button', { name: 'Create company' }).click()

    await expect(page.getByText('Company created.')).toBeVisible()
    await expect(page).toHaveURL(/\/companies\/\d+$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
    await expect(page.getByText('No industry or country set')).toBeVisible()
    await expect(page.getByText('No contacts yet')).toBeVisible()
  })

  test('unicode and emoji names are stored correctly', async ({ page }) => {
    const name = `Café Zürich 東京 🚀 ${unique('')}`.trim()
    const dialog = await openNewCompany(page)
    await dialog.getByLabel('Company name').fill(name)
    await page.getByRole('button', { name: 'Create company' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
  })

  test('valid PNG logo shows a preview and is saved', async ({ page }) => {
    const name = unique('Logo Co')
    const dialog = await openNewCompany(page)
    await dialog.getByLabel('Company name').fill(name)
    await dialog.locator('#company-logo').setInputFiles(files.png)
    await expect(dialog.getByRole('img', { name: `${name} logo` })).toBeVisible()
    await page.getByRole('button', { name: 'Create company' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
    const logo = page.getByRole('img', { name: `${name} logo` })
    await expect(logo).toBeVisible()
    await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  })

  test('removing a picked logo before saving creates the company without one', async ({ page }) => {
    const name = unique('Changed Mind Co')
    const dialog = await openNewCompany(page)
    await dialog.getByLabel('Company name').fill(name)
    await dialog.locator('#company-logo').setInputFiles(files.png)
    await dialog.getByRole('button', { name: 'Remove' }).click()
    await expect(dialog.getByRole('img')).toHaveCount(0)
    await page.getByRole('button', { name: 'Create company' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
    await expect(page.getByRole('img', { name: `${name} logo` })).toHaveCount(0)
  })

  test('double-clicking Create makes only one company', async ({ page, request }) => {
    const name = unique('Double Click Co')
    let creates = 0
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/companies\/$/.test(req.url())) creates += 1
    })
    const dialog = await openNewCompany(page)
    await dialog.getByLabel('Company name').fill(name)
    await page.getByRole('button', { name: 'Create company' }).dblclick()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
    expect(creates).toBe(1)

    const { access } = await login(request, 'admin')
    const response = await apiCall(request, access).get(`/companies/?search=${encodeURIComponent(name)}`)
    expect((await response.json()).meta.pagination.count).toBe(1)
  })
})

test.describe('dialogs', () => {
  test('Escape, the close button and the backdrop all close without saving', async ({ page }) => {
    const name = unique('Never Saved')
    const dialog = await openNewCompany(page)
    await dialog.getByLabel('Company name').fill(name)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await page.getByRole('button', { name: 'New company' }).click()
    await expect(dialog.getByLabel('Company name')).toHaveValue('')
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toBeHidden()

    await page.getByRole('button', { name: 'New company' }).click()
    await page.mouse.click(5, 5)
    await expect(dialog).toBeHidden()

    await search(page, name)
    await expect(page.getByText('No companies match your filters')).toBeVisible()
  })
})

test.describe('edit company', () => {
  test('changes are saved and shown on the detail page', async ({ page, request }) => {
    const { access } = await login(request, 'admin')
    const company = await createCompany(request, access, { name: unique('Edit Me'), industry: 'Old', country: 'Oldland' })

    await page.goto(`/companies/${company.id}`)
    await page.getByRole('button', { name: 'Edit' }).click()
    const dialog = editCompanyDialog(page)
    await expect(dialog.getByLabel('Company name')).toHaveValue(company.name)
    await dialog.getByLabel('Country').fill('Newland')
    await dialog.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Company updated.')).toBeVisible()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Old · Newland')).toBeVisible()
  })

  test('Cancel discards unsaved edits', async ({ page, request }) => {
    const { access } = await login(request, 'admin')
    const company = await createCompany(request, access, { name: unique('Keep Me') })

    await page.goto(`/companies/${company.id}`)
    await page.getByRole('button', { name: 'Edit' }).click()
    await editCompanyDialog(page).getByLabel('Company name').fill('Accidental rename')
    await editCompanyDialog(page).getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(company.name)
    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(editCompanyDialog(page).getByLabel('Company name')).toHaveValue(company.name)
  })

  test('renaming to another existing company is blocked, changing only the case of its own name is allowed', async ({
    page,
    request,
  }) => {
    const { access } = await login(request, 'admin')
    const company = await createCompany(request, access, { name: unique('rename target') })

    await page.goto(`/companies/${company.id}`)
    await page.getByRole('button', { name: 'Edit' }).click()
    const dialog = editCompanyDialog(page)
    await dialog.getByLabel('Company name').fill('Nordic Cruises')
    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(dialog.getByText('A company with this name already exists in your organization.')).toBeVisible()

    await dialog.getByLabel('Company name').fill(company.name.toUpperCase())
    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(company.name.toUpperCase())
  })

  test('clearing the name while editing is rejected', async ({ page, request }) => {
    const { access } = await login(request, 'admin')
    const company = await createCompany(request, access, { name: unique('Do Not Blank') })

    await page.goto(`/companies/${company.id}`)
    await page.getByRole('button', { name: 'Edit' }).click()
    await editCompanyDialog(page).getByLabel('Company name').fill('')
    await editCompanyDialog(page).getByRole('button', { name: 'Save changes' }).click()
    await expect(editCompanyDialog(page).getByText('Company name is required.')).toBeVisible()
  })

  test('logo can be added and then removed', async ({ page, request }) => {
    const { access } = await login(request, 'admin')
    const company = await createCompany(request, access, { name: unique('Logo Swap') })
    const logo = page.getByRole('img', { name: `${company.name} logo` })

    await page.goto(`/companies/${company.id}`)
    await page.getByRole('button', { name: 'Edit' }).click()
    await editCompanyDialog(page).locator('#company-logo').setInputFiles(files.png)
    await editCompanyDialog(page).getByRole('button', { name: 'Save changes' }).click()
    await expect(editCompanyDialog(page)).toBeHidden()
    await expect(logo).toBeVisible()

    await page.getByRole('button', { name: 'Edit' }).click()
    await editCompanyDialog(page).getByRole('button', { name: 'Remove' }).click()
    await editCompanyDialog(page).getByRole('button', { name: 'Save changes' }).click()
    await expect(editCompanyDialog(page)).toBeHidden()
    await expect(logo).toHaveCount(0)
  })
})

test.describe('delete company', () => {
  test('Cancel keeps the company', async ({ page, request }) => {
    const { access } = await login(request, 'admin')
    const company = await createCompany(request, access, { name: unique('Almost Deleted') })

    await page.goto('/companies')
    await search(page, company.name)
    await page.getByRole('button', { name: `Delete ${company.name}` }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete company' })
    await expect(dialog).toContainText(company.name)
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    await expect(dialog).toBeHidden()
    await expect(page.getByRole('cell', { name: company.name, exact: true })).toBeVisible()
  })

  test('confirming removes it, its URL becomes "not found" and the name can be reused', async ({ page, request }) => {
    const { access } = await login(request, 'admin')
    const company = await createCompany(request, access, { name: unique('Delete Me') })

    await page.goto('/companies')
    await search(page, company.name)
    await page.getByRole('button', { name: `Delete ${company.name}` }).click()
    await page.getByRole('dialog', { name: 'Delete company' }).getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Company deleted successfully.')).toBeVisible()
    await expect(page.getByText('No companies match your filters')).toBeVisible()

    await page.goto(`/companies/${company.id}`)
    await expect(page.getByText('Company not found')).toBeVisible()

    const recreated = await createCompany(request, access, { name: company.name })
    expect(recreated.id).not.toBe(company.id)
  })

  test('deleting from the detail page also removes its contacts', async ({ page, request }) => {
    const { access } = await login(request, 'admin')
    const company = await createCompany(request, access, { name: unique('Cascade Co') })
    const contact = await createContact(request, access, {
      company: company.id,
      full_name: 'Cascade Person',
      email: `${Date.now()}@cascade.example`,
    })

    await page.goto(`/companies/${company.id}`)
    await expect(page.getByText('Cascade Person')).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete company' })
    await expect(dialog).toContainText('1 contact(s)')
    await dialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page).toHaveURL(/\/companies$/)
    expect((await apiCall(request, access).get(`/contacts/${contact.id}/`)).status()).toBe(404)
  })
})

test.describe('list: search, filters, sorting, pagination', () => {
  test('search is partial and case-insensitive, with an empty state and a reset', async ({ page }) => {
    await page.goto('/companies')
    await search(page, 'SKYL')
    await expect(page.getByRole('cell', { name: 'Skyline Airways', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Nordic Cruises', exact: true })).toHaveCount(0)

    await search(page, 'zzz-no-such-company')
    await expect(page.getByText('No companies match your filters')).toBeVisible()

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByPlaceholder('Search name, industry or country…')).toHaveValue('')
    await expectUnfilteredList(page)
  })

  test('search also matches industry and country', async ({ page }) => {
    await page.goto('/companies')
    await search(page, 'maldives')
    await expect(page.getByRole('cell', { name: 'Blue Lagoon Resorts', exact: true })).toBeVisible()
    await search(page, 'cruise')
    await expect(page.getByRole('cell', { name: 'Nordic Cruises', exact: true })).toBeVisible()
  })

  // Wildcards must be matched literally, and SQL-looking input must be treated as plain text.
  for (const text of ['%', '"; DROP TABLE crm_company; --', '\\']) {
    test(`special characters in search are matched literally: ${text}`, async ({ page }) => {
      await page.goto('/companies')
      await search(page, text)
      await expect(page.getByText('No companies match your filters')).toBeVisible()
      await expect(page.getByText(/could not|unexpected/i)).toHaveCount(0)
    })
  }

  test('a lone quote in search is ignored instead of crashing', async ({ page }) => {
    await page.goto('/companies')
    await search(page, "'")
    await expectUnfilteredList(page)
    await expect(page.getByText(/could not|unexpected/i)).toHaveCount(0)
  })

  test('industry filter narrows the list and can be cleared', async ({ page }) => {
    await page.goto('/companies')
    const industry = page.getByLabel('Filter by industry')
    await expect(industry.locator('option', { hasText: 'Cruise' })).toHaveCount(1)
    await industry.selectOption('Cruise')

    await expect(page.getByRole('cell', { name: 'Nordic Cruises', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Skyline Airways', exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(industry).toHaveValue('')
    await expectUnfilteredList(page)
  })

  test('clicking a column header cycles ascending, descending and off', async ({ page }) => {
    await page.goto('/companies')
    const header = page.getByRole('columnheader', { name: 'Company' })
    await header.getByRole('button').click()
    await expect(header).toHaveAttribute('aria-sort', 'ascending')
    await header.getByRole('button').click()
    await expect(header).toHaveAttribute('aria-sort', 'descending')
    await header.getByRole('button').click()
    await expect(header).not.toHaveAttribute('aria-sort')
  })

  test('pagination moves between pages and a new search returns to page 1', async ({ page, request }) => {
    const { access } = await login(request, 'admin')
    const prefix = unique('Paged')
    for (let index = 1; index <= 12; index += 1) {
      await createCompany(request, access, { name: `${prefix} #${index}` })
    }

    await page.goto('/companies')
    await search(page, prefix)
    const pagination = page.getByRole('navigation', { name: 'Pagination' })
    await expect(pagination).toContainText('Showing 1–10 of 12')
    await expect(pagination.getByRole('button', { name: 'Previous page' })).toBeDisabled()

    await pagination.getByRole('button', { name: 'Next page' }).click()
    await expect(pagination).toContainText('Showing 11–12 of 12')
    await expect(pagination.getByRole('button', { name: 'Next page' })).toBeDisabled()

    // "#1" matches #1, #10, #11 and #12.
    await search(page, `${prefix} #1`)
    await expect(pagination).toContainText('Showing 1–4 of 4')
  })

  test('clicking a row opens the company', async ({ page }) => {
    await page.goto('/companies')
    await search(page, 'Nordic')
    await page.getByRole('cell', { name: 'Nordic Cruises', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nordic Cruises')
    await page.getByRole('link', { name: 'Companies' }).first().click()
    await expect(page).toHaveURL(/\/companies$/)
  })
})

test.describe('broken or hand-typed URLs', () => {
  for (const id of ['abc', '0', '-1', '1.5', '99999999']) {
    test(`/companies/${id} shows "Company not found"`, async ({ page }) => {
      await page.goto(`/companies/${id}`)
      await expect(page.getByText('Company not found')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Companies' }).first()).toBeVisible()
    })
  }

  test('a company id from another organization is "not found", not "forbidden"', async ({ page, request }) => {
    const globex = await login(request, 'globexAdmin')
    const foreign = await findCompany(request, globex.access, 'Alpine Lodges')
    await page.goto(`/companies/${foreign.id}`)
    await expect(page.getByText('Company not found')).toBeVisible()
    await expect(page.getByText('Alpine Lodges')).toHaveCount(0)
  })
})
