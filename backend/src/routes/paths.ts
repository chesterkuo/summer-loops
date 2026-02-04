import { Hono } from 'hono'
import { sql, generateId } from '../db/postgres.js'
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
    const pathResults = await findPaths(userId, body.targetContactId, maxHops, topK)

    return c.json({
      data: {
        paths: pathResults,
        targetContactId: body.targetContactId
      }
    })
  } else {
    // Search by description (includes cross-team search)
    const result = await searchPaths(userId, body.targetDescription!, maxHops, topK)

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
        targetContact: result.targetContact,
        isTeamContact: result.isTeamContact
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
paths.get('/requests', async (c) => {
  const userId = c.get('user').userId
  const { status, limit = '50', offset = '0' } = c.req.query()

  const limitNum = Number(limit)
  const offsetNum = Number(offset)

  let requests: IntroductionRequest[]
  let totalResult: { total: string }[]

  if (status) {
    requests = await sql<IntroductionRequest[]>`
      SELECT * FROM introduction_requests
      WHERE user_id = ${userId} AND status = ${status}
      ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}
    `
    totalResult = await sql<{ total: string }[]>`
      SELECT COUNT(*) as total FROM introduction_requests
      WHERE user_id = ${userId} AND status = ${status}
    `
  } else {
    requests = await sql<IntroductionRequest[]>`
      SELECT * FROM introduction_requests
      WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}
    `
    totalResult = await sql<{ total: string }[]>`
      SELECT COUNT(*) as total FROM introduction_requests WHERE user_id = ${userId}
    `
  }

  return c.json({
    data: requests,
    total: Number(totalResult[0].total),
    limit: limitNum,
    offset: offsetNum
  })
})

// Get single introduction request
paths.get('/requests/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const [request] = await sql<IntroductionRequest[]>`
    SELECT * FROM introduction_requests WHERE id = ${id} AND user_id = ${userId}
  `

  if (!request) {
    return c.json({ error: 'Introduction request not found' }, 404)
  }

  return c.json({ data: request })
})

// Create introduction request
paths.post('/requests', async (c) => {
  const userId = c.get('user').userId
  const body = await c.req.json<CreateIntroductionRequest>()

  if (!body.targetContactId && !body.targetDescription) {
    return c.json({ error: 'Either targetContactId or targetDescription is required' }, 400)
  }

  // If targetContactId provided, verify it exists
  if (body.targetContactId) {
    const [contact] = await sql`
      SELECT id FROM contacts WHERE id = ${body.targetContactId} AND user_id = ${userId}
    `

    if (!contact) {
      return c.json({ error: 'Target contact not found' }, 404)
    }
  }

  const id = generateId()
  const now = new Date().toISOString()

  await sql`
    INSERT INTO introduction_requests (
      id, user_id, target_contact_id, target_description,
      path_data, generated_message, status, created_at, updated_at
    )
    VALUES (
      ${id}, ${userId}, ${body.targetContactId || null}, ${body.targetDescription || null},
      ${body.pathData ? JSON.stringify(body.pathData) : null}::jsonb,
      ${body.generatedMessage || null}, ${body.status || 'draft'}, ${now}, ${now}
    )
  `

  const [request] = await sql<IntroductionRequest[]>`SELECT * FROM introduction_requests WHERE id = ${id}`

  return c.json({ data: request }, 201)
})

// Update introduction request
paths.put('/requests/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<UpdateIntroductionRequest>()

  const [existing] = await sql<IntroductionRequest[]>`
    SELECT * FROM introduction_requests WHERE id = ${id} AND user_id = ${userId}
  `

  if (!existing) {
    return c.json({ error: 'Introduction request not found' }, 404)
  }

  const hasStatus = body.status !== undefined
  const hasMessage = body.generatedMessage !== undefined

  if (!hasStatus && !hasMessage) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  const now = new Date().toISOString()

  await sql`
    UPDATE introduction_requests SET
      status = COALESCE(${hasStatus ? body.status ?? null : null}, status),
      generated_message = ${hasMessage ? (body.generatedMessage || null) : existing.generatedMessage},
      updated_at = ${now}
    WHERE id = ${id}
  `

  const [request] = await sql<IntroductionRequest[]>`SELECT * FROM introduction_requests WHERE id = ${id}`

  return c.json({ data: request })
})

// Delete introduction request
paths.delete('/requests/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const [existing] = await sql`
    SELECT * FROM introduction_requests WHERE id = ${id} AND user_id = ${userId}
  `

  if (!existing) {
    return c.json({ error: 'Introduction request not found' }, 404)
  }

  await sql`DELETE FROM introduction_requests WHERE id = ${id}`

  return c.json({ message: 'Introduction request deleted' })
})

export default paths
