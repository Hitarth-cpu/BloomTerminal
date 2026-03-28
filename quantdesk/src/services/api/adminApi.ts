import { useAdminAuthStore } from '../../stores/adminAuthStore';

class AdminApiClient {
  private token(): string | null {
    return useAdminAuthStore.getState().adminSession?.token ?? null;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.token();
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(`/api/admin${path}`, { ...init, headers });
    if (res.status === 401) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!path.startsWith('/auth/')) {
        useAdminAuthStore.getState().clearAdmin();
        window.location.replace('/admin/login?reason=session_expired');
      }
      throw new Error(body.error ?? 'Admin session expired');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `Admin API error ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  get<T>(path: string)                 { return this.request<T>(path); }
  post<T>(path: string, body: unknown) { return this.request<T>(path, { method: 'POST',   body: JSON.stringify(body) }); }
  patch<T>(path: string, body: unknown){ return this.request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }); }
  delete<T>(path: string)              { return this.request<T>(path, { method: 'DELETE' }); }
}

export const adminApi = new AdminApiClient();

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function adminLogin(firebaseToken: string, totpCode: string, email: string) {
  return adminApi.post<{
    token: string; expiresAt: string;
    requiresMfaSetup?: boolean; userId?: string;
    user: { id: string; email: string; displayName: string; orgId: string; orgRole: string };
  }>('/auth/login', { firebaseToken, totpCode, email });
}

export async function adminLogout(): Promise<void> {
  await adminApi.post('/auth/logout', {}).catch(() => {});
  useAdminAuthStore.getState().clearAdmin();
}

export async function setupMfa(userId: string) {
  return adminApi.post<{ qrCode: string; secret: string }>('/auth/setup-mfa', { userId });
}

export async function verifyMfa(userId: string, totpCode: string) {
  return adminApi.post<{ ok: boolean }>('/auth/verify-mfa', { userId, totpCode });
}

// ─── Members ──────────────────────────────────────────────────────────────────

export interface AdminMember {
  id: string; display_name: string; email: string; org_role: string;
  team_ids: string[]; is_active: boolean; created_at: string;
  last_login_at: string | null; photo_url: string | null;
  daily_pnl: number | null; firm: string | null;
}

export async function fetchAdminMembers(params: {
  search?: string; role?: string; status?: string;
  page?: number; limit?: number;
} = {}) {
  const qs = new URLSearchParams();
  if (params.search)  qs.set('search', params.search);
  if (params.role)    qs.set('role',   params.role);
  if (params.status)  qs.set('status', params.status);
  if (params.page)    qs.set('page',   String(params.page));
  if (params.limit)   qs.set('limit',  String(params.limit));
  return adminApi.get<{ members: AdminMember[]; total: number; page: number }>(
    `/members?${qs}`,
  );
}

export async function fetchAdminMember(userId: string) {
  return adminApi.get<{
    member: AdminMember & { mfa_enabled: boolean };
    sessions: Array<{ id: string; ip_address: string; created_at: string; last_active: string }>;
    snapshots: Array<{ snapshot_date: string; daily_pnl: number; cumulative_pnl: number; trades_count: number }>;
  }>(`/members/${userId}`);
}

export async function updateAdminMember(userId: string, updates: {
  role?: string; teamIds?: string[]; isActive?: boolean;
}) {
  return adminApi.patch<{ ok: boolean }>(`/members/${userId}`, updates);
}

export async function suspendMember(userId: string) {
  return adminApi.delete<{ ok: boolean }>(`/members/${userId}`);
}

export async function fetchAdminInvitations() {
  return adminApi.get<{ invitations: AdminInvitation[] }>('/members/invitations');
}

export async function createInvitation(data: {
  email: string; firstName?: string; lastName?: string;
  role: string; teamIds?: string[]; expiryHours?: number;
}) {
  return adminApi.post<{ invitation: AdminInvitation; token: string }>('/members/invitations', data);
}

export async function revokeInvitation(id: string) {
  return adminApi.delete<{ ok: boolean }>(`/members/invitations/${id}`);
}

export interface AdminInvitation {
  id: string; email: string; first_name: string | null; last_name: string | null;
  intended_role: string; status: string; expires_at: string; created_at: string;
  invited_by_name: string;
}

// ─── Performance ──────────────────────────────────────────────────────────────

export async function fetchTraderPerformance(period = '1m') {
  return adminApi.get<{
    traders: TraderPerf[]; period: string; start: string; end: string;
  }>(`/performance/traders?period=${period}`);
}

export async function fetchTraderDetail(userId: string, period = '1m') {
  return adminApi.get<{
    user: { id: string; display_name: string; email: string; org_role: string; team_ids: string[] };
    snapshots: Array<{ snapshot_date: string; daily_pnl: string; cumulative_pnl: string; trades_count: number }>;
    trades: Array<{ id: string; ticker: string; side: string; quantity: number; price: string; status: string; created_at: string }>;
    period: string;
  }>(`/performance/traders/${userId}?period=${period}`);
}

export async function fetchAnalystPerformance(period = '1m') {
  return adminApi.get<{ analysts: AnalystPerf[]; period: string }>(
    `/performance/analysts?period=${period}`,
  );
}

export async function fetchSessionSummaries(from?: string, to?: string) {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to)   qs.set('to',   to);
  return adminApi.get<{ sessions: SessionSummary[] }>(`/performance/sessions?${qs}`);
}

export async function fetchSessionSummary(date: string) {
  return adminApi.get<{ summary: SessionSummary & { ai_content: string | null } }>(
    `/performance/sessions/${date}`,
  );
}

export async function generateSessionSummary(date: string) {
  return adminApi.post<{ status: string; date: string }>(
    `/performance/sessions/${date}/generate`, {},
  );
}

export interface TraderPerf {
  user_id: string; display_name: string; email: string; team_ids: string[];
  total_pnl: number; trades_count: number; winning_trades: number;
  volume_traded: number; win_rate: number;
  sharpe_ratio: number | null; max_drawdown: number | null;
  sparkline: Array<{ date: string; pnl: number }>;
}

export interface AnalystPerf {
  user_id: string; display_name: string; email: string; team_ids: string[];
  doc_count: string; last_doc_at: string | null;
}

export interface SessionSummary {
  id: string; session_date: string; total_pnl: string | null;
  active_traders: number | null; total_trades: number | null;
  status: string; generated_at: string | null;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function fetchChatConnections() {
  return adminApi.get<{ connections: ChatConnection[] }>('/chat/connections');
}

export async function createChatLink(userAId: string, userBId: string, reason: string) {
  return adminApi.post<{ link: { id: string } }>('/chat/connections', { userAId, userBId, reason });
}

export async function removeChatLink(linkId: string) {
  return adminApi.delete<{ ok: boolean }>(`/chat/connections/${linkId}`);
}

export async function updateChatSettings(settings: Record<string, boolean>) {
  return adminApi.patch<{ ok: boolean }>('/chat/settings', settings);
}

export interface ChatConnection {
  id: string; user_a_id: string; user_a_name: string;
  user_b_id: string; user_b_name: string;
  reason: string; is_active: boolean; created_at: string;
}

// ─── Security ─────────────────────────────────────────────────────────────────

export async function fetchAuditLog(params: {
  action?: string; userId?: string; from?: string; to?: string; page?: number;
} = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
  return adminApi.get<{ logs: AuditEntry[] }>(`/security/audit?${qs}`);
}

export async function fetchAdminSessions() {
  return adminApi.get<{ sessions: AdminSessionEntry[] }>('/security/sessions');
}

export async function terminateAdminSession(sessionId: string) {
  return adminApi.delete<{ ok: boolean }>(`/security/sessions/${sessionId}`);
}

export interface AuditEntry {
  id: string; action: string; user_id: string; display_name: string;
  metadata: unknown; created_at: string;
}

export interface AdminSessionEntry {
  id: string; user_id: string; display_name: string; email: string;
  ip_address: string | null; created_at: string; last_active: string; expires_at: string;
}

// ─── Broadcasts ───────────────────────────────────────────────────────────────

export interface AdminBroadcast {
  id: string; title: string; body_template: string; priority: string;
  status: string; audience_type: string; created_at: string; sent_at: string | null;
  sender_name: string; delivery_count: number;
}

export async function fetchAdminBroadcasts() {
  return adminApi.get<{ broadcasts: AdminBroadcast[] }>('/broadcasts');
}

export async function sendAdminBroadcast(data: { title: string; body: string; priority?: string; audienceType?: string }) {
  return adminApi.post<{ broadcast: { id: string }; recipientCount: number }>('/broadcasts', data);
}

// ─── Org Settings ─────────────────────────────────────────────────────────────

export interface AdminOrg {
  id: string; name: string; display_name: string; slug: string;
  plan: string; domain: string | null; logo_url: string | null; created_at: string;
}

export async function fetchAdminOrg() {
  return adminApi.get<{ org: AdminOrg; stats: { member_count: string; admin_count: string } }>('/org');
}

export async function updateAdminOrg(data: { name?: string; displayName?: string; domain?: string }) {
  return adminApi.patch<{ ok: boolean }>('/org', data);
}

// ─── AI ───────────────────────────────────────────────────────────────────────

export function streamAdminAi(
  path: string,
  body: Record<string, unknown>,
  onChunk: (text: string) => void,
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const token = useAdminAuthStore.getState().adminSession?.token;
    try {
      const res = await fetch(`/api/admin${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Stream failed' }));
        reject(new Error((err as { error?: string }).error ?? 'Stream failed'));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') { resolve(); return; }
          try {
            const { text } = JSON.parse(payload) as { text: string };
            onChunk(text);
          } catch { /* ignore */ }
        }
      }
      resolve();
    } catch (e) { reject(e); }
  });
}
