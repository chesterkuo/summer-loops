import { Hono } from 'hono'
import { getDb, generateId } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import type { Interaction, CreateInteractionRequest } from '../types/index.js'

const interactions = new Hono()

// Apply auth middleware to all routes
interactions.use('*', authMiddleware)

// List all interactions
interactions.get('/', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { contactId, type, limit = '50', offset = '0' } = c.req.query()

  let query = 'SELECT * FROM interactions WHERE user_id = ?'
  const params: (string | number)[] = [userId]

  if (contactId) {
    query += ' AND contact_id = ?'
    params.push(contactId)
  }

  if (type) {
    query += ' AND type = ?'
    params.push(type)
  }

  query += ' ORDER BY occurred_at DESC LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))

  const rows = db.query(query).all(...params) as Interaction[]

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM interactions WHERE user_id = ?'
  const countParams: string[] = [userId]
  if (contactId) {
    countQuery += ' AND contact_id = ?'
    countParams.push(contactId)
  }
  if (type) {
    countQuery += ' AND type = ?'
    countParams.push(type)
  }
  const countResult = db.query(countQuery).get(...countParams) as { total: number }

  return c.json({
    data: rows,
    total: countResult.total,
    limit: Number(limit),
    offset: Number(offset)
  })
})

// Get single interaction
interactions.get('/:id', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const interaction = db.query(
    'SELECT * FROM interactions WHERE id = ? AND user_id = ?'
  ).get(id, userId) as Interaction | null

  if (!interaction) {
    return c.json({ error: 'Interaction not found' }, 404)
  }

  return c.json({ data: interaction })
})

// Create interaction
interactions.post('/', async (c) => {
  const db = getDb()
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
  const contact = db.query(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
  ).get(body.contactId, userId)

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const id = generateId()
  const now = new Date().toISOString()

  db.query(`
    INSERT INTO interactions (id, user_id, contact_id, type, notes, occurred_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    body.contactId,
    body.type,
    body.notes || null,
    body.occurredAt,
    now
  )

  // Update relationship last_interaction_at if relationship exists
  db.query(`
    UPDATE relationships
    SET last_interaction_at = ?, updated_at = ?
    WHERE user_id = ? AND is_user_relationship = 1 AND contact_a_id = ?
  `).run(body.occurredAt, now, userId, body.contactId)

  const interaction = db.query('SELECT * FROM interactions WHERE id = ?').get(id) as Interaction

  return c.json({ data: interaction }, 201)
})

// Update interaction
interactions.put('/:id', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<Partial<CreateInteractionRequest>>()

  const existing = db.query(
    'SELECT * FROM interactions WHERE id = ? AND user_id = ?'
  ).get(id, userId) as Interaction | null

  if (!existing) {
    return c.json({ error: 'Interaction not found' }, 404)
  }

  const updates: string[] = []
  const params: (string | null)[] = []

  if (body.type !== undefined) {
    updates.push('type = ?')
    params.push(body.type)
  }
  if (body.notes !== undefined) {
    updates.push('notes = ?')
    params.push(body.notes || null)
  }
  if (body.occurredAt !== undefined) {
    updates.push('occurred_at = ?')
    params.push(body.occurredAt)
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  params.push(id)

  db.query(`UPDATE interactions SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  const interaction = db.query('SELECT * FROM interactions WHERE id = ?').get(id) as Interaction

  return c.json({ data: interaction })
})

// Delete interaction
interactions.delete('/:id', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const existing = db.query(
    'SELECT * FROM interactions WHERE id = ? AND user_id = ?'
  ).get(id, userId)

  if (!existing) {
    return c.json({ error: 'Interaction not found' }, 404)
  }

  db.query('DELETE FROM interactions WHERE id = ?').run(id)

  return c.json({ message: 'Interaction deleted' })
})

// Get interaction reminders (contacts with no recent interactions)
interactions.get('/reminders/list', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { days = '30' } = c.req.query()

  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - Number(days))
  const cutoffDate = daysAgo.toISOString()

  // Find contacts with user relationships that haven't been interacted with recently
  const contacts = db.query(`
    SELECT c.*, r.strength, r.last_interaction_at,
           (SELECT MAX(i.occurred_at) FROM interactions i WHERE i.contact_id = c.id) as last_interaction
    FROM contacts c
    JOIN relationships r ON r.contact_a_id = c.id AND r.is_user_relationship = 1
    WHERE c.user_id = ?
    AND (
      r.last_interaction_at IS NULL
      OR r.last_interaction_at < ?
    )
    ORDER BY r.strength DESC, r.last_interaction_at ASC
    LIMIT 20
  `).all(userId, cutoffDate)

  return c.json({
    data: contacts,
    threshold: { days: Number(days), cutoffDate }
  })
})

export default interactions
