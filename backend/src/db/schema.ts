// PostgreSQL Schema Definition for Warmly/Summer-Loops
// Generated for Drizzle ORM migration from SQLite
// Using TEXT for IDs to maintain compatibility with existing data

import {
  pgTable,
  text,
  boolean,
  integer,
  real,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core'

// ============ USERS ============
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash'),
  googleId: text('google_id').unique(),
  authProvider: text('auth_provider').default('email'),
  emailVerified: boolean('email_verified').default(false),
  bio: text('bio'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ============ CONTACTS ============
export const contacts = pgTable(
  'contacts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    company: text('company'),
    title: text('title'),
    department: text('department'),
    email: text('email'),
    phone: text('phone'),
    linkedinUrl: text('linkedin_url'),
    notes: text('notes'),
    aiSummary: text('ai_summary'),
    source: text('source'),
    sourceMetadata: jsonb('source_metadata'),
    // Messaging platforms
    lineId: text('line_id'),
    telegramUsername: text('telegram_username'),
    whatsappNumber: text('whatsapp_number'),
    wechatId: text('wechat_id'),
    // Social media
    twitterHandle: text('twitter_handle'),
    facebookUrl: text('facebook_url'),
    instagramHandle: text('instagram_handle'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_contacts_user').on(table.userId),
    companyIdx: index('idx_contacts_company').on(table.company),
  })
)

// ============ RELATIONSHIPS ============
export const relationships = pgTable(
  'relationships',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contactAId: text('contact_a_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    contactBId: text('contact_b_id').references(() => contacts.id, {
      onDelete: 'cascade',
    }),
    isUserRelationship: boolean('is_user_relationship').default(false),
    relationshipType: text('relationship_type'),
    strength: integer('strength').default(3),
    howMet: text('how_met'),
    introducedById: text('introduced_by_id').references(() => contacts.id),
    isAiInferred: boolean('is_ai_inferred').default(false),
    confidenceScore: real('confidence_score'),
    verified: boolean('verified').default(false),
    lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_relationships_user').on(table.userId),
    contactAIdx: index('idx_relationships_a').on(table.contactAId),
    contactBIdx: index('idx_relationships_b').on(table.contactBId),
  })
)

// ============ CAREER HISTORY ============
export const careerHistory = pgTable(
  'career_history',
  {
    id: text('id').primaryKey(),
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    company: text('company'),
    title: text('title'),
    startDate: text('start_date'),
    endDate: text('end_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    contactIdx: index('idx_career_contact').on(table.contactId),
  })
)

// ============ EDUCATION HISTORY ============
export const educationHistory = pgTable(
  'education_history',
  {
    id: text('id').primaryKey(),
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    school: text('school').notNull(),
    degree: text('degree'),
    field: text('field'),
    startYear: integer('start_year'),
    endYear: integer('end_year'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    contactIdx: index('idx_education_contact').on(table.contactId),
  })
)

// ============ INTERACTIONS ============
export const interactions = pgTable(
  'interactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title'),
    notes: text('notes'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    contactIdx: index('idx_interactions_contact').on(table.contactId),
  })
)

// ============ TAGS ============
export const tags = pgTable(
  'tags',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    uniqueUserName: uniqueIndex('unique_user_tag_name').on(
      table.userId,
      table.name
    ),
  })
)

// ============ CONTACT TAGS (Junction Table) ============
export const contactTags = pgTable(
  'contact_tags',
  {
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.contactId, table.tagId] }),
  })
)

// ============ TEAMS ============
export const teams = pgTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ============ TEAM MEMBERS (Junction Table) ============
export const teamMembers = pgTable(
  'team_members',
  {
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    autoShare: boolean('auto_share').default(false),
    autoShareVisibility: text('auto_share_visibility').default('basic'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.teamId, table.userId] }),
  })
)

// ============ SHARED CONTACTS (Junction Table) ============
export const sharedContacts = pgTable(
  'shared_contacts',
  {
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    sharedById: text('shared_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    visibility: text('visibility').notNull().default('basic'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.contactId, table.teamId] }),
  })
)

// ============ INTRODUCTION REQUESTS ============
export const introductionRequests = pgTable(
  'introduction_requests',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetContactId: text('target_contact_id').references(() => contacts.id, {
      onDelete: 'set null',
    }),
    targetDescription: text('target_description'),
    pathData: jsonb('path_data'),
    generatedMessage: text('generated_message'),
    status: text('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_intro_requests_user').on(table.userId),
  })
)

// ============ NOTIFICATIONS ============
export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contactId: text('contact_id').references(() => contacts.id, {
      onDelete: 'cascade',
    }),
    note: text('note'),
    remindAt: timestamp('remind_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('pending'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_notifications_user').on(table.userId),
    statusIdx: index('idx_notifications_status').on(
      table.userId,
      table.status,
      table.remindAt
    ),
  })
)
