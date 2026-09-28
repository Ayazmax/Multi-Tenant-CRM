import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { useAuthStore } from '@/store/authStore'
import type { ApiEnvelope, ListParams, Paginated } from '@/types'

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: FieldErrors

  constructor(message: string, status: number, fieldErrors: FieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export const apiClient = axios.create({ baseURL: API_BASE_URL, timeout: 20_000 })

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Concurrent 401s share a single refresh request.
let refreshInFlight: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const { refreshToken, setTokens } = useAuthStore.getState()
  if (!refreshToken) throw new ApiError('Session expired.', 401)

  const { data } = await axios.post<ApiEnvelope<{ access: string; refresh?: string }>>(
    `${API_BASE_URL}/auth/refresh/`,
    { refresh: refreshToken },
  )
  setTokens(data.data.access, data.data.refresh ?? refreshToken)
  return data.data.access
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

const SKIP_REFRESH_URLS = ['/auth/login/', '/auth/refresh/']

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined
    const canRefresh =
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !SKIP_REFRESH_URLS.some((url) => original.url?.includes(url)) &&
      useAuthStore.getState().refreshToken

    if (canRefresh) {
      original._retry = true
      try {
        refreshInFlight ??= refreshAccessToken().finally(() => {
          refreshInFlight = null
        })
        const token = await refreshInFlight
        original.headers.Authorization = `Bearer ${token}`
        return apiClient(original)
      } catch {
        useAuthStore.getState().clearSession()
        throw new ApiError('Your session has expired. Please sign in again.', 401)
      }
    }
    throw toApiError(error)
  },
)

function normalizeFieldErrors(errors: unknown): FieldErrors {
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return {}
  return Object.fromEntries(
    Object.entries(errors as Record<string, unknown>).map(([field, value]) => [
      field,
      Array.isArray(value) ? value.map(String) : [String(value)],
    ]),
  )
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new ApiError('Unable to reach the server. Please check your connection.', 0)
    }
    const body = error.response.data as Partial<ApiEnvelope<unknown>> | undefined
    return new ApiError(
      body?.message || error.message,
      error.response.status,
      normalizeFieldErrors(body?.errors),
    )
  }
  return new ApiError(error instanceof Error ? error.message : 'An unexpected error occurred.', 0)
}

function cleanParams(params?: ListParams) {
  if (!params) return undefined
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

export async function apiGet<T>(url: string, params?: ListParams): Promise<T> {
  const { data } = await apiClient.get<ApiEnvelope<T>>(url, { params: cleanParams(params) })
  return data.data
}

export async function apiGetPaginated<T>(url: string, params?: ListParams): Promise<Paginated<T>> {
  const { data } = await apiClient.get<ApiEnvelope<T[]>>(url, { params: cleanParams(params) })
  if (!data.meta?.pagination) throw new ApiError('Malformed paginated response.', 500)
  return { items: data.data, pagination: data.meta.pagination }
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await apiClient.post<ApiEnvelope<T>>(url, body)
  return data.data
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await apiClient.patch<ApiEnvelope<T>>(url, body)
  return data.data
}

export async function apiDelete(url: string): Promise<string> {
  const { data } = await apiClient.delete<ApiEnvelope<null>>(url)
  return data.message
}
