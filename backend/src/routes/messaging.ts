import { Hono } from 'hono'
import { sql } from '../db/postgres.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  generateLinkingToken,
  verifyLineSignature,
  handleLineWebhook,
} from '../services/messagingBots.js'
import {
  connectUser,
  requestPairingCode,
  disconnectUser,
  getStatus,
  getImportableContacts,
  importContacts,
} from '../services/whatsappProxy.js'

const messaging = new Hono()

// ============================================================
// Authenticated endpoints (require JWT)
// ============================================================

// Generate linking token (LINE only now)
messaging.post('/generate-token', authMiddleware, async (c) => {
  const userId = c.get('user').userId
  const { platform } = await c.req.json<{ platform: 'line' }>()

  if (platform !== 'line') {
    return c.json({ error: 'Invalid platform. Use /whatsapp/connect for WhatsApp.' }, 400)
  }

  const token = await generateLinkingToken(userId, platform)
  return c.json({ data: { token, expiresInSeconds: 600 } })
})

// List connected accounts
messaging.get('/accounts', authMiddleware, async (c) => {
  const userId = c.get('user').userId

  const accounts = await sql<any[]>`
    SELECT id, platform, display_name, linked_at, last_message_at, is_active
    FROM messaging_accounts
    WHERE user_id = ${userId}
    ORDER BY linked_at DESC
  `

  return c.json({ data: accounts })
})

// Check if account is linked (for polling during linking flow)
messaging.get('/link-status/:platform', authMiddleware, async (c) => {
  const userId = c.get('user').userId
  const { platform } = c.req.param()

  if (platform === 'whatsapp') {
    const status = await getStatus(userId)
    return c.json({ data: { linked: status.status === 'connected', account: status.status === 'connected' ? { phoneNumber: status.phoneNumber } : null } })
  }

  const [account] = await sql<any[]>`
    SELECT id, display_name, linked_at
    FROM messaging_accounts
    WHERE user_id = ${userId} AND platform = ${platform} AND is_active = true
    ORDER BY linked_at DESC LIMIT 1
  `

  return c.json({ data: { linked: !!account, account: account || null } })
})

// Disconnect account
messaging.delete('/accounts/:id', authMiddleware, async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const [account] = await sql<any[]>`
    SELECT * FROM messaging_accounts WHERE id = ${id} AND user_id = ${userId}
  `
  if (!account) return c.json({ error: 'Account not found' }, 404)

  await sql`UPDATE messaging_accounts SET is_active = false WHERE id = ${id}`

  return c.json({ data: { disconnected: true } })
})

// ============================================================
// WhatsApp Baileys endpoints (authenticated)
// ============================================================

// Start Baileys connection and return pairing code
messaging.post('/whatsapp/connect', authMiddleware, async (c) => {
  const userId = c.get('user').userId
  const { phoneNumber } = await c.req.json<{ phoneNumber: string }>()

  if (!phoneNumber) {
    return c.json({ error: 'Phone number is required' }, 400)
  }

  try {
    await connectUser(userId)
    const pairingCode = await requestPairingCode(userId, phoneNumber)
    return c.json({ data: { pairingCode } })
  } catch (err: any) {
    console.error('[WhatsApp] Connect error:', err)
    return c.json({ error: err.message || 'Failed to connect' }, 500)
  }
})

// Get WhatsApp connection status
messaging.get('/whatsapp/status', authMiddleware, async (c) => {
  const userId = c.get('user').userId
  const status = await getStatus(userId)
  return c.json({ data: status })
})

// Disconnect WhatsApp
messaging.post('/whatsapp/disconnect', authMiddleware, async (c) => {
  const userId = c.get('user').userId
  await disconnectUser(userId)
  return c.json({ data: { disconnected: true } })
})

// List imported WhatsApp contacts
messaging.get('/whatsapp/contacts', authMiddleware, async (c) => {
  const userId = c.get('user').userId
  const contacts = await getImportableContacts(userId)
  return c.json({ data: contacts })
})

// Import selected WhatsApp contacts into Warmly
messaging.post('/whatsapp/import-contacts', authMiddleware, async (c) => {
  const userId = c.get('user').userId
  const { contactIds } = await c.req.json<{ contactIds: string[] }>()

  if (!contactIds?.length) {
    return c.json({ error: 'No contacts selected' }, 400)
  }

  const result = await importContacts(userId, contactIds)
  return c.json({ data: result })
})

// ============================================================
// LINE Webhook (public — verified by signature)
// ============================================================

messaging.post('/webhooks/line', async (c) => {
  const signature = c.req.header('X-Line-Signature')
  if (!signature) return c.json({ error: 'Missing signature' }, 400)

  const body = await c.req.text()

  if (!verifyLineSignature(body, signature)) {
    return c.json({ error: 'Invalid signature' }, 403)
  }

  const parsed = JSON.parse(body)
  const events = parsed.events || []

  // Process asynchronously so webhook returns fast
  handleLineWebhook(events).catch(err => console.error('LINE webhook error:', err))

  return c.json({ status: 'ok' })
})

export default messaging
