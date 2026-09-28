import type { ListParams } from '@/types'

export const queryKeys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  members: ['members'] as const,
  companies: {
    all: ['companies'] as const,
    list: (params: ListParams) => ['companies', 'list', params] as const,
    detail: (id: number) => ['companies', 'detail', id] as const,
    filterOptions: ['companies', 'filter-options'] as const,
  },
  contacts: {
    all: ['contacts'] as const,
    list: (params: ListParams) => ['contacts', 'list', params] as const,
  },
  activity: {
    all: ['activity'] as const,
    list: (params: ListParams) => ['activity', 'list', params] as const,
  },
}
