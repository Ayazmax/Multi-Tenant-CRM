import { ActionBadge } from '@/components/ui/Badge'
import { formatRelative } from '@/lib/format'
import type { ActivityLog } from '@/types'

export function ActivityFeed({ items }: { items: ActivityLog[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((log) => (
        <li key={log.id} className="flex items-start gap-3 px-5 py-3">
          <ActionBadge action={log.action} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-slate-700">
              <span className="font-medium text-slate-900">{log.user.full_name}</span>{' '}
              {log.action.toLowerCase()}d {log.model_name.toLowerCase()}{' '}
              <span className="font-medium text-slate-900">{log.object_repr}</span>
            </p>
            <p className="text-xs text-slate-500" title={log.timestamp}>
              {formatRelative(log.timestamp)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
