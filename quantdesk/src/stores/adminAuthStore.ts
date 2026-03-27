import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AdminUser {
  id:          string;
  email:       string;
  displayName: string;
  orgId:       string;
  orgRole:     'admin' | 'super_admin';
}

interface AdminSession {
  token:     string;
  expiresAt: string;  // ISO string
}

interface AdminAuthState {
  adminUser:            AdminUser | null;
  adminSession:         AdminSession | null;
  isAdminAuthenticated: boolean;

  setAdmin:       (user: AdminUser, session: AdminSession) => void;
  clearAdmin:     () => void;
  refreshSession: (session: AdminSession) => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      adminUser:            null,
      adminSession:         null,
      isAdminAuthenticated: false,

      setAdmin: (user, session) =>
        set({ adminUser: user, adminSession: session, isAdminAuthenticated: true }),

      clearAdmin: () =>
        set({ adminUser: null, adminSession: null, isAdminAuthenticated: false }),

      refreshSession: (session) =>
        set({ adminSession: session }),
    }),
    {
      name:    'quantdesk-admin',
      // sessionStorage: cleared on browser close
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        adminUser:            s.adminUser,
        adminSession:         s.adminSession,
        isAdminAuthenticated: s.isAdminAuthenticated,
      }),
    },
  ),
);
