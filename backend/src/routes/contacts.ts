import { Hono } from 'hono'
import { sql, generateId } from '../db/postgres.js'
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
import { sendContactInviteEmail } from '../utils/email.js'

const contacts = new Hono()

// Apply auth middleware to all routes
contacts.use('*', authMiddleware)

// List all contacts
contacts.get('/', async (c) => {
  const userId = c.get('user').userId
  const { search, company, limit = '50', offset = '0' } = c.req.query()

  const limitNum = Number(limit)
  const offsetNum = Number(offset)

  let rows: Contact[]
  let totalResult: { total: string }[]

  if (search && company) {
    const searchPattern = `%${search}%`
    rows = await sql<Contact[]>`
      SELECT * FROM contacts
      WHERE user_id = ${userId}
      AND (name ILIKE ${searchPattern} OR company ILIKE ${searchPattern} OR title ILIKE ${searchPattern} OR email ILIKE ${searchPattern})
      AND company = ${company}
      ORDER BY updated_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}
    `
    totalResult = await sql<{ total: string }[]>`
      SELECT COUNT(*) as total FROM contacts
      WHERE user_id = ${userId}
      AND (name ILIKE ${searchPattern} OR company ILIKE ${searchPattern} OR title ILIKE ${searchPattern} OR email ILIKE ${searchPattern})
      AND company = ${company}
    `
  } else if (search) {
    const searchPattern = `%${search}%`
    rows = await sql<Contact[]>`
      SELECT * FROM contacts
      WHERE user_id = ${userId}
      AND (name ILIKE ${searchPattern} OR company ILIKE ${searchPattern} OR title ILIKE ${searchPattern} OR email ILIKE ${searchPattern})
      ORDER BY updated_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}
    `
    totalResult = await sql<{ total: string }[]>`
      SELECT COUNT(*) as total FROM contacts
      WHERE user_id = ${userId}
      AND (name ILIKE ${searchPattern} OR company ILIKE ${searchPattern} OR title ILIKE ${searchPattern} OR email ILIKE ${searchPattern})
    `
  } else if (company) {
    rows = await sql<Contact[]>`
      SELECT * FROM contacts
      WHERE user_id = ${userId} AND company = ${company}
      ORDER BY updated_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}
    `
    totalResult = await sql<{ total: string }[]>`
      SELECT COUNT(*) as total FROM contacts
      WHERE user_id = ${userId} AND company = ${company}
    `
  } else {
    rows = await sql<Contact[]>`
      SELECT * FROM contacts
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}
    `
    totalResult = await sql<{ total: string }[]>`
      SELECT COUNT(*) as total FROM contacts WHERE user_id = ${userId}
    `
  }

  return c.json({
    data: rows,
    total: Number(totalResult[0].total),
    limit: limitNum,
    offset: offsetNum,
    hasMore: offsetNum + rows.length < Number(totalResult[0].total)
  })
})

// Get single contact
contacts.get('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const [contact] = await sql<Contact[]>`
    SELECT * FROM contacts WHERE id = ${id} AND user_id = ${userId}
  `

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  return c.json({ data: contact })
})

// Create contact
contacts.post('/', async (c) => {
  const userId = c.get('user').userId
  const body = await c.req.json<CreateContactRequest>()

  if (!body.name) {
    return c.json({ error: 'Name is required' }, 400)
  }

  const id = generateId()
  const now = new Date().toISOString()

  await sql`
    INSERT INTO contacts (id, user_id, name, company, title, email, phone, linkedin_url, notes, source,
      line_id, telegram_username, whatsapp_number, wechat_id, twitter_handle, facebook_url, instagram_handle,
      created_at, updated_at)
    VALUES (
      ${id}, ${userId}, ${body.name}, ${body.company || null}, ${body.title || null},
      ${body.email || null}, ${body.phone || null}, ${body.linkedinUrl || null},
      ${body.notes || null}, ${body.source || 'manual'},
      ${body.lineId || null}, ${body.telegramUsername || null}, ${body.whatsappNumber || null},
      ${body.wechatId || null}, ${body.twitterHandle || null}, ${body.facebookUrl || null},
      ${body.instagramHandle || null}, ${now}, ${now}
    )
  `

  // Automatically create a direct (1st degree) relationship between user and contact
  const relationshipId = generateId()
  await sql`
    INSERT INTO relationships (id, user_id, contact_a_id, contact_b_id, is_user_relationship, relationship_type, strength, verified, created_at, updated_at)
    VALUES (${relationshipId}, ${userId}, ${id}, null, true, 'direct', 5, true, ${now}, ${now})
  `

  // Auto-share to teams where user has auto_share enabled
  const autoShareTeams = await sql<{ team_id: string; auto_share_visibility: string }[]>`
    SELECT team_id, auto_share_visibility
    FROM team_members
    WHERE user_id = ${userId} AND auto_share = true
  `

  for (const team of autoShareTeams) {
    await sql`
      INSERT INTO shared_contacts (contact_id, team_id, shared_by_id, visibility)
      VALUES (${id}, ${team.team_id}, ${userId}, ${team.auto_share_visibility || 'basic'})
    `
  }

  const [contact] = await sql<Contact[]>`SELECT * FROM contacts WHERE id = ${id}`

  // Send invitation email if contact has email and hasn't been invited before
  let invitationSent = false
  if (body.email) {
    try {
      // Check if this email has already received an invitation
      const [existingInvitation] = await sql<{ id: string }[]>`
        SELECT id FROM contact_invitations WHERE email = ${body.email}
      `

      if (!existingInvitation) {
        // Get the user's name for the invitation
        const [user] = await sql<{ name: string }[]>`
          SELECT name FROM users WHERE id = ${userId}
        `
        const inviterName = user?.name || 'Someone'

        // Send the invitation email with user's locale
        const locale = (body as any).locale || 'en'
        await sendContactInviteEmail(body.email, body.name, inviterName, locale)

        // Record the invitation
        const invitationId = generateId()
        await sql`
          INSERT INTO contact_invitations (id, user_id, contact_id, email, sent_at)
          VALUES (${invitationId}, ${userId}, ${id}, ${body.email}, ${now})
        `

        invitationSent = true
      }
    } catch (error) {
      // Log error but don't fail the contact creation
      console.error('Failed to send invitation email:', error)
    }
  }

  return c.json({ data: contact, invitationSent }, 201)
})

// Update contact
contacts.put('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<UpdateContactRequest>()

  // Check if contact exists
  const [existing] = await sql<Contact[]>`
    SELECT * FROM contacts WHERE id = ${id} AND user_id = ${userId}
  `

  if (!existing) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  // Check what fields need updating
  const hasName = body.name !== undefined
  const hasCompany = body.company !== undefined
  const hasTitle = body.title !== undefined
  const hasEmail = body.email !== undefined
  const hasPhone = body.phone !== undefined
  const hasLinkedinUrl = body.linkedinUrl !== undefined
  const hasNotes = body.notes !== undefined
  const hasAiSummary = body.aiSummary !== undefined
  const hasLineId = body.lineId !== undefined
  const hasTelegramUsername = body.telegramUsername !== undefined
  const hasWhatsappNumber = body.whatsappNumber !== undefined
  const hasWechatId = body.wechatId !== undefined
  const hasTwitterHandle = body.twitterHandle !== undefined
  const hasFacebookUrl = body.facebookUrl !== undefined
  const hasInstagramHandle = body.instagramHandle !== undefined

  if (!hasName && !hasCompany && !hasTitle && !hasEmail && !hasPhone &&
      !hasLinkedinUrl && !hasNotes && !hasAiSummary && !hasLineId &&
      !hasTelegramUsername && !hasWhatsappNumber && !hasWechatId &&
      !hasTwitterHandle && !hasFacebookUrl && !hasInstagramHandle) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  const now = new Date().toISOString()

  await sql`
    UPDATE contacts SET
      name = COALESCE(${hasName ? body.name ?? null : null}, name),
      company = ${hasCompany ? (body.company || null) : existing.company},
      title = ${hasTitle ? (body.title || null) : existing.title},
      email = ${hasEmail ? (body.email || null) : existing.email},
      phone = ${hasPhone ? (body.phone || null) : existing.phone},
      linkedin_url = ${hasLinkedinUrl ? (body.linkedinUrl || null) : existing.linkedinUrl},
      notes = ${hasNotes ? (body.notes || null) : existing.notes},
      ai_summary = ${hasAiSummary ? (body.aiSummary || null) : existing.aiSummary},
      line_id = ${hasLineId ? (body.lineId || null) : existing.lineId},
      telegram_username = ${hasTelegramUsername ? (body.telegramUsername || null) : existing.telegramUsername},
      whatsapp_number = ${hasWhatsappNumber ? (body.whatsappNumber || null) : existing.whatsappNumber},
      wechat_id = ${hasWechatId ? (body.wechatId || null) : existing.wechatId},
      twitter_handle = ${hasTwitterHandle ? (body.twitterHandle || null) : existing.twitterHandle},
      facebook_url = ${hasFacebookUrl ? (body.facebookUrl || null) : existing.facebookUrl},
      instagram_handle = ${hasInstagramHandle ? (body.instagramHandle || null) : existing.instagramHandle},
      updated_at = ${now}
    WHERE id = ${id}
  `

  const [contact] = await sql<Contact[]>`SELECT * FROM contacts WHERE id = ${id}`

  return c.json({ data: contact })
})

// Delete contact
contacts.delete('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const [existing] = await sql<Contact[]>`
    SELECT * FROM contacts WHERE id = ${id} AND user_id = ${userId}
  `

  if (!existing) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  await sql`DELETE FROM contacts WHERE id = ${id}`

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
    const scannedDataArray = await scanBusinessCard(imageBase64, mimeType)

    // Map each scanned card to a contact object
    const contacts = scannedDataArray.map(scannedData => ({
      scanned: scannedData,
      contact: {
        name: scannedData.name,
        company: scannedData.company,
        title: scannedData.title,
        email: scannedData.email,
        phone: scannedData.phone?.join(', '),
        linkedinUrl: scannedData.social?.linkedin,
        twitterHandle: scannedData.social?.twitter,
        lineId: scannedData.social?.line,
        whatsappNumber: scannedData.social?.whatsapp,
        telegramUsername: scannedData.social?.telegram,
        wechatId: scannedData.social?.wechat,
        facebookUrl: scannedData.social?.facebook,
        instagramHandle: scannedData.social?.instagram,
        source: 'card_scan',
        sourceMetadata: JSON.stringify(scannedData)
      }
    }))

    return c.json({
      data: {
        // Return array of contacts for multi-card support
        contacts,
        // Keep backward compatibility: also return first contact as single object
        scanned: scannedDataArray[0],
        contact: contacts[0]?.contact
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
contacts.get('/:id/career', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  // Verify contact belongs to user
  const [contact] = await sql`
    SELECT id FROM contacts WHERE id = ${id} AND user_id = ${userId}
  `

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const history = await sql<CareerHistory[]>`
    SELECT * FROM career_history WHERE contact_id = ${id} ORDER BY start_date DESC
  `

  return c.json({ data: history })
})

// Add career history entry
contacts.post('/:id/career', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<CreateCareerHistoryRequest>()

  // Verify contact belongs to user
  const [contact] = await sql`
    SELECT id FROM contacts WHERE id = ${id} AND user_id = ${userId}
  `

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  if (!body.company) {
    return c.json({ error: 'Company is required' }, 400)
  }

  const entryId = generateId()
  const now = new Date().toISOString()

  await sql`
    INSERT INTO career_history (id, contact_id, company, title, start_date, end_date, created_at)
    VALUES (${entryId}, ${id}, ${body.company}, ${body.title || null}, ${body.startDate || null}, ${body.endDate || null}, ${now})
  `

  const [entry] = await sql<CareerHistory[]>`SELECT * FROM career_history WHERE id = ${entryId}`

  return c.json({ data: entry }, 201)
})

// Delete career history entry
contacts.delete('/:id/career/:entryId', async (c) => {
  const userId = c.get('user').userId
  const { id, entryId } = c.req.param()

  // Verify contact belongs to user
  const [contact] = await sql`
    SELECT id FROM contacts WHERE id = ${id} AND user_id = ${userId}
  `

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const [entry] = await sql`
    SELECT id FROM career_history WHERE id = ${entryId} AND contact_id = ${id}
  `

  if (!entry) {
    return c.json({ error: 'Career history entry not found' }, 404)
  }

  await sql`DELETE FROM career_history WHERE id = ${entryId}`

  return c.json({ message: 'Career history entry deleted' })
})

// ============ Education History ============

// Get education history for a contact
contacts.get('/:id/education', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  // Verify contact belongs to user
  const [contact] = await sql`
    SELECT id FROM contacts WHERE id = ${id} AND user_id = ${userId}
  `

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const history = await sql<EducationHistory[]>`
    SELECT * FROM education_history WHERE contact_id = ${id} ORDER BY end_year DESC
  `

  return c.json({ data: history })
})

// Add education history entry
contacts.post('/:id/education', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<CreateEducationHistoryRequest>()

  // Verify contact belongs to user
  const [contact] = await sql`
    SELECT id FROM contacts WHERE id = ${id} AND user_id = ${userId}
  `

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  if (!body.school) {
    return c.json({ error: 'School is required' }, 400)
  }

  const entryId = generateId()
  const now = new Date().toISOString()

  await sql`
    INSERT INTO education_history (id, contact_id, school, degree, field, start_year, end_year, created_at)
    VALUES (${entryId}, ${id}, ${body.school}, ${body.degree || null}, ${body.field || null}, ${body.startYear || null}, ${body.endYear || null}, ${now})
  `

  const [entry] = await sql<EducationHistory[]>`SELECT * FROM education_history WHERE id = ${entryId}`

  return c.json({ data: entry }, 201)
})

// Delete education history entry
contacts.delete('/:id/education/:entryId', async (c) => {
  const userId = c.get('user').userId
  const { id, entryId } = c.req.param()

  // Verify contact belongs to user
  const [contact] = await sql`
    SELECT id FROM contacts WHERE id = ${id} AND user_id = ${userId}
  `

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const [entry] = await sql`
    SELECT id FROM education_history WHERE id = ${entryId} AND contact_id = ${id}
  `

  if (!entry) {
    return c.json({ error: 'Education history entry not found' }, 404)
  }

  await sql`DELETE FROM education_history WHERE id = ${entryId}`

  return c.json({ message: 'Education history entry deleted' })
})

// ============ Tags for Contacts ============

// Get tags for a contact
contacts.get('/:id/tags', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  // Verify contact belongs to user
  const [contact] = await sql`
    SELECT id FROM contacts WHERE id = ${id} AND user_id = ${userId}
  `

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const tags = await sql`
    SELECT t.* FROM tags t
    JOIN contact_tags ct ON ct.tag_id = t.id
    WHERE ct.contact_id = ${id}
  `

  return c.json({ data: tags })
})

// Add tag to contact
contacts.post('/:id/tags', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<{ tagId: string }>()

  // Verify contact belongs to user
  const [contact] = await sql`
    SELECT id FROM contacts WHERE id = ${id} AND user_id = ${userId}
  `

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  // Verify tag belongs to user
  const [tag] = await sql`
    SELECT id FROM tags WHERE id = ${body.tagId} AND user_id = ${userId}
  `

  if (!tag) {
    return c.json({ error: 'Tag not found' }, 404)
  }

  // Check if already tagged
  const [existing] = await sql`
    SELECT * FROM contact_tags WHERE contact_id = ${id} AND tag_id = ${body.tagId}
  `

  if (existing) {
    return c.json({ error: 'Tag already applied to contact' }, 409)
  }

  await sql`INSERT INTO contact_tags (contact_id, tag_id) VALUES (${id}, ${body.tagId})`

  return c.json({ message: 'Tag added to contact' }, 201)
})

// Remove tag from contact
contacts.delete('/:id/tags/:tagId', async (c) => {
  const userId = c.get('user').userId
  const { id, tagId } = c.req.param()

  // Verify contact belongs to user
  const [contact] = await sql`
    SELECT id FROM contacts WHERE id = ${id} AND user_id = ${userId}
  `

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const [existing] = await sql`
    SELECT * FROM contact_tags WHERE contact_id = ${id} AND tag_id = ${tagId}
  `

  if (!existing) {
    return c.json({ error: 'Tag not found on contact' }, 404)
  }

  await sql`DELETE FROM contact_tags WHERE contact_id = ${id} AND tag_id = ${tagId}`

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
  const id = generateId()
  const now = new Date().toISOString()

  // Extract username from URL for placeholder name
  const username = body.linkedinUrl.match(/linkedin\.com\/in\/([\w-]+)/)?.[1] || 'Unknown'

  await sql`
    INSERT INTO contacts (id, user_id, name, linkedin_url, source, created_at, updated_at)
    VALUES (
      ${id}, ${userId},
      ${username.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())},
      ${body.linkedinUrl}, 'linkedin', ${now}, ${now}
    )
  `

  const [contact] = await sql<Contact[]>`SELECT * FROM contacts WHERE id = ${id}`

  return c.json({
    data: contact,
    message: 'Contact created from LinkedIn URL. Please update with additional details.'
  }, 201)
})

// ---- vCard Export ----

function escapeVcardValue(val: string | null | undefined): string {
  if (!val) return ''
  return val.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function contactToVcard(contact: any): string {
  const name = contact.name || ''
  const parts = name.split(/\s+/)
  const firstName = parts[0] || ''
  const lastName = parts.slice(1).join(' ') || ''

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVcardValue(name)}`,
    `N:${escapeVcardValue(lastName)};${escapeVcardValue(firstName)};;;`,
  ]

  if (contact.company) lines.push(`ORG:${escapeVcardValue(contact.company)}`)
  if (contact.title) lines.push(`TITLE:${escapeVcardValue(contact.title)}`)
  if (contact.email) lines.push(`EMAIL:${escapeVcardValue(contact.email)}`)
  if (contact.phone) lines.push(`TEL:${escapeVcardValue(contact.phone)}`)
  if (contact.linkedin_url) lines.push(`URL:${escapeVcardValue(contact.linkedin_url)}`)
  if (contact.notes) lines.push(`NOTE:${escapeVcardValue(contact.notes)}`)

  lines.push('END:VCARD')
  return lines.join('\r\n')
}

// Export all contacts as vCard (.vcf)
contacts.get('/export/vcard', async (c) => {
  const userId = c.get('user').userId

  const rows = await sql<Contact[]>`
    SELECT * FROM contacts WHERE user_id = ${userId} ORDER BY name ASC
  `

  const vcf = rows.map(contactToVcard).join('\r\n')

  return new Response(vcf, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': 'attachment; filename="warmly-contacts.vcf"',
    },
  })
})

// Export single contact as vCard
contacts.get('/:id/export/vcard', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const [contact] = await sql<Contact[]>`
    SELECT * FROM contacts WHERE id = ${id} AND user_id = ${userId}
  `

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }

  const vcf = contactToVcard(contact)
  const filename = `${(contact.name || 'contact').replace(/[^a-zA-Z0-9]/g, '-')}.vcf`

  return new Response(vcf, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

export default contacts
