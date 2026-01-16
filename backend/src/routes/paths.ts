import { Hono } from 'hono'
import { getDb, generateId } from '../db/index.js'
import { findPaths, searchPaths } from '../services/pathFinder.js'
import { generateIntroMessage, isGeminiAvailable } from '../services/gemini.js'
import { authMiddleware } from '../middleware/auth.js'
import type {
  PathSearchRequest,
  IntroductionRequest,
  CreateIntroductionRequest,
  UpdateIntroductionRequest
} from '../types/index.js'

const paths = new Hono()

// Apply auth middleware to all routes
paths.use('*', authMiddleware)

interface GenerateMessageRequest {
  path: { name: string; company?: string; relationship?: string }[]
  goal: string
  tone?: 'formal' | 'casual' | 'brief'
  senderName?: string
  senderBio?: string
}

// Search for introduction paths
paths.post('/search', async (c) => {
  const userId = c.get('user').userId
  const body = await c.req.json<PathSearchRequest>()

  if (!body.targetContactId && !body.targetDescription) {
    return c.json({ error: 'Either targetContactId or targetDescription is required' }, 400)
  }

  const maxHops = body.maxHops || 4
  const topK = body.topK || 5

  if (body.targetContactId) {
    // Direct path search to specific contact
    const pathResults = findPaths(userId, body.targetContactId, maxHops, topK)

    return c.json({
      data: {
        paths: pathResults,
        targetContactId: body.targetContactId
      }
    })
  } else {
    // Search by description
    const result = searchPaths(userId, body.targetDescription!, maxHops, topK)

    if (!result.targetContact) {
      return c.json({
        data: {
          paths: [],
          message: 'No matching contacts found'
        }
      })
    }

    return c.json({
      data: {
        paths: result.paths,
        targetContact: result.targetContact
      }
    })
  }
})

// Generate introduction message
paths.post('/generate-message', async (c) => {
  if (!isGeminiAvailable()) {
    return c.json({ error: 'AI features not available - GEMINI_API_KEY not configured' }, 503)
  }

  const body = await c.req.json<GenerateMessageRequest>()

  if (!body.path || body.path.length < 2) {
    return c.json({ error: 'Path must have at least 2 people (you and target)' }, 400)
  }

  if (!body.goal) {
    return c.json({ error: 'Goal is required' }, 400)
  }

  try {
    const message = await generateIntroMessage(body.path, body.goal, body.tone || 'formal', body.senderName, body.senderBio)

    return c.json({
      data: {
        message,
        path: body.path,
        goal: body.goal,
        tone: body.tone || 'formal'
      }
    })
  } catch (error) {
    console.error('Message generation failed:', error)
    return c.json({ error: 'Failed to generate message' }, 500)
  }
})

// ============ Introduction Requests ============

// List introduction requests
paths.get('/requests', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { status, limit = '50', offset = '0' } = c.req.query()

  let query = 'SELECT * FROM introduction_requests WHERE user_id = ?'
  const params: (string | number)[] = [userId]

  if (status) {
    query += ' AND status = ?'
    params.push(status)
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))

  const requests = db.query(query).all(...params) as IntroductionRequest[]

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM introduction_requests WHERE user_id = ?'
  const countParams: string[] = [userId]
  if (status) {
    countQuery += ' AND status = ?'
    countParams.push(status)
  }
  const countResult = db.query(countQuery).get(...countParams) as { total: number }

  return c.json({
    data: requests,
    total: countResult.total,
    limit: Number(limit),
    offset: Number(offset)
  })
})

// Get single introduction request
paths.get('/requests/:id', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const request = db.query(
    'SELECT * FROM introduction_requests WHERE id = ? AND user_id = ?'
  ).get(id, userId) as IntroductionRequest | null

  if (!request) {
    return c.json({ error: 'Introduction request not found' }, 404)
  }

  return c.json({ data: request })
})

// Create introduction request
paths.post('/requests', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const body = await c.req.json<CreateIntroductionRequest>()

  if (!body.targetContactId && !body.targetDescription) {
    return c.json({ error: 'Either targetContactId or targetDescription is required' }, 400)
  }

  // If targetContactId provided, verify it exists
  if (body.targetContactId) {
    const contact = db.query(
      'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
    ).get(body.targetContactId, userId)

    if (!contact) {
      return c.json({ error: 'Target contact not found' }, 404)
    }
  }

  const id = generateId()
  const now = new Date().toISOString()

  db.query(`
    INSERT INTO introduction_requests (
      id, user_id, target_contact_id, target_description,
      path_data, generated_message, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    body.targetContactId || null,
    body.targetDescription || null,
    body.pathData ? JSON.stringify(body.pathData) : null,
    body.generatedMessage || null,
    body.status || 'draft',
    now,
    now
  )

  const request = db.query('SELECT * FROM introduction_requests WHERE id = ?').get(id) as IntroductionRequest

  return c.json({ data: request }, 201)
})

// Update introduction request
paths.put('/requests/:id', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<UpdateIntroductionRequest>()

  const existing = db.query(
    'SELECT * FROM introduction_requests WHERE id = ? AND user_id = ?'
  ).get(id, userId) as IntroductionRequest | null

  if (!existing) {
    return c.json({ error: 'Introduction request not found' }, 404)
  }

  const updates: string[] = []
  const params: (string | null)[] = []

  if (body.status !== undefined) {
    updates.push('status = ?')
    params.push(body.status)
  }
  if (body.generatedMessage !== undefined) {
    updates.push('generated_message = ?')
    params.push(body.generatedMessage || null)
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  updates.push('updated_at = ?')
  params.push(new Date().toISOString())
  params.push(id)

  db.query(`UPDATE introduction_requests SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  const request = db.query('SELECT * FROM introduction_requests WHERE id = ?').get(id) as IntroductionRequest

  return c.json({ data: request })
})

// Delete introduction request
paths.delete('/requests/:id', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const existing = db.query(
    'SELECT * FROM introduction_requests WHERE id = ? AND user_id = ?'
  ).get(id, userId)

  if (!existing) {
    return c.json({ error: 'Introduction request not found' }, 404)
  }

  db.query('DELETE FROM introduction_requests WHERE id = ?').run(id)

  return c.json({ message: 'Introduction request deleted' })
})

export default paths
