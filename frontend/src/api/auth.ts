import type { AuthSession, User } from '@/types'

import { apiGet, apiPost } from './client'

export const authApi = {
  login: (email: string, password: string) => apiPost<AuthSession>('/auth/login/', { email, password }),
  logout: (refresh: string) => apiPost<null>('/auth/logout/', { refresh }),
  me: () => apiGet<User>('/auth/me/'),
}
