import { api } from './apiClient';

export interface ApiBroadcastDelivery {
  id:                string;
  broadcast_id:      string;
  recipient_id:      string;
  personalized_body: string;
  delivery_channel:  string;
  status:            'pending' | 'delivered' | 'read' | 'failed';
  delivered_at:      string | null;
  read_at:           string | null;
  // joined from broadcast + author
  title:             string;
  broadcast_type:    string;
  priority:          'low' | 'normal' | 'high' | 'critical';
  created_by_name:   string;
  sent_at:           string | null;
}

export interface ApiBroadcast {
  id:               string;
  org_id:           string;
  created_by:       string;
  title:            string;
  body_template:    string;
  broadcast_type:   string;
  priority:         string;
  audience_type:    string;
  audience_config:  Record<string, unknown>;
  status:           string;
  total_recipients: number;
  delivered_count:  number;
  read_count:       number;
  sent_at:          string | null;
  created_at:       string;
}

/** Fetch broadcasts delivered to the current user (inbox). */
export async function fetchBroadcastInbox(limit = 20): Promise<ApiBroadcastDelivery[]> {
  const { deliveries } = await api.get<{ deliveries: ApiBroadcastDelivery[] }>(
    `/broadcasts/inbox?limit=${limit}`,
  );
  return deliveries;
}

/** Mark a delivery as read (uses delivery id, not broadcast id). */
export async function markBroadcastRead(deliveryId: string): Promise<void> {
  await api.patch(`/broadcasts/inbox/${deliveryId}/read`, {});
}

/** Admin: get broadcast stats. */
export async function fetchBroadcastStats(broadcastId: string): Promise<unknown> {
  return api.get(`/broadcasts/${broadcastId}/stats`);
}

/** Admin: preview a broadcast for a given user. */
export async function previewBroadcast(broadcastId: string, userId?: string): Promise<{ renderedBody: string; tokenMap: Record<string, string> }> {
  const qs = userId ? `?userId=${userId}` : '';
  return api.get(`/broadcasts/${broadcastId}/preview${qs}`);
}

/** Admin: cancel a broadcast. */
export async function cancelBroadcast(broadcastId: string): Promise<void> {
  await api.post(`/broadcasts/${broadcastId}/cancel`, {});
}

/** Fetch broadcast templates. */
export async function fetchBroadcastTemplates(): Promise<ApiBroadcastTemplate[]> {
  const { templates } = await api.get<{ templates: ApiBroadcastTemplate[] }>('/broadcasts/templates');
  return templates;
}

export interface ApiBroadcastTemplate {
  id:                    string;
  name:                  string;
  description:           string | null;
  category:              string | null;
  body_template:         string;
  default_audience_type: string | null;
  default_priority:      string | null;
}

/** Admin: list all org broadcasts. */
export async function fetchOrgBroadcasts(): Promise<ApiBroadcast[]> {
  const { broadcasts } = await api.get<{ broadcasts: ApiBroadcast[] }>('/broadcasts');
  return broadcasts;
}

/** Admin: create and send a broadcast (immediate or scheduled). */
export async function createBroadcast(payload: {
  title:           string;
  bodyTemplate:    string;
  broadcastType?:  string;
  priority?:       string;
  audienceType:    string;
  audienceConfig?: Record<string, unknown>;
  scheduleType?:   'immediate' | 'scheduled' | 'recurring';
  scheduledAt?:    string;
}): Promise<ApiBroadcast> {
  const { broadcast } = await api.post<{ broadcast: ApiBroadcast }>('/broadcasts', payload);
  return broadcast;
}
