import { Hono } from 'hono'
import { sql, generateId } from '../db/postgres.js'
import { authMiddleware } from '../middleware/auth.js'
import type { Tag, CreateTagRequest, UpdateTagRequest } from '../types/index.js'

const tags = new Hono()

// Apply auth middleware to all routes
tags.use('*', authMiddleware)

// List all tags
tags.get('/', async (c) => {
  const userId = c.get('user').userId

  const rows = await sql<Tag[]>`
    SELECT * FROM tags WHERE user_id = ${userId} ORDER BY name ASC
  `

  return c.json({ data: rows })
})

// Get single tag with contact count
tags.get('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const [tag] = await sql<Tag[]>`
    SELECT * FROM tags WHERE id = ${id} AND user_id = ${userId}
  `

  if (!tag) {
    return c.json({ error: 'Tag not found' }, 404)
  }

  // Get contact count for this tag
  const [countResult] = await sql<{ count: string }[]>`
    SELECT COUNT(*) as count FROM contact_tags WHERE tag_id = ${id}
  `

  return c.json({
    data: {
      ...tag,
      contactCount: Number(countResult.count)
    }
  })
})

// Create tag
tags.post('/', async (c) => {
  const userId = c.get('user').userId
  const body = await c.req.json<CreateTagRequest>()

  if (!body.name) {
    return c.json({ error: 'Name is required' }, 400)
  }

  // Check for duplicate name
  const [existing] = await sql`
    SELECT id FROM tags WHERE user_id = ${userId} AND name = ${body.name}
  `

  if (existing) {
    return c.json({ error: 'A tag with this name already exists' }, 409)
  }

  const id = generateId()

  await sql`
    INSERT INTO tags (id, user_id, name, color)
    VALUES (${id}, ${userId}, ${body.name}, ${body.color || null})
  `

  const [tag] = await sql<Tag[]>`SELECT * FROM tags WHERE id = ${id}`

  return c.json({ data: tag }, 201)
})

// Update tag
tags.put('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<UpdateTagRequest>()

  const [existing] = await sql<Tag[]>`
    SELECT * FROM tags WHERE id = ${id} AND user_id = ${userId}
  `

  if (!existing) {
    return c.json({ error: 'Tag not found' }, 404)
  }

  // Check for duplicate name if name is being changed
  if (body.name && body.name !== existing.name) {
    const [duplicate] = await sql`
      SELECT id FROM tags WHERE user_id = ${userId} AND name = ${body.name} AND id != ${id}
    `

    if (duplicate) {
      return c.json({ error: 'A tag with this name already exists' }, 409)
    }
  }

  // Build dynamic update
  const updates: Record<string, string | null> = {}

  if (body.name !== undefined) {
    updates.name = body.name
  }
  if (body.color !== undefined) {
    updates.color = body.color || null
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  // Update with available fields
  if (updates.name !== undefined && updates.color !== undefined) {
    await sql`UPDATE tags SET name = ${updates.name}, color = ${updates.color} WHERE id = ${id}`
  } else if (updates.name !== undefined) {
    await sql`UPDATE tags SET name = ${updates.name} WHERE id = ${id}`
  } else if (updates.color !== undefined) {
    await sql`UPDATE tags SET color = ${updates.color} WHERE id = ${id}`
  }

  const [tag] = await sql<Tag[]>`SELECT * FROM tags WHERE id = ${id}`

  return c.json({ data: tag })
})

// Delete tag
tags.delete('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const [existing] = await sql`
    SELECT * FROM tags WHERE id = ${id} AND user_id = ${userId}
  `

  if (!existing) {
    return c.json({ error: 'Tag not found' }, 404)
  }

  // Delete tag (contact_tags will cascade delete due to FK)
  await sql`DELETE FROM tags WHERE id = ${id}`

  return c.json({ message: 'Tag deleted' })
})

// Get contacts with a specific tag
tags.get('/:id/contacts', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  // Verify tag belongs to user
  const [tag] = await sql`
    SELECT * FROM tags WHERE id = ${id} AND user_id = ${userId}
  `

  if (!tag) {
    return c.json({ error: 'Tag not found' }, 404)
  }

  const contacts = await sql`
    SELECT c.* FROM contacts c
    JOIN contact_tags ct ON ct.contact_id = c.id
    WHERE ct.tag_id = ${id}
    ORDER BY c.name ASC
  `

  return c.json({ data: contacts })
})

export default tags
