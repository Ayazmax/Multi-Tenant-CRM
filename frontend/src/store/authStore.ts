import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { AuthSession, User } from '@/types'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  setSession: (session: AuthSession) => void
  setTokens: (access: string, refresh: string) => void
  setUser: (user: User) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: ({ access, refresh, user }) => set({ accessToken: access, refreshToken: refresh, user }),
      setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
      setUser: (user) => set({ user }),
      clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'crm-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ accessToken, refreshToken, user }) => ({ accessToken, refreshToken, user }),
    },
  ),
)

export const selectIsAuthenticated = (state: AuthState) => Boolean(state.accessToken && state.user)
