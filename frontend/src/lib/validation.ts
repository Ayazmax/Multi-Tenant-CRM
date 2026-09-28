export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PHONE_PATTERN = /^\d{8,15}$/

export const MAX_LOGO_BYTES = 2 * 1024 * 1024
export const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function validateLogo(file: File): string | null {
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) return 'Logo must be a PNG, JPEG or WebP image.'
  if (file.size > MAX_LOGO_BYTES) return 'Logo must be 2 MB or smaller.'
  return null
}
