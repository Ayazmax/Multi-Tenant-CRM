import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { authApi } from '@/api/auth'
import { selectIsAuthenticated, useAuthStore } from '@/store/authStore'

import { queryKeys } from './queryKeys'

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => authApi.login(email, password),
    onSuccess: (session) => {
      queryClient.clear()
      setSession(session)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return async () => {
    const { refreshToken, clearSession } = useAuthStore.getState()
    if (refreshToken) {
      // Best effort: the local session is cleared even if the server call fails.
      await authApi.logout(refreshToken).catch(() => undefined)
    }
    clearSession()
    queryClient.clear()
  }
}

/** Revalidates the stored session against the API and keeps the profile fresh. */
export function useCurrentUser() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const setUser = useAuthStore((s) => s.setUser)

  const query = useQuery({
    queryKey: queryKeys.me,
    queryFn: authApi.me,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (query.data) setUser(query.data)
  }, [query.data, setUser])

  return query
}
