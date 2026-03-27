import { api } from './apiClient';

export interface ApiContactGroup {
  id:         string;
  owner_id:   string;
  name:       string;
  color:      string;
  sort_order: number;
  created_at: string;
}

export interface ApiContact {
  id:                 string;
  owner_id:           string;
  contact_user_id:    string;
  nickname:           string | null;
  notes:              string | null;
  group_id:           string | null;
  is_favorite:        boolean;
  is_blocked:         boolean;
  tags:               string[];
  last_interacted_at: string | null;
  created_at:         string;
  updated_at:         string;
  // joined from users
  email:              string;
  display_name:       string;
  photo_url:          string | null;
  firm:               string | null;
  org_id:             string | null;
  org_role:           string;
}

export interface ApiContactRequest {
  id:                      string;
  requester_id:             string;
  target_id:               string;
  message:                 string | null;
  status:                  'pending' | 'accepted' | 'declined' | 'blocked';
  responded_at:            string | null;
  created_at:              string;
  requester_display_name?: string;
  requester_email?:        string;
  requester_photo_url?:    string | null;
}

export interface ApiOrgUser {
  id:           string;
  email:        string;
  display_name: string;
  photo_url:    string | null;
  firm:         string | null;
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export async function fetchContactGroups(): Promise<ApiContactGroup[]> {
  const { groups } = await api.get<{ groups: ApiContactGroup[] }>('/contacts/groups');
  return groups;
}

export async function createContactGroup(name: string, color?: string): Promise<ApiContactGroup> {
  const { group } = await api.post<{ group: ApiContactGroup }>('/contacts/groups', { name, color });
  return group;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function fetchContacts(): Promise<ApiContact[]> {
  const { contacts } = await api.get<{ contacts: ApiContact[] }>('/contacts');
  return contacts;
}

export async function addContact(
  contactUserId: string,
  opts: { nickname?: string; groupId?: string; tags?: string[] } = {},
): Promise<ApiContact> {
  const { contact } = await api.post<{ contact: ApiContact }>('/contacts', {
    contactUserId, ...opts,
  });
  return contact;
}

export async function removeContact(userId: string): Promise<void> {
  await api.delete(`/contacts/${userId}`);
}

export async function updateContact(
  userId: string,
  patch: { nickname?: string; notes?: string; is_favorite?: boolean; is_blocked?: boolean; tags?: string[] },
): Promise<ApiContact> {
  const { contact } = await api.patch<{ contact: ApiContact }>(`/contacts/${userId}`, patch);
  return contact;
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export async function fetchContactRequests(): Promise<ApiContactRequest[]> {
  const { requests } = await api.get<{ requests: ApiContactRequest[] }>('/contacts/requests');
  return requests;
}

export async function sendContactRequest(targetId: string, message?: string): Promise<ApiContactRequest> {
  const { request } = await api.post<{ request: ApiContactRequest }>('/contacts/requests', { targetId, message });
  return request;
}

export async function respondToContactRequest(requestId: string, accept: boolean): Promise<void> {
  await api.post(`/contacts/requests/${requestId}/respond`, { accept });
}

// ─── Discovery ────────────────────────────────────────────────────────────────

export async function discoverOrgUsers(q: string): Promise<ApiOrgUser[]> {
  const { users } = await api.get<{ users: ApiOrgUser[] }>(`/contacts/discover?q=${encodeURIComponent(q)}`);
  return users;
}
