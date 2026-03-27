import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TerminalShell } from './components/terminal/TerminalShell';
import { AuthLayout } from './components/auth/AuthLayout';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { useAuthStore } from './stores/authStore';
import { onAuthStateChanged } from './services/auth/authService';

// Admin
import AdminLoginPage        from './pages/admin/AdminLoginPage';
import AdminShell            from './components/admin/AdminShell';
import { AdminRoute }        from './components/admin/AdminRoute';
import AdminDashboard        from './pages/admin/AdminDashboard';
import MembersPage           from './pages/admin/MembersPage';
import TraderPerformancePage from './pages/admin/TraderPerformancePage';
import ChatPermissionsPage   from './pages/admin/ChatPermissionsPage';
import AdminAskbPage         from './pages/admin/AdminAskbPage';
import AuditLogPage          from './pages/admin/AuditLogPage';
import { InvitePage }        from './pages/InvitePage';

// ─── Standard app ─────────────────────────────────────────────────────────────

function StandardApp() {
  const { isAuthenticated, authPage } = useAuthStore();

  useEffect(() => {
    const unsub = onAuthStateChanged((fbUser) => {
      const store = useAuthStore.getState();
      if (fbUser) {
        store.setUser(fbUser, store.apiToken ?? undefined);
      } else if (!store.apiToken) {
        store.logout();
      }
    });
    return unsub;
  }, []);

  if (!isAuthenticated) {
    return (
      <AuthLayout>
        {authPage === 'signup' ? <SignUpPage /> : <LoginPage />}
      </AuthLayout>
    );
  }
  return <TerminalShell />;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminShell />
            </AdminRoute>
          }
        >
          <Route index                       element={<AdminDashboard />} />
          <Route path="members"              element={<MembersPage />} />
          <Route path="invitations"          element={<MembersPage />} />
          <Route path="teams"                element={<Navigate to="/admin/members" replace />} />
          <Route path="performance/traders"  element={<TraderPerformancePage />} />
          <Route path="performance/analysts" element={<TraderPerformancePage />} />
          <Route path="performance/sessions" element={<TraderPerformancePage />} />
          <Route path="performance/teams"    element={<TraderPerformancePage />} />
          <Route path="chat/permissions"     element={<ChatPermissionsPage />} />
          <Route path="chat/contacts"        element={<ChatPermissionsPage />} />
          <Route path="broadcasts"           element={<Navigate to="/admin" replace />} />
          <Route path="broadcasts/history"   element={<Navigate to="/admin" replace />} />
          <Route path="ai/askb"              element={<AdminAskbPage />} />
          <Route path="ai/summaries"         element={<AdminAskbPage />} />
          <Route path="ai/performance"       element={<AdminAskbPage />} />
          <Route path="security/audit"       element={<AuditLogPage />} />
          <Route path="security/sessions"    element={<AuditLogPage />} />
          <Route path="security/access"      element={<AuditLogPage />} />
          <Route path="settings/org"         element={<Navigate to="/admin" replace />} />
          <Route path="settings/integrations" element={<Navigate to="/admin" replace />} />
          <Route path="*"                    element={<Navigate to="/admin" replace />} />
        </Route>

        {/* Invitation acceptance */}
        <Route path="/invite" element={<InvitePage />} />

        {/* Standard trader/analyst app */}
        <Route path="/*" element={<StandardApp />} />
      </Routes>
    </BrowserRouter>
  );
}
