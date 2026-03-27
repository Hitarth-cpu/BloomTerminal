import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  provider: 'google' | 'email' | 'mock';
}

interface AuthState {
  user:            AuthUser | null;
  apiToken:        string | null;   // dev JWT or Firebase ID token
  isAuthenticated: boolean;
  isLoading:       boolean;
  authPage:        'login' | 'signup';

  setUser:     (user: AuthUser | null, apiToken?: string) => void;
  setLoading:  (loading: boolean) => void;
  setAuthPage: (page: 'login' | 'signup') => void;
  logout:      () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:            null,
      apiToken:        null,
      isAuthenticated: false,
      isLoading:       false,
      authPage:        'login',

      setUser:     (user, apiToken = undefined) => set({ user, apiToken, isAuthenticated: !!user, isLoading: false }),
      setLoading:  (isLoading) => set({ isLoading }),
      setAuthPage: (authPage) => set({ authPage }),
      logout:      () => set({ user: null, apiToken: null, isAuthenticated: false }),
    }),
    {
      name:    'quantdesk-auth',
      // localStorage → auth persists across tabs and browser restarts
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, apiToken: state.apiToken, isAuthenticated: state.isAuthenticated }),
    },
  ),
);
