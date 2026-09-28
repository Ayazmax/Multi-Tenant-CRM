import type { Contact, ContactInput, ListParams } from '@/types'

import { apiDelete, apiGet, apiGetPaginated, apiPatch, apiPost } from './client'

export const contactsApi = {
  list: (params?: ListParams) => apiGetPaginated<Contact>('/contacts/', params),
  get: (id: number) => apiGet<Contact>(`/contacts/${id}/`),
  create: (input: ContactInput) => apiPost<Contact>('/contacts/', input),
  update: (id: number, input: Partial<ContactInput>) => apiPatch<Contact>(`/contacts/${id}/`, input),
  remove: (id: number) => apiDelete(`/contacts/${id}/`),
}
