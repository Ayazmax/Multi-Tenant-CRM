import { clsx } from 'clsx'
import { Building2, History, LayoutDashboard, LogOut, Menu, X } from 'lucide-react'
import { type ComponentType, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { PlanBadge, RoleBadge } from '@/components/ui/Badge'
import { useCurrentUser, useLogout } from '@/hooks/useAuth'
import { usePermission } from '@/hooks/usePermission'
import { initials } from '@/lib/format'
import type { Permission } from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  permission?: Permission
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/activity', label: 'Activity log', icon: History, permission: 'activity:view' },
]

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const can = usePermission()
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV_ITEMS.filter((item) => !item.permission || can(item.permission)).map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )
          }
        >
          <Icon className="size-4.5" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function OrganizationSummary() {
  const organization = useAuthStore((s) => s.user?.organization)
  if (!organization) return null
  return (
    <div className="mx-3 mb-4 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Organization</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900">{organization.name}</p>
      <div className="mt-2">
        <PlanBadge plan={organization.subscription_plan} />
      </div>
    </div>
  )
}

function Brand() {
  return (
    <div className="flex h-16 items-center gap-2 px-6">
      <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
        C
      </div>
      <span className="text-base font-semibold text-slate-900">Tenant CRM</span>
    </div>
  )
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const navigate = useNavigate()
  useCurrentUser()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-full">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <Brand />
        <OrganizationSummary />
        <Navigation />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="relative flex h-full w-64 flex-col bg-white">
            <button
              type="button"
              className="absolute top-4 right-3 rounded p-1 text-slate-500"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </button>
            <Brand />
            <OrganizationSummary />
            <Navigation onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded p-1 text-slate-600 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex-1" />
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-900">{user.full_name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <RoleBadge role={user.role} />
              <div className="flex size-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {initials(user.full_name)}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          )}
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
