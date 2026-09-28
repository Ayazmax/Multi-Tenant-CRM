import { AlertCircle } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/FormControls'
import { useLogin } from '@/hooks/useAuth'
import { EMAIL_PATTERN } from '@/lib/validation'

const DEMO_ACCOUNTS = [
  { label: 'Acme · Admin', email: 'admin@acme.test' },
  { label: 'Acme · Manager', email: 'manager@acme.test' },
  { label: 'Acme · Staff', email: 'staff@acme.test' },
  { label: 'Globex · Admin', email: 'admin@globex.test' },
]
const DEMO_PASSWORD = 'Demo@12345'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/'

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: typeof errors = {}
    if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = 'Enter a valid email address.'
    if (!password) nextErrors.password = 'Password is required.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    login.mutate(
      { email: email.trim(), password },
      { onSuccess: () => navigate(redirectTo, { replace: true }) },
    )
  }

  const serverError = login.error ? toApiError(login.error).message : null

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white shadow-sm">
            C
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Sign in to Tenant CRM</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your organization's companies and contacts.</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {serverError && (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {serverError}
              </div>
            )}

            <FormField label="Email" htmlFor="email" error={errors.email} required>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                invalid={Boolean(errors.email)}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>

            <FormField label="Password" htmlFor="password" error={errors.password} required>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                invalid={Boolean(errors.password)}
                onChange={(event) => setPassword(event.target.value)}
              />
            </FormField>

            <Button type="submit" className="w-full" loading={login.isPending}>
              Sign in
            </Button>
          </form>
        </div>

        {import.meta.env.DEV && (
          <div className="mt-6 rounded-xl bg-white/70 p-4 ring-1 ring-slate-200">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Demo accounts (password {DEMO_PASSWORD})
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email)
                    setPassword(DEMO_PASSWORD)
                    setErrors({})
                  }}
                  className="rounded-lg px-3 py-2 text-left text-xs ring-1 ring-slate-200 hover:bg-indigo-50 hover:ring-indigo-200"
                >
                  <span className="block font-medium text-slate-800">{account.label}</span>
                  <span className="text-slate-500">{account.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
