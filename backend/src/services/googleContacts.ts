// Google People API v1 Client
// Docs: https://developers.google.com/people/api/rest/v1/people.connections/list

import { sql } from '../db/postgres.js'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

export interface GoogleContact {
  resourceName: string
  name: string | null
  email: string | null
  phone: string | null
  company: string | null
  title: string | null
}

// Refresh the access token if expired, returns null if connection is broken
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const [token] = await sql`
    SELECT access_token, refresh_token, token_expiry
    FROM google_contacts_tokens
    WHERE user_id = ${userId} AND access_token != 'pending'
  `

  if (!token) return null

  const expiry = new Date(token.token_expiry)
  const now = new Date()

  // If token still valid (with 5-minute buffer), return it
  if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
    return token.access_token
  }

  // Refresh the token
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: token.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Failed to refresh Google Contacts token:', errText)
      if (response.status === 400 || response.status === 401) {
        console.warn(`Google Contacts token revoked for user ${userId}, removing stale record`)
        await sql`DELETE FROM google_contacts_tokens WHERE user_id = ${userId}`
      }
      return null
    }

    const data = await response.json() as {
      access_token: string
      expires_in: number
    }

    const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString()
    await sql`
      UPDATE google_contacts_tokens
      SET access_token = ${data.access_token},
          token_expiry = ${newExpiry},
          updated_at = NOW()
      WHERE user_id = ${userId}
    `

    return data.access_token
  } catch (err) {
    console.error('Google Contacts token refresh error:', err)
    return null
  }
}

// Fetch all contacts from Google People API with pagination
export async function fetchGoogleContacts(userId: string): Promise<GoogleContact[]> {
  const accessToken = await getValidAccessToken(userId)
  if (!accessToken) return []

  const contacts: GoogleContact[] = []
  let nextPageToken: string | undefined

  try {
    do {
      const params = new URLSearchParams({
        personFields: 'names,emailAddresses,phoneNumbers,organizations',
        pageSize: '200',
        sortOrder: 'FIRST_NAME_ASCENDING',
      })
      if (nextPageToken) params.set('pageToken', nextPageToken)

      const response = await fetch(
        `https://people.googleapis.com/v1/people/me/connections?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (!response.ok) {
        const errText = await response.text()
        console.error('Google People API error:', errText)
        break
      }

      const data = await response.json() as {
        connections?: Array<{
          resourceName: string
          names?: Array<{ displayName?: string; givenName?: string; familyName?: string }>
          emailAddresses?: Array<{ value?: string }>
          phoneNumbers?: Array<{ value?: string }>
          organizations?: Array<{ name?: string; title?: string }>
        }>
        nextPageToken?: string
      }

      if (data.connections) {
        for (const person of data.connections) {
          const name = person.names?.[0]?.displayName || null
          const email = person.emailAddresses?.[0]?.value || null
          const phone = person.phoneNumbers?.[0]?.value || null
          const company = person.organizations?.[0]?.name || null
          const title = person.organizations?.[0]?.title || null

          // Skip contacts with no useful info
          if (!name && !email && !phone) continue

          contacts.push({
            resourceName: person.resourceName,
            name,
            email,
            phone,
            company,
            title,
          })
        }
      }

      nextPageToken = data.nextPageToken
    } while (nextPageToken)
  } catch (err) {
    console.error('Failed to fetch Google contacts:', err)
  }

  return contacts
}

// Normalize phone to digits-only for comparison
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

// Find duplicate contacts by email or phone (case-insensitive)
export async function findDuplicates(userId: string, googleContacts: GoogleContact[]): Promise<Set<string>> {
  const duplicateResourceNames = new Set<string>()

  // Fetch all existing contacts' emails and phones
  const existing = await sql<{ email: string | null; phone: string | null }[]>`
    SELECT email, phone FROM contacts WHERE user_id = ${userId}
  `

  const existingEmails = new Set<string>()
  const existingPhones = new Set<string>()

  for (const c of existing) {
    if (c.email) existingEmails.add(c.email.toLowerCase())
    if (c.phone) existingPhones.add(normalizePhone(c.phone))
  }

  for (const gc of googleContacts) {
    if (gc.email && existingEmails.has(gc.email.toLowerCase())) {
      duplicateResourceNames.add(gc.resourceName)
      continue
    }
    if (gc.phone && existingPhones.has(normalizePhone(gc.phone))) {
      duplicateResourceNames.add(gc.resourceName)
    }
  }

  return duplicateResourceNames
}
