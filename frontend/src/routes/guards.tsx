import { ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { EmptyState } from '@/components/feedback/States'
import { usePermission } from '@/hooks/usePermission'
import type { Permission } from '@/lib/permissions'
import { selectIsAuthenticated, useAuthStore } from '@/store/authStore'

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}

export function PublicOnlyRoute() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />
}

export function PermissionRoute({ permission, children }: { permission: Permission; children: ReactNode }) {
  const can = usePermission()
  if (!can(permission)) {
    return (
      <EmptyState
        icon={<ShieldAlert className="size-6" />}
        title="Access restricted"
        message="Your role does not have permission to view this page."
      />
    )
  }
  return <>{children}</>
}
