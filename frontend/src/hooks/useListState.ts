import { useCallback, useMemo, useState } from 'react'

import type { ListParams, QueryParamValue } from '@/types'

import { useDebouncedValue } from './useDebouncedValue'

interface ListStateOptions {
  pageSize?: number
  ordering?: string
  filters?: Record<string, string>
}

/**
 * Pagination, debounced search, ordering and filters for a list view.
 * Any change other than the page itself resets to page 1.
 */
export function useListState({ pageSize = 10, ordering = '', filters: initialFilters = {} }: ListStateOptions = {}) {
  const [page, setPage] = useState(1)
  const [search, setSearchValue] = useState('')
  const [orderingValue, setOrderingValue] = useState(ordering)
  const [defaultFilters] = useState(initialFilters)
  const [filters, setFiltersValue] = useState<Record<string, string>>(defaultFilters)
  const debouncedSearch = useDebouncedValue(search)

  const setSearch = useCallback((value: string) => {
    setSearchValue(value)
    setPage(1)
  }, [])

  const setOrdering = useCallback((value: string) => {
    setOrderingValue(value)
    setPage(1)
  }, [])

  const setFilter = useCallback((key: string, value: string) => {
    setFiltersValue((current) => ({ ...current, [key]: value }))
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersValue(defaultFilters)
    setSearchValue('')
    setPage(1)
  }, [defaultFilters])

  const params = useMemo<ListParams>(() => {
    const extra: Record<string, QueryParamValue> = filters
    return { page, page_size: pageSize, search: debouncedSearch.trim(), ordering: orderingValue, ...extra }
  }, [page, pageSize, debouncedSearch, orderingValue, filters])

  const hasActiveFilters = search.trim() !== '' || Object.values(filters).some(Boolean)

  return {
    params,
    page,
    setPage,
    search,
    setSearch,
    ordering: orderingValue,
    setOrdering,
    filters,
    setFilter,
    resetFilters,
    hasActiveFilters,
  }
}
