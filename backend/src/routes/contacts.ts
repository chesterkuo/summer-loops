import { Hono } from 'hono'
import { getDb, generateId } from '../db/index.js'
import type {
  CreateContactRequest,
  UpdateContactRequest,
  Contact,
  CreateCareerHistoryRequest,
  CreateEducationHistoryRequest,
  CareerHistory,
  EducationHistory
} from '../types/index.js'
import { scanBusinessCard, parseNaturalLanguage, isGeminiAvailable } from '../services/gemini.js'
import { authMiddleware } from '../middleware/auth.js'

const contacts = new Hono()

// Apply auth middleware to all routes
contacts.use('*', authMiddleware)

// List all contacts
contacts.get('/', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { search, company, limit = '50', offset = '0' } = c.req.query()

  let query = 'SELECT * FROM contacts WHERE user_id = ?'
  const params: (string | number)[] = [userId]

  if (search) {
    query += ' AND (name LIKE ? OR company LIKE ? OR title LIKE ? OR email LIKE ?)'
    const searchPattern = `%${search}%`
    params.push(searchPattern, searchPattern, searchPattern, searchPattern)
  }

  if (company) {
    query += ' AND company = ?'
    params.push(company)
  }

  query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))

  const rows = db.query(query).all(...params) as Contact[]

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM contacts WHERE user_id = ?'
  const countParams: string[] = [userId]
  if (search) {
    countQuery += ' AND (name LIKE ? OR company LIKE ? OR title LIKE ? OR email LIKE ?)'
    const searchPattern = `%${search}%`
    countParams.push(searchPattern, searchPattern, searchPattern, searchPattern)
  }
  if (company) {
    countQuery += ' AND company = ?'
    countParams.push(company)
  }
  const countResult = db.query(countQuery).get(...countParams) as { total: number }

  return c.json({
    data: rows,
    total: countResult.total,
    limit: Number(limit),
    offset: Number(offset),
    hasMore: Number(offset) + rows.length < countResult.total
  })
})

// Get single contact
contacts.get('/:id', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const contact = db.query(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?'
  ).get(id, userId) as Contact | null

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  return c.json({ data: contact })
})

// Create contact
contacts.post('/', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const body = await c.req.json<CreateContactRequest>()

  if (!body.name) {
    return c.json({ error: 'Name is required' }, 400)
  }

  const id = generateId()
  const now = new Date().toISOString()

  db.query(`
    INSERT INTO contacts (id, user_id, name, company, title, email, phone, linkedin_url, notes, source,
      line_id, telegram_username, whatsapp_number, wechat_id, twitter_handle, facebook_url, instagram_handle,
      created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    body.name,
    body.company || null,
    body.title || null,
    body.email || null,
    body.phone || null,
    body.linkedinUrl || null,
    body.notes || null,
    body.source || 'manual',
    body.lineId || null,
    body.telegramUsername || null,
    body.whatsappNumber || null,
    body.wechatId || null,
    body.twitterHandle || null,
    body.facebookUrl || null,
    body.instagramHandle || null,
    now,
    now
  )

  // Automatically create a direct (1st degree) relationship between user and contact
  const relationshipId = generateId()
  db.query(`
    INSERT INTO relationships (id, user_id, contact_a_id, contact_b_id, is_user_relationship, relationship_type, strength, verified, created_at, updated_at)
    VALUES (?, ?, ?, NULL, 1, 'direct', 5, 1, ?, ?)
  `).run(
    relationshipId,
    userId,
    id,
    now,
    now
  )

  const contact = db.query('SELECT * FROM contacts WHERE id = ?').get(id) as Contact

  return c.json({ data: contact }, 201)
})

// Update contact
contacts.put('/:id', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<UpdateContactRequest>()

  // Check if contact exists
  const existing = db.query(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?'
  ).get(id, userId) as Contact | null

  if (!existing) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const updates: string[] = []
  const params: (string | null)[] = []

  if (body.name !== undefined) {
    updates.push('name = ?')
    params.push(body.name)
  }
  if (body.company !== undefined) {
    updates.push('company = ?')
    params.push(body.company || null)
  }
  if (body.title !== undefined) {
    updates.push('title = ?')
    params.push(body.title || null)
  }
  if (body.email !== undefined) {
    updates.push('email = ?')
    params.push(body.email || null)
  }
  if (body.phone !== undefined) {
    updates.push('phone = ?')
    params.push(body.phone || null)
  }
  if (body.linkedinUrl !== undefined) {
    updates.push('linkedin_url = ?')
    params.push(body.linkedinUrl || null)
  }
  if (body.notes !== undefined) {
    updates.push('notes = ?')
    params.push(body.notes || null)
  }
  if (body.aiSummary !== undefined) {
    updates.push('ai_summary = ?')
    params.push(body.aiSummary || null)
  }
  // Social media fields
  if (body.lineId !== undefined) {
    updates.push('line_id = ?')
    params.push(body.lineId || null)
  }
  if (body.telegramUsername !== undefined) {
    updates.push('telegram_username = ?')
    params.push(body.telegramUsername || null)
  }
  if (body.whatsappNumber !== undefined) {
    updates.push('whatsapp_number = ?')
    params.push(body.whatsappNumber || null)
  }
  if (body.wechatId !== undefined) {
    updates.push('wechat_id = ?')
    params.push(body.wechatId || null)
  }
  if (body.twitterHandle !== undefined) {
    updates.push('twitter_handle = ?')
    params.push(body.twitterHandle || null)
  }
  if (body.facebookUrl !== undefined) {
    updates.push('facebook_url = ?')
    params.push(body.facebookUrl || null)
  }
  if (body.instagramHandle !== undefined) {
    updates.push('instagram_handle = ?')
    params.push(body.instagramHandle || null)
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  updates.push('updated_at = ?')
  params.push(new Date().toISOString())
  params.push(id)

  db.query(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  const contact = db.query('SELECT * FROM contacts WHERE id = ?').get(id) as Contact

  return c.json({ data: contact })
})

// Delete contact
contacts.delete('/:id', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const existing = db.query(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?'
  ).get(id, userId) as Contact | null

  if (!existing) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  db.query('DELETE FROM contacts WHERE id = ?').run(id)

  return c.json({ message: 'Contact deleted successfully' })
})

// Scan business card with OCR
contacts.post('/scan', async (c) => {
  if (!isGeminiAvailable()) {
    return c.json({ error: 'AI features not available - GEMINI_API_KEY not configured' }, 503)
  }

  const contentType = c.req.header('content-type') || ''

  let imageBase64: string
  let mimeType: string = 'image/jpeg'

  if (contentType.includes('multipart/form-data')) {
    // Handle file upload
    const formData = await c.req.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return c.json({ error: 'No image file provided' }, 400)
    }

    mimeType = file.type || 'image/jpeg'
    const arrayBuffer = await file.arrayBuffer()
    imageBase64 = Buffer.from(arrayBuffer).toString('base64')
  } else if (contentType.includes('application/json')) {
    // Handle base64 JSON payload
    const body = await c.req.json<{ image: string; mimeType?: string }>()

    if (!body.image) {
      return c.json({ error: 'No image data provided' }, 400)
    }

    // Remove data URL prefix if present
    imageBase64 = body.image.replace(/^data:image\/\w+;base64,/, '')
    mimeType = body.mimeType || 'image/jpeg'
  } else {
    return c.json({ error: 'Unsupported content type' }, 400)
  }

  try {
    const scannedData = await scanBusinessCard(imageBase64, mimeType)

    return c.json({
      data: {
        scanned: scannedData,
        // Prepare for contact creation
        contact: {
          name: scannedData.name,
          company: scannedData.company,
          title: scannedData.title,
          email: scannedData.email,
          phone: scannedData.phone?.join(', '),
          linkedinUrl: scannedData.social?.linkedin,
          source: 'card_scan',
          sourceMetadata: JSON.stringify(scannedData)
        }
      }
    })
  } catch (error) {
    console.error('OCR scan failed:', error)
    return c.json({ error: 'Failed to scan business card' }, 500)
  }
})

// Parse natural language input
contacts.post('/parse', async (c) => {
  if (!isGeminiAvailable()) {
    return c.json({ error: 'AI features not available - GEMINI_API_KEY not configured' }, 503)
  }

  const body = await c.req.json<{ text: string }>()

  if (!body.text) {
    return c.json({ error: 'No text provided' }, 400)
  }

  try {
    const parsedData = await parseNaturalLanguage(body.text)

    return c.json({
      data: {
        parsed: parsedData,
        // Prepare for contact creation
        contact: {
          name: parsedData.name,
          company: parsedData.company,
          title: parsedData.title,
          notes: [
            parsedData.howMet?.event ? `Met at: ${parsedData.howMet.event}` : '',
            parsedData.howMet?.introducer ? `Introduced by: ${parsedData.howMet.introducer}` : '',
            parsedData.notes || ''
          ].filter(Boolean).join('\n'),
          source: 'natural_language',
          sourceMetadata: JSON.stringify(parsedData)
        }
      }
    })
  } catch (error) {
    console.error('NL parse failed:', error)
    return c.json({ error: 'Failed to parse text' }, 500)
  }
})

// ============ Career History ============

// Get career history for a contact
contacts.get('/:id/career', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  // Verify contact belongs to user
  const contact = db.query(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
  ).get(id, userId)

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const history = db.query(
    'SELECT * FROM career_history WHERE contact_id = ? ORDER BY start_date DESC'
  ).all(id) as CareerHistory[]

  return c.json({ data: history })
})

// Add career history entry
contacts.post('/:id/career', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<CreateCareerHistoryRequest>()

  // Verify contact belongs to user
  const contact = db.query(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
  ).get(id, userId)

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  if (!body.company) {
    return c.json({ error: 'Company is required' }, 400)
  }

  const entryId = generateId()
  const now = new Date().toISOString()

  db.query(`
    INSERT INTO career_history (id, contact_id, company, title, start_date, end_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    entryId,
    id,
    body.company,
    body.title || null,
    body.startDate || null,
    body.endDate || null,
    now
  )

  const entry = db.query('SELECT * FROM career_history WHERE id = ?').get(entryId) as CareerHistory

  return c.json({ data: entry }, 201)
})

// Delete career history entry
contacts.delete('/:id/career/:entryId', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id, entryId } = c.req.param()

  // Verify contact belongs to user
  const contact = db.query(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
  ).get(id, userId)

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const entry = db.query(
    'SELECT id FROM career_history WHERE id = ? AND contact_id = ?'
  ).get(entryId, id)

  if (!entry) {
    return c.json({ error: 'Career history entry not found' }, 404)
  }

  db.query('DELETE FROM career_history WHERE id = ?').run(entryId)

  return c.json({ message: 'Career history entry deleted' })
})

// ============ Education History ============

// Get education history for a contact
contacts.get('/:id/education', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  // Verify contact belongs to user
  const contact = db.query(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
  ).get(id, userId)

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const history = db.query(
    'SELECT * FROM education_history WHERE contact_id = ? ORDER BY end_year DESC'
  ).all(id) as EducationHistory[]

  return c.json({ data: history })
})

// Add education history entry
contacts.post('/:id/education', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<CreateEducationHistoryRequest>()

  // Verify contact belongs to user
  const contact = db.query(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
  ).get(id, userId)

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  if (!body.school) {
    return c.json({ error: 'School is required' }, 400)
  }

  const entryId = generateId()
  const now = new Date().toISOString()

  db.query(`
    INSERT INTO education_history (id, contact_id, school, degree, field, start_year, end_year, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entryId,
    id,
    body.school,
    body.degree || null,
    body.field || null,
    body.startYear || null,
    body.endYear || null,
    now
  )

  const entry = db.query('SELECT * FROM education_history WHERE id = ?').get(entryId) as EducationHistory

  return c.json({ data: entry }, 201)
})

// Delete education history entry
contacts.delete('/:id/education/:entryId', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id, entryId } = c.req.param()

  // Verify contact belongs to user
  const contact = db.query(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
  ).get(id, userId)

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const entry = db.query(
    'SELECT id FROM education_history WHERE id = ? AND contact_id = ?'
  ).get(entryId, id)

  if (!entry) {
    return c.json({ error: 'Education history entry not found' }, 404)
  }

  db.query('DELETE FROM education_history WHERE id = ?').run(entryId)

  return c.json({ message: 'Education history entry deleted' })
})

// ============ Tags for Contacts ============

// Get tags for a contact
contacts.get('/:id/tags', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  // Verify contact belongs to user
  const contact = db.query(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
  ).get(id, userId)

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const tags = db.query(`
    SELECT t.* FROM tags t
    JOIN contact_tags ct ON ct.tag_id = t.id
    WHERE ct.contact_id = ?
  `).all(id)

  return c.json({ data: tags })
})

// Add tag to contact
contacts.post('/:id/tags', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<{ tagId: string }>()

  // Verify contact belongs to user
  const contact = db.query(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
  ).get(id, userId)

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  // Verify tag belongs to user
  const tag = db.query(
    'SELECT id FROM tags WHERE id = ? AND user_id = ?'
  ).get(body.tagId, userId)

  if (!tag) {
    return c.json({ error: 'Tag not found' }, 404)
  }

  // Check if already tagged
  const existing = db.query(
    'SELECT * FROM contact_tags WHERE contact_id = ? AND tag_id = ?'
  ).get(id, body.tagId)

  if (existing) {
    return c.json({ error: 'Tag already applied to contact' }, 409)
  }

  db.query('INSERT INTO contact_tags (contact_id, tag_id) VALUES (?, ?)').run(id, body.tagId)

  return c.json({ message: 'Tag added to contact' }, 201)
})

// Remove tag from contact
contacts.delete('/:id/tags/:tagId', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id, tagId } = c.req.param()

  // Verify contact belongs to user
  const contact = db.query(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
  ).get(id, userId)

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const existing = db.query(
    'SELECT * FROM contact_tags WHERE contact_id = ? AND tag_id = ?'
  ).get(id, tagId)

  if (!existing) {
    return c.json({ error: 'Tag not found on contact' }, 404)
  }

  db.query('DELETE FROM contact_tags WHERE contact_id = ? AND tag_id = ?').run(id, tagId)

  return c.json({ message: 'Tag removed from contact' })
})

// ============ LinkedIn Import ============

// Import contact from LinkedIn URL (placeholder - requires LinkedIn API or scraping)
contacts.post('/import-linkedin', async (c) => {
  const userId = c.get('user').userId
  const body = await c.req.json<{ linkedinUrl: string }>()

  if (!body.linkedinUrl) {
    return c.json({ error: 'LinkedIn URL is required' }, 400)
  }

  // Validate LinkedIn URL format
  const linkedinRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/
  if (!linkedinRegex.test(body.linkedinUrl)) {
    return c.json({ error: 'Invalid LinkedIn URL format' }, 400)
  }

  // Note: Full LinkedIn import would require LinkedIn API access or web scraping
  // For now, we create a placeholder contact with the LinkedIn URL
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()

  // Extract username from URL for placeholder name
  const username = body.linkedinUrl.match(/linkedin\.com\/in\/([\w-]+)/)?.[1] || 'Unknown'

  db.query(`
    INSERT INTO contacts (id, user_id, name, linkedin_url, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    username.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    body.linkedinUrl,
    'linkedin',
    now,
    now
  )

  const contact = db.query('SELECT * FROM contacts WHERE id = ?').get(id) as Contact

  return c.json({
    data: contact,
    message: 'Contact created from LinkedIn URL. Please update with additional details.'
  }, 201)
})

export default contacts
