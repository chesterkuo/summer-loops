import { Hono } from 'hono'
import { getDb, generateId } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { isGeminiAvailable, generateContactSummary, suggestInteraction, inferRelationships } from '../services/gemini.js'
import type { Contact, Relationship } from '../types/index.js'

const ai = new Hono()

// Apply auth middleware to all routes
ai.use('*', authMiddleware)

// Check AI availability
ai.get('/status', (c) => {
  return c.json({
    data: {
      available: isGeminiAvailable(),
      provider: 'gemini'
    }
  })
})

// Run relationship inference for a user's contacts
ai.post('/infer', async (c) => {
  if (!isGeminiAvailable()) {
    return c.json({ error: 'AI features not available - GEMINI_API_KEY not configured' }, 503)
  }

  const db = getDb()
  const userId = c.get('user').userId

  // Get all contacts with their career and education history
  const contacts = db.query(
    'SELECT * FROM contacts WHERE user_id = ?'
  ).all(userId) as Contact[]

  if (contacts.length < 2) {
    return c.json({ error: 'Need at least 2 contacts to infer relationships' }, 400)
  }

  // Get career history for all contacts
  const careerData: { [contactId: string]: { company: string; title: string | null; startDate: string | null; endDate: string | null }[] } = {}
  for (const contact of contacts) {
    const career = db.query(
      'SELECT company, title, start_date as startDate, end_date as endDate FROM career_history WHERE contact_id = ?'
    ).all(contact.id) as any[]
    careerData[contact.id] = career
  }

  // Get education history for all contacts
  const educationData: { [contactId: string]: { school: string; degree: string | null; startYear: number | null; endYear: number | null }[] } = {}
  for (const contact of contacts) {
    const education = db.query(
      'SELECT school, degree, start_year as startYear, end_year as endYear FROM education_history WHERE contact_id = ?'
    ).all(contact.id) as any[]
    educationData[contact.id] = education
  }

  // Get existing relationships to avoid duplicates
  const existingRels = db.query(
    'SELECT contact_a_id, contact_b_id FROM relationships WHERE user_id = ? AND contact_b_id IS NOT NULL'
  ).all(userId) as { contact_a_id: string; contact_b_id: string }[]

  const existingPairs = new Set(
    existingRels.map(r => [r.contact_a_id, r.contact_b_id].sort().join('-'))
  )

  // Infer relationships using AI
  try {
    const inferences = await inferRelationships(contacts, careerData, educationData)

    // Filter out existing relationships
    const newInferences = inferences.filter(inf => {
      const pairKey = [inf.contactAId, inf.contactBId].sort().join('-')
      return !existingPairs.has(pairKey)
    })

    // Create inferred relationships in database
    const created: any[] = []
    const now = new Date().toISOString()

    for (const inf of newInferences) {
      if (inf.confidence >= 0.6) { // Only create if confidence is high enough
        const id = generateId()
        db.query(`
          INSERT INTO relationships (
            id, user_id, contact_a_id, contact_b_id, is_user_relationship,
            relationship_type, strength, is_ai_inferred, confidence_score,
            verified, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, 0, ?, ?, 1, ?, 0, ?, ?)
        `).run(
          id,
          userId,
          inf.contactAId,
          inf.contactBId,
          inf.relationshipType,
          Math.round(inf.confidence * 5), // Convert confidence to strength 1-5
          inf.confidence,
          now,
          now
        )

        created.push({
          id,
          ...inf,
          strength: Math.round(inf.confidence * 5)
        })
      }
    }

    return c.json({
      data: {
        analyzed: contacts.length,
        inferred: newInferences.length,
        created: created.length,
        relationships: created
      }
    })
  } catch (error) {
    console.error('Relationship inference failed:', error)
    return c.json({ error: 'Failed to infer relationships' }, 500)
  }
})

// Generate AI summary for a contact
ai.post('/summary/:contactId', async (c) => {
  if (!isGeminiAvailable()) {
    return c.json({ error: 'AI features not available - GEMINI_API_KEY not configured' }, 503)
  }

  const db = getDb()
  const userId = c.get('user').userId
  const { contactId } = c.req.param()

  // Get contact
  const contact = db.query(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?'
  ).get(contactId, userId) as Contact | null

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  // Get career history
  const careerHistory = db.query(
    'SELECT * FROM career_history WHERE contact_id = ? ORDER BY start_date DESC'
  ).all(contactId)

  // Get education history
  const educationHistory = db.query(
    'SELECT * FROM education_history WHERE contact_id = ? ORDER BY end_year DESC'
  ).all(contactId)

  // Get interactions
  const interactions = db.query(
    'SELECT * FROM interactions WHERE contact_id = ? ORDER BY occurred_at DESC LIMIT 10'
  ).all(contactId)

  // Get relationship info
  const relationship = db.query(
    'SELECT * FROM relationships WHERE user_id = ? AND is_user_relationship = 1 AND contact_a_id = ?'
  ).get(userId, contactId)

  try {
    const summary = await generateContactSummary(
      contact,
      careerHistory,
      educationHistory,
      interactions,
      relationship
    )

    // Update contact with new summary
    const now = new Date().toISOString()
    db.query('UPDATE contacts SET ai_summary = ?, updated_at = ? WHERE id = ?').run(summary, now, contactId)

    return c.json({
      data: {
        summary,
        contact: {
          ...contact,
          ai_summary: summary
        }
      }
    })
  } catch (error) {
    console.error('Summary generation failed:', error)
    return c.json({ error: 'Failed to generate summary' }, 500)
  }
})

// Get AI-suggested interaction for a contact
ai.post('/suggest-interaction/:contactId', async (c) => {
  if (!isGeminiAvailable()) {
    return c.json({ error: 'AI features not available - GEMINI_API_KEY not configured' }, 503)
  }

  const db = getDb()
  const userId = c.get('user').userId
  const { contactId } = c.req.param()

  // Get contact
  const contact = db.query(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?'
  ).get(contactId, userId) as Contact | null

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  // Get recent interactions
  const recentInteractions = db.query(
    'SELECT * FROM interactions WHERE contact_id = ? ORDER BY occurred_at DESC LIMIT 5'
  ).all(contactId)

  // Get relationship info
  const relationship = db.query(
    'SELECT * FROM relationships WHERE user_id = ? AND is_user_relationship = 1 AND contact_a_id = ?'
  ).get(userId, contactId)

  try {
    const suggestion = await suggestInteraction(contact, recentInteractions, relationship)

    return c.json({
      data: {
        suggestion,
        contact: {
          id: contact.id,
          name: contact.name
        },
        lastInteraction: recentInteractions[0] || null
      }
    })
  } catch (error) {
    console.error('Interaction suggestion failed:', error)
    return c.json({ error: 'Failed to generate interaction suggestion' }, 500)
  }
})

export default ai
