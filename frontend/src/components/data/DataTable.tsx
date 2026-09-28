import { clsx } from 'clsx'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** API ordering field; makes the header clickable. */
  sortKey?: string
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  isLoading?: boolean
  isFetching?: boolean
  ordering?: string
  onOrderingChange?: (ordering: string) => void
  onRowClick?: (row: T) => void
  empty?: ReactNode
  skeletonRows?: number
}

function nextOrdering(current: string, sortKey: string) {
  if (current === sortKey) return `-${sortKey}`
  if (current === `-${sortKey}`) return ''
  return sortKey
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  isFetching = false,
  ordering = '',
  onOrderingChange,
  onRowClick,
  empty,
  skeletonRows = 5,
}: DataTableProps<T>) {
  const showEmpty = !isLoading && rows.length === 0

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => {
              const sortable = Boolean(column.sortKey && onOrderingChange)
              const active = column.sortKey && ordering.replace('-', '') === column.sortKey
              const SortIcon = !active ? ArrowUpDown : ordering.startsWith('-') ? ArrowDown : ArrowUp
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={active ? (ordering.startsWith('-') ? 'descending' : 'ascending') : undefined}
                  className={clsx(
                    'px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase',
                    column.className,
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 uppercase hover:text-slate-900"
                      onClick={() => onOrderingChange?.(nextOrdering(ordering, column.sortKey!))}
                    >
                      {column.header}
                      <SortIcon className={clsx('size-3.5', active ? 'text-indigo-600' : 'text-slate-300')} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody
          className={clsx('divide-y divide-slate-100 bg-white transition-opacity', isFetching && !isLoading && 'opacity-60')}
        >
          {isLoading &&
            Array.from({ length: skeletonRows }, (_, index) => (
              <tr key={`skeleton-${index}`}>
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-4">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                  </td>
                ))}
              </tr>
            ))}

          {!isLoading &&
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(onRowClick && 'cursor-pointer hover:bg-slate-50')}
              >
                {columns.map((column) => (
                  <td key={column.key} className={clsx('px-4 py-3 whitespace-nowrap text-slate-700', column.className)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}

          {showEmpty && (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
