import { sql, generateId } from '../db/postgres.js'
import { scanBusinessCard, parseNaturalLanguage } from './gemini.js'
import crypto from 'crypto'

// ============================================================
// LINE webhook signature verification
// ============================================================

export function verifyLineSignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) return false
  const hash = crypto.createHmac('SHA256', secret).update(body).digest('base64')
  return hash === signature
}

// ============================================================
// Account linking
// ============================================================

export async function generateLinkingToken(userId: string, platform: 'line' | 'whatsapp'): Promise<string> {
  // Generate 6-digit code
  const token = String(Math.floor(100000 + Math.random() * 900000))
  const id = generateId()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

  await sql`
    INSERT INTO linking_tokens (id, user_id, token, platform, expires_at)
    VALUES (${id}, ${userId}, ${token}, ${platform}, ${expiresAt})
  `

  return token
}

export async function validateAndLinkAccount(
  token: string,
  platform: 'line' | 'whatsapp',
  platformUserId: string,
  displayName?: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  // Find valid token
  const [linkingToken] = await sql<any[]>`
    SELECT * FROM linking_tokens
    WHERE token = ${token} AND platform = ${platform}
    AND expires_at > NOW() AND used_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `

  if (!linkingToken) {
    return { success: false, error: 'Invalid or expired code' }
  }

  // Mark token as used
  await sql`UPDATE linking_tokens SET used_at = NOW() WHERE id = ${linkingToken.id}`

  // Check if already linked
  const [existing] = await sql<any[]>`
    SELECT * FROM messaging_accounts
    WHERE platform = ${platform} AND platform_user_id = ${platformUserId}
  `

  if (existing) {
    if (existing.user_id === linkingToken.user_id) {
      return { success: true, userId: linkingToken.user_id }
    }
    // Already linked to different account — update
    await sql`
      UPDATE messaging_accounts
      SET user_id = ${linkingToken.user_id}, display_name = ${displayName || existing.display_name || null}, is_active = true
      WHERE id = ${existing.id}
    `
    return { success: true, userId: linkingToken.user_id }
  }

  // Create new messaging account
  const id = generateId()
  await sql`
    INSERT INTO messaging_accounts (id, user_id, platform, platform_user_id, display_name)
    VALUES (${id}, ${linkingToken.user_id}, ${platform}, ${platformUserId}, ${displayName || null})
  `

  return { success: true, userId: linkingToken.user_id }
}

// ============================================================
// Find linked user by platform user ID
// ============================================================

async function findLinkedUser(platform: string, platformUserId: string): Promise<string | null> {
  const [account] = await sql<any[]>`
    SELECT user_id FROM messaging_accounts
    WHERE platform = ${platform} AND platform_user_id = ${platformUserId} AND is_active = true
  `
  return account?.user_id || null
}

// ============================================================
// Shared message processors
// ============================================================

export async function processTextMessage(
  userId: string,
  text: string,
  platform: 'line' | 'whatsapp'
): Promise<{ success: boolean; contactName?: string; company?: string; error?: string }> {
  try {
    const parsed = await parseNaturalLanguage(text)
    if (!parsed.name) {
      return { success: false, error: 'Could not extract a contact name from the message' }
    }

    const id = generateId()
    const now = new Date().toISOString()
    const source = `${platform}_bot`

    await sql`
      INSERT INTO contacts (id, user_id, name, company, title, notes, source, created_at, updated_at)
      VALUES (${id}, ${userId}, ${parsed.name}, ${parsed.company || null}, ${parsed.title || null},
        ${parsed.notes || null}, ${source}, ${now}, ${now})
    `

    // Update last_message_at
    await sql`
      UPDATE messaging_accounts SET last_message_at = NOW()
      WHERE user_id = ${userId} AND platform = ${platform} AND is_active = true
    `

    return { success: true, contactName: parsed.name, company: parsed.company }
  } catch (error) {
    console.error(`[${platform}] Text processing failed:`, error)
    return { success: false, error: 'Failed to process message' }
  }
}

export async function processImageMessage(
  userId: string,
  imageBase64: string,
  mimeType: string,
  platform: 'line' | 'whatsapp'
): Promise<{ success: boolean; contactName?: string; company?: string; error?: string }> {
  try {
    const scanned = await scanBusinessCard(imageBase64, mimeType)
    if (!scanned.name) {
      return { success: false, error: 'Could not read the business card' }
    }

    const id = generateId()
    const now = new Date().toISOString()
    const source = `${platform}_bot`
    const phone = scanned.phone?.[0] || null

    await sql`
      INSERT INTO contacts (id, user_id, name, company, title, email, phone, notes, source, created_at, updated_at)
      VALUES (${id}, ${userId}, ${scanned.name}, ${scanned.company || null}, ${scanned.title || null},
        ${scanned.email || null}, ${phone}, ${scanned.address || null}, ${source}, ${now}, ${now})
    `

    await sql`
      UPDATE messaging_accounts SET last_message_at = NOW()
      WHERE user_id = ${userId} AND platform = ${platform} AND is_active = true
    `

    return { success: true, contactName: scanned.name, company: scanned.company }
  } catch (error) {
    console.error(`[${platform}] Image processing failed:`, error)
    return { success: false, error: 'Failed to scan business card' }
  }
}

// ============================================================
// LINE Bot handlers
// ============================================================

export async function sendLineReply(replyToken: string, messages: { type: string; text: string }[]) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!accessToken) return

  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  })
}

async function getLineImageBase64(messageId: string): Promise<string> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer).toString('base64')
}

export async function handleLineWebhook(events: any[]) {
  for (const event of events) {
    if (event.type !== 'message') continue

    const platformUserId = event.source?.userId
    if (!platformUserId) continue

    const replyToken = event.replyToken
    const userId = await findLinkedUser('line', platformUserId)

    if (!userId) {
      // Not linked — check for linking code
      if (event.message?.type === 'text') {
        const text = event.message.text.trim()
        if (/^\d{6}$/.test(text)) {
          const result = await validateAndLinkAccount(text, 'line', platformUserId, event.source?.displayName)
          if (result.success) {
            await sendLineReply(replyToken, [{ type: 'text', text: '✅ Connected to Warmly! Send me business cards or contact descriptions.' }])
          } else {
            await sendLineReply(replyToken, [{ type: 'text', text: '❌ Invalid or expired code. Please try again.' }])
          }
          return
        }
      }
      await sendLineReply(replyToken, [{
        type: 'text',
        text: 'Welcome to Warmly! To link your account, open Warmly app → Profile → Messaging Integrations → Connect LINE, then send the 6-digit code here.'
      }])
      return
    }

    // Linked user — process message
    if (event.message?.type === 'text') {
      const result = await processTextMessage(userId, event.message.text, 'line')
      if (result.success) {
        await sendLineReply(replyToken, [{
          type: 'text',
          text: `✅ Added: ${result.contactName}${result.company ? ` (${result.company})` : ''}`
        }])
      } else {
        await sendLineReply(replyToken, [{
          type: 'text',
          text: `Could not process: ${result.error}. Try describing the contact like "Met Sarah Chen at Google, she's a PM".`
        }])
      }
    } else if (event.message?.type === 'image') {
      try {
        const imageBase64 = await getLineImageBase64(event.message.id)
        const result = await processImageMessage(userId, imageBase64, 'image/jpeg', 'line')
        if (result.success) {
          await sendLineReply(replyToken, [{
            type: 'text',
            text: `✅ Added: ${result.contactName}${result.company ? ` (${result.company})` : ''}`
          }])
        } else {
          await sendLineReply(replyToken, [{ type: 'text', text: `Could not read card: ${result.error}` }])
        }
      } catch {
        await sendLineReply(replyToken, [{ type: 'text', text: 'Failed to process image. Please try again.' }])
      }
    }
  }
}

