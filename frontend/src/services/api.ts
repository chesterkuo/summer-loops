// API Client for Warmly Backend

const API_BASE = '/api'

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

  async logout() {
    setAuthToken(null)
    return apiFetch('/auth/logout', { method: 'POST' })
  },
}

// Contacts API
export const contactsApi = {
  async list(params?: { search?: string; company?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.company) query.set('company', params.company)
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.offset) query.set('offset', String(params.offset))

    const queryStr = query.toString()
    return apiFetch<Contact[]>(`/contacts${queryStr ? `?${queryStr}` : ''}`)
  },

  async get(id: string) {
    return apiFetch<Contact>(`/contacts/${id}`)
  },

  async create(data: Partial<Contact>) {
    return apiFetch<Contact>('/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    })
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
    return apiFetch<{ scanned: any; contact: Partial<Contact> }>('/contacts/scan', {
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
