import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { companiesApi } from '@/api/companies'
import type { CompanyInput, ListParams } from '@/types'

import { queryKeys } from './queryKeys'

export function useCompanies(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.companies.list(params),
    queryFn: () => companiesApi.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useCompany(id: number) {
  return useQuery({
    queryKey: queryKeys.companies.detail(id),
    queryFn: () => companiesApi.get(id),
    enabled: Number.isFinite(id),
  })
}

export function useCompanyFilterOptions() {
  return useQuery({
    queryKey: queryKeys.companies.filterOptions,
    queryFn: companiesApi.filterOptions,
    staleTime: 60_000,
  })
}

function useInvalidateCompanyData() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.activity.all }),
    ])
}

export function useCreateCompany() {
  const invalidate = useInvalidateCompanyData()
  return useMutation({ mutationFn: (input: CompanyInput) => companiesApi.create(input), onSuccess: invalidate })
}

export function useUpdateCompany() {
  const invalidate = useInvalidateCompanyData()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<CompanyInput> }) => companiesApi.update(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteCompany() {
  const invalidate = useInvalidateCompanyData()
  return useMutation({ mutationFn: (id: number) => companiesApi.remove(id), onSuccess: invalidate })
}
