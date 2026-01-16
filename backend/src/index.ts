import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { initDb, getDb, generateId } from './db/index.js'
import { initGemini, isGeminiAvailable } from './services/gemini.js'
import auth from './routes/auth.js'
import contacts from './routes/contacts.js'
import relationships from './routes/relationships.js'
import paths from './routes/paths.js'
import interactions from './routes/interactions.js'
import tags from './routes/tags.js'
import search from './routes/search.js'
import ai from './routes/ai.js'
import notifications from './routes/notifications.js'

const app = new Hono()

// Initialize database
initDb()

// Initialize Gemini AI
initGemini()

// Seed demo user if not exists
seedDemoData()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://mywarmly.app'],
  credentials: true,
}))

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Note: /api/auth/me is now in auth routes with proper JWT verification

// Mount routes
app.route('/api/auth', auth)
app.route('/api/contacts', contacts)
app.route('/api/relationships', relationships)
app.route('/api/paths', paths)
app.route('/api/interactions', interactions)
app.route('/api/tags', tags)
app.route('/api/search', search)
app.route('/api/ai', ai)
app.route('/api/notifications', notifications)

// Seed demo data for testing
function seedDemoData() {
  const db = getDb()
  const MOCK_USER_ID = 'demo-user-001'

  // Check if demo user exists
  const existingUser = db.query('SELECT id FROM users WHERE id = ?').get(MOCK_USER_ID)
  if (existingUser) {
    console.log('Demo data already exists')
    return
  }

  console.log('Seeding demo data...')
  const now = new Date().toISOString()

  // Create demo user
  db.query(`
    INSERT INTO users (id, email, name, avatar_url, google_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    MOCK_USER_ID,
    'demo@summerloop.app',
    'Demo User',
    'https://ui-avatars.com/api/?name=Demo+User&background=39E079&color=fff',
    'google-demo-001',
    now,
    now
  )

  // Create demo contacts
  const contactsData = [
    { id: generateId(), name: 'Sarah Chen', company: 'TechCorp', title: 'VP of Engineering', email: 'sarah@techcorp.com' },
    { id: generateId(), name: 'David Miller', company: 'StartupX', title: 'CEO', email: 'david@startupx.io' },
    { id: generateId(), name: 'Kenji Tanaka', company: 'InnovateTech', title: 'CTO', email: 'kenji@innovatetech.jp' },
    { id: generateId(), name: 'Lisa Wong', company: 'VentureCapital', title: 'Partner', email: 'lisa@vc.com' },
    { id: generateId(), name: 'Mark Johnson', company: 'BigBank', title: 'Director of IT', email: 'mark@bigbank.com' },
    { id: generateId(), name: 'Emily Davis', company: 'ConsultingPro', title: 'Senior Consultant', email: 'emily@consultingpro.com' },
    { id: generateId(), name: 'Alex Kim', company: 'TechCorp', title: 'Senior Engineer', email: 'alex@techcorp.com' },
    { id: generateId(), name: 'Jennifer Lee', company: 'StartupX', title: 'COO', email: 'jennifer@startupx.io' },
  ]

  for (const contact of contactsData) {
    db.query(`
      INSERT INTO contacts (id, user_id, name, company, title, email, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(contact.id, MOCK_USER_ID, contact.name, contact.company, contact.title, contact.email, 'manual', now, now)
  }

  // Create relationships
  // User knows: Sarah (5), Mark (4), Emily (3)
  // Sarah knows: David (4), Alex (5) - colleagues
  // David knows: Jennifer (5), Lisa (3)
  // Mark knows: Kenji (4)

  const relationshipsData = [
    // User's direct contacts
    { contactAId: contactsData[0].id, isUser: true, strength: 5, type: 'colleague', howMet: 'Former colleague at TechCorp' },
    { contactAId: contactsData[4].id, isUser: true, strength: 4, type: 'friend', howMet: 'College roommate' },
    { contactAId: contactsData[5].id, isUser: true, strength: 3, type: 'professional', howMet: 'Met at conference' },

    // Sarah's connections
    { contactAId: contactsData[0].id, contactBId: contactsData[1].id, strength: 4, type: 'professional', howMet: 'Worked together on project' },
    { contactAId: contactsData[0].id, contactBId: contactsData[6].id, strength: 5, type: 'colleague', howMet: 'Current colleagues at TechCorp' },

    // David's connections
    { contactAId: contactsData[1].id, contactBId: contactsData[7].id, strength: 5, type: 'colleague', howMet: 'Co-founders' },
    { contactAId: contactsData[1].id, contactBId: contactsData[3].id, strength: 3, type: 'professional', howMet: 'Investor relationship' },

    // Mark's connections
    { contactAId: contactsData[4].id, contactBId: contactsData[2].id, strength: 4, type: 'professional', howMet: 'Met at banking tech summit' },
  ]

  for (const rel of relationshipsData) {
    db.query(`
      INSERT INTO relationships (id, user_id, contact_a_id, contact_b_id, is_user_relationship, relationship_type, strength, how_met, verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId(),
      MOCK_USER_ID,
      rel.contactAId,
      rel.contactBId || null,
      rel.isUser ? 1 : 0,
      rel.type,
      rel.strength,
      rel.howMet,
      1,
      now,
      now
    )
  }

  console.log(`Seeded ${contactsData.length} contacts and ${relationshipsData.length} relationships`)
}

const port = Number(process.env.PORT) || 7000
const host = process.env.HOST || '0.0.0.0'

Bun.serve({
  port,
  hostname: host,
  fetch: app.fetch,
})

console.log(`Warmly API running on http://${host}:${port}`)
