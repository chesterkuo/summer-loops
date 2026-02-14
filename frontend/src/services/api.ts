// API Client for Warmly Backend

// Detect native vs web environment for API base URL
// iOS Capacitor uses capacitor://localhost, Android uses https://localhost
const isNative = typeof window !== 'undefined' && (
  window.location.protocol === 'capacitor:' ||
  window.location.protocol === 'file:' ||
  (window.location.hostname === 'localhost' && window.location.port === '')
);

const API_BASE = isNative
  ? 'https://mywarmly.app/api'  // Production API URL for native app
  : '/api';  // Relative for web (proxied in dev)

// Token management
let authToken: string | null = localStorage.getItem('token')

export function setAuthToken(token: string | null) {
  authToken = token
  if (token) {
    localStorage.setItem('token', token)
  } else {
    localStorage.removeItem('token')
  }
}

export function getAuthToken(): string | null {
  return authToken
}

// Generic fetch wrapper
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: string }> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (authToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    })

    const json = await response.json()

    if (!response.ok) {
      return { error: json.error || `HTTP ${response.status}` }
    }

    return { data: json.data }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Network error' }
  }
}

// Types
export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  bio?: string
}

export interface Contact {
  id: string
  user_id: string
  name: string
  company: string | null
  department: string | null
  title: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  notes: string | null
  ai_summary: string | null
  source: string | null
  created_at: string
  updated_at: string
  // Social media
  line_id: string | null
  telegram_username: string | null
  whatsapp_number: string | null
  wechat_id: string | null
  twitter_handle: string | null
  facebook_url: string | null
  instagram_handle: string | null
}

export interface Relationship {
  id: string
  user_id: string
  contact_a_id: string
  contact_b_id: string | null
  is_user_relationship: number
  relationship_type: string | null
  strength: number
  how_met: string | null
  verified: number
  created_at: string
}

export interface GraphNode {
  id: string
  name: string
  company: string | null
  title: string | null
  degree: number
}

export interface GraphEdge {
  source: string
  target: string
  strength: number
  type: string | null
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface PathNode {
  contactId: string
  name: string
  company: string | null
  title: string | null
}

export interface PathEdge {
  from: string
  to: string
  strength: number
  type: string | null
}

export interface PathResult {
  path: PathNode[]
  edges: PathEdge[]
  pathStrength: number
  hops: number
  estimatedSuccessRate: number
}

// Auth API
export const authApi = {
  async getStatus() {
    return apiFetch<{ googleOAuthConfigured: boolean; demoMode: boolean }>('/auth/status')
  },

  async signup(data: { email: string; password: string; name: string }) {
    const result = await apiFetch<{ token: string; user: User; expiresIn: number }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    if (result.data?.token) {
      setAuthToken(result.data.token)
    }
    return result
  },

  async login(data: { email: string; password: string }) {
    const result = await apiFetch<{ token: string; user: User; expiresIn: number }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    if (result.data?.token) {
      setAuthToken(result.data.token)
    }
    return result
  },

  async demoLogin() {
    const result = await apiFetch<{ token: string; user: User; expiresIn: number }>('/auth/demo', {
      method: 'POST',
    })
    if (result.data?.token) {
      setAuthToken(result.data.token)
    }
    return result
  },

  async getMe() {
    return apiFetch<User>('/auth/me')
  },

  async updateMe(data: { name?: string; avatarUrl?: string; bio?: string }) {
    return apiFetch<User>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async logout() {
    setAuthToken(null)
    return apiFetch('/auth/logout', { method: 'POST' })
  },

  async deleteAccount() {
    const result = await apiFetch<{ message: string }>('/auth/account', {
      method: 'DELETE',
    })
    if (result.data) {
      setAuthToken(null)
    }
    return result
  },

  async forgotPassword(email: string) {
    return apiFetch<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  async resetPassword(email: string, code: string, newPassword: string) {
    return apiFetch<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword }),
    })
  },
}

// Contacts API
export interface ContactsListResponse {
  data: Contact[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export const contactsApi = {
  async list(params?: { search?: string; company?: string; limit?: number; offset?: number }): Promise<{ data?: Contact[]; total?: number; error?: string }> {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.company) query.set('company', params.company)
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.offset) query.set('offset', String(params.offset))

    const queryStr = query.toString()

    // Custom fetch to preserve total count
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    const token = getAuthToken()
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
    }

    try {
      const response = await fetch(`${API_BASE}/contacts${queryStr ? `?${queryStr}` : ''}`, { headers })
      const json = await response.json()

      if (!response.ok) {
        return { error: json.error || `HTTP ${response.status}` }
      }

      return { data: json.data, total: json.total }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network error' }
    }
  },

  async get(id: string) {
    return apiFetch<Contact>(`/contacts/${id}`)
  },

  async create(data: Partial<Contact> & { locale?: string }): Promise<{ data?: Contact; invitationSent?: boolean; error?: string }> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    const token = getAuthToken()
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
    }

    try {
      const response = await fetch(`${API_BASE}/contacts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      })
      const json = await response.json()
      if (!response.ok) {
        return { error: json.error || `HTTP ${response.status}` }
      }
      return { data: json.data, invitationSent: json.invitationSent }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network error' }
    }
  },

  async update(id: string, data: Partial<Contact>) {
    return apiFetch<Contact>(`/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string) {
    return apiFetch(`/contacts/${id}`, { method: 'DELETE' })
  },

  async scan(imageBase64: string, mimeType?: string) {
    return apiFetch<{
      scanned: any;
      contact: Partial<Contact>;
      contacts?: Array<{ scanned: any; contact: Partial<Contact> }>;
    }>('/contacts/scan', {
      method: 'POST',
      body: JSON.stringify({ image: imageBase64, mimeType }),
    })
  },

  async parse(text: string) {
    return apiFetch<{ parsed: any; contact: Partial<Contact> }>('/contacts/parse', {
      method: 'POST',
      body: JSON.stringify({ text }),
    })
  },
}

// Relationships API
export const relationshipsApi = {
  async list(contactId?: string) {
    const query = contactId ? `?contactId=${contactId}` : ''
    return apiFetch<Relationship[]>(`/relationships${query}`)
  },

  async getGraph() {
    return apiFetch<GraphData>('/relationships/graph')
  },

  async create(data: {
    contactAId: string
    contactBId?: string
    isUserRelationship?: boolean
    relationshipType?: string
    strength?: number
    howMet?: string
  }) {
    return apiFetch<Relationship>('/relationships', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: Partial<Relationship>) {
    return apiFetch<Relationship>(`/relationships/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string) {
    return apiFetch(`/relationships/${id}`, { method: 'DELETE' })
  },
}

// Paths API
export const pathsApi = {
  async search(params: { targetContactId?: string; targetDescription?: string; maxHops?: number }) {
    return apiFetch<{ paths: PathResult[]; targetContact?: any }>('/paths/search', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  },

  async generateMessage(data: {
    path: { name: string; company?: string; relationship?: string }[]
    goal: string
    tone?: 'formal' | 'casual' | 'brief'
    senderName?: string
    senderBio?: string
  }) {
    return apiFetch<{ message: string }>('/paths/generate-message', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Introduction Requests
  async listRequests(params?: { status?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.offset) query.set('offset', String(params.offset))
    const queryStr = query.toString()
    return apiFetch<any[]>(`/paths/requests${queryStr ? `?${queryStr}` : ''}`)
  },

  async createRequest(data: {
    targetContactId?: string
    targetDescription?: string
    pathData?: any
    generatedMessage?: string
  }) {
    return apiFetch<any>('/paths/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateRequest(id: string, data: { status?: string; generatedMessage?: string }) {
    return apiFetch<any>(`/paths/requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
}

// Interactions API
export interface Interaction {
  id: string
  user_id: string
  contact_id: string
  type: 'meeting' | 'call' | 'message' | 'email' | 'other'
  notes: string | null
  occurred_at: string
  created_at: string
}

export const interactionsApi = {
  async list(params?: { contactId?: string; type?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams()
    if (params?.contactId) query.set('contactId', params.contactId)
    if (params?.type) query.set('type', params.type)
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.offset) query.set('offset', String(params.offset))
    const queryStr = query.toString()
    return apiFetch<Interaction[]>(`/interactions${queryStr ? `?${queryStr}` : ''}`)
  },

  async create(data: {
    contactId: string
    type: 'meeting' | 'call' | 'message' | 'email' | 'other'
    notes?: string
    occurredAt: string
  }) {
    return apiFetch<Interaction>('/interactions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: Partial<{ type: string; notes: string; occurredAt: string }>) {
    return apiFetch<Interaction>(`/interactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string) {
    return apiFetch(`/interactions/${id}`, { method: 'DELETE' })
  },

  async getReminders(days: number = 30) {
    return apiFetch<any[]>(`/interactions/reminders/list?days=${days}`)
  },
}

// Tags API
export interface Tag {
  id: string
  user_id: string
  name: string
  color: string | null
}

export const tagsApi = {
  async list() {
    return apiFetch<Tag[]>('/tags')
  },

  async get(id: string) {
    return apiFetch<Tag & { contactCount: number }>(`/tags/${id}`)
  },

  async create(data: { name: string; color?: string }) {
    return apiFetch<Tag>('/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: { name?: string; color?: string }) {
    return apiFetch<Tag>(`/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string) {
    return apiFetch(`/tags/${id}`, { method: 'DELETE' })
  },

  async getContacts(tagId: string) {
    return apiFetch<Contact[]>(`/tags/${tagId}/contacts`)
  },
}

// Search API
export const searchApi = {
  async search(query: string, limit: number = 20) {
    return apiFetch<{ contact: Contact; score: number; matchedFields: string[] }[]>('/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    })
  },

  async findSimilar(contactId: string, limit: number = 10) {
    return apiFetch<(Contact & { similarityScore: number; similarityReasons: string[] })[]>(
      `/search/similar/${contactId}?limit=${limit}`
    )
  },
}

// AI API
export const aiApi = {
  async getStatus() {
    return apiFetch<{ available: boolean; provider: string }>('/ai/status')
  },

  async inferRelationships() {
    return apiFetch<{ analyzed: number; inferred: number; created: number; relationships: any[] }>(
      '/ai/infer',
      { method: 'POST' }
    )
  },

  async generateSummary(contactId: string) {
    return apiFetch<{ summary: string; contact: Contact }>(`/ai/summary/${contactId}`, {
      method: 'POST',
    })
  },

  async suggestInteraction(contactId: string) {
    return apiFetch<{
      suggestion: { type: string; suggestion: string; timing: string; reason: string }
      contact: { id: string; name: string }
      lastInteraction: Interaction | null
    }>(`/ai/suggest-interaction/${contactId}`, { method: 'POST' })
  },

  // v1.2 Relationship Coach
  async analyzeRelationshipHealth(locale?: string) {
    return apiFetch<{ analyzed: number; results: any[] }>('/ai/relationship-coach/analyze', {
      method: 'POST',
      headers: locale ? { 'X-User-Locale': locale } : {},
    })
  },

  async getRelationshipCoachDashboard() {
    return apiFetch<{ urgent: any[]; due: any[]; maintain: any[]; healthy: any[] }>(
      '/ai/relationship-coach/dashboard'
    )
  },

  // v1.2 Meeting Prep
  async generateMeetingBrief(contactId: string, locale?: string) {
    return apiFetch<{
      summary: string
      talkingPoints: string[]
      relationshipContext: string
      lastInteractionRecap: string
      mutualConnections: string
    }>(`/ai/meeting/brief/${contactId}`, {
      method: 'POST',
      headers: locale ? { 'X-User-Locale': locale } : {},
    })
  },

  async processMeetingFollowUp(contactId: string, noteText: string, locale?: string) {
    return apiFetch<{
      cleanedNotes: string
      actionItems: { task: string; dueDate?: string }[]
      interactionType: string
      followUpSuggestion: { note: string; daysFromNow: number } | null
      createdInteraction: any
      createdReminder: any
    }>(`/ai/meeting/follow-up/${contactId}`, {
      method: 'POST',
      body: JSON.stringify({ noteText }),
      headers: locale ? { 'X-User-Locale': locale } : {},
    })
  },

  // v1.2 Smart Reminders
  async analyzeSmartReminders(locale?: string) {
    return apiFetch<{ analyzed: number; suggestions: any[] }>('/ai/smart-reminders/analyze', {
      method: 'POST',
      headers: locale ? { 'X-User-Locale': locale } : {},
    })
  },

  async getSmartReminderSuggestions() {
    return apiFetch<any[]>('/ai/smart-reminders/suggestions')
  },

  async acceptSmartReminder(id: string) {
    return apiFetch<{ notificationId: string; suggestion: any }>(
      `/ai/smart-reminders/accept/${id}`,
      { method: 'POST' }
    )
  },

  async dismissSmartReminder(id: string) {
    return apiFetch<{ dismissed: boolean }>(
      `/ai/smart-reminders/dismiss/${id}`,
      { method: 'POST' }
    )
  },
}

// Messaging API (v1.2)
export const messagingApi = {
  async generateToken(platform: 'line') {
    return apiFetch<{ token: string; expiresInSeconds: number }>('/messaging/generate-token', {
      method: 'POST',
      body: JSON.stringify({ platform }),
    })
  },

  async listAccounts() {
    return apiFetch<any[]>('/messaging/accounts')
  },

  async checkLinkStatus(platform: string) {
    return apiFetch<{ linked: boolean; account: any }>(`/messaging/link-status/${platform}`)
  },

  async disconnect(accountId: string) {
    return apiFetch<{ disconnected: boolean }>(`/messaging/accounts/${accountId}`, {
      method: 'DELETE',
    })
  },

  // WhatsApp Baileys
  async whatsappConnect(phoneNumber: string) {
    return apiFetch<{ pairingCode: string }>('/messaging/whatsapp/connect', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    })
  },

  async whatsappStatus() {
    return apiFetch<{ status: string; phoneNumber: string | null; connectedAt: string | null; lastSyncAt: string | null }>('/messaging/whatsapp/status')
  },

  async whatsappDisconnect() {
    return apiFetch<{ disconnected: boolean }>('/messaging/whatsapp/disconnect', {
      method: 'POST',
    })
  },

  async whatsappContacts() {
    return apiFetch<any[]>('/messaging/whatsapp/contacts')
  },

  async whatsappImportContacts(contactIds: string[]) {
    return apiFetch<{ importedCount: number }>('/messaging/whatsapp/import-contacts', {
      method: 'POST',
      body: JSON.stringify({ contactIds }),
    })
  },
}

// Notifications API
export interface Notification {
  id: string
  userId: string
  contactId: string | null
  contactName?: string
  note: string | null
  remindAt: string
  status: 'pending' | 'done'
  createdAt: string
  completedAt: string | null
  googleEventId: string | null
}

export interface NotificationsResponse {
  pending: Notification[]
  upcoming: Notification[]
  done: Notification[]
  activeCount: number
}

export const notificationsApi = {
  async list() {
    return apiFetch<NotificationsResponse>('/notifications')
  },

  async get(id: string) {
    return apiFetch<Notification>(`/notifications/${id}`)
  },

  async create(data: { contactId?: string; note?: string; remindAt: string }) {
    return apiFetch<Notification>('/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: { contactId?: string; note?: string; remindAt?: string; status?: 'pending' | 'done' }) {
    return apiFetch<Notification>(`/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string) {
    return apiFetch(`/notifications/${id}`, { method: 'DELETE' })
  },

  async markDone(id: string) {
    return apiFetch<Notification>(`/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'done' }),
    })
  },
}

// Extended Contacts API (career, education, tags)
export const contactsExtendedApi = {
  // Career History
  async getCareer(contactId: string) {
    return apiFetch<any[]>(`/contacts/${contactId}/career`)
  },

  async addCareer(contactId: string, data: {
    company: string
    title?: string
    startDate?: string
    endDate?: string
  }) {
    return apiFetch<any>(`/contacts/${contactId}/career`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async deleteCareer(contactId: string, entryId: string) {
    return apiFetch(`/contacts/${contactId}/career/${entryId}`, { method: 'DELETE' })
  },

  // Education History
  async getEducation(contactId: string) {
    return apiFetch<any[]>(`/contacts/${contactId}/education`)
  },

  async addEducation(contactId: string, data: {
    school: string
    degree?: string
    field?: string
    startYear?: number
    endYear?: number
  }) {
    return apiFetch<any>(`/contacts/${contactId}/education`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async deleteEducation(contactId: string, entryId: string) {
    return apiFetch(`/contacts/${contactId}/education/${entryId}`, { method: 'DELETE' })
  },

  // Tags for Contact
  async getTags(contactId: string) {
    return apiFetch<Tag[]>(`/contacts/${contactId}/tags`)
  },

  async addTag(contactId: string, tagId: string) {
    return apiFetch(`/contacts/${contactId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagId }),
    })
  },

  async removeTag(contactId: string, tagId: string) {
    return apiFetch(`/contacts/${contactId}/tags/${tagId}`, { method: 'DELETE' })
  },

  // LinkedIn Import
  async importLinkedIn(linkedinUrl: string) {
    return apiFetch<Contact>('/contacts/import-linkedin', {
      method: 'POST',
      body: JSON.stringify({ linkedinUrl }),
    })
  },
}

// Teams API
export interface Team {
  id: string
  name: string
  owner_id: string
  created_at: string
  role?: string
  member_count?: number
  contact_count?: number
}

export interface TeamMember {
  id: string
  name: string
  email: string
  avatar_url: string | null
  role: 'owner' | 'admin' | 'member'
}

export interface SharedContact {
  id: string
  name: string
  company: string | null
  title: string | null
  email: string | null
  phone: string | null
  visibility: 'basic' | 'full'
  shared_by_name: string
  shared_by_id: string
}

export const teamsApi = {
  async list() {
    return apiFetch<Team[]>('/teams')
  },

  async get(id: string) {
    return apiFetch<Team & { members: TeamMember[]; currentUserRole: string }>(`/teams/${id}`)
  },

  async create(data: { name: string }) {
    return apiFetch<Team>('/teams', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: { name?: string }) {
    return apiFetch<Team>(`/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string) {
    return apiFetch(`/teams/${id}`, { method: 'DELETE' })
  },

  async addMember(teamId: string, data: { email: string; role?: 'admin' | 'member' }) {
    return apiFetch<{ userId?: string; role: string; invited?: boolean; email?: string }>(`/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async removeMember(teamId: string, memberId: string) {
    return apiFetch(`/teams/${teamId}/members/${memberId}`, { method: 'DELETE' })
  },

  async shareContact(teamId: string, data: { contactId: string; visibility?: 'basic' | 'full' }) {
    return apiFetch(`/teams/${teamId}/share`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async unshareContact(teamId: string, contactId: string) {
    return apiFetch(`/teams/${teamId}/share/${contactId}`, { method: 'DELETE' })
  },

  async getContacts(teamId: string) {
    return apiFetch<SharedContact[]>(`/teams/${teamId}/contacts`)
  },

  async shareAllContacts(teamId: string, data: { visibility?: 'basic' | 'full' }) {
    return apiFetch<{ sharedCount: number }>(`/teams/${teamId}/share-all`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async getAutoShare(teamId: string) {
    return apiFetch<{ autoShare: boolean; visibility: string }>(`/teams/${teamId}/auto-share`)
  },

  async updateAutoShare(teamId: string, data: { autoShare: boolean; visibility?: 'basic' | 'full' }) {
    return apiFetch<{ autoSync: boolean; visibility: string }>(`/teams/${teamId}/auto-share`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
}

// Google Calendar API
export const googleCalendarApi = {
  async getConnectUrl(platform?: string) {
    const query = platform ? `?platform=${platform}` : ''
    return apiFetch<{ url: string }>(`/google-calendar/connect-url${query}`)
  },

  async getStatus() {
    return apiFetch<{ connected: boolean; autoSync: boolean; connectedAt: string | null }>('/google-calendar/status')
  },

  async updateSettings(data: { autoSync: boolean }) {
    return apiFetch<{ autoSync: boolean }>('/google-calendar/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async disconnect() {
    return apiFetch('/google-calendar/disconnect', { method: 'POST' })
  },

  async syncNotification(notificationId: string) {
    return apiFetch<{ googleEventId: string }>(`/google-calendar/sync/notification/${notificationId}`, {
      method: 'POST',
    })
  },

  async unsyncNotification(notificationId: string) {
    return apiFetch(`/google-calendar/sync/notification/${notificationId}`, {
      method: 'DELETE',
    })
  },
}

// Google Contacts API
export const googleContactsApi = {
  async getConnectUrl(platform?: string) {
    const query = platform ? `?platform=${platform}` : ''
    return apiFetch<{ url: string }>(`/google-contacts/connect-url${query}`)
  },

  async getStatus() {
    return apiFetch<{ connected: boolean; connectedAt: string | null }>('/google-contacts/status')
  },

  async listContacts() {
    return apiFetch<Array<{ resourceName: string; name: string | null; email: string | null; phone: string | null; company: string | null; title: string | null; isDuplicate: boolean }>>('/google-contacts/contacts')
  },

  async importContacts(resourceNames: string[]) {
    return apiFetch<{ imported: Array<{ id: string; name: string }>; count: number }>('/google-contacts/import', {
      method: 'POST',
      body: JSON.stringify({ resourceNames }),
    })
  },

  async disconnect() {
    return apiFetch('/google-contacts/disconnect', { method: 'POST' })
  },
}

// Export API (vCard download)
export const exportApi = {
  async exportAllVcard() {
    const headers: Record<string, string> = {}
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`
    const response = await fetch(`${API_BASE}/contacts/export/vcard`, { headers })
    if (!response.ok) throw new Error('Export failed')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'warmly-contacts.vcf'
    a.click()
    URL.revokeObjectURL(url)
  },

  async exportContactVcard(id: string) {
    const headers: Record<string, string> = {}
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`
    const response = await fetch(`${API_BASE}/contacts/${id}/export/vcard`, { headers })
    if (!response.ok) throw new Error('Export failed')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contact-${id}.vcf`
    a.click()
    URL.revokeObjectURL(url)
  },
}
