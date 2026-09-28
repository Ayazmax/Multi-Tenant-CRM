import { Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'

import { toApiError } from '@/api/client'
import { RoleGate } from '@/components/auth/RoleGate'
import { type Column, DataTable } from '@/components/data/DataTable'
import { Pagination } from '@/components/data/Pagination'
import { SearchInput } from '@/components/data/SearchInput'
import { EmptyState, ErrorState } from '@/components/feedback/States'
import { Card } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useContacts, useDeleteContact } from '@/hooks/useContacts'
import { useListState } from '@/hooks/useListState'
import { usePermission } from '@/hooks/usePermission'
import { formatDate } from '@/lib/format'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { Contact } from '@/types'

import { ContactFormModal } from './ContactFormModal'

type Dialog = { type: 'create' } | { type: 'edit'; contact: Contact } | { type: 'delete'; contact: Contact } | null

export function ContactsPanel({ companyId }: { companyId: number }) {
  const can = usePermission()
  const list = useListState({ ordering: 'full_name', filters: { company: String(companyId) } })
  const { data, isLoading, isFetching, error, refetch } = useContacts(list.params)
  const deleteContact = useDeleteContact()
  const [dialog, setDialog] = useState<Dialog>(null)

  const closeDialog = () => setDialog(null)

  const confirmDelete = () => {
    if (dialog?.type !== 'delete') return
    deleteContact.mutate(dialog.contact.id, {
      onSuccess: (message) => {
        notifySuccess(message)
        closeDialog()
        if (data && data.items.length === 1 && list.page > 1) list.setPage(list.page - 1)
      },
      onError: notifyError,
    })
  }

  const columns: Column<Contact>[] = [
    {
      key: 'name',
      header: 'Name',
      sortKey: 'full_name',
      render: (contact) => <span className="font-medium text-slate-900">{contact.full_name}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      sortKey: 'email',
      render: (contact) => (
        <a href={`mailto:${contact.email}`} className="text-indigo-600 hover:underline">
          {contact.email}
        </a>
      ),
    },
    { key: 'phone', header: 'Phone', render: (contact) => contact.phone || '—' },
    { key: 'role', header: 'Role', sortKey: 'role', render: (contact) => contact.role || '—' },
    { key: 'created', header: 'Added', sortKey: 'created_at', render: (contact) => formatDate(contact.created_at) },
  ]

  if (can('record:update') || can('record:delete')) {
    columns.push({
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      render: (contact) => (
        <div className="flex justify-end gap-1">
          <RoleGate permission="record:update">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Edit ${contact.full_name}`}
              icon={<Pencil className="size-4" />}
              onClick={() => setDialog({ type: 'edit', contact })}
            />
          </RoleGate>
          <RoleGate permission="record:delete">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Delete ${contact.full_name}`}
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              icon={<Trash2 className="size-4" />}
              onClick={() => setDialog({ type: 'delete', contact })}
            />
          </RoleGate>
        </div>
      ),
    })
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Contacts</h2>
          {data && <span className="text-xs text-slate-500">{data.pagination.count} total</span>}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search contacts…" label="Search contacts" />
          <RoleGate permission="record:create">
            <Button icon={<Plus className="size-4" />} onClick={() => setDialog({ type: 'create' })}>
              Add contact
            </Button>
          </RoleGate>
        </div>
      </div>

      {error ? (
        <ErrorState message={toApiError(error).message} onRetry={() => refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(contact) => contact.id}
            isLoading={isLoading}
            isFetching={isFetching}
            ordering={list.ordering}
            onOrderingChange={list.setOrdering}
            skeletonRows={3}
            empty={
              <EmptyState
                icon={<UserRound className="size-6" />}
                title={list.search ? 'No contacts match your search' : 'No contacts yet'}
                message={list.search ? undefined : 'Add the people you work with at this company.'}
              />
            }
          />
          <div className="border-t border-slate-100">
            <Pagination pagination={data?.pagination} onPageChange={list.setPage} disabled={isFetching} />
          </div>
        </>
      )}

      {(dialog?.type === 'create' || dialog?.type === 'edit') && (
        <ContactFormModal
          open
          onClose={closeDialog}
          companyId={companyId}
          contact={dialog.type === 'edit' ? dialog.contact : undefined}
        />
      )}

      <ConfirmDialog
        open={dialog?.type === 'delete'}
        title="Delete contact"
        loading={deleteContact.isPending}
        onCancel={closeDialog}
        onConfirm={confirmDelete}
        message={
          dialog?.type === 'delete' && (
            <>
              <strong className="text-slate-900">{dialog.contact.full_name}</strong> will be removed from this company.
            </>
          )
        }
      />
    </Card>
  )
}
