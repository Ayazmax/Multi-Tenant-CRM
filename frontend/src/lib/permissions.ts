import type { Role } from '@/types'

/** Mirrors the backend role matrix; the API remains the source of truth. */
const PERMISSIONS = {
  'record:create': ['admin', 'manager', 'staff'],
  'record:update': ['admin', 'manager'],
  'record:delete': ['admin'],
  'activity:view': ['admin', 'manager'],
} as const satisfies Record<string, readonly Role[]>

export type Permission = keyof typeof PERMISSIONS

export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  return role !== undefined && (PERMISSIONS[permission] as readonly Role[]).includes(role)
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
}
