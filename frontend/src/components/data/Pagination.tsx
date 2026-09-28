import { clsx } from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import type { PaginationMeta } from '@/types'

interface PaginationProps {
  pagination: PaginationMeta | undefined
  onPageChange: (page: number) => void
  disabled?: boolean
}

function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, total, current - 1, current, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  return sorted.flatMap((page, index) => (index > 0 && page - sorted[index - 1] > 1 ? ['gap' as const, page] : [page]))
}

export function Pagination({ pagination, onPageChange, disabled = false }: PaginationProps) {
  if (!pagination || pagination.count === 0) return null

  const { page, page_size, count, total_pages } = pagination
  const from = (page - 1) * page_size + 1
  const to = Math.min(page * page_size, count)

  const navButton =
    'inline-flex size-8 items-center justify-center rounded-md text-slate-500 ring-1 ring-inset ring-slate-200 ' +
    'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <nav className="flex flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row" aria-label="Pagination">
      <p className="text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{from}</span>–
        <span className="font-medium text-slate-700">{to}</span> of{' '}
        <span className="font-medium text-slate-700">{count}</span>
      </p>
      {total_pages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={navButton}
            onClick={() => onPageChange(page - 1)}
            disabled={disabled || page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          {pageWindow(page, total_pages).map((item, index) =>
            item === 'gap' ? (
              <span key={`gap-${index}`} className="px-1 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                disabled={disabled}
                aria-current={item === page ? 'page' : undefined}
                className={clsx(
                  'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm',
                  item === page ? 'bg-indigo-600 font-medium text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            className={navButton}
            onClick={() => onPageChange(page + 1)}
            disabled={disabled || page >= total_pages}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </nav>
  )
}
