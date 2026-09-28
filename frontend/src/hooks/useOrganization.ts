import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { organizationApi } from '@/api/organization'
import type { ListParams } from '@/types'

import { queryKeys } from './queryKeys'

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: organizationApi.dashboard })
}

export function useOrganizationMembers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.members,
    queryFn: organizationApi.members,
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useActivityLogs(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.activity.list(params),
    queryFn: () => organizationApi.activityLogs(params),
    placeholderData: keepPreviousData,
  })
}
