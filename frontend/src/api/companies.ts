import type { Company, CompanyFilterOptions, CompanyInput, ListParams } from '@/types'

import { apiDelete, apiGet, apiGetPaginated, apiPatch, apiPost } from './client'

function toFormData(input: Partial<CompanyInput>): FormData {
  const form = new FormData()
  if (input.name !== undefined) form.append('name', input.name)
  if (input.industry !== undefined) form.append('industry', input.industry)
  if (input.country !== undefined) form.append('country', input.country)
  if (input.logo instanceof File) form.append('logo', input.logo)
  if (input.remove_logo) form.append('remove_logo', 'true')
  return form
}

export const companiesApi = {
  list: (params?: ListParams) => apiGetPaginated<Company>('/companies/', params),
  get: (id: number) => apiGet<Company>(`/companies/${id}/`),
  create: (input: CompanyInput) => apiPost<Company>('/companies/', toFormData(input)),
  update: (id: number, input: Partial<CompanyInput>) => apiPatch<Company>(`/companies/${id}/`, toFormData(input)),
  remove: (id: number) => apiDelete(`/companies/${id}/`),
  filterOptions: () => apiGet<CompanyFilterOptions>('/companies/filter-options/'),
}
