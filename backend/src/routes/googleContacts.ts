import { Hono } from 'hono'
import { sql, generateId } from '../db/postgres.js'
import { authMiddleware } from '../middleware/auth.js'
import { fetchGoogleContacts, findDuplicates, GoogleContact } from '../services/googleContacts.js'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_CONTACTS_CALLBACK_URL = process.env.GOOGLE_CONTACTS_CALLBACK_URL || (
  process.env.NODE_ENV === 'production'
    ? 'https://mywarmly.app/api/google-contacts/callback'
    : 'http://localhost:7000/api/google-contacts/callback'
)
const FRONTEND_URL = process.env.FRONTEND_URL || (
  process.env.NODE_ENV === 'production' ? 'https://mywarmly.app' : 'http://localhost:5173'
)

const CONTACTS_SCOPE = 'https://www.googleapis.com/auth/contacts.readonly'

const googleContacts = new Hono()

// ---- OAuth Connect Flow ----

googleContacts.get('/connect-url', authMiddleware, async (c) => {
  const userId = c.get('user').userId

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return c.json({ error: 'Google OAuth not configured' }, 503)
  }

  const stateToken = generateId()
  const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await sql`
    INSERT INTO google_contacts_tokens (id, user_id, access_token, refresh_token, token_expiry, scopes, created_at, updated_at)
    VALUES (${stateToken}, ${userId}, 'pending', 'pending', ${expiry}, 'pending', NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      id = ${stateToken},
      access_token = 'pending',
      refresh_token = 'pending',
      token_expiry = ${expiry},
      scopes = 'pending',
      updated_at = NOW()
  `

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CONTACTS_CALLBACK_URL,
    response_type: 'code',
    scope: CONTACTS_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state: stateToken,
  })

  return c.json({ data: { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` } })
})

// OAuth callback — exchange code for tokens and store
googleContacts.get('/callback', async (c) => {
  const code = c.req.query('code')
  const error = c.req.query('error')
  const stateToken = c.req.query('state')

  if (error || !code || !stateToken) {
    return c.redirect(`${FRONTEND_URL}/profile?gcontacts_error=${error || 'missing_code'}`)
  }

  const [pending] = await sql`
    SELECT user_id FROM google_contacts_tokens
    WHERE id = ${stateToken} AND access_token = 'pending'
    AND token_expiry > NOW()
  `
  if (!pending) {
    return c.redirect(`${FRONTEND_URL}/profile?gcontacts_error=invalid_state`)
  }
  const userId = pending.user_id

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: GOOGLE_CONTACTS_CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text()
      console.error('Google Contacts token exchange failed:', errText)
      throw new Error('Failed to exchange code for tokens')
    }

    const tokens = await tokenResponse.json() as {
      access_token: string
      refresh_token?: string
      expires_in: number
      scope: string
    }

    if (!tokens.refresh_token) {
      const [existing] = await sql`
        SELECT id FROM google_contacts_tokens
        WHERE user_id = ${userId} AND refresh_token != 'pending'
      `
      if (existing) {
        const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        await sql`
          UPDATE google_contacts_tokens
          SET access_token = ${tokens.access_token},
              token_expiry = ${expiry},
              scopes = ${tokens.scope},
              updated_at = NOW()
          WHERE user_id = ${userId}
        `
        return c.redirect(`${FRONTEND_URL}/profile?gcontacts_connected=true`)
      }
      await sql`DELETE FROM google_contacts_tokens WHERE user_id = ${userId} AND access_token = 'pending'`
      return c.redirect(`${FRONTEND_URL}/profile?gcontacts_error=no_refresh_token`)
    }

    const now = new Date().toISOString()
    const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    await sql`
      UPDATE google_contacts_tokens
      SET access_token = ${tokens.access_token},
          refresh_token = ${tokens.refresh_token},
          token_expiry = ${expiry},
          scopes = ${tokens.scope},
          updated_at = ${now}
      WHERE user_id = ${userId}
    `

    return c.redirect(`${FRONTEND_URL}/profile?gcontacts_connected=true`)
  } catch (err: any) {
    console.error('Google Contacts OAuth error:', err)
    await sql`DELETE FROM google_contacts_tokens WHERE user_id = ${userId} AND access_token = 'pending'`
    return c.redirect(`${FRONTEND_URL}/profile?gcontacts_error=auth_failed`)
  }
})

// ---- Authenticated endpoints ----

googleContacts.use('/status', authMiddleware)
googleContacts.use('/contacts', authMiddleware)
googleContacts.use('/import', authMiddleware)
googleContacts.use('/disconnect', authMiddleware)

// Get connection status
googleContacts.get('/status', async (c) => {
  const userId = c.get('user').userId
  const [token] = await sql`
    SELECT id, scopes, created_at
    FROM google_contacts_tokens
    WHERE user_id = ${userId} AND access_token != 'pending'
  `
  return c.json({
    data: {
      connected: !!token,
      connectedAt: token?.created_at || null,
    },
  })
})

// List Google contacts with duplicate detection
googleContacts.get('/contacts', async (c) => {
  const userId = c.get('user').userId

  const contacts = await fetchGoogleContacts(userId)
  if (contacts.length === 0) {
    return c.json({ data: [] })
  }

  const duplicates = await findDuplicates(userId, contacts)

  return c.json({
    data: contacts.map(gc => ({
      ...gc,
      isDuplicate: duplicates.has(gc.resourceName),
    })),
  })
})

// Import selected Google contacts
googleContacts.post('/import', async (c) => {
  const userId = c.get('user').userId
  const body = await c.req.json<{ resourceNames: string[] }>()

  if (!body.resourceNames?.length) {
    return c.json({ error: 'No contacts selected' }, 400)
  }

  // Fetch full contacts list to get details for selected ones
  const allContacts = await fetchGoogleContacts(userId)
  const contactMap = new Map<string, GoogleContact>()
  for (const gc of allContacts) {
    contactMap.set(gc.resourceName, gc)
  }

  const now = new Date().toISOString()
  const imported: any[] = []

  // Get user's teams for auto-sharing
  const teams = await sql`
    SELECT team_id FROM team_members WHERE user_id = ${userId} AND auto_share = 1
  `

  for (const resourceName of body.resourceNames) {
    const gc = contactMap.get(resourceName)
    if (!gc) continue

    const contactId = generateId()
    const contactName = gc.name || gc.email || gc.phone || 'Unknown'

    await sql`
      INSERT INTO contacts (id, user_id, name, company, title, email, phone, source, created_at, updated_at)
      VALUES (${contactId}, ${userId}, ${contactName}, ${gc.company}, ${gc.title}, ${gc.email}, ${gc.phone}, 'google_contacts', ${now}, ${now})
    `

    // Auto-create relationship (strength 5, type 'direct')
    await sql`
      INSERT INTO relationships (id, user_id, contact_a_id, is_user_relationship, relationship_type, strength, verified, created_at, updated_at)
      VALUES (${generateId()}, ${userId}, ${contactId}, true, 'direct', 5, true, ${now}, ${now})
    `

    // Auto-share to teams
    for (const team of teams) {
      await sql`
        INSERT INTO shared_contacts (contact_id, team_id, shared_by_id, visibility)
        VALUES (${contactId}, ${team.team_id}, ${userId}, 'basic')
        ON CONFLICT (contact_id, team_id) DO NOTHING
      `
    }

    imported.push({ id: contactId, name: contactName })
  }

  return c.json({ data: { imported, count: imported.length } })
})

// Disconnect Google Contacts
googleContacts.post('/disconnect', async (c) => {
  const userId = c.get('user').userId

  const [token] = await sql`
    SELECT access_token FROM google_contacts_tokens WHERE user_id = ${userId}
  `
  if (token && token.access_token !== 'pending') {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${token.access_token}`, {
        method: 'POST',
      })
    } catch {
      // Non-fatal — just delete locally
    }
  }

  await sql`DELETE FROM google_contacts_tokens WHERE user_id = ${userId}`

  return c.json({ message: 'Google Contacts disconnected' })
})

export default googleContacts
