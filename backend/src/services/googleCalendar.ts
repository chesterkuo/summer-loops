// Google Calendar API v3 Client
// Docs: https://developers.google.com/workspace/calendar/api/v3/reference
// Endpoint: https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events

import { sql } from '../db/postgres.js'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

interface CalendarEvent {
  id?: string
  summary: string
  description?: string
  start: { dateTime: string; timeZone?: string }
  end: { dateTime: string; timeZone?: string }
  reminders?: { useDefault: boolean }
}

// Refresh the access token if expired, returns null if connection is broken
async function getValidAccessToken(userId: string): Promise<string | null> {
  const [token] = await sql`
    SELECT access_token, refresh_token, token_expiry
    FROM google_calendar_tokens
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
      console.error('Failed to refresh Google token:', errText)
      // If refresh token is revoked/invalid, clean up the stale record
      if (response.status === 400 || response.status === 401) {
        console.warn(`Google Calendar token revoked for user ${userId}, removing stale record`)
        await sql`DELETE FROM google_calendar_tokens WHERE user_id = ${userId}`
      }
      return null
    }

    const data = await response.json() as {
      access_token: string
      expires_in: number
    }

    const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString()
    await sql`
      UPDATE google_calendar_tokens
      SET access_token = ${data.access_token},
          token_expiry = ${newExpiry},
          updated_at = NOW()
      WHERE user_id = ${userId}
    `

    return data.access_token
  } catch (err) {
    console.error('Token refresh error:', err)
    return null
  }
}

// Check if user has Google Calendar connected
export async function isCalendarConnected(userId: string): Promise<boolean> {
  const [token] = await sql`
    SELECT id FROM google_calendar_tokens
    WHERE user_id = ${userId} AND access_token != 'pending'
  `
  return !!token
}

export async function isAutoSyncEnabled(userId: string): Promise<boolean> {
  const [token] = await sql`
    SELECT auto_sync FROM google_calendar_tokens
    WHERE user_id = ${userId} AND access_token != 'pending'
  `
  return token?.auto_sync ?? false
}

// Create a Google Calendar event
export async function createCalendarEvent(
  userId: string,
  event: CalendarEvent
): Promise<string | null> {
  const accessToken = await getValidAccessToken(userId)
  if (!accessToken) return null

  try {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error('Failed to create calendar event:', errText)
      return null
    }

    const created = await response.json() as { id: string }
    return created.id
  } catch (err) {
    console.error('Calendar event creation error:', err)
    return null
  }
}

// Update an existing Google Calendar event
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  event: Partial<CalendarEvent>
): Promise<boolean> {
  const accessToken = await getValidAccessToken(userId)
  if (!accessToken) return false

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    )
    return response.ok
  } catch {
    return false
  }
}

// Delete a Google Calendar event
export async function deleteCalendarEvent(
  userId: string,
  eventId: string
): Promise<boolean> {
  const accessToken = await getValidAccessToken(userId)
  if (!accessToken) return false

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
    return response.ok || response.status === 404 // 404 = already deleted
  } catch {
    return false
  }
}

// Build a calendar event from a Warmly notification/reminder
export function buildReminderEvent(notification: {
  note: string | null
  remindAt: string
  contactName?: string | null
}): CalendarEvent {
  const startTime = new Date(notification.remindAt)
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000) // 30-minute default

  const summary = notification.contactName
    ? `Warmly: Follow up with ${notification.contactName}`
    : 'Warmly: Reminder'

  return {
    summary,
    description: notification.note || undefined,
    start: { dateTime: startTime.toISOString() },
    end: { dateTime: endTime.toISOString() },
    reminders: { useDefault: true },
  }
}

// Build a calendar event from a meeting follow-up action item
export function buildActionItemEvent(actionItem: {
  task: string
  dueDate: string
  contactName?: string | null
}): CalendarEvent {
  const startTime = new Date(actionItem.dueDate)
  // Default to 9 AM if no time component
  if (startTime.getHours() === 0 && startTime.getMinutes() === 0) {
    startTime.setHours(9, 0, 0, 0)
  }
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000)

  const summary = actionItem.contactName
    ? `Warmly: ${actionItem.task} (${actionItem.contactName})`
    : `Warmly: ${actionItem.task}`

  return {
    summary,
    description: actionItem.task,
    start: { dateTime: startTime.toISOString() },
    end: { dateTime: endTime.toISOString() },
    reminders: { useDefault: true },
  }
}
