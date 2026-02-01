import { Hono } from 'hono'
import { sql, generateId } from '../db/postgres.js'
import { authMiddleware } from '../middleware/auth.js'
import { isGeminiAvailable, generateContactSummary, suggestInteraction, inferRelationships, analyzeRelationshipHealth, generateMeetingBrief, processMeetingFollowUp, analyzeInteractionPatterns } from '../services/gemini.js'
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

  const userId = c.get('user').userId

  // Get all contacts with their career and education history
  const contacts = await sql<Contact[]>`
    SELECT * FROM contacts WHERE user_id = ${userId}
  `

  if (contacts.length < 2) {
    return c.json({ error: 'Need at least 2 contacts to infer relationships' }, 400)
  }

  // Get career history for all contacts
  const careerData: { [contactId: string]: { company: string; title: string | null; startDate: string | null; endDate: string | null }[] } = {}
  for (const contact of contacts) {
    const career = await sql<any[]>`
      SELECT company, title, start_date as "startDate", end_date as "endDate"
      FROM career_history WHERE contact_id = ${contact.id}
    `
    careerData[contact.id] = career
  }

  // Get education history for all contacts
  const educationData: { [contactId: string]: { school: string; degree: string | null; startYear: number | null; endYear: number | null }[] } = {}
  for (const contact of contacts) {
    const education = await sql<any[]>`
      SELECT school, degree, start_year as "startYear", end_year as "endYear"
      FROM education_history WHERE contact_id = ${contact.id}
    `
    educationData[contact.id] = education
  }

  // Get existing relationships to avoid duplicates
  const existingRels = await sql<{ contact_a_id: string; contact_b_id: string }[]>`
    SELECT contact_a_id, contact_b_id FROM relationships
    WHERE user_id = ${userId} AND contact_b_id IS NOT NULL
  `

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
        const strength = Math.round(inf.confidence * 5) // Convert confidence to strength 1-5

        await sql`
          INSERT INTO relationships (
            id, user_id, contact_a_id, contact_b_id, is_user_relationship,
            relationship_type, strength, is_ai_inferred, confidence_score,
            verified, created_at, updated_at
          )
          VALUES (
            ${id}, ${userId}, ${inf.contactAId}, ${inf.contactBId}, false,
            ${inf.relationshipType}, ${strength}, true, ${inf.confidence},
            false, ${now}, ${now}
          )
        `

        created.push({
          id,
          ...inf,
          strength
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

  const userId = c.get('user').userId
  const { contactId } = c.req.param()

  // Get contact
  const [contact] = await sql<Contact[]>`
    SELECT * FROM contacts WHERE id = ${contactId} AND user_id = ${userId}
  `

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  // Get career history
  const careerHistory = await sql`
    SELECT * FROM career_history WHERE contact_id = ${contactId} ORDER BY start_date DESC
  `

  // Get education history
  const educationHistory = await sql`
    SELECT * FROM education_history WHERE contact_id = ${contactId} ORDER BY end_year DESC
  `

  // Get interactions
  const interactions = await sql`
    SELECT * FROM interactions WHERE contact_id = ${contactId} ORDER BY occurred_at DESC LIMIT 10
  `

  // Get relationship info
  const [relationship] = await sql`
    SELECT * FROM relationships
    WHERE user_id = ${userId} AND is_user_relationship = true AND contact_a_id = ${contactId}
  `

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
    await sql`UPDATE contacts SET ai_summary = ${summary}, updated_at = ${now} WHERE id = ${contactId}`

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

  const userId = c.get('user').userId
  const { contactId } = c.req.param()

  // Get contact
  const [contact] = await sql<Contact[]>`
    SELECT * FROM contacts WHERE id = ${contactId} AND user_id = ${userId}
  `

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  // Get recent interactions
  const recentInteractions = await sql`
    SELECT * FROM interactions WHERE contact_id = ${contactId} ORDER BY occurred_at DESC LIMIT 5
  `

  // Get relationship info
  const [relationship] = await sql`
    SELECT * FROM relationships
    WHERE user_id = ${userId} AND is_user_relationship = true AND contact_a_id = ${contactId}
  `

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

// ============================================================
// v1.2 AI Features: Relationship Coach, Meeting Prep, Smart Reminders
// ============================================================

// Relationship Coach: Analyze all contacts and compute health scores
ai.post('/relationship-coach/analyze', async (c) => {
  if (!isGeminiAvailable()) {
    return c.json({ error: 'AI features not available' }, 503)
  }

  const userId = c.get('user').userId
  const locale = c.req.header('X-User-Locale') || c.req.query('locale')

  const contacts = await sql<any[]>`
    SELECT c.id, c.name, c.company, c.title
    FROM contacts c WHERE c.user_id = ${userId}
  `

  if (contacts.length === 0) {
    return c.json({ data: { analyzed: 0, results: [] } })
  }

  // Build interaction map
  const interactions = await sql<any[]>`
    SELECT contact_id, type, occurred_at, notes
    FROM interactions WHERE user_id = ${userId}
    ORDER BY occurred_at DESC
  `
  const interactionMap: Record<string, any[]> = {}
  for (const i of interactions) {
    if (!interactionMap[i.contact_id]) interactionMap[i.contact_id] = []
    interactionMap[i.contact_id].push(i)
  }

  // Build relationship map
  const relationships = await sql<any[]>`
    SELECT contact_a_id, strength, relationship_type, how_met
    FROM relationships
    WHERE user_id = ${userId} AND is_user_relationship = true
  `
  const relationshipMap: Record<string, any> = {}
  for (const r of relationships) {
    relationshipMap[r.contact_a_id] = r
  }

  try {
    const results = await analyzeRelationshipHealth(contacts, interactionMap, relationshipMap, locale)

    // Upsert results into relationship_health_scores
    const now = new Date().toISOString()
    for (const r of results) {
      const id = generateId()
      await sql`
        INSERT INTO relationship_health_scores (
          id, user_id, contact_id, health_score, days_since_interaction,
          avg_interaction_frequency_days, suggested_action, suggested_message,
          priority, computed_at
        ) VALUES (
          ${id}, ${userId}, ${r.contactId}, ${r.healthScore}, ${r.daysSinceInteraction},
          ${r.avgFrequencyDays}, ${r.suggestedAction}, ${r.suggestedMessage},
          ${r.priority}, ${now}
        )
        ON CONFLICT (user_id, contact_id) DO UPDATE SET
          health_score = EXCLUDED.health_score,
          days_since_interaction = EXCLUDED.days_since_interaction,
          avg_interaction_frequency_days = EXCLUDED.avg_interaction_frequency_days,
          suggested_action = EXCLUDED.suggested_action,
          suggested_message = EXCLUDED.suggested_message,
          priority = EXCLUDED.priority,
          computed_at = EXCLUDED.computed_at
      `
    }

    return c.json({ data: { analyzed: contacts.length, results } })
  } catch (error) {
    console.error('Relationship coach analysis failed:', error)
    return c.json({ error: 'Failed to analyze relationships' }, 500)
  }
})

// Relationship Coach: Get dashboard grouped by priority
ai.get('/relationship-coach/dashboard', async (c) => {
  const userId = c.get('user').userId

  const scores = await sql<any[]>`
    SELECT rhs.*, c.name, c.company, c.title
    FROM relationship_health_scores rhs
    JOIN contacts c ON c.id = rhs.contact_id
    WHERE rhs.user_id = ${userId}
    ORDER BY rhs.health_score ASC
  `

  const grouped = {
    urgent: scores.filter(s => s.priority === 'urgent'),
    due: scores.filter(s => s.priority === 'due'),
    maintain: scores.filter(s => s.priority === 'maintain'),
    healthy: scores.filter(s => s.priority === 'healthy'),
  }

  return c.json({ data: grouped })
})

// Meeting Prep: Generate pre-meeting brief
ai.post('/meeting/brief/:contactId', async (c) => {
  if (!isGeminiAvailable()) {
    return c.json({ error: 'AI features not available' }, 503)
  }

  const userId = c.get('user').userId
  const { contactId } = c.req.param()
  const locale = c.req.header('X-User-Locale') || c.req.query('locale')

  const [contact] = await sql<Contact[]>`
    SELECT * FROM contacts WHERE id = ${contactId} AND user_id = ${userId}
  `
  if (!contact) return c.json({ error: 'Contact not found' }, 404)

  // Check for cached brief (valid 24h, same locale)
  const effectiveLocale = locale || 'zh-TW'
  const [cached] = await sql<any[]>`
    SELECT * FROM meeting_briefs
    WHERE user_id = ${userId} AND contact_id = ${contactId}
    AND expires_at > NOW()
    AND (locale = ${effectiveLocale} OR locale IS NULL)
    ORDER BY created_at DESC LIMIT 1
  `
  if (cached && cached.locale === effectiveLocale) {
    return c.json({ data: cached.brief_content })
  }

  const careerHistory = await sql`
    SELECT * FROM career_history WHERE contact_id = ${contactId} ORDER BY start_date DESC
  `
  const educationHistory = await sql`
    SELECT * FROM education_history WHERE contact_id = ${contactId} ORDER BY end_year DESC
  `
  const interactions = await sql`
    SELECT * FROM interactions WHERE contact_id = ${contactId} ORDER BY occurred_at DESC LIMIT 10
  `
  const [relationship] = await sql`
    SELECT * FROM relationships
    WHERE user_id = ${userId} AND is_user_relationship = true AND contact_a_id = ${contactId}
  `

  // Find mutual contacts (contacts that share a relationship with this contact)
  const mutualContacts = await sql<{ name: string; company: string | null }[]>`
    SELECT DISTINCT c.name, c.company FROM relationships r
    JOIN contacts c ON c.id = r.contact_a_id
    WHERE r.user_id = ${userId}
    AND r.contact_b_id = ${contactId}
    AND r.is_user_relationship = false
  `

  try {
    const brief = await generateMeetingBrief(
      contact, careerHistory, educationHistory, interactions,
      relationship, mutualContacts, locale
    )

    // Cache the brief for 24h
    const id = generateId()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await sql`
      INSERT INTO meeting_briefs (id, user_id, contact_id, brief_content, expires_at, locale)
      VALUES (${id}, ${userId}, ${contactId}, ${JSON.stringify(brief)}, ${expiresAt}, ${effectiveLocale})
    `

    return c.json({ data: brief })
  } catch (error) {
    console.error('Meeting brief generation failed:', error)
    return c.json({ error: 'Failed to generate meeting brief' }, 500)
  }
})

// Meeting Follow-Up: Process post-meeting note
ai.post('/meeting/follow-up/:contactId', async (c) => {
  if (!isGeminiAvailable()) {
    return c.json({ error: 'AI features not available' }, 503)
  }

  const userId = c.get('user').userId
  const { contactId } = c.req.param()
  const locale = c.req.header('X-User-Locale') || c.req.query('locale')
  const { noteText } = await c.req.json<{ noteText: string }>()

  if (!noteText || !noteText.trim()) {
    return c.json({ error: 'noteText is required' }, 400)
  }

  const [contact] = await sql<Contact[]>`
    SELECT * FROM contacts WHERE id = ${contactId} AND user_id = ${userId}
  `
  if (!contact) return c.json({ error: 'Contact not found' }, 404)

  try {
    const result = await processMeetingFollowUp(contact, noteText, locale)

    // Auto-create interaction
    const interactionId = generateId()
    const now = new Date().toISOString()
    await sql`
      INSERT INTO interactions (id, user_id, contact_id, type, notes, occurred_at, created_at)
      VALUES (${interactionId}, ${userId}, ${contactId}, ${result.interactionType}, ${result.cleanedNotes}, ${now}, ${now})
    `

    // Auto-create follow-up reminder if suggested
    let createdReminder = null
    if (result.followUpSuggestion) {
      const reminderId = generateId()
      const remindAt = new Date(Date.now() + result.followUpSuggestion.daysFromNow * 24 * 60 * 60 * 1000).toISOString()
      await sql`
        INSERT INTO notifications (id, user_id, contact_id, note, remind_at, status, created_at)
        VALUES (${reminderId}, ${userId}, ${contactId}, ${result.followUpSuggestion.note}, ${remindAt}, 'pending', ${now})
      `
      createdReminder = { id: reminderId, note: result.followUpSuggestion.note, remindAt }
    }

    return c.json({
      data: {
        ...result,
        createdInteraction: { id: interactionId, type: result.interactionType, notes: result.cleanedNotes },
        createdReminder
      }
    })
  } catch (error) {
    console.error('Meeting follow-up processing failed:', error)
    return c.json({ error: 'Failed to process meeting follow-up' }, 500)
  }
})

// Smart Reminders: Analyze interaction patterns and create suggestions
ai.post('/smart-reminders/analyze', async (c) => {
  if (!isGeminiAvailable()) {
    return c.json({ error: 'AI features not available' }, 503)
  }

  const userId = c.get('user').userId
  const locale = c.req.header('X-User-Locale') || c.req.query('locale')

  // Get contacts with relationship strength
  const contacts = await sql<any[]>`
    SELECT c.id, c.name, c.company,
      COALESCE(r.strength, 3) as strength
    FROM contacts c
    LEFT JOIN relationships r ON r.contact_a_id = c.id AND r.user_id = c.user_id AND r.is_user_relationship = true
    WHERE c.user_id = ${userId}
  `

  if (contacts.length === 0) {
    return c.json({ data: { analyzed: 0, suggestions: [] } })
  }

  // Build interaction map
  const interactions = await sql<any[]>`
    SELECT contact_id, type, occurred_at
    FROM interactions WHERE user_id = ${userId}
    ORDER BY occurred_at DESC
  `
  const interactionMap: Record<string, any[]> = {}
  for (const i of interactions) {
    if (!interactionMap[i.contact_id]) interactionMap[i.contact_id] = []
    interactionMap[i.contact_id].push(i)
  }

  try {
    const results = await analyzeInteractionPatterns(contacts, interactionMap, locale)

    // Store suggestions in DB
    const now = new Date().toISOString()
    for (const r of results) {
      const id = generateId()
      await sql`
        INSERT INTO smart_reminder_suggestions (
          id, user_id, contact_id, suggestion_text, reason,
          suggested_date, confidence, status, created_at
        ) VALUES (
          ${id}, ${userId}, ${r.contactId}, ${r.suggestionText}, ${r.reason},
          ${r.suggestedDate}, ${r.confidence}, 'pending', ${now}
        )
      `
    }

    return c.json({ data: { analyzed: contacts.length, suggestions: results } })
  } catch (error) {
    console.error('Smart reminders analysis failed:', error)
    return c.json({ error: 'Failed to analyze interaction patterns' }, 500)
  }
})

// Smart Reminders: List pending suggestions
ai.get('/smart-reminders/suggestions', async (c) => {
  const userId = c.get('user').userId

  const suggestions = await sql<any[]>`
    SELECT s.*, c.name, c.company, c.title
    FROM smart_reminder_suggestions s
    JOIN contacts c ON c.id = s.contact_id
    WHERE s.user_id = ${userId} AND s.status = 'pending'
    ORDER BY s.confidence DESC, s.suggested_date ASC
  `

  return c.json({ data: suggestions })
})

// Smart Reminders: Accept suggestion → create real notification
ai.post('/smart-reminders/accept/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const [suggestion] = await sql<any[]>`
    SELECT * FROM smart_reminder_suggestions
    WHERE id = ${id} AND user_id = ${userId} AND status = 'pending'
  `
  if (!suggestion) return c.json({ error: 'Suggestion not found' }, 404)

  const now = new Date().toISOString()

  // Create real notification
  const notificationId = generateId()
  await sql`
    INSERT INTO notifications (id, user_id, contact_id, note, remind_at, status, created_at)
    VALUES (${notificationId}, ${userId}, ${suggestion.contact_id}, ${suggestion.suggestion_text}, ${suggestion.suggested_date}, 'pending', ${now})
  `

  // Mark suggestion as accepted
  await sql`
    UPDATE smart_reminder_suggestions SET status = 'accepted' WHERE id = ${id}
  `

  return c.json({ data: { notificationId, suggestion } })
})

// Smart Reminders: Dismiss suggestion
ai.post('/smart-reminders/dismiss/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const [suggestion] = await sql<any[]>`
    SELECT * FROM smart_reminder_suggestions
    WHERE id = ${id} AND user_id = ${userId} AND status = 'pending'
  `
  if (!suggestion) return c.json({ error: 'Suggestion not found' }, 404)

  await sql`
    UPDATE smart_reminder_suggestions SET status = 'dismissed' WHERE id = ${id}
  `

  return c.json({ data: { dismissed: true } })
})

export default ai
