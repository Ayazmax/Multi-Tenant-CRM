import { clsx } from 'clsx'
import type { ReactNode } from 'react'

import { ROLE_LABELS } from '@/lib/permissions'
import type { ActivityAction, Role, SubscriptionPlan } from '@/types'

type Tone = 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky'

const TONES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/20',
}

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
      )}
    >
      {children}
    </span>
  )
}

const ROLE_TONES: Record<Role, Tone> = { admin: 'indigo', manager: 'sky', staff: 'slate' }
const ACTION_TONES: Record<ActivityAction, Tone> = { CREATE: 'emerald', UPDATE: 'amber', DELETE: 'rose' }

export const RoleBadge = ({ role }: { role: Role }) => <Badge tone={ROLE_TONES[role]}>{ROLE_LABELS[role]}</Badge>

export const ActionBadge = ({ action }: { action: ActivityAction }) => (
  <Badge tone={ACTION_TONES[action]}>{action}</Badge>
)

export const PlanBadge = ({ plan }: { plan: SubscriptionPlan }) => (
  <Badge tone={plan === 'pro' ? 'emerald' : 'slate'}>{plan === 'pro' ? 'Pro plan' : 'Basic plan'}</Badge>
)
