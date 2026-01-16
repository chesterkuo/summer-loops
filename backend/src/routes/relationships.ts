import { Hono } from 'hono'
import { getDb, generateId } from '../db/index.js'
import type { CreateRelationshipRequest, UpdateRelationshipRequest, Relationship, Contact } from '../types/index.js'
import { authMiddleware } from '../middleware/auth.js'

const relationships = new Hono()

// Apply auth middleware to all routes
relationships.use('*', authMiddleware)

// List all relationships
relationships.get('/', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { contactId } = c.req.query()

  let query = 'SELECT * FROM relationships WHERE user_id = ?'
  const params: string[] = [userId]

  if (contactId) {
    query += ' AND (contact_a_id = ? OR contact_b_id = ?)'
    params.push(contactId, contactId)
  }

  query += ' ORDER BY updated_at DESC'

  const rows = db.query(query).all(...params) as Relationship[]

  return c.json({ data: rows })
})

// Get graph data for visualization
relationships.get('/graph', (c) => {
  const db = getDb()
  const userId = c.get('user').userId

  // Get all contacts for this user
  const contacts = db.query(
    'SELECT id, name, company, title FROM contacts WHERE user_id = ?'
  ).all(userId) as Pick<Contact, 'id' | 'name' | 'company' | 'title'>[]

  // Get all relationships
  const rels = db.query(
    'SELECT * FROM relationships WHERE user_id = ?'
  ).all(userId) as Relationship[]

  // Build nodes (including user as center)
  const nodes = [
    {
      id: 'user',
      name: 'You',
      company: null,
      title: null,
      degree: 0
    },
    ...contacts.map(contact => {
      // Check if direct connection to user (is_user_relationship is stored as 0/1 integer)
      const directConnection = rels.find(
        r => (r as any).is_user_relationship === 1 &&
        ((r as any).contact_a_id === contact.id || (r as any).contact_b_id === contact.id)
      )
      return {
        id: contact.id,
        name: contact.name,
        company: contact.company,
        title: contact.title,
        degree: directConnection ? 1 : 2
      }
    })
  ]

  // Build edges (using snake_case as returned from SQLite)
  const edges = rels.map(rel => {
    const r = rel as any
    return {
      source: r.is_user_relationship === 1 ? 'user' : r.contact_a_id,
      target: r.is_user_relationship === 1 ? r.contact_a_id : (r.contact_b_id || r.contact_a_id),
      strength: r.strength,
      type: r.relationship_type
    }
  })

  return c.json({
    data: {
      nodes,
      edges
    }
  })
})

// Create relationship
relationships.post('/', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const body = await c.req.json<CreateRelationshipRequest>()

  if (!body.contactAId) {
    return c.json({ error: 'contactAId is required' }, 400)
  }

  // Verify contacts exist
  const contactA = db.query(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
  ).get(body.contactAId, userId)

  if (!contactA) {
    return c.json({ error: 'Contact A not found' }, 404)
  }

  if (body.contactBId) {
    const contactB = db.query(
      'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
    ).get(body.contactBId, userId)

    if (!contactB) {
      return c.json({ error: 'Contact B not found' }, 404)
    }
  }

  // Check for duplicate
  const existing = db.query(`
    SELECT id FROM relationships
    WHERE user_id = ? AND contact_a_id = ? AND (contact_b_id = ? OR (contact_b_id IS NULL AND ? IS NULL))
  `).get(userId, body.contactAId, body.contactBId || null, body.contactBId || null)

  if (existing) {
    return c.json({ error: 'Relationship already exists' }, 409)
  }

  const id = generateId()
  const now = new Date().toISOString()

  db.query(`
    INSERT INTO relationships (
      id, user_id, contact_a_id, contact_b_id, is_user_relationship,
      relationship_type, strength, how_met, introduced_by_id,
      is_ai_inferred, verified, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    body.contactAId,
    body.contactBId || null,
    body.isUserRelationship ? 1 : 0,
    body.relationshipType || null,
    body.strength || 3,
    body.howMet || null,
    body.introducedById || null,
    0, // not AI inferred
    1, // verified since user created it
    now,
    now
  )

  const relationship = db.query('SELECT * FROM relationships WHERE id = ?').get(id) as Relationship

  return c.json({ data: relationship }, 201)
})

// Update relationship
relationships.put('/:id', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<UpdateRelationshipRequest>()

  const existing = db.query(
    'SELECT * FROM relationships WHERE id = ? AND user_id = ?'
  ).get(id, userId) as Relationship | null

  if (!existing) {
    return c.json({ error: 'Relationship not found' }, 404)
  }

  const updates: string[] = []
  const params: (string | number | null)[] = []

  if (body.relationshipType !== undefined) {
    updates.push('relationship_type = ?')
    params.push(body.relationshipType || null)
  }
  if (body.strength !== undefined) {
    updates.push('strength = ?')
    params.push(body.strength)
  }
  if (body.howMet !== undefined) {
    updates.push('how_met = ?')
    params.push(body.howMet || null)
  }
  if (body.verified !== undefined) {
    updates.push('verified = ?')
    params.push(body.verified ? 1 : 0)
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  updates.push('updated_at = ?')
  params.push(new Date().toISOString())
  params.push(id)

  db.query(`UPDATE relationships SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  const relationship = db.query('SELECT * FROM relationships WHERE id = ?').get(id) as Relationship

  return c.json({ data: relationship })
})

// Delete relationship
relationships.delete('/:id', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const existing = db.query(
    'SELECT * FROM relationships WHERE id = ? AND user_id = ?'
  ).get(id, userId) as Relationship | null

  if (!existing) {
    return c.json({ error: 'Relationship not found' }, 404)
  }

  db.query('DELETE FROM relationships WHERE id = ?').run(id)

  return c.json({ message: 'Relationship deleted successfully' })
})

// Verify AI-inferred relationship
relationships.post('/:id/verify', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<{ verified: boolean }>()

  const existing = db.query(
    'SELECT * FROM relationships WHERE id = ? AND user_id = ?'
  ).get(id, userId) as Relationship | null

  if (!existing) {
    return c.json({ error: 'Relationship not found' }, 404)
  }

  db.query(`
    UPDATE relationships SET verified = ?, updated_at = ? WHERE id = ?
  `).run(body.verified ? 1 : 0, new Date().toISOString(), id)

  const relationship = db.query('SELECT * FROM relationships WHERE id = ?').get(id) as Relationship

  return c.json({ data: relationship })
})

export default relationships
