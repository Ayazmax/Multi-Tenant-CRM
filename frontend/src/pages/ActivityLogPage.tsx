import { ChevronDown, ChevronRight, History } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { Pagination } from '@/components/data/Pagination'
import { EmptyState, ErrorState } from '@/components/feedback/States'
import { Card, PageHeader } from '@/components/layout/PageHeader'
import { ActionBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/FormControls'
import { useListState } from '@/hooks/useListState'
import { useActivityLogs, useOrganizationMembers } from '@/hooks/useOrganization'
import { formatChangeValue, formatDateTime } from '@/lib/format'
import type { ActivityLog } from '@/types'

function ObjectCell({ log }: { log: ActivityLog }) {
  const label = (
    <>
      <span className="font-medium text-slate-900">{log.object_repr}</span>
      <span className="ml-1 text-xs text-slate-400">#{log.object_id}</span>
    </>
  )
  if (log.model_name === 'Company' && log.action !== 'DELETE') {
    return (
      <Link to={`/companies/${log.object_id}`} className="hover:underline">
        {label}
      </Link>
    )
  }
  return label
}

function ChangesTable({ changes }: { changes: ActivityLog['changes'] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-slate-500">
          <th className="py-1 pr-4 font-medium">Field</th>
          <th className="py-1 pr-4 font-medium">Before</th>
          <th className="py-1 font-medium">After</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(changes).map(([field, change]) => (
          <tr key={field} className="align-top">
            <td className="py-1 pr-4 font-medium text-slate-700">{field}</td>
            <td className="py-1 pr-4 break-all text-rose-700">{formatChangeValue(change.from)}</td>
            <td className="py-1 break-all text-emerald-700">{formatChangeValue(change.to)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ActivityLogPage() {
  const list = useListState({
    pageSize: 20,
    ordering: '-timestamp',
    filters: { action: '', model_name: '', user: '', date_from: '', date_to: '' },
  })
  const { data, isLoading, isFetching, error, refetch } = useActivityLogs(list.params)
  const { data: members } = useOrganizationMembers()
  const [expanded, setExpanded] = useState<number | null>(null)

  return (
    <>
      <PageHeader
        title="Activity log"
        description="An immutable audit trail of every create, update and delete in your organization."
      />

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <Select
            aria-label="Filter by action"
            value={list.filters.action}
            onChange={(event) => list.setFilter('action', event.target.value)}
          >
            <option value="">All actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </Select>
          <Select
            aria-label="Filter by record type"
            value={list.filters.model_name}
            onChange={(event) => list.setFilter('model_name', event.target.value)}
          >
            <option value="">All records</option>
            <option value="Company">Companies</option>
            <option value="Contact">Contacts</option>
          </Select>
          <Select
            aria-label="Filter by user"
            value={list.filters.user}
            onChange={(event) => list.setFilter('user', event.target.value)}
          >
            <option value="">All users</option>
            {members?.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            aria-label="From date"
            value={list.filters.date_from}
            max={list.filters.date_to || undefined}
            onChange={(event) => list.setFilter('date_from', event.target.value)}
          />
          <Input
            type="date"
            aria-label="To date"
            value={list.filters.date_to}
            min={list.filters.date_from || undefined}
            onChange={(event) => list.setFilter('date_to', event.target.value)}
          />
          <Button variant="ghost" onClick={list.resetFilters} disabled={!list.hasActiveFilters}>
            Clear filters
          </Button>
        </div>

        {error ? (
          <ErrorState message={toApiError(error).message} onRetry={() => refetch()} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <th className="w-8 px-4 py-3" />
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Record</th>
                  <th className="px-4 py-3">Object</th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-slate-100 bg-white ${isFetching && !isLoading ? 'opacity-60' : ''}`}>
                {isLoading &&
                  Array.from({ length: 6 }, (_, index) => (
                    <tr key={index}>
                      <td colSpan={6} className="px-4 py-4">
                        <div className="h-4 animate-pulse rounded bg-slate-100" />
                      </td>
                    </tr>
                  ))}
                {!isLoading &&
                  data?.items.map((log) => {
                    const hasChanges = Object.keys(log.changes).length > 0
                    const isOpen = expanded === log.id
                    return (
                      <Fragment key={log.id}>
                        <tr className={hasChanges ? 'cursor-pointer hover:bg-slate-50' : undefined}
                          onClick={hasChanges ? () => setExpanded(isOpen ? null : log.id) : undefined}
                        >
                          <td className="px-4 py-3 text-slate-400">
                            {hasChanges && (isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDateTime(log.timestamp)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-medium text-slate-900">{log.user.full_name}</p>
                            <p className="text-xs text-slate-500">{log.user.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <ActionBadge action={log.action} />
                          </td>
                          <td className="px-4 py-3 text-slate-600">{log.model_name}</td>
                          <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                            <ObjectCell log={log} />
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-slate-50/60">
                            <td />
                            <td colSpan={5} className="px-4 py-3">
                              <ChangesTable changes={log.changes} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                {!isLoading && data?.items.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={<History className="size-6" />}
                        title="No activity found"
                        message={list.hasActiveFilters ? 'Try adjusting the filters.' : 'Changes to companies and contacts will appear here.'}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-slate-100">
          <Pagination pagination={data?.pagination} onPageChange={list.setPage} disabled={isFetching} />
        </div>
      </Card>
    </>
  )
}
