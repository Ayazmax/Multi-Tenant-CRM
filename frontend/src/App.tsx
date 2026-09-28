import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { ActivityLogPage } from '@/pages/ActivityLogPage'
import { CompaniesPage } from '@/pages/CompaniesPage'
import { CompanyDetailPage } from '@/pages/CompanyDetailPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PermissionRoute, ProtectedRoute, PublicOnlyRoute } from '@/routes/guards'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="companies" element={<CompaniesPage />} />
            <Route path="companies/:companyId" element={<CompanyDetailPage />} />
            <Route
              path="activity"
              element={
                <PermissionRoute permission="activity:view">
                  <ActivityLogPage />
                </PermissionRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
