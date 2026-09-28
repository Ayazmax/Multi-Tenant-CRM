import { Activity, Building2, ContactRound, Users } from 'lucide-react'
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { RoleGate } from '@/components/auth/RoleGate'
import { ActivityFeed } from '@/components/crm/ActivityFeed'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States'
import { Card, CardHeader, PageHeader } from '@/components/layout/PageHeader'
import { PlanBadge, RoleBadge } from '@/components/ui/Badge'
import { useDashboard } from '@/hooks/useOrganization'
import { formatDate } from '@/lib/format'
import type { Role } from '@/types'

interface StatCardProps {
  label: string
  value: number
  icon: ComponentType<{ className?: string }>
}

function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Icon className="size-4.5" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  )
}

export function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboard()

  if (isLoading) return <LoadingState label="Loading dashboard…" />
  if (error || !data) return <ErrorState message={toApiError(error).message} onRetry={() => refetch()} />

  const { organization, stats } = data

  return (
    <>
      <PageHeader
        title={organization.name}
        description={
          <span className="inline-flex items-center gap-2">
            <PlanBadge plan={organization.subscription_plan} />
            Member since {formatDate(organization.created_at)}
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Companies" value={stats.companies} icon={Building2} />
        <StatCard label="Contacts" value={stats.contacts} icon={ContactRound} />
        <StatCard label="Team members" value={stats.team_members} icon={Users} />
        {stats.activity_last_7_days !== undefined && (
          <StatCard label="Changes (7 days)" value={stats.activity_last_7_days} icon={Activity} />
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recently added companies"
            actions={
              <Link to="/companies" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                View all
              </Link>
            }
          />
          {data.recent_companies.length === 0 ? (
            <EmptyState title="No companies yet" message="Companies you add will appear here." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recent_companies.map((company) => (
                <li key={company.id}>
                  <Link
                    to={`/companies/${company.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{company.name}</p>
                      <p className="text-xs text-slate-500">
                        {[company.industry, company.country].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">{formatDate(company.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Team" />
            <ul className="space-y-3 px-5 py-4">
              {(Object.entries(data.team_by_role) as [Role, number][]).map(([role, count]) => (
                <li key={role} className="flex items-center justify-between text-sm">
                  <RoleBadge role={role} />
                  <span className="font-medium text-slate-900">{count}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Top industries" />
            {data.top_industries.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">No industry data yet.</p>
            ) : (
              <ul className="space-y-3 px-5 py-4">
                {data.top_industries.map(({ industry, total }) => (
                  <li key={industry}>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700">{industry}</span>
                      <span className="font-medium text-slate-900">{total}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      <div
                        className="h-1.5 rounded-full bg-indigo-500"
                        style={{ width: `${(total / Math.max(stats.companies, 1)) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <RoleGate permission="activity:view">
        {data.recent_activity && (
          <Card className="mt-6">
            <CardHeader
              title="Recent activity"
              actions={
                <Link to="/activity" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                  Full activity log
                </Link>
              }
            />
            {data.recent_activity.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <ActivityFeed items={data.recent_activity} />
            )}
          </Card>
        )}
      </RoleGate>
    </>
  )
}
