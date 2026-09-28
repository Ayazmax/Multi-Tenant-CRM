import { toast } from 'sonner'

import { toApiError } from '@/api/client'

export const notifySuccess = (message: string) => toast.success(message)

export const notifyError = (error: unknown) => toast.error(toApiError(error).message)

/** Maps API field errors to the first message per field. */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(toApiError(error).fieldErrors).map(([field, messages]) => [field, messages[0] ?? '']),
  )
}
