const WORKER_BASE = `http://127.0.0.1:${process.env.WA_WORKER_PORT || 7100}`
const TIMEOUT_MS = 30_000

async function workerFetch(path: string, options: RequestInit = {}): Promise<any> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${WORKER_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || `Worker responded with ${res.status}`)
    }
    return data
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('WhatsApp worker request timed out')
    }
    if (err.cause?.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      throw new Error('WhatsApp worker is not running')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function connectUser(userId: string): Promise<{ pairingCode: string; sessionId: string }> {
  const result = await workerFetch('/connect', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
  return { pairingCode: '', sessionId: result.sessionId }
}

export async function requestPairingCode(userId: string, phoneNumber: string): Promise<string> {
  const result = await workerFetch('/pairing-code', {
    method: 'POST',
    body: JSON.stringify({ userId, phoneNumber }),
  })
  return result.pairingCode
}

export async function disconnectUser(userId: string): Promise<void> {
  await workerFetch('/disconnect', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}

export async function getStatus(userId: string): Promise<{
  status: string
  phoneNumber: string | null
  connectedAt: string | null
  lastSyncAt: string | null
}> {
  return workerFetch(`/status/${encodeURIComponent(userId)}`)
}

export async function getImportableContacts(userId: string): Promise<any[]> {
  return workerFetch(`/contacts/${encodeURIComponent(userId)}`)
}

export async function importContacts(
  userId: string,
  contactImportIds: string[]
): Promise<{ importedCount: number }> {
  return workerFetch('/import-contacts', {
    method: 'POST',
    body: JSON.stringify({ userId, contactIds: contactImportIds }),
  })
}

export async function restoreActiveSessions(): Promise<void> {
  // No-op: the worker restores sessions on its own startup
}

export async function shutdownAll(): Promise<void> {
  try {
    await workerFetch('/shutdown', { method: 'POST' })
  } catch {
    // Worker may already be down
  }
}
