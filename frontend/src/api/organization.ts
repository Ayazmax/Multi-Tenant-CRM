import type { ActivityLog, DashboardData, ListParams, OrganizationMember } from '@/types'

import { apiGet, apiGetPaginated } from './client'

export const organizationApi = {
  dashboard: () => apiGet<DashboardData>('/dashboard/'),
  members: () => apiGet<OrganizationMember[]>('/users/'),
  activityLogs: (params?: ListParams) => apiGetPaginated<ActivityLog>('/activity-logs/', params),
}
