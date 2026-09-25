import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { AnonymousOnly, RequireAdminAccess, RequireAuthenticated } from './auth/RouteGuards';
import { AdminLayout } from './layouts/AdminLayout';
import { TeacherLayout } from './layouts/TeacherLayout';
import { LoginPage } from './pages/LoginPage';
import { ForbiddenPage, LandingPage, NotFoundPage } from './pages/SystemPages';
import { AcademicPage } from './pages/admin/AcademicPage';
import { AssignmentsPage } from './pages/admin/AssignmentsPage';
import { InstitutionsPage } from './pages/admin/InstitutionsPage';
import { SubjectsPage } from './pages/admin/SubjectsPage';
import { TeachersPage } from './pages/admin/TeachersPage';
import { MyAssignmentsPage } from './pages/teacher/MyAssignmentsPage';

export function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } },
  }));
  return <QueryClientProvider client={queryClient}><BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<AnonymousOnly><LoginPage /></AnonymousOnly>} />
    <Route element={<RequireAuthenticated />}>
      <Route index element={<LandingPage />} />
      <Route element={<RequireAdminAccess />}>
        <Route path="admin" element={<AdminLayout />}>
          <Route path="institutions" element={<InstitutionsPage />} />
          <Route path="institutions/:institutionId/teachers" element={<TeachersPage />} />
          <Route path="institutions/:institutionId/academic" element={<AcademicPage />} />
          <Route path="institutions/:institutionId/subjects" element={<SubjectsPage />} />
          <Route path="institutions/:institutionId/assignments" element={<AssignmentsPage />} />
        </Route>
      </Route>
      <Route path="teacher" element={<TeacherLayout />}><Route path="assignments" element={<MyAssignmentsPage />} /></Route>
      <Route path="forbidden" element={<ForbiddenPage />} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes></AuthProvider></BrowserRouter></QueryClientProvider>;
}
