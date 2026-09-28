export const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 8899)
export const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT ?? 5174)

export const API_URL = `http://localhost:${BACKEND_PORT}/api/v1`
export const APP_URL = `http://localhost:${FRONTEND_PORT}`

export const DEMO_PASSWORD = 'Demo@12345'

export const USERS = {
  admin: 'admin@acme.test',
  manager: 'manager@acme.test',
  staff: 'staff@acme.test',
  globexAdmin: 'admin@globex.test',
} as const

export type UserKey = keyof typeof USERS

export const authFile = (user: UserKey) => `e2e/.auth/${user}.json`
