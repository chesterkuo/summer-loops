import { Hono } from 'hono'
import { sql, generateId } from '../db/postgres.js'
import type {
  Notification,
  CreateNotificationRequest,
  UpdateNotificationRequest,
} from '../types/index.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  isAutoSyncEnabled,
  createCalendarEvent,
  buildReminderEvent,
  deleteCalendarEvent,
} from '../services/googleCalendar.js'

const notifications = new Hono()

// Apply auth middleware to all routes
notifications.use('*', authMiddleware)

// Helper to map DB row to Notification type (snake_case to camelCase)
function mapNotification(row: any): Notification & { contactName?: string } {
  return {
    id: row.id,
    userId: row.user_id,
    contactId: row.contact_id,
    note: row.note,
    remindAt: row.remind_at,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    contactName: row.contact_name,
    googleEventId: row.google_event_id || null,
  }
}

// List all notifications (grouped by status)
notifications.get('/', async (c) => {
  const userId = c.get('user').userId
  const now = new Date().toISOString()

  // Get pending notifications that are due (remind_at <= now)
  const pendingRows = await sql`
    SELECT n.*, c.name as contact_name
    FROM notifications n
    LEFT JOIN contacts c ON c.id = n.contact_id
    WHERE n.user_id = ${userId} AND n.status = 'pending' AND n.remind_at <= ${now}
    ORDER BY n.remind_at ASC
  `
  const pending = pendingRows.map(mapNotification)

  // Get upcoming notifications (remind_at > now)
  const upcomingRows = await sql`
    SELECT n.*, c.name as contact_name
    FROM notifications n
    LEFT JOIN contacts c ON c.id = n.contact_id
    WHERE n.user_id = ${userId} AND n.status = 'pending' AND n.remind_at > ${now}
    ORDER BY n.remind_at ASC
  `
  const upcoming = upcomingRows.map(mapNotification)

  // Get completed notifications (most recent first)
  const doneRows = await sql`
    SELECT n.*, c.name as contact_name
    FROM notifications n
    LEFT JOIN contacts c ON c.id = n.contact_id
    WHERE n.user_id = ${userId} AND n.status = 'done'
    ORDER BY n.completed_at DESC
    LIMIT 50
  `
  const done = doneRows.map(mapNotification)

  return c.json({ data: {
    pending,
    upcoming,
    done,
    activeCount: pending.length
  }})
})

// Get single notification
notifications.get('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const [row] = await sql`
    SELECT n.*, c.name as contact_name
    FROM notifications n
    LEFT JOIN contacts c ON c.id = n.contact_id
    WHERE n.id = ${id} AND n.user_id = ${userId}
  `

  if (!row) {
    return c.json({ error: 'Notification not found' }, 404)
  }

  return c.json({ data: mapNotification(row) })
})

// Create notification
notifications.post('/', async (c) => {
  const userId = c.get('user').userId
  const body = await c.req.json<CreateNotificationRequest>()

  if (!body.remindAt) {
    return c.json({ error: 'remindAt is required' }, 400)
  }

  // Validate contact exists if provided
  if (body.contactId) {
    const [contact] = await sql`
      SELECT id FROM contacts WHERE id = ${body.contactId} AND user_id = ${userId}
    `

    if (!contact) {
      return c.json({ error: 'Contact not found' }, 404)
    }
  }

  const id = generateId()
  const now = new Date().toISOString()

  await sql`
    INSERT INTO notifications (id, user_id, contact_id, note, remind_at, status, created_at)
    VALUES (${id}, ${userId}, ${body.contactId || null}, ${body.note || null}, ${body.remindAt}, 'pending', ${now})
  `

  const [row] = await sql`
    SELECT n.*, c.name as contact_name
    FROM notifications n
    LEFT JOIN contacts c ON c.id = n.contact_id
    WHERE n.id = ${id}
  `

  // Auto-sync to Google Calendar if enabled
  const autoSync = await isAutoSyncEnabled(userId)
  if (autoSync) {
    let contactName: string | null = null
    if (body.contactId) {
      const [contact] = await sql`SELECT name FROM contacts WHERE id = ${body.contactId}`
      contactName = contact?.name || null
    }

    const event = buildReminderEvent({
      note: row.note,
      remindAt: row.remind_at,
      contactName,
    })
    const eventId = await createCalendarEvent(userId, event)
    if (eventId) {
      await sql`UPDATE notifications SET google_event_id = ${eventId} WHERE id = ${id}`
      row.google_event_id = eventId
    }
  }

  return c.json({ data: mapNotification(row) }, 201)
})

// Update notification
notifications.patch('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<UpdateNotificationRequest>()

  // Check if notification exists
  const [existing] = await sql`
    SELECT * FROM notifications WHERE id = ${id} AND user_id = ${userId}
  `

  if (!existing) {
    return c.json({ error: 'Notification not found' }, 404)
  }

  // Validate contact exists if provided
  if (body.contactId) {
    const [contact] = await sql`
      SELECT id FROM contacts WHERE id = ${body.contactId} AND user_id = ${userId}
    `

    if (!contact) {
      return c.json({ error: 'Contact not found' }, 404)
    }
  }

  // Build update object
  const updateValues: Record<string, any> = {}

  if (body.contactId !== undefined) {
    updateValues.contact_id = body.contactId || null
  }
  if (body.note !== undefined) {
    updateValues.note = body.note || null
  }
  if (body.remindAt !== undefined) {
    updateValues.remind_at = body.remindAt
  }
  if (body.status !== undefined) {
    updateValues.status = body.status
    if (body.status === 'done') {
      updateValues.completed_at = new Date().toISOString()
      // Remove from Google Calendar when marking done
      if (existing.google_event_id) {
        await deleteCalendarEvent(userId, existing.google_event_id)
      }
    }
  }

  if (Object.keys(updateValues).length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  // Execute update based on what fields are provided
  await sql`
    UPDATE notifications SET
      contact_id = COALESCE(${updateValues.contact_id ?? null}::uuid, contact_id),
      note = COALESCE(${updateValues.note ?? null}, note),
      remind_at = COALESCE(${updateValues.remind_at ?? null}::timestamptz, remind_at),
      status = COALESCE(${updateValues.status ?? null}, status),
      completed_at = COALESCE(${updateValues.completed_at ?? null}::timestamptz, completed_at)
    WHERE id = ${id}
  `

  const [row] = await sql`
    SELECT n.*, c.name as contact_name
    FROM notifications n
    LEFT JOIN contacts c ON c.id = n.contact_id
    WHERE n.id = ${id}
  `

  return c.json({ data: mapNotification(row) })
})

// Delete notification
notifications.delete('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const [existing] = await sql`
    SELECT * FROM notifications WHERE id = ${id} AND user_id = ${userId}
  `

  if (!existing) {
    return c.json({ error: 'Notification not found' }, 404)
  }

  // Delete from Google Calendar if synced
  if (existing.google_event_id) {
    await deleteCalendarEvent(userId, existing.google_event_id)
  }

  await sql`DELETE FROM notifications WHERE id = ${id}`

  return c.json({ message: 'Notification deleted successfully' })
})

export default notifications
