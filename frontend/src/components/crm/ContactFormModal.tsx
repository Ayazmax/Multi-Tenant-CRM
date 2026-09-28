import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/FormControls'
import { Modal } from '@/components/ui/Modal'
import { useCreateContact, useUpdateContact } from '@/hooks/useContacts'
import { fieldErrorsFrom, notifyError, notifySuccess } from '@/lib/notify'
import { EMAIL_PATTERN, PHONE_PATTERN } from '@/lib/validation'
import type { Contact } from '@/types'

interface ContactFormModalProps {
  open: boolean
  onClose: () => void
  companyId: number
  contact?: Contact
}

type Field = 'full_name' | 'email' | 'phone' | 'role'
type Errors = Partial<Record<Field | 'company', string>>

function validate(values: Record<Field, string>): Errors {
  const errors: Errors = {}
  if (!values.full_name.trim()) errors.full_name = 'Full name is required.'
  if (!values.email.trim()) errors.email = 'Email is required.'
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Enter a valid email address.'
  if (values.phone && !PHONE_PATTERN.test(values.phone)) errors.phone = 'Phone must be 8 to 15 digits (numbers only).'
  return errors
}

export function ContactFormModal({ open, onClose, companyId, contact }: ContactFormModalProps) {
  const isEdit = Boolean(contact)
  const [values, setValues] = useState<Record<Field, string>>({
    full_name: contact?.full_name ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    role: contact?.role ?? '',
  })
  const [errors, setErrors] = useState<Errors>({})

  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const isSaving = createContact.isPending || updateContact.isPending

  const setValue = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const clientErrors = validate(values)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return

    const input = {
      company: companyId,
      full_name: values.full_name.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim(),
      role: values.role.trim(),
    }
    const callbacks = {
      onSuccess: () => {
        notifySuccess(isEdit ? 'Contact updated.' : 'Contact added.')
        onClose()
      },
      onError: (error: unknown) => {
        const fieldErrors = fieldErrorsFrom(error)
        if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors)
        else notifyError(error)
      },
    }

    if (contact) updateContact.mutate({ id: contact.id, input }, callbacks)
    else createContact.mutate(input, callbacks)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={isSaving}
      title={isEdit ? 'Edit contact' : 'Add contact'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" form="contact-form" loading={isSaving}>
            {isEdit ? 'Save changes' : 'Add contact'}
          </Button>
        </>
      }
    >
      <form id="contact-form" className="space-y-4" onSubmit={handleSubmit} noValidate>
        {errors.company && (
          <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">
            {errors.company}
          </p>
        )}
        <FormField label="Full name" htmlFor="contact-name" error={errors.full_name} required>
          <Input
            id="contact-name"
            value={values.full_name}
            maxLength={255}
            invalid={Boolean(errors.full_name)}
            onChange={(event) => setValue('full_name', event.target.value)}
            autoFocus
          />
        </FormField>
        <FormField
          label="Email"
          htmlFor="contact-email"
          error={errors.email}
          hint="Must be unique within this company."
          required
        >
          <Input
            id="contact-email"
            type="email"
            value={values.email}
            invalid={Boolean(errors.email)}
            onChange={(event) => setValue('email', event.target.value)}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Phone" htmlFor="contact-phone" error={errors.phone} hint="Optional · 8–15 digits">
            <Input
              id="contact-phone"
              inputMode="numeric"
              value={values.phone}
              maxLength={15}
              invalid={Boolean(errors.phone)}
              onChange={(event) => setValue('phone', event.target.value)}
            />
          </FormField>
          <FormField label="Role" htmlFor="contact-role" error={errors.role}>
            <Input
              id="contact-role"
              value={values.role}
              maxLength={100}
              placeholder="e.g. Sales Manager"
              onChange={(event) => setValue('role', event.target.value)}
            />
          </FormField>
        </div>
      </form>
    </Modal>
  )
}
