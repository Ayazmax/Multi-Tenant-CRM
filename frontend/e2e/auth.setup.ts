import fs from 'node:fs/promises'
import path from 'node:path'

import { test as setup } from '@playwright/test'

import { login } from './support/api.ts'
import { APP_URL, USERS, authFile, type UserKey } from './support/env.ts'

// Writes a signed-in browser state per role so specs skip the login form.
// The login UI itself is covered in auth.spec.ts.
for (const user of Object.keys(USERS) as UserKey[]) {
  setup(`sign in as ${user}`, async ({ request }) => {
    const { access, refresh, user: profile } = await login(request, user)
    const state = {
      cookies: [],
      origins: [
        {
          origin: APP_URL,
          localStorage: [
            {
              name: 'crm-auth',
              value: JSON.stringify({ state: { accessToken: access, refreshToken: refresh, user: profile }, version: 0 }),
            },
          ],
        },
      ],
    }
    const file = authFile(user)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify(state, null, 2))
  })
}
