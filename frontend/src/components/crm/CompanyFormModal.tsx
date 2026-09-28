import { ImagePlus, Trash2 } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/FormControls'
import { Modal } from '@/components/ui/Modal'
import { useCreateCompany, useUpdateCompany } from '@/hooks/useCompanies'
import { fieldErrorsFrom, notifyError, notifySuccess } from '@/lib/notify'
import { ALLOWED_LOGO_TYPES, validateLogo } from '@/lib/validation'
import type { Company } from '@/types'

import { CompanyLogo } from './CompanyLogo'

interface CompanyFormModalProps {
  open: boolean
  onClose: () => void
  /** When provided the form edits this company, otherwise it creates one. */
  company?: Company
  onSaved?: (company: Company) => void
}

type Errors = Partial<Record<'name' | 'industry' | 'country' | 'logo', string>>

export function CompanyFormModal({ open, onClose, company, onSaved }: CompanyFormModalProps) {
  const isEdit = Boolean(company)
  const [name, setName] = useState(company?.name ?? '')
  const [industry, setIndustry] = useState(company?.industry ?? '')
  const [country, setCountry] = useState(company?.country ?? '')
  const [logo, setLogo] = useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [errors, setErrors] = useState<Errors>({})

  const createCompany = useCreateCompany()
  const updateCompany = useUpdateCompany()
  const isSaving = createCompany.isPending || updateCompany.isPending

  const previewUrl = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo])
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const currentLogo = previewUrl ?? (removeLogo ? null : (company?.logo ?? null))

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const error = validateLogo(file)
    setErrors((current) => ({ ...current, logo: error ?? undefined }))
    if (!error) {
      setLogo(file)
      setRemoveLogo(false)
    }
  }

  const handleRemoveLogo = () => {
    setLogo(null)
    setRemoveLogo(Boolean(company?.logo))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setErrors({ name: 'Company name is required.' })
      return
    }
    setErrors({})

    const input = { name: name.trim(), industry: industry.trim(), country: country.trim(), logo, remove_logo: removeLogo }
    const callbacks = {
      onSuccess: (saved: Company) => {
        notifySuccess(isEdit ? 'Company updated.' : 'Company created.')
        onSaved?.(saved)
        onClose()
      },
      onError: (error: unknown) => {
        const fieldErrors = fieldErrorsFrom(error)
        if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors)
        else notifyError(error)
      },
    }

    if (company) updateCompany.mutate({ id: company.id, input }, callbacks)
    else createCompany.mutate(input, callbacks)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={isSaving}
      title={isEdit ? 'Edit company' : 'New company'}
      description={isEdit ? undefined : 'Add a company to your organization.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" form="company-form" loading={isSaving}>
            {isEdit ? 'Save changes' : 'Create company'}
          </Button>
        </>
      }
    >
      <form id="company-form" className="space-y-4" onSubmit={handleSubmit} noValidate>
        <FormField label="Company name" htmlFor="company-name" error={errors.name} required>
          <Input
            id="company-name"
            value={name}
            maxLength={255}
            invalid={Boolean(errors.name)}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Industry" htmlFor="company-industry" error={errors.industry}>
            <Input
              id="company-industry"
              value={industry}
              maxLength={100}
              placeholder="e.g. Hospitality"
              onChange={(event) => setIndustry(event.target.value)}
            />
          </FormField>
          <FormField label="Country" htmlFor="company-country" error={errors.country}>
            <Input
              id="company-country"
              value={country}
              maxLength={100}
              placeholder="e.g. United Kingdom"
              onChange={(event) => setCountry(event.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Logo" htmlFor="company-logo" error={errors.logo} hint="PNG, JPEG or WebP, up to 2 MB.">
          <div className="flex items-center gap-4">
            <CompanyLogo name={name || 'Company'} src={currentLogo} size="lg" />
            <div className="flex flex-wrap gap-2">
              <label
                htmlFor="company-logo"
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 ring-inset hover:bg-slate-50"
              >
                <ImagePlus className="size-4" />
                {currentLogo ? 'Replace' : 'Upload'}
              </label>
              <input
                id="company-logo"
                type="file"
                accept={ALLOWED_LOGO_TYPES.join(',')}
                className="sr-only"
                onChange={handleLogoChange}
              />
              {currentLogo && (
                <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={handleRemoveLogo}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        </FormField>
      </form>
    </Modal>
  )
}
