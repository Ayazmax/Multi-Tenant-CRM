import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { RoleGate } from '@/components/auth/RoleGate'
import { CompanyFormModal } from '@/components/crm/CompanyFormModal'
import { CompanyLogo } from '@/components/crm/CompanyLogo'
import { ContactsPanel } from '@/components/crm/ContactsPanel'
import { ErrorState, LoadingState } from '@/components/feedback/States'
import { Card } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useCompany, useDeleteCompany } from '@/hooks/useCompanies'
import { formatDateTime } from '@/lib/format'
import { notifyError, notifySuccess } from '@/lib/notify'

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value || '—'}</dd>
    </div>
  )
}

export function CompanyDetailPage() {
  const companyId = Number(useParams().companyId)
  const navigate = useNavigate()
  const { data: company, isLoading, error, refetch } = useCompany(companyId)
  const deleteCompany = useDeleteCompany()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const backLink = (
    <Link to="/companies" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
      <ArrowLeft className="size-4" />
      Companies
    </Link>
  )

  if (isLoading) return <LoadingState label="Loading company…" />
  if (error || !company) {
    const apiError = toApiError(error)
    return (
      <>
        {backLink}
        <ErrorState
          title={apiError.status === 404 ? 'Company not found' : 'Could not load company'}
          message={apiError.status === 404 ? 'It may have been deleted or belongs to another organization.' : apiError.message}
          onRetry={apiError.status === 404 ? undefined : () => refetch()}
        />
      </>
    )
  }

  const handleDelete = () =>
    deleteCompany.mutate(company.id, {
      onSuccess: (message) => {
        notifySuccess(message)
        navigate('/companies', { replace: true })
      },
      onError: notifyError,
    })

  return (
    <>
      {backLink}

      <Card className="mb-6">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <CompanyLogo name={company.name} src={company.logo} size="lg" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{company.name}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {[company.industry, company.country].filter(Boolean).join(' · ') || 'No industry or country set'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <RoleGate permission="record:update">
              <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            </RoleGate>
            <RoleGate permission="record:delete">
              <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            </RoleGate>
          </div>
        </div>
        <dl className="grid gap-6 border-t border-slate-100 px-6 py-5 sm:grid-cols-4">
          <Detail label="Industry" value={company.industry} />
          <Detail label="Country" value={company.country} />
          <Detail label="Created" value={formatDateTime(company.created_at)} />
          <Detail label="Last updated" value={formatDateTime(company.updated_at)} />
        </dl>
      </Card>

      <ContactsPanel companyId={company.id} />

      {editing && <CompanyFormModal open company={company} onClose={() => setEditing(false)} />}

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete company"
        loading={deleteCompany.isPending}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
        message={
          <>
            <strong className="text-slate-900">{company.name}</strong> and its {company.contacts_count} contact(s) will be
            removed. This action is recorded in the activity log.
          </>
        }
      />
    </>
  )
}
