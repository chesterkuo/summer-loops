import { Hono } from 'hono'
import { sql, generateId } from '../db/postgres.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  buildReminderEvent,
} from '../services/googleCalendar.js'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_CALENDAR_CALLBACK_URL = process.env.GOOGLE_CALENDAR_CALLBACK_URL || (
  process.env.NODE_ENV === 'production'
    ? 'https://mywarmly.app/api/google-calendar/callback'
    : 'http://localhost:7000/api/google-calendar/callback'
)
const FRONTEND_URL = process.env.FRONTEND_URL || (
  process.env.NODE_ENV === 'production' ? 'https://mywarmly.app' : 'http://localhost:5173'
)

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

const googleCalendar = new Hono()

// ---- OAuth Connect Flow ----

// Return the Google Calendar OAuth URL (frontend redirects the user)
// Uses a state token stored in google_calendar_tokens with access_token='pending'
googleCalendar.get('/connect-url', authMiddleware, async (c) => {
  const userId = c.get('user').userId

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return c.json({ error: 'Google OAuth not configured' }, 503)
  }

  // Create a short-lived state token
  const stateToken = generateId()
  const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

  await sql`
    INSERT INTO google_calendar_tokens (id, user_id, access_token, refresh_token, token_expiry, scopes, created_at, updated_at)
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
    redirect_uri: GOOGLE_CALENDAR_CALLBACK_URL,
    response_type: 'code',
    scope: CALENDAR_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state: stateToken,
  })

  return c.json({ data: { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` } })
})

// OAuth callback — exchange code for tokens and store
googleCalendar.get('/callback', async (c) => {
  const code = c.req.query('code')
  const error = c.req.query('error')
  const stateToken = c.req.query('state')

  if (error || !code || !stateToken) {
    return c.redirect(`${FRONTEND_URL}/profile?gcal_error=${error || 'missing_code'}`)
  }

  // Look up user from state token
  const [pending] = await sql`
    SELECT user_id FROM google_calendar_tokens
    WHERE id = ${stateToken} AND access_token = 'pending'
    AND token_expiry > NOW()
  `
  if (!pending) {
    return c.redirect(`${FRONTEND_URL}/profile?gcal_error=invalid_state`)
  }
  const userId = pending.user_id

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: GOOGLE_CALENDAR_CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text()
      console.error('Google token exchange failed:', errText)
      throw new Error('Failed to exchange code for tokens')
    }

    const tokens = await tokenResponse.json() as {
      access_token: string
      refresh_token?: string
      expires_in: number
      scope: string
    }

    if (!tokens.refresh_token) {
      // User already granted access before — try to update existing record
      const [existing] = await sql`
        SELECT id FROM google_calendar_tokens
        WHERE user_id = ${userId} AND refresh_token != 'pending'
      `
      if (existing) {
        const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        await sql`
          UPDATE google_calendar_tokens
          SET access_token = ${tokens.access_token},
              token_expiry = ${expiry},
              scopes = ${tokens.scope},
              updated_at = NOW()
          WHERE user_id = ${userId}
        `
        return c.redirect(`${FRONTEND_URL}/profile?gcal_connected=true`)
      }
      // No existing refresh token — clean up pending row and error
      await sql`DELETE FROM google_calendar_tokens WHERE user_id = ${userId} AND access_token = 'pending'`
      return c.redirect(`${FRONTEND_URL}/profile?gcal_error=no_refresh_token`)
    }

    const now = new Date().toISOString()
    const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Update the pending row with real tokens
    await sql`
      UPDATE google_calendar_tokens
      SET access_token = ${tokens.access_token},
          refresh_token = ${tokens.refresh_token},
          token_expiry = ${expiry},
          scopes = ${tokens.scope},
          auto_sync = true,
          updated_at = ${now}
      WHERE user_id = ${userId}
    `

    return c.redirect(`${FRONTEND_URL}/profile?gcal_connected=true`)
  } catch (err: any) {
    console.error('Google Calendar OAuth error:', err)
    // Clean up pending row on failure
    await sql`DELETE FROM google_calendar_tokens WHERE user_id = ${userId} AND access_token = 'pending'`
    return c.redirect(`${FRONTEND_URL}/profile?gcal_error=auth_failed`)
  }
})

// ---- Settings & Status (all require auth) ----

googleCalendar.use('/status', authMiddleware)
googleCalendar.use('/settings', authMiddleware)
googleCalendar.use('/disconnect', authMiddleware)
googleCalendar.use('/sync/*', authMiddleware)

// Get connection status
googleCalendar.get('/status', async (c) => {
  const userId = c.get('user').userId
  const [token] = await sql`
    SELECT id, auto_sync, scopes, created_at
    FROM google_calendar_tokens
    WHERE user_id = ${userId} AND access_token != 'pending'
  `
  return c.json({
    data: {
      connected: !!token,
      autoSync: token?.auto_sync ?? false,
      connectedAt: token?.created_at || null,
    },
  })
})

// Update auto-sync setting
googleCalendar.put('/settings', async (c) => {
  const userId = c.get('user').userId
  const body = await c.req.json<{ autoSync: boolean }>()

  await sql`
    UPDATE google_calendar_tokens
    SET auto_sync = ${body.autoSync}, updated_at = NOW()
    WHERE user_id = ${userId}
  `

  return c.json({ data: { autoSync: body.autoSync } })
})

// Disconnect Google Calendar
googleCalendar.post('/disconnect', async (c) => {
  const userId = c.get('user').userId

  // Optionally revoke the token at Google
  const [token] = await sql`
    SELECT access_token FROM google_calendar_tokens WHERE user_id = ${userId}
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

  await sql`DELETE FROM google_calendar_tokens WHERE user_id = ${userId}`

  // Clear google_event_id from all user's notifications
  await sql`
    UPDATE notifications SET google_event_id = NULL WHERE user_id = ${userId}
  `

  return c.json({ message: 'Google Calendar disconnected' })
})

// ---- Manual Sync for Individual Notifications ----

// Sync a single notification to Google Calendar
googleCalendar.post('/sync/notification/:notificationId', async (c) => {
  const userId = c.get('user').userId
  const { notificationId } = c.req.param()

  const [notification] = await sql`
    SELECT n.*, c.name as contact_name
    FROM notifications n
    LEFT JOIN contacts c ON c.id = n.contact_id
    WHERE n.id = ${notificationId} AND n.user_id = ${userId}
  `

  if (!notification) {
    return c.json({ error: 'Notification not found' }, 404)
  }

  if (notification.google_event_id) {
    return c.json({ error: 'Already synced to Google Calendar' }, 409)
  }

  const event = buildReminderEvent({
    note: notification.note,
    remindAt: notification.remind_at,
    contactName: notification.contact_name,
  })

  const eventId = await createCalendarEvent(userId, event)
  if (!eventId) {
    return c.json({ error: 'Failed to create calendar event. Check Google Calendar connection.' }, 502)
  }

  await sql`UPDATE notifications SET google_event_id = ${eventId} WHERE id = ${notificationId}`

  return c.json({ data: { googleEventId: eventId } })
})

// Remove a notification from Google Calendar (but keep the notification)
googleCalendar.delete('/sync/notification/:notificationId', async (c) => {
  const userId = c.get('user').userId
  const { notificationId } = c.req.param()

  const [notification] = await sql`
    SELECT * FROM notifications WHERE id = ${notificationId} AND user_id = ${userId}
  `

  if (!notification?.google_event_id) {
    return c.json({ error: 'Not synced to Google Calendar' }, 400)
  }

  await deleteCalendarEvent(userId, notification.google_event_id)
  await sql`UPDATE notifications SET google_event_id = NULL WHERE id = ${notificationId}`

  return c.json({ message: 'Removed from Google Calendar' })
})

export default googleCalendar
