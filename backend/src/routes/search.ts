import { Hono } from 'hono'
import { getDb } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { parseNaturalLanguage, isGeminiAvailable } from '../services/gemini.js'
import type { Contact } from '../types/index.js'

const search = new Hono()

// Apply auth middleware to all routes
search.use('*', authMiddleware)

interface SearchResult {
  contact: Contact
  score: number
  matchedFields: string[]
}

// Natural language search
search.post('/', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const body = await c.req.json<{ query: string; limit?: number }>()

  if (!body.query) {
    return c.json({ error: 'Query is required' }, 400)
  }

  const limit = body.limit || 20
  const query = body.query.toLowerCase()

  // Parse query with AI if available for better understanding
  let parsedQuery: any = null
  if (isGeminiAvailable()) {
    try {
      parsedQuery = await parseNaturalLanguage(body.query)
    } catch (e) {
      // Continue with basic search if AI fails
    }
  }

  // Build search based on parsed query or raw text
  const searchTerms: string[] = []
  const searchParams: any[] = [userId]

  // Extract search terms from parsed query or use raw query
  if (parsedQuery?.name) {
    searchTerms.push('name LIKE ?')
    searchParams.push(`%${parsedQuery.name}%`)
  }
  if (parsedQuery?.company) {
    searchTerms.push('company LIKE ?')
    searchParams.push(`%${parsedQuery.company}%`)
  }
  if (parsedQuery?.title) {
    searchTerms.push('title LIKE ?')
    searchParams.push(`%${parsedQuery.title}%`)
  }
  if (parsedQuery?.industry) {
    searchTerms.push('(company LIKE ? OR title LIKE ? OR notes LIKE ?)')
    searchParams.push(`%${parsedQuery.industry}%`, `%${parsedQuery.industry}%`, `%${parsedQuery.industry}%`)
  }

  // If no parsed terms, do a broad search
  if (searchTerms.length === 0) {
    const words = query.split(/\s+/).filter(w => w.length > 2)
    for (const word of words) {
      searchTerms.push('(name LIKE ? OR company LIKE ? OR title LIKE ? OR notes LIKE ? OR email LIKE ?)')
      searchParams.push(`%${word}%`, `%${word}%`, `%${word}%`, `%${word}%`, `%${word}%`)
    }
  }

  // Build the final query
  let sqlQuery = 'SELECT * FROM contacts WHERE user_id = ?'
  if (searchTerms.length > 0) {
    sqlQuery += ' AND (' + searchTerms.join(' OR ') + ')'
  }
  sqlQuery += ` ORDER BY updated_at DESC LIMIT ${limit}`

  const contacts = db.query(sqlQuery).all(...searchParams) as Contact[]

  // Calculate relevance scores
  const results: SearchResult[] = contacts.map(contact => {
    let score = 0
    const matchedFields: string[] = []

    // Score based on matches
    if (contact.name.toLowerCase().includes(query)) {
      score += 10
      matchedFields.push('name')
    }
    if (contact.company?.toLowerCase().includes(query)) {
      score += 5
      matchedFields.push('company')
    }
    if (contact.title?.toLowerCase().includes(query)) {
      score += 5
      matchedFields.push('title')
    }
    if (contact.notes?.toLowerCase().includes(query)) {
      score += 2
      matchedFields.push('notes')
    }

    // Boost for parsed query matches
    if (parsedQuery) {
      if (parsedQuery.name && contact.name.toLowerCase().includes(parsedQuery.name.toLowerCase())) {
        score += 15
      }
      if (parsedQuery.company && contact.company?.toLowerCase().includes(parsedQuery.company.toLowerCase())) {
        score += 10
      }
    }

    return { contact, score, matchedFields }
  })

  // Sort by score descending
  results.sort((a, b) => b.score - a.score)

  return c.json({
    data: results,
    query: body.query,
    parsedQuery,
    total: results.length
  })
})

// Find similar contacts
search.get('/similar/:contactId', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { contactId } = c.req.param()
  const { limit = '10' } = c.req.query()

  // Get the reference contact
  const refContact = db.query(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?'
  ).get(contactId, userId) as Contact | null

  if (!refContact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  // Find similar contacts based on company, title keywords, and career history
  const similarContacts: (Contact & { similarityScore: number; similarityReasons: string[] })[] = []

  // Get all other contacts
  const allContacts = db.query(
    'SELECT * FROM contacts WHERE user_id = ? AND id != ?'
  ).all(userId, contactId) as Contact[]

  // Get career history for reference contact
  const refCareer = db.query(
    'SELECT company FROM career_history WHERE contact_id = ?'
  ).all(contactId) as { company: string }[]
  const refCompanies = new Set([
    refContact.company?.toLowerCase(),
    ...refCareer.map(c => c.company.toLowerCase())
  ].filter(Boolean))

  // Get education history for reference contact
  const refEducation = db.query(
    'SELECT school FROM education_history WHERE contact_id = ?'
  ).all(contactId) as { school: string }[]
  const refSchools = new Set(refEducation.map(e => e.school.toLowerCase()))

  for (const contact of allContacts) {
    let score = 0
    const reasons: string[] = []

    // Same current company
    if (refContact.company && contact.company &&
        refContact.company.toLowerCase() === contact.company.toLowerCase()) {
      score += 20
      reasons.push('Same company')
    }

    // Similar title keywords
    if (refContact.title && contact.title) {
      const refWords = new Set(refContact.title.toLowerCase().split(/\s+/))
      const contactWords = contact.title.toLowerCase().split(/\s+/)
      const matches = contactWords.filter(w => refWords.has(w) && w.length > 3)
      if (matches.length > 0) {
        score += matches.length * 3
        reasons.push('Similar title')
      }
    }

    // Worked at same company (career history)
    const contactCareer = db.query(
      'SELECT company FROM career_history WHERE contact_id = ?'
    ).all(contact.id) as { company: string }[]
    const contactCompanies = new Set([
      contact.company?.toLowerCase(),
      ...contactCareer.map(c => c.company.toLowerCase())
    ].filter(Boolean))

    for (const company of contactCompanies) {
      if (refCompanies.has(company)) {
        score += 15
        reasons.push(`Worked at ${company}`)
        break
      }
    }

    // Same school
    const contactEducation = db.query(
      'SELECT school FROM education_history WHERE contact_id = ?'
    ).all(contact.id) as { school: string }[]
    for (const edu of contactEducation) {
      if (refSchools.has(edu.school.toLowerCase())) {
        score += 10
        reasons.push(`Attended ${edu.school}`)
        break
      }
    }

    if (score > 0) {
      similarContacts.push({
        ...contact,
        similarityScore: score,
        similarityReasons: [...new Set(reasons)]
      })
    }
  }

  // Sort by similarity score
  similarContacts.sort((a, b) => b.similarityScore - a.similarityScore)

  return c.json({
    data: similarContacts.slice(0, Number(limit)),
    referenceContact: refContact,
    total: similarContacts.length
  })
})

export default search
