import { useAuthStore } from '../../stores/authStore';

class ApiClient {
  private token(): string | null {
    return useAuthStore.getState().apiToken;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.token();
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`/api${path}`, { ...init, headers });

    if (res.status === 401) {
      useAuthStore.getState().logout();
      throw new Error('Session expired — please log in again');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `API error ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  get<T>(path: string)                     { return this.request<T>(path); }
  post<T>(path: string, body: unknown)     { return this.request<T>(path, { method: 'POST',   body: JSON.stringify(body) }); }
  patch<T>(path: string, body: unknown)    { return this.request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }); }
  delete<T>(path: string)                  { return this.request<T>(path, { method: 'DELETE' }); }
}

export const api = new ApiClient();
