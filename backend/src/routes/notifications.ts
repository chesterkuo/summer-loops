import { Hono } from 'hono'
import { getDb, generateId } from '../db/index.js'
import type {
  Notification,
  CreateNotificationRequest,
  UpdateNotificationRequest,
  Contact
} from '../types/index.js'
import { authMiddleware } from '../middleware/auth.js'

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
    contactName: row.contact_name
  }
}

// List all notifications (grouped by status)
notifications.get('/', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const now = new Date().toISOString()

  // Get pending notifications that are due (remind_at <= now)
  const pending = db.query(`
    SELECT n.*, c.name as contact_name
    FROM notifications n
    LEFT JOIN contacts c ON c.id = n.contact_id
    WHERE n.user_id = ? AND n.status = 'pending' AND n.remind_at <= ?
    ORDER BY n.remind_at ASC
  `).all(userId, now).map(mapNotification)

  // Get upcoming notifications (remind_at > now)
  const upcoming = db.query(`
    SELECT n.*, c.name as contact_name
    FROM notifications n
    LEFT JOIN contacts c ON c.id = n.contact_id
    WHERE n.user_id = ? AND n.status = 'pending' AND n.remind_at > ?
    ORDER BY n.remind_at ASC
  `).all(userId, now).map(mapNotification)

  // Get completed notifications (most recent first)
  const done = db.query(`
    SELECT n.*, c.name as contact_name
    FROM notifications n
    LEFT JOIN contacts c ON c.id = n.contact_id
    WHERE n.user_id = ? AND n.status = 'done'
    ORDER BY n.completed_at DESC
    LIMIT 50
  `).all(userId).map(mapNotification)

  return c.json({
    pending,
    upcoming,
    done,
    activeCount: pending.length
  })
})

// Get single notification
notifications.get('/:id', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const row = db.query(`
    SELECT n.*, c.name as contact_name
    FROM notifications n
    LEFT JOIN contacts c ON c.id = n.contact_id
    WHERE n.id = ? AND n.user_id = ?
  `).get(id, userId)

  if (!row) {
    return c.json({ error: 'Notification not found' }, 404)
  }

  return c.json({ data: mapNotification(row) })
})

// Create notification
notifications.post('/', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const body = await c.req.json<CreateNotificationRequest>()

  if (!body.remindAt) {
    return c.json({ error: 'remindAt is required' }, 400)
  }

  // Validate contact exists if provided
  if (body.contactId) {
    const contact = db.query(
      'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
    ).get(body.contactId, userId) as Contact | null

    if (!contact) {
      return c.json({ error: 'Contact not found' }, 404)
    }
  }

  const id = generateId()
  const now = new Date().toISOString()

  db.query(`
    INSERT INTO notifications (id, user_id, contact_id, note, remind_at, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(
    id,
    userId,
    body.contactId || null,
    body.note || null,
    body.remindAt,
    now
  )

  const row = db.query(`
    SELECT n.*, c.name as contact_name
    FROM notifications n
    LEFT JOIN contacts c ON c.id = n.contact_id
    WHERE n.id = ?
  `).get(id)

  return c.json({ data: mapNotification(row) }, 201)
})

// Update notification
notifications.patch('/:id', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<UpdateNotificationRequest>()

  // Check if notification exists
  const existing = db.query(
    'SELECT * FROM notifications WHERE id = ? AND user_id = ?'
  ).get(id, userId)

  if (!existing) {
    return c.json({ error: 'Notification not found' }, 404)
  }

  // Validate contact exists if provided
  if (body.contactId) {
    const contact = db.query(
      'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
    ).get(body.contactId, userId) as Contact | null

    if (!contact) {
      return c.json({ error: 'Contact not found' }, 404)
    }
  }

  const updates: string[] = []
  const params: (string | null)[] = []

  if (body.contactId !== undefined) {
    updates.push('contact_id = ?')
    params.push(body.contactId || null)
  }
  if (body.note !== undefined) {
    updates.push('note = ?')
    params.push(body.note || null)
  }
  if (body.remindAt !== undefined) {
    updates.push('remind_at = ?')
    params.push(body.remindAt)
  }
  if (body.status !== undefined) {
    updates.push('status = ?')
    params.push(body.status)
    if (body.status === 'done') {
      updates.push('completed_at = ?')
      params.push(new Date().toISOString())
    }
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  params.push(id)

  db.query(`UPDATE notifications SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  const row = db.query(`
    SELECT n.*, c.name as contact_name
    FROM notifications n
    LEFT JOIN contacts c ON c.id = n.contact_id
    WHERE n.id = ?
  `).get(id)

  return c.json({ data: mapNotification(row) })
})

// Delete notification
notifications.delete('/:id', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const existing = db.query(
    'SELECT * FROM notifications WHERE id = ? AND user_id = ?'
  ).get(id, userId)

  if (!existing) {
    return c.json({ error: 'Notification not found' }, 404)
  }

  db.query('DELETE FROM notifications WHERE id = ?').run(id)

  return c.json({ message: 'Notification deleted successfully' })
})

export default notifications
