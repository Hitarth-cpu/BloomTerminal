import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuthStore } from '../../stores/adminAuthStore';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdminAuthenticated, adminSession } = useAdminAuthStore();
  const location = useLocation();

  if (!isAdminAuthenticated || !adminSession) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Check session expiry
  if (new Date(adminSession.expiresAt) < new Date()) {
    useAdminAuthStore.getState().clearAdmin();
    return <Navigate to="/admin/login?reason=session_expired" replace />;
  }

  return <>{children}</>;
}
