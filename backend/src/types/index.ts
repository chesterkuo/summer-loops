// Request/Response types for API

export interface CreateContactRequest {
  name: string
  company?: string
  title?: string
  email?: string
  phone?: string
  linkedinUrl?: string
  notes?: string
  source?: 'manual' | 'card_scan' | 'linkedin' | 'natural_language' | 'calendar'
}

export interface UpdateContactRequest {
  name?: string
  company?: string
  title?: string
  email?: string
  phone?: string
  linkedinUrl?: string
  notes?: string
  aiSummary?: string
}

export interface CreateRelationshipRequest {
  contactAId: string
  contactBId?: string
  isUserRelationship?: boolean
  relationshipType?: string
  strength?: 1 | 2 | 3 | 4 | 5
  howMet?: string
  introducedById?: string
}

export interface UpdateRelationshipRequest {
  relationshipType?: string
  strength?: 1 | 2 | 3 | 4 | 5
  howMet?: string
  verified?: boolean
}

export interface PathSearchRequest {
  targetContactId?: string
  targetDescription?: string
  maxHops?: number
  topK?: number
}

export interface Contact {
  id: string
  userId: string
  name: string
  company: string | null
  title: string | null
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  notes: string | null
  aiSummary: string | null
  source: string | null
  sourceMetadata: string | null
  createdAt: string
  updatedAt: string
}

export interface Relationship {
  id: string
  userId: string
  contactAId: string
  contactBId: string | null
  isUserRelationship: number
  relationshipType: string | null
  strength: number
  howMet: string | null
  introducedById: string | null
  isAiInferred: number
  confidenceScore: number | null
  verified: number
  lastInteractionAt: string | null
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  googleId: string
  createdAt: string
  updatedAt: string
}

// Career History
export interface CareerHistory {
  id: string
  contactId: string
  company: string
  title: string | null
  startDate: string | null
  endDate: string | null
  createdAt: string
}

export interface CreateCareerHistoryRequest {
  company: string
  title?: string
  startDate?: string
  endDate?: string
}

// Education History
export interface EducationHistory {
  id: string
  contactId: string
  school: string
  degree: string | null
  field: string | null
  startYear: number | null
  endYear: number | null
  createdAt: string
}

export interface CreateEducationHistoryRequest {
  school: string
  degree?: string
  field?: string
  startYear?: number
  endYear?: number
}

// Interactions
export interface Interaction {
  id: string
  userId: string
  contactId: string
  type: 'meeting' | 'call' | 'message' | 'email' | 'other'
  notes: string | null
  occurredAt: string
  createdAt: string
}

export interface CreateInteractionRequest {
  contactId: string
  type: 'meeting' | 'call' | 'message' | 'email' | 'other'
  notes?: string
  occurredAt: string
}

// Tags
export interface Tag {
  id: string
  userId: string
  name: string
  color: string | null
}

export interface CreateTagRequest {
  name: string
  color?: string
}

export interface UpdateTagRequest {
  name?: string
  color?: string
}

// Introduction Requests
export interface IntroductionRequest {
  id: string
  userId: string
  targetContactId: string | null
  targetDescription: string | null
  pathData: string | null
  generatedMessage: string | null
  status: 'draft' | 'sent' | 'accepted' | 'introduced' | 'success' | 'failed'
  createdAt: string
  updatedAt: string
}

export interface CreateIntroductionRequest {
  targetContactId?: string
  targetDescription?: string
  pathData?: any
  generatedMessage?: string
  status?: 'draft' | 'sent' | 'accepted' | 'introduced' | 'success' | 'failed'
}

export interface UpdateIntroductionRequest {
  status?: 'draft' | 'sent' | 'accepted' | 'introduced' | 'success' | 'failed'
  generatedMessage?: string
}

// Notifications
export interface Notification {
  id: string
  userId: string
  contactId: string | null
  note: string | null
  remindAt: string
  status: 'pending' | 'done'
  createdAt: string
  completedAt: string | null
}

export interface CreateNotificationRequest {
  contactId?: string
  note?: string
  remindAt: string
}

export interface UpdateNotificationRequest {
  contactId?: string
  note?: string
  remindAt?: string
  status?: 'pending' | 'done'
}
