import { type APIRequestContext, expect } from '@playwright/test'

import { API_URL, DEMO_PASSWORD, USERS, type UserKey } from './env.ts'

export interface Session {
  access: string
  refresh: string
  user: Record<string, unknown>
}

export async function login(request: APIRequestContext, user: UserKey): Promise<Session> {
  const response = await request.post(`${API_URL}/auth/login/`, {
    data: { email: USERS[user], password: DEMO_PASSWORD },
  })
  expect(response.ok(), `login as ${user}`).toBeTruthy()
  return (await response.json()).data as Session
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

export interface CompanyRecord {
  id: number
  name: string
  industry: string
  country: string
}

export async function createCompany(
  request: APIRequestContext,
  token: string,
  data: { name: string; industry?: string; country?: string },
): Promise<CompanyRecord> {
  const response = await request.post(`${API_URL}/companies/`, { headers: auth(token), data })
  expect(response.status(), `create company ${data.name}`).toBe(201)
  return (await response.json()).data
}

export async function createContact(
  request: APIRequestContext,
  token: string,
  data: { company: number; full_name: string; email: string; phone?: string; role?: string },
) {
  const response = await request.post(`${API_URL}/contacts/`, { headers: auth(token), data })
  expect(response.status(), `create contact ${data.email}`).toBe(201)
  return (await response.json()).data as { id: number; email: string }
}

export async function findCompany(request: APIRequestContext, token: string, name: string): Promise<CompanyRecord> {
  const response = await request.get(`${API_URL}/companies/`, { headers: auth(token), params: { search: name } })
  const match = ((await response.json()).data as CompanyRecord[]).find((company) => company.name === name)
  if (!match) throw new Error(`Company "${name}" not found`)
  return match
}

export function apiCall(request: APIRequestContext, token: string) {
  return {
    get: (url: string) => request.get(`${API_URL}${url}`, { headers: auth(token) }),
    patch: (url: string, data: unknown) => request.patch(`${API_URL}${url}`, { headers: auth(token), data }),
    delete: (url: string) => request.delete(`${API_URL}${url}`, { headers: auth(token) }),
  }
}

let counter = 0
/** Unique, human-readable value so tests never collide with each other or with seed data. */
export function unique(prefix: string) {
  counter += 1
  return `${prefix} ${Date.now().toString(36)}${counter}`
}
