import http from 'node:http'
import postgres from 'postgres'
import makeWASocket, {
  type WASocket,
  type AuthenticationState,
  type AuthenticationCreds,
  type SignalDataTypeMap,
  type SignalDataSet,
  type SignalKeyStore,
  initAuthCreds,
  BufferJSON,
  Browsers,
} from '@whiskeysockets/baileys'

// ============================================================
// Database connection (independent from main process)
// ============================================================

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://warmly_app:WarmlyApp2026@127.0.0.1:5432/warmly'

const sql = postgres(connectionString, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
})

function generateId(): string {
  return crypto.randomUUID()
}

// ============================================================
// PostgreSQL Auth State Adapter
// ============================================================

async function usePostgresAuthState(sessionId: string): Promise<{
  state: AuthenticationState
  saveCreds: () => Promise<void>
}> {
  const [session] = await sql<any[]>`
    SELECT creds FROM whatsapp_sessions WHERE id = ${sessionId}
  `
  let creds: AuthenticationCreds
  if (session?.creds) {
    creds = JSON.parse(JSON.stringify(session.creds), BufferJSON.reviver)
  } else {
    creds = initAuthCreds()
  }

  const saveCreds = async () => {
    const credsStr = JSON.stringify(creds, BufferJSON.replacer)
    await sql`
      UPDATE whatsapp_sessions SET creds = ${credsStr}::jsonb WHERE id = ${sessionId}
    `
  }

  const keys: SignalKeyStore = {
    async get<T extends keyof SignalDataTypeMap>(type: T, ids: string[]): Promise<{ [id: string]: SignalDataTypeMap[T] }> {
      const result: { [id: string]: SignalDataTypeMap[T] } = {}
      if (ids.length === 0) return result

      const rows = await sql<any[]>`
        SELECT key_id, key_data FROM whatsapp_auth_keys
        WHERE session_id = ${sessionId} AND key_type = ${type} AND key_id = ANY(${ids})
      `
      for (const row of rows) {
        result[row.key_id] = JSON.parse(JSON.stringify(row.key_data), BufferJSON.reviver)
      }
      return result
    },

    async set(data: SignalDataSet): Promise<void> {
      for (const type of Object.keys(data) as (keyof SignalDataTypeMap)[]) {
        const entries = data[type]
        if (!entries) continue
        for (const [id, value] of Object.entries(entries)) {
          if (value === null || value === undefined) {
            await sql`
              DELETE FROM whatsapp_auth_keys
              WHERE session_id = ${sessionId} AND key_type = ${type} AND key_id = ${id}
            `
          } else {
            const jsonStr = JSON.stringify(value, BufferJSON.replacer)
            await sql`
              INSERT INTO whatsapp_auth_keys (session_id, key_type, key_id, key_data)
              VALUES (${sessionId}, ${type}, ${id}, ${jsonStr}::jsonb)
              ON CONFLICT (session_id, key_type, key_id)
              DO UPDATE SET key_data = ${jsonStr}::jsonb
            `
          }
        }
      }
    },
  }

  return { state: { creds, keys }, saveCreds }
}

// ============================================================
// Session Manager
// ============================================================

interface ActiveSession {
  socket: WASocket
  cleanup: () => void
  state: AuthenticationState
  saveCreds: () => Promise<void>
}

const activeSessions = new Map<string, ActiveSession>()

async function connectUser(userId: string): Promise<{ sessionId: string }> {
  await disconnectUser(userId)

  let [session] = await sql<any[]>`
    SELECT id FROM whatsapp_sessions WHERE user_id = ${userId}
  `
  const sessionId = session?.id || generateId()
  if (!session) {
    await sql`
      INSERT INTO whatsapp_sessions (id, user_id, status)
      VALUES (${sessionId}, ${userId}, 'connecting')
    `
  } else {
    await sql`
      DELETE FROM whatsapp_auth_keys WHERE session_id = ${sessionId}
    `
    await sql`
      UPDATE whatsapp_sessions SET status = 'connecting', creds = NULL WHERE id = ${sessionId}
    `
  }

  const { state, saveCreds } = await usePostgresAuthState(sessionId)

  const socket = makeWASocket({
    printQRInTerminal: false,
    mobile: false,
    auth: state,
    browser: ['Warmly', 'Chrome', '22.04.4'],
    defaultQueryTimeoutMs: undefined,
  })

  const cleanup = setupEventHandlers(socket, userId, sessionId, saveCreds, state)
  activeSessions.set(userId, { socket, cleanup, state, saveCreds })

  // Wait for the socket to be ready (first QR event signals readiness for pairing)
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve() // Proceed anyway after 10s
    }, 10000)

    socket.ev.on('connection.update', (update: any) => {
      if (update.qr) {
        clearTimeout(timeout)
        resolve()
      }
      if (update.connection === 'close') {
        clearTimeout(timeout)
        reject(new Error('Connection closed before pairing could start'))
      }
    })
  })

  return { sessionId }
}

async function requestPairingCode(userId: string, phoneNumber: string): Promise<string> {
  const session = activeSessions.get(userId)
  if (!session) throw new Error('No active session. Call connectUser first.')

  await sql`
    UPDATE whatsapp_sessions SET phone_number = ${phoneNumber} WHERE user_id = ${userId}
  `

  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '')
  const code = await session.socket.requestPairingCode(cleanPhone)
  return code
}

function setupEventHandlers(
  socket: WASocket,
  userId: string,
  sessionId: string,
  saveCreds: () => Promise<void>,
  state: AuthenticationState
): () => void {
  const ev = socket.ev

  ev.on('creds.update', async () => {
    await saveCreds()
  })

  ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update

    if (connection === 'open') {
      console.log(`[WhatsApp] User ${userId} connected`)
      await sql`
        UPDATE whatsapp_sessions
        SET status = 'connected', connected_at = NOW()
        WHERE id = ${sessionId}
      `
    } else if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode
      const isLoggedOut = statusCode === 401 || statusCode === 403
      const isQrTimeout = statusCode === 408
      const isStreamRestart = statusCode === 515

      if (isLoggedOut) {
        console.log(`[WhatsApp] User ${userId} logged out`)
        await sql`
          UPDATE whatsapp_sessions SET status = 'logged_out' WHERE id = ${sessionId}
        `
        activeSessions.delete(userId)
      } else if (isQrTimeout) {
        // 408 = QR ref timeout. If session was already connected, this is a
        // stale timer — reconnect instead of giving up.
        const [currentSession] = await sql<any[]>`
          SELECT status FROM whatsapp_sessions WHERE id = ${sessionId}
        `
        if (currentSession?.status === 'connected') {
          console.log(`[WhatsApp] User ${userId} QR timeout on already-connected session, reconnecting...`)
          activeSessions.delete(userId)
          setTimeout(() => {
            restoreSession(userId, sessionId).catch(err => {
              console.error(`[WhatsApp] Failed to reconnect user ${userId} after QR timeout:`, err)
            })
          }, 2000)
        } else {
          console.log(`[WhatsApp] User ${userId} QR timeout (expected for pairing code mode)`)
          await sql`
            UPDATE whatsapp_sessions SET status = 'disconnected' WHERE id = ${sessionId}
          `
          activeSessions.delete(userId)
        }
      } else if (isStreamRestart) {
        // 515 = stream restart required (expected after successful pairing)
        // Use in-memory state — DB may not have the latest creds yet
        console.log(`[WhatsApp] User ${userId} stream restart required, reconnecting with in-memory state...`)
        activeSessions.delete(userId)
        await saveCreds()
        restoreSessionInMemory(userId, sessionId, state, saveCreds).catch(err => {
          console.error(`[WhatsApp] Failed to reconnect user ${userId} after stream restart:`, err)
        })
      } else {
        console.log(`[WhatsApp] User ${userId} disconnected (code: ${statusCode}), reconnecting...`)
        await sql`
          UPDATE whatsapp_sessions SET status = 'disconnected' WHERE id = ${sessionId}
        `
        setTimeout(() => {
          restoreSession(userId, sessionId).catch(err => {
            console.error(`[WhatsApp] Failed to reconnect user ${userId}:`, err)
          })
        }, 5000)
      }
    }
  })

  ev.on('contacts.upsert', async (contacts) => {
    console.log(`[WhatsApp] User ${userId}: received ${contacts.length} contacts`)
    for (const contact of contacts) {
      if (!contact.id) continue
      const phoneFromJid = contact.id.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
      await sql`
        INSERT INTO whatsapp_contact_imports (user_id, wa_jid, wa_name, phone_number, status)
        VALUES (${userId}, ${contact.id}, ${contact.name || contact.notify || null}, ${phoneFromJid}, 'pending')
        ON CONFLICT (user_id, wa_jid)
        DO UPDATE SET wa_name = COALESCE(EXCLUDED.wa_name, whatsapp_contact_imports.wa_name)
      `
    }
    await sql`
      UPDATE whatsapp_sessions SET last_sync_at = NOW() WHERE id = ${sessionId}
    `
  })

  ev.on('messaging-history.set', async ({ contacts: histContacts }) => {
    if (!histContacts?.length) return
    console.log(`[WhatsApp] User ${userId}: history sync, ${histContacts.length} contacts`)
    for (const contact of histContacts) {
      if (!contact.id) continue
      const phoneFromJid = contact.id.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
      await sql`
        INSERT INTO whatsapp_contact_imports (user_id, wa_jid, wa_name, phone_number, status)
        VALUES (${userId}, ${contact.id}, ${contact.name || contact.notify || null}, ${phoneFromJid}, 'pending')
        ON CONFLICT (user_id, wa_jid)
        DO UPDATE SET wa_name = COALESCE(EXCLUDED.wa_name, whatsapp_contact_imports.wa_name)
      `
    }
  })

  return () => {
    ev.removeAllListeners('creds.update')
    ev.removeAllListeners('connection.update')
    ev.removeAllListeners('contacts.upsert')
    ev.removeAllListeners('messaging-history.set')
  }
}

async function restoreSession(userId: string, sessionId: string): Promise<void> {
  if (activeSessions.has(userId)) return

  const { state, saveCreds } = await usePostgresAuthState(sessionId)

  const socket = makeWASocket({
    printQRInTerminal: false,
    mobile: false,
    auth: state,
    browser: ['Warmly', 'Chrome', '22.04.4'],
    defaultQueryTimeoutMs: undefined,
  })

  const cleanup = setupEventHandlers(socket, userId, sessionId, saveCreds, state)
  activeSessions.set(userId, { socket, cleanup, state, saveCreds })
}

// Reconnect using in-memory auth state (for 515 stream restart after pairing)
async function restoreSessionInMemory(
  userId: string,
  sessionId: string,
  existingState: AuthenticationState,
  existingSaveCreds: () => Promise<void>
): Promise<void> {
  if (activeSessions.has(userId)) return

  const socket = makeWASocket({
    printQRInTerminal: false,
    mobile: false,
    auth: existingState,
    browser: ['Warmly', 'Chrome', '22.04.4'],
    defaultQueryTimeoutMs: undefined,
  })

  const cleanup = setupEventHandlers(socket, userId, sessionId, existingSaveCreds, existingState)
  activeSessions.set(userId, { socket, cleanup, state: existingState, saveCreds: existingSaveCreds })
}

async function disconnectUser(userId: string): Promise<void> {
  const session = activeSessions.get(userId)
  if (session) {
    session.cleanup()
    session.socket.end(undefined)
    activeSessions.delete(userId)
  }
  await sql`
    UPDATE whatsapp_sessions SET status = 'disconnected' WHERE user_id = ${userId}
  `
}

async function getStatus(userId: string) {
  const [session] = await sql<any[]>`
    SELECT status, phone_number, connected_at, last_sync_at
    FROM whatsapp_sessions WHERE user_id = ${userId}
  `
  return {
    status: session?.status || 'disconnected',
    phoneNumber: session?.phone_number || null,
    connectedAt: session?.connected_at || null,
    lastSyncAt: session?.last_sync_at || null,
  }
}

async function getImportableContacts(userId: string) {
  return sql<any[]>`
    SELECT id, wa_jid, wa_name, phone_number, status, imported_to_contact_id, created_at
    FROM whatsapp_contact_imports
    WHERE user_id = ${userId}
    ORDER BY wa_name ASC NULLS LAST
  `
}

async function importContacts(userId: string, contactImportIds: string[]) {
  let importedCount = 0

  for (const importId of contactImportIds) {
    const [waContact] = await sql<any[]>`
      SELECT * FROM whatsapp_contact_imports
      WHERE id = ${importId} AND user_id = ${userId} AND status = 'pending'
    `
    if (!waContact) continue

    const contactId = generateId()
    const now = new Date().toISOString()

    await sql`
      INSERT INTO contacts (id, user_id, name, phone, source, created_at, updated_at)
      VALUES (
        ${contactId},
        ${userId},
        ${waContact.wa_name || waContact.phone_number || 'Unknown'},
        ${waContact.phone_number || null},
        'whatsapp_import',
        ${now},
        ${now}
      )
    `

    // Create 1st-degree relationship (user ↔ imported contact)
    await sql`
      INSERT INTO relationships (id, user_id, contact_a_id, is_user_relationship, relationship_type, strength, how_met, verified, created_at, updated_at)
      VALUES (${generateId()}, ${userId}, ${contactId}, true, 'personal', 3, 'WhatsApp contact', false, ${now}, ${now})
    `

    await sql`
      UPDATE whatsapp_contact_imports
      SET status = 'imported', imported_to_contact_id = ${contactId}, imported_at = NOW()
      WHERE id = ${importId}
    `

    importedCount++
  }

  return { importedCount }
}

async function restoreActiveSessions(): Promise<void> {
  const sessions = await sql<any[]>`
    SELECT id, user_id FROM whatsapp_sessions WHERE status = 'connected'
  `
  console.log(`[WhatsApp Worker] Restoring ${sessions.length} active session(s)`)
  for (const session of sessions) {
    try {
      await restoreSession(session.user_id, session.id)
    } catch (err) {
      console.error(`[WhatsApp Worker] Failed to restore session for user ${session.user_id}:`, err)
    }
  }
}

async function shutdownAll(): Promise<void> {
  console.log(`[WhatsApp Worker] Shutting down ${activeSessions.size} session(s)`)
  for (const [userId, session] of activeSessions) {
    try {
      session.cleanup()
      session.socket.end(undefined)
    } catch (err) {
      console.error(`[WhatsApp Worker] Error shutting down session for user ${userId}:`, err)
    }
  }
  activeSessions.clear()
}

// ============================================================
// HTTP Server
// ============================================================

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => {
      if (!body) return resolve({})
      try { resolve(JSON.parse(body)) }
      catch { reject(new Error('Invalid JSON')) }
    })
    req.on('error', reject)
  })
}

function sendJson(res: http.ServerResponse, status: number, data: any) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const path = url.pathname
  const method = req.method || 'GET'

  try {
    // GET /health
    if (method === 'GET' && path === '/health') {
      return sendJson(res, 200, { ok: true })
    }

    // POST /connect
    if (method === 'POST' && path === '/connect') {
      const { userId } = await parseBody(req)
      if (!userId) return sendJson(res, 400, { error: 'userId required' })
      const result = await connectUser(userId)
      return sendJson(res, 200, result)
    }

    // POST /pairing-code
    if (method === 'POST' && path === '/pairing-code') {
      const { userId, phoneNumber } = await parseBody(req)
      if (!userId || !phoneNumber) return sendJson(res, 400, { error: 'userId and phoneNumber required' })
      const pairingCode = await requestPairingCode(userId, phoneNumber)
      return sendJson(res, 200, { pairingCode })
    }

    // POST /disconnect
    if (method === 'POST' && path === '/disconnect') {
      const { userId } = await parseBody(req)
      if (!userId) return sendJson(res, 400, { error: 'userId required' })
      await disconnectUser(userId)
      return sendJson(res, 200, { ok: true })
    }

    // GET /status/:userId
    if (method === 'GET' && path.startsWith('/status/')) {
      const userId = path.slice('/status/'.length)
      if (!userId) return sendJson(res, 400, { error: 'userId required' })
      const status = await getStatus(userId)
      return sendJson(res, 200, status)
    }

    // GET /contacts/:userId
    if (method === 'GET' && path.startsWith('/contacts/')) {
      const userId = path.slice('/contacts/'.length)
      if (!userId) return sendJson(res, 400, { error: 'userId required' })
      const contacts = await getImportableContacts(userId)
      return sendJson(res, 200, contacts)
    }

    // POST /import-contacts
    if (method === 'POST' && path === '/import-contacts') {
      const { userId, contactIds } = await parseBody(req)
      if (!userId || !contactIds) return sendJson(res, 400, { error: 'userId and contactIds required' })
      const result = await importContacts(userId, contactIds)
      return sendJson(res, 200, result)
    }

    // POST /shutdown
    if (method === 'POST' && path === '/shutdown') {
      await shutdownAll()
      return sendJson(res, 200, { ok: true })
    }

    sendJson(res, 404, { error: 'Not found' })
  } catch (err: any) {
    console.error(`[WhatsApp Worker] Error handling ${method} ${path}:`, err)
    sendJson(res, 500, { error: err.message || 'Internal server error' })
  }
})

const PORT = Number(process.env.WA_WORKER_PORT) || 7100

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`[WhatsApp Worker] Running on http://127.0.0.1:${PORT}`)
  try {
    await sql`SELECT 1`
    console.log('[WhatsApp Worker] PostgreSQL connected')
    await restoreActiveSessions()
  } catch (err) {
    console.error('[WhatsApp Worker] PostgreSQL connection failed:', err)
  }
})

// Graceful shutdown
const handleShutdown = async () => {
  console.log('[WhatsApp Worker] Shutting down...')
  await shutdownAll()
  await sql.end()
  server.close()
  process.exit(0)
}
process.on('SIGTERM', handleShutdown)
process.on('SIGINT', handleShutdown)
