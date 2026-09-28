import type { ReactNode } from 'react'

import { usePermission } from '@/hooks/usePermission'
import type { Permission } from '@/lib/permissions'

interface RoleGateProps {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}

/** Renders children only when the current user's role grants the permission. */
export function RoleGate({ permission, children, fallback = null }: RoleGateProps) {
  const can = usePermission()
  return <>{can(permission) ? children : fallback}</>
}
