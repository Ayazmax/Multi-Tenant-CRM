import { useCallback } from 'react'

import { hasPermission, type Permission } from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'

export function usePermission() {
  const role = useAuthStore((s) => s.user?.role)
  return useCallback((permission: Permission) => hasPermission(role, permission), [role])
}
