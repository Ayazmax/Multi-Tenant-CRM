import { Building2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { RoleGate } from '@/components/auth/RoleGate'
import { CompanyFormModal } from '@/components/crm/CompanyFormModal'
import { CompanyLogo } from '@/components/crm/CompanyLogo'
import { type Column, DataTable } from '@/components/data/DataTable'
import { Pagination } from '@/components/data/Pagination'
import { SearchInput } from '@/components/data/SearchInput'
import { EmptyState, ErrorState } from '@/components/feedback/States'
import { Card, PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Select } from '@/components/ui/FormControls'
import { useCompanies, useCompanyFilterOptions, useDeleteCompany } from '@/hooks/useCompanies'
import { useListState } from '@/hooks/useListState'
import { usePermission } from '@/hooks/usePermission'
import { formatDate } from '@/lib/format'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { Company } from '@/types'

type Dialog = { type: 'create' } | { type: 'edit'; company: Company } | { type: 'delete'; company: Company } | null

export function CompaniesPage() {
  const navigate = useNavigate()
  const can = usePermission()
  const list = useListState({ ordering: '-created_at', filters: { industry: '', country: '' } })
  const { data, isLoading, isFetching, error, refetch } = useCompanies(list.params)
  const { data: options } = useCompanyFilterOptions()
  const deleteCompany = useDeleteCompany()
  const [dialog, setDialog] = useState<Dialog>(null)

  const closeDialog = () => setDialog(null)

  const confirmDelete = () => {
    if (dialog?.type !== 'delete') return
    deleteCompany.mutate(dialog.company.id, {
      onSuccess: (message) => {
        notifySuccess(message)
        closeDialog()
        if (data && data.items.length === 1 && list.page > 1) list.setPage(list.page - 1)
      },
      onError: notifyError,
    })
  }

  const columns: Column<Company>[] = [
    {
      key: 'name',
      header: 'Company',
      sortKey: 'name',
      render: (company) => (
        <div className="flex items-center gap-3">
          <CompanyLogo name={company.name} src={company.logo} />
          <span className="font-medium text-slate-900">{company.name}</span>
        </div>
      ),
    },
    { key: 'industry', header: 'Industry', sortKey: 'industry', render: (c) => c.industry || '—' },
    { key: 'country', header: 'Country', sortKey: 'country', render: (c) => c.country || '—' },
    { key: 'contacts', header: 'Contacts', sortKey: 'contacts_count', render: (c) => c.contacts_count },
    { key: 'created', header: 'Created', sortKey: 'created_at', render: (c) => formatDate(c.created_at) },
  ]

  if (can('record:update') || can('record:delete')) {
    columns.push({
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      render: (company) => (
        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <RoleGate permission="record:update">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Edit ${company.name}`}
              icon={<Pencil className="size-4" />}
              onClick={() => setDialog({ type: 'edit', company })}
            />
          </RoleGate>
          <RoleGate permission="record:delete">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Delete ${company.name}`}
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              icon={<Trash2 className="size-4" />}
              onClick={() => setDialog({ type: 'delete', company })}
            />
          </RoleGate>
        </div>
      ),
    })
  }

  return (
    <>
      <PageHeader
        title="Companies"
        description="All companies that belong to your organization."
        actions={
          <RoleGate permission="record:create">
            <Button icon={<Plus className="size-4" />} onClick={() => setDialog({ type: 'create' })}>
              New company
            </Button>
          </RoleGate>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search name, industry or country…"
            label="Search companies"
          />
          <div className="flex gap-3">
            <Select
              aria-label="Filter by industry"
              value={list.filters.industry}
              onChange={(event) => list.setFilter('industry', event.target.value)}
              className="sm:w-44"
            >
              <option value="">All industries</option>
              {options?.industries.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by country"
              value={list.filters.country}
              onChange={(event) => list.setFilter('country', event.target.value)}
              className="sm:w-44"
            >
              <option value="">All countries</option>
              {options?.countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </Select>
          </div>
          {list.hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={list.resetFilters}>
              Clear filters
            </Button>
          )}
        </div>

        {error ? (
          <ErrorState message={toApiError(error).message} onRetry={() => refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data?.items ?? []}
              rowKey={(company) => company.id}
              isLoading={isLoading}
              isFetching={isFetching}
              ordering={list.ordering}
              onOrderingChange={list.setOrdering}
              onRowClick={(company) => navigate(`/companies/${company.id}`)}
              empty={
                <EmptyState
                  icon={<Building2 className="size-6" />}
                  title={list.hasActiveFilters ? 'No companies match your filters' : 'No companies yet'}
                  message={list.hasActiveFilters ? 'Try a different search or clear the filters.' : 'Create your first company to get started.'}
                />
              }
            />
            <div className="border-t border-slate-100">
              <Pagination pagination={data?.pagination} onPageChange={list.setPage} disabled={isFetching} />
            </div>
          </>
        )}
      </Card>

      {(dialog?.type === 'create' || dialog?.type === 'edit') && (
        <CompanyFormModal
          open
          onClose={closeDialog}
          company={dialog.type === 'edit' ? dialog.company : undefined}
          onSaved={(company) => {
            if (dialog.type === 'create') navigate(`/companies/${company.id}`)
          }}
        />
      )}

      <ConfirmDialog
        open={dialog?.type === 'delete'}
        title="Delete company"
        loading={deleteCompany.isPending}
        onCancel={closeDialog}
        onConfirm={confirmDelete}
        message={
          dialog?.type === 'delete' && (
            <>
              <strong className="text-slate-900">{dialog.company.name}</strong> and its{' '}
              {dialog.company.contacts_count} contact(s) will be removed. This action is recorded in the activity log.
            </>
          )
        }
      />
    </>
  )
}
