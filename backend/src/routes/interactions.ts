import { Hono } from 'hono'
import { sql, generateId } from '../db/postgres.js'
import { authMiddleware } from '../middleware/auth.js'
import type { Interaction, CreateInteractionRequest } from '../types/index.js'

const interactions = new Hono()

// Apply auth middleware to all routes
interactions.use('*', authMiddleware)

// List all interactions
interactions.get('/', async (c) => {
  const userId = c.get('user').userId
  const { contactId, type, limit = '50', offset = '0' } = c.req.query()

  const limitNum = Number(limit)
  const offsetNum = Number(offset)

  // Build query based on filters
  let rows: Interaction[]
  let totalResult: { total: string }[]

  if (contactId && type) {
    rows = await sql<Interaction[]>`
      SELECT * FROM interactions
      WHERE user_id = ${userId} AND contact_id = ${contactId} AND type = ${type}
      ORDER BY occurred_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}
    `
    totalResult = await sql<{ total: string }[]>`
      SELECT COUNT(*) as total FROM interactions
      WHERE user_id = ${userId} AND contact_id = ${contactId} AND type = ${type}
    `
  } else if (contactId) {
    rows = await sql<Interaction[]>`
      SELECT * FROM interactions
      WHERE user_id = ${userId} AND contact_id = ${contactId}
      ORDER BY occurred_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}
    `
    totalResult = await sql<{ total: string }[]>`
      SELECT COUNT(*) as total FROM interactions
      WHERE user_id = ${userId} AND contact_id = ${contactId}
    `
  } else if (type) {
    rows = await sql<Interaction[]>`
      SELECT * FROM interactions
      WHERE user_id = ${userId} AND type = ${type}
      ORDER BY occurred_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}
    `
    totalResult = await sql<{ total: string }[]>`
      SELECT COUNT(*) as total FROM interactions
      WHERE user_id = ${userId} AND type = ${type}
    `
  } else {
    rows = await sql<Interaction[]>`
      SELECT * FROM interactions
      WHERE user_id = ${userId}
      ORDER BY occurred_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}
    `
    totalResult = await sql<{ total: string }[]>`
      SELECT COUNT(*) as total FROM interactions WHERE user_id = ${userId}
    `
  }

  return c.json({
    data: rows,
    total: Number(totalResult[0].total),
    limit: limitNum,
    offset: offsetNum
  })
})

// Get single interaction
interactions.get('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const [interaction] = await sql<Interaction[]>`
    SELECT * FROM interactions WHERE id = ${id} AND user_id = ${userId}
  `

  if (!interaction) {
    return c.json({ error: 'Interaction not found' }, 404)
  }

  return c.json({ data: interaction })
})

// Create interaction
interactions.post('/', async (c) => {
  const userId = c.get('user').userId
  const body = await c.req.json<CreateInteractionRequest>()

  if (!body.contactId) {
    return c.json({ error: 'contactId is required' }, 400)
  }

  if (!body.type) {
    return c.json({ error: 'type is required' }, 400)
  }

  if (!body.occurredAt) {
    return c.json({ error: 'occurredAt is required' }, 400)
  }

  // Verify contact belongs to user
  const [contact] = await sql`
    SELECT id FROM contacts WHERE id = ${body.contactId} AND user_id = ${userId}
  `

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const id = generateId()
  const now = new Date().toISOString()

  await sql`
    INSERT INTO interactions (id, user_id, contact_id, type, title, notes, occurred_at, created_at)
    VALUES (${id}, ${userId}, ${body.contactId}, ${body.type}, ${body.title || null}, ${body.notes || null}, ${body.occurredAt}, ${now})
  `

  // Update relationship last_interaction_at if relationship exists
  await sql`
    UPDATE relationships
    SET last_interaction_at = ${body.occurredAt}, updated_at = ${now}
    WHERE user_id = ${userId} AND is_user_relationship = true AND contact_a_id = ${body.contactId}
  `

  const [interaction] = await sql<Interaction[]>`SELECT * FROM interactions WHERE id = ${id}`

  return c.json({ data: interaction }, 201)
})

// Update interaction
interactions.put('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<Partial<CreateInteractionRequest>>()

  const [existing] = await sql<Interaction[]>`
    SELECT * FROM interactions WHERE id = ${id} AND user_id = ${userId}
  `

  if (!existing) {
    return c.json({ error: 'Interaction not found' }, 404)
  }

  // Build update values
  const hasType = body.type !== undefined
  const hasNotes = body.notes !== undefined
  const hasOccurredAt = body.occurredAt !== undefined

  if (!hasType && !hasNotes && !hasOccurredAt) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  // Perform update with explicit fields
  await sql`
    UPDATE interactions SET
      type = COALESCE(${hasType ? body.type ?? null : null}, type),
      notes = ${hasNotes ? (body.notes || null) : existing.notes},
      occurred_at = COALESCE(${hasOccurredAt ? body.occurredAt ?? null : null}::timestamptz, occurred_at)
    WHERE id = ${id}
  `

  const [interaction] = await sql<Interaction[]>`SELECT * FROM interactions WHERE id = ${id}`

  return c.json({ data: interaction })
})

// Delete interaction
interactions.delete('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const [existing] = await sql`
    SELECT * FROM interactions WHERE id = ${id} AND user_id = ${userId}
  `

  if (!existing) {
    return c.json({ error: 'Interaction not found' }, 404)
  }

  await sql`DELETE FROM interactions WHERE id = ${id}`

  return c.json({ message: 'Interaction deleted' })
})

// Get interaction reminders (contacts with no recent interactions)
interactions.get('/reminders/list', async (c) => {
  const userId = c.get('user').userId
  const { days = '30' } = c.req.query()

  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - Number(days))
  const cutoffDate = daysAgo.toISOString()

  // Find contacts with user relationships that haven't been interacted with recently
  const contacts = await sql`
    SELECT c.*, r.strength, r.last_interaction_at,
           (SELECT MAX(i.occurred_at) FROM interactions i WHERE i.contact_id = c.id) as last_interaction
    FROM contacts c
    JOIN relationships r ON r.contact_a_id = c.id AND r.is_user_relationship = true
    WHERE c.user_id = ${userId}
    AND (
      r.last_interaction_at IS NULL
      OR r.last_interaction_at < ${cutoffDate}
    )
    ORDER BY r.strength DESC, r.last_interaction_at ASC
    LIMIT 20
  `

  return c.json({
    data: contacts,
    threshold: { days: Number(days), cutoffDate }
  })
})

export default interactions
