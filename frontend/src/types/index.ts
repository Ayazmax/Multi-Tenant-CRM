export type Role = 'admin' | 'manager' | 'staff'
export type SubscriptionPlan = 'basic' | 'pro'
export type ActivityAction = 'CREATE' | 'UPDATE' | 'DELETE'

export interface Organization {
  id: number
  name: string
  subscription_plan: SubscriptionPlan
  created_at: string
}

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  full_name: string
  role: Role
  organization: Organization
}

export interface OrganizationMember {
  id: number
  email: string
  full_name: string
  role: Role
  is_active: boolean
  date_joined: string
}

export interface PaginationMeta {
  count: number
  page: number
  page_size: number
  total_pages: number
  next: string | null
  previous: string | null
}

export interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
  errors: unknown
  meta?: { pagination?: PaginationMeta }
}

export interface Paginated<T> {
  items: T[]
  pagination: PaginationMeta
}

export type QueryParamValue = string | number | boolean | null | undefined
export type ListParams = Record<string, QueryParamValue>

export interface Company {
  id: number
  name: string
  industry: string
  country: string
  logo: string | null
  contacts_count: number
  created_at: string
  updated_at: string
}

export interface CompanyInput {
  name: string
  industry: string
  country: string
  logo?: File | null
  remove_logo?: boolean
}

export interface CompanyFilterOptions {
  industries: string[]
  countries: string[]
}

export interface Contact {
  id: number
  company: number
  company_name: string
  full_name: string
  email: string
  phone: string
  role: string
  created_at: string
  updated_at: string
}

export interface ContactInput {
  company: number
  full_name: string
  email: string
  phone: string
  role: string
}

export interface ActivityChange {
  from: unknown
  to: unknown
}

export interface ActivityLog {
  id: number
  user: { id: number | null; email: string; full_name: string }
  action: ActivityAction
  model_name: string
  object_id: number
  object_repr: string
  changes: Record<string, ActivityChange>
  timestamp: string
}

export interface DashboardData {
  organization: Organization
  stats: {
    companies: number
    contacts: number
    team_members: number
    activity_last_7_days?: number
  }
  team_by_role: Partial<Record<Role, number>>
  top_industries: { industry: string; total: number }[]
  recent_companies: Pick<Company, 'id' | 'name' | 'industry' | 'country' | 'created_at'>[]
  recent_activity: ActivityLog[] | null
}

export interface AuthSession {
  access: string
  refresh: string
  user: User
}
