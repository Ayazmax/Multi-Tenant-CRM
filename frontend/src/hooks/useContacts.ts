import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { contactsApi } from '@/api/contacts'
import type { ContactInput, ListParams } from '@/types'

import { queryKeys } from './queryKeys'

export function useContacts(params: ListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.contacts.list(params),
    queryFn: () => contactsApi.list(params),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  })
}

function useInvalidateContactData() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all }),
      // Company rows show a contact count.
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.activity.all }),
    ])
}

export function useCreateContact() {
  const invalidate = useInvalidateContactData()
  return useMutation({ mutationFn: (input: ContactInput) => contactsApi.create(input), onSuccess: invalidate })
}

export function useUpdateContact() {
  const invalidate = useInvalidateContactData()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<ContactInput> }) => contactsApi.update(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteContact() {
  const invalidate = useInvalidateContactData()
  return useMutation({ mutationFn: (id: number) => contactsApi.remove(id), onSuccess: invalidate })
}
