import { Hono } from 'hono'
import { getDb, generateId } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import type { Tag, CreateTagRequest, UpdateTagRequest } from '../types/index.js'

const tags = new Hono()

// Apply auth middleware to all routes
tags.use('*', authMiddleware)

// List all tags
tags.get('/', (c) => {
  const db = getDb()
  const userId = c.get('user').userId

  const rows = db.query(
    'SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC'
  ).all(userId) as Tag[]

  return c.json({ data: rows })
})

// Get single tag with contact count
tags.get('/:id', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const tag = db.query(
    'SELECT * FROM tags WHERE id = ? AND user_id = ?'
  ).get(id, userId) as Tag | null

  if (!tag) {
    return c.json({ error: 'Tag not found' }, 404)
  }

  // Get contact count for this tag
  const countResult = db.query(
    'SELECT COUNT(*) as count FROM contact_tags WHERE tag_id = ?'
  ).get(id) as { count: number }

  return c.json({
    data: {
      ...tag,
      contactCount: countResult.count
    }
  })
})

// Create tag
tags.post('/', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const body = await c.req.json<CreateTagRequest>()

  if (!body.name) {
    return c.json({ error: 'Name is required' }, 400)
  }

  // Check for duplicate name
  const existing = db.query(
    'SELECT id FROM tags WHERE user_id = ? AND name = ?'
  ).get(userId, body.name)

  if (existing) {
    return c.json({ error: 'A tag with this name already exists' }, 409)
  }

  const id = generateId()

  db.query(`
    INSERT INTO tags (id, user_id, name, color)
    VALUES (?, ?, ?, ?)
  `).run(
    id,
    userId,
    body.name,
    body.color || null
  )

  const tag = db.query('SELECT * FROM tags WHERE id = ?').get(id) as Tag

  return c.json({ data: tag }, 201)
})

// Update tag
tags.put('/:id', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<UpdateTagRequest>()

  const existing = db.query(
    'SELECT * FROM tags WHERE id = ? AND user_id = ?'
  ).get(id, userId) as Tag | null

  if (!existing) {
    return c.json({ error: 'Tag not found' }, 404)
  }

  // Check for duplicate name if name is being changed
  if (body.name && body.name !== existing.name) {
    const duplicate = db.query(
      'SELECT id FROM tags WHERE user_id = ? AND name = ? AND id != ?'
    ).get(userId, body.name, id)

    if (duplicate) {
      return c.json({ error: 'A tag with this name already exists' }, 409)
    }
  }

  const updates: string[] = []
  const params: (string | null)[] = []

  if (body.name !== undefined) {
    updates.push('name = ?')
    params.push(body.name)
  }
  if (body.color !== undefined) {
    updates.push('color = ?')
    params.push(body.color || null)
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  params.push(id)

  db.query(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  const tag = db.query('SELECT * FROM tags WHERE id = ?').get(id) as Tag

  return c.json({ data: tag })
})

// Delete tag
tags.delete('/:id', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const existing = db.query(
    'SELECT * FROM tags WHERE id = ? AND user_id = ?'
  ).get(id, userId)

  if (!existing) {
    return c.json({ error: 'Tag not found' }, 404)
  }

  // Delete tag (contact_tags will cascade delete due to FK)
  db.query('DELETE FROM tags WHERE id = ?').run(id)

  return c.json({ message: 'Tag deleted' })
})

// Get contacts with a specific tag
tags.get('/:id/contacts', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  // Verify tag belongs to user
  const tag = db.query(
    'SELECT * FROM tags WHERE id = ? AND user_id = ?'
  ).get(id, userId)

  if (!tag) {
    return c.json({ error: 'Tag not found' }, 404)
  }

  const contacts = db.query(`
    SELECT c.* FROM contacts c
    JOIN contact_tags ct ON ct.contact_id = c.id
    WHERE ct.tag_id = ?
    ORDER BY c.name ASC
  `).all(id)

  return c.json({ data: contacts })
})

export default tags
