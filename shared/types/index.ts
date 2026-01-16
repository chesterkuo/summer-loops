// User types
export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  googleId: string
  createdAt: string
  updatedAt: string
}

// Contact types
export type ContactSource = 'manual' | 'card_scan' | 'linkedin' | 'natural_language' | 'calendar'

export interface Contact {
  id: string
  userId: string
  name: string
  company?: string
  title?: string
  email?: string
  phone?: string
  linkedinUrl?: string
  notes?: string
  aiSummary?: string
  source: ContactSource
  sourceMetadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CareerHistory {
  id: string
  contactId: string
  company: string
  title?: string
  startDate?: string
  endDate?: string
  createdAt: string
}

export interface EducationHistory {
  id: string
  contactId: string
  school: string
  degree?: string
  field?: string
  startYear?: number
  endYear?: number
  createdAt: string
}

// Relationship types
export type RelationshipStrength = 1 | 2 | 3 | 4 | 5

export interface Relationship {
  id: string
  userId: string
  contactAId: string
  contactBId?: string
  isUserRelationship: boolean
  relationshipType?: string
  strength: RelationshipStrength
  howMet?: string
  introducedById?: string
  isAiInferred: boolean
  confidenceScore?: number
  verified: boolean
  lastInteractionAt?: string
  createdAt: string
  updatedAt: string
}

// Interaction types
export type InteractionType = 'meeting' | 'call' | 'message' | 'email' | 'other'

export interface Interaction {
  id: string
  userId: string
  contactId: string
  type: InteractionType
  notes?: string
  occurredAt: string
  createdAt: string
}

// Introduction request types
export type IntroRequestStatus = 'draft' | 'sent' | 'accepted' | 'introduced' | 'success' | 'failed'

export interface IntroductionRequest {
  id: string
  userId: string
  targetContactId?: string
  targetDescription?: string
  pathData?: PathResult
  generatedMessage?: string
  status: IntroRequestStatus
  createdAt: string
  updatedAt: string
}

// Path search types
export interface PathNode {
  contactId: string
  name: string
  company?: string
  title?: string
  avatarUrl?: string
}

export interface PathEdge {
  from: string
  to: string
  strength: RelationshipStrength
  type?: string
}

export interface PathResult {
  path: PathNode[]
  edges: PathEdge[]
  pathStrength: number
  hops: number
  estimatedSuccessRate: number
}

// Tag types
export interface Tag {
  id: string
  userId: string
  name: string
  color?: string
}

// Team types (Phase 3)
export type TeamRole = 'owner' | 'admin' | 'member'
export type ContactVisibility = 'basic' | 'full'

export interface Team {
  id: string
  name: string
  ownerId: string
  createdAt: string
}

export interface TeamMember {
  teamId: string
  userId: string
  role: TeamRole
}

export interface SharedContact {
  contactId: string
  teamId: string
  sharedById: string
  visibility: ContactVisibility
}

// API response types
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// Graph visualization types
export interface GraphNode {
  id: string
  name: string
  company?: string
  title?: string
  avatarUrl?: string
  degree: number // 0 = self, 1 = direct contact, 2+ = degrees of separation
}

export interface GraphEdge {
  source: string
  target: string
  strength: RelationshipStrength
  type?: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}
