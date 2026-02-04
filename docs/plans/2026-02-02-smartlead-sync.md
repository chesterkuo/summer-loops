# SmartLead.ai Contact Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** One-way manual sync of contacts (with notes and social handles) from Warmly to SmartLead.ai, with both individual and bulk sync options.

**Architecture:** Backend service wraps the SmartLead REST API (`https://server.smartlead.ai/api/v1`). A global `SMARTLEAD_API_KEY` env var serves as the default key for all users; individual users can optionally override with their own key stored in `smartlead_settings`. New routes handle settings (optional per-user API key + campaign ID) and sync triggers. Frontend adds a SmartLead settings card on the user Profile screen, a "Sync to SmartLead" button on the contact detail view, and a "Sync All" bulk button in the settings card. Contacts without email are skipped (SmartLead requires email).

**API Key Resolution Order:** Per-user key (if set) → Global `SMARTLEAD_API_KEY` env var → Error "not configured"

**Tech Stack:** Hono (backend routes), postgres.js (DB), React + Tailwind (frontend), SmartLead REST API (external)

---

## Task 1: Database Migration — SmartLead Settings + Sync Tracking

**Files:**
- Create: `backend/migrations/006_smartlead.sql`
- Modify: `backend/src/db/schema.ts` (add new tables)

**Step 1: Create the migration file**

Create `backend/migrations/006_smartlead.sql`:

```sql
-- SmartLead integration settings per user
-- api_key is optional — if NULL, the global SMARTLEAD_API_KEY env var is used
CREATE TABLE IF NOT EXISTS smartlead_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key TEXT,
  campaign_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_smartlead_settings_user ON smartlead_settings(user_id);

-- Track which contacts have been synced
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS smartlead_lead_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS smartlead_synced_at TIMESTAMPTZ;
```

**Step 2: Add schema definitions to Drizzle**

In `backend/src/db/schema.ts`, add at the end (before the closing):

```typescript
// ============ SMARTLEAD SETTINGS ============
export const smartleadSettings = pgTable(
  'smartlead_settings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    apiKey: text('api_key'), // nullable — falls back to SMARTLEAD_API_KEY env var
    campaignId: text('campaign_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdx: uniqueIndex('unique_smartlead_user').on(table.userId),
  })
)
```

Also add the two new columns to the existing `contacts` table definition:

```typescript
smartleadLeadId: text('smartlead_lead_id'),
smartleadSyncedAt: timestamp('smartlead_synced_at', { withTimezone: true }),
```

These go after `instagramHandle` and before `createdAt` in the contacts table.

**Step 3: Run the migration**

```bash
cd backend && psql "$DATABASE_URL" -f migrations/006_smartlead.sql
```

If `DATABASE_URL` is not set, use: `psql "postgresql://warmly_app:WarmlyApp2026@127.0.0.1:5432/warmly" -f migrations/006_smartlead.sql`

Expected: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE` x2

**Step 4: Commit**

```bash
git add backend/migrations/006_smartlead.sql backend/src/db/schema.ts
git commit -m "feat: add smartlead settings table and sync tracking columns"
```

---

## Task 2: SmartLead API Service

**Files:**
- Create: `backend/src/services/smartlead.ts`

**Step 1: Create the SmartLead API client service**

Create `backend/src/services/smartlead.ts`:

```typescript
// SmartLead.ai API Client
// Docs: https://api.smartlead.ai/reference/welcome
// Base URL: https://server.smartlead.ai/api/v1
// Auth: ?api_key=<key> query param on all requests

const SMARTLEAD_BASE = 'https://server.smartlead.ai/api/v1'

interface SmartLeadLead {
  id: number
  email: string
  first_name?: string
  last_name?: string
  company_name?: string
  [key: string]: any
}

interface AddLeadPayload {
  email: string
  first_name?: string
  last_name?: string
  company_name?: string
  custom_fields?: Record<string, string>
}

async function smartleadFetch<T>(
  apiKey: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const separator = endpoint.includes('?') ? '&' : '?'
  const url = `${SMARTLEAD_BASE}${endpoint}${separator}api_key=${apiKey}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`SmartLead API error ${response.status}: ${text}`)
  }

  return response.json() as Promise<T>
}

export async function listCampaigns(apiKey: string): Promise<{ id: number; name: string }[]> {
  return smartleadFetch(apiKey, '/campaigns')
}

export async function fetchLeadByEmail(
  apiKey: string,
  email: string
): Promise<SmartLeadLead | null> {
  try {
    const result = await smartleadFetch<SmartLeadLead>(
      apiKey,
      `/leads/email/${encodeURIComponent(email)}`
    )
    return result
  } catch {
    return null
  }
}

export async function addLeadToCampaign(
  apiKey: string,
  campaignId: string,
  lead: AddLeadPayload
): Promise<{ leadId: number }> {
  // SmartLead expects lead_list array
  const result = await smartleadFetch<any>(
    apiKey,
    `/campaigns/${campaignId}/leads`,
    {
      method: 'POST',
      body: JSON.stringify({
        lead_list: [
          {
            email: lead.email,
            first_name: lead.first_name || '',
            last_name: lead.last_name || '',
            company_name: lead.company_name || '',
            ...Object.fromEntries(
              Object.entries(lead.custom_fields || {}).map(([k, v]) => [k, v])
            ),
          },
        ],
        settings: {
          ignore_global_block_list: false,
          ignore_unsubscribe_list: false,
          ignore_duplicate_leads_in_other_campaign: false,
        },
      }),
    }
  )

  // The response structure may vary — extract lead ID from response
  const leadId = result?.upload_count > 0 ? result?.leads?.[0]?.id : result?.id
  return { leadId: leadId || 0 }
}

export async function createLeadNote(
  apiKey: string,
  leadId: number,
  note: string
): Promise<void> {
  await smartleadFetch(apiKey, `/leads/${leadId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}

// Map a Warmly contact to a SmartLead lead payload
export function mapContactToLead(contact: {
  name: string
  email: string
  company?: string | null
  title?: string | null
  phone?: string | null
  linkedin_url?: string | null
  line_id?: string | null
  whatsapp_number?: string | null
  telegram_username?: string | null
  wechat_id?: string | null
  twitter_handle?: string | null
  facebook_url?: string | null
  instagram_handle?: string | null
}): AddLeadPayload {
  const nameParts = (contact.name || '').trim().split(/\s+/)
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  const customFields: Record<string, string> = {}
  if (contact.title) customFields.title = contact.title
  if (contact.phone) customFields.phone = contact.phone
  if (contact.linkedin_url) customFields.linkedin_url = contact.linkedin_url
  if (contact.line_id) customFields.line_id = contact.line_id
  if (contact.whatsapp_number) customFields.whatsapp = contact.whatsapp_number
  if (contact.telegram_username) customFields.telegram = contact.telegram_username
  if (contact.wechat_id) customFields.wechat = contact.wechat_id
  if (contact.twitter_handle) customFields.twitter = contact.twitter_handle
  if (contact.facebook_url) customFields.facebook = contact.facebook_url
  if (contact.instagram_handle) customFields.instagram = contact.instagram_handle

  return {
    email: contact.email,
    first_name: firstName,
    last_name: lastName,
    company_name: contact.company || undefined,
    custom_fields: customFields,
  }
}

// Build a note string from contact notes + AI summary
export function buildNoteContent(contact: {
  notes?: string | null
  ai_summary?: string | null
}): string | null {
  const parts: string[] = []
  if (contact.notes) parts.push(`Notes:\n${contact.notes}`)
  if (contact.ai_summary) parts.push(`AI Summary:\n${contact.ai_summary}`)
  return parts.length > 0 ? parts.join('\n\n---\n\n') : null
}
```

**Step 2: Commit**

```bash
git add backend/src/services/smartlead.ts
git commit -m "feat: add SmartLead API client service with contact mapping"
```

---

## Task 3: Backend Routes — SmartLead Settings + Sync Endpoints

**Files:**
- Create: `backend/src/routes/smartlead.ts`
- Modify: `backend/src/index.ts` (mount new route)

**Step 1: Create the SmartLead routes**

Create `backend/src/routes/smartlead.ts`:

```typescript
import { Hono } from 'hono'
import { sql, generateId } from '../db/postgres.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  listCampaigns,
  fetchLeadByEmail,
  addLeadToCampaign,
  createLeadNote,
  mapContactToLead,
  buildNoteContent,
} from '../services/smartlead.js'
import type { Contact } from '../types/index.js'

const smartlead = new Hono()
smartlead.use('*', authMiddleware)

// Resolve the API key: per-user override → global env var → null
function resolveApiKey(userApiKey: string | null): string | null {
  return userApiKey || process.env.SMARTLEAD_API_KEY || null
}

// ---- Settings ----

// Get current SmartLead settings
smartlead.get('/settings', async (c) => {
  const userId = c.get('user').userId
  const [settings] = await sql`
    SELECT id, user_id, api_key, campaign_id, created_at, updated_at
    FROM smartlead_settings WHERE user_id = ${userId}
  `
  const globalKeySet = !!process.env.SMARTLEAD_API_KEY
  // Never return the raw API key to frontend — just whether one is available
  return c.json({
    data: settings
      ? { ...settings, api_key: undefined, hasApiKey: !!settings.api_key, hasGlobalKey: globalKeySet, keyAvailable: !!resolveApiKey(settings.api_key) }
      : { campaign_id: null, hasApiKey: false, hasGlobalKey: globalKeySet, keyAvailable: globalKeySet },
  })
})

// Save / update SmartLead settings
// apiKey is optional — if not provided, the global env var is used
smartlead.put('/settings', async (c) => {
  const userId = c.get('user').userId
  const body = await c.req.json<{ apiKey?: string; campaignId?: string }>()

  if (!body.apiKey && !body.campaignId) {
    return c.json({ error: 'apiKey or campaignId required' }, 400)
  }

  const now = new Date().toISOString()
  const [existing] = await sql`
    SELECT id, api_key FROM smartlead_settings WHERE user_id = ${userId}
  `

  if (existing) {
    // Only update api_key if explicitly provided; keep existing otherwise
    const apiKey = body.apiKey !== undefined ? (body.apiKey || null) : existing.api_key
    const campaignId = body.campaignId !== undefined ? (body.campaignId || null) : null
    await sql`
      UPDATE smartlead_settings
      SET api_key = ${apiKey},
          campaign_id = COALESCE(${campaignId}, campaign_id),
          updated_at = ${now}
      WHERE user_id = ${userId}
    `
  } else {
    // Create new settings row — apiKey can be null (will use global key)
    const id = generateId()
    await sql`
      INSERT INTO smartlead_settings (id, user_id, api_key, campaign_id, created_at, updated_at)
      VALUES (${id}, ${userId}, ${body.apiKey || null}, ${body.campaignId || null}, ${now}, ${now})
    `
  }

  const globalKeySet = !!process.env.SMARTLEAD_API_KEY
  const [updated] = await sql`
    SELECT id, user_id, api_key, campaign_id, created_at, updated_at
    FROM smartlead_settings WHERE user_id = ${userId}
  `
  return c.json({ data: { ...updated, api_key: undefined, hasApiKey: !!updated.api_key, hasGlobalKey: globalKeySet, keyAvailable: !!resolveApiKey(updated.api_key) } })
})

// Delete SmartLead settings (disconnect)
smartlead.delete('/settings', async (c) => {
  const userId = c.get('user').userId
  await sql`DELETE FROM smartlead_settings WHERE user_id = ${userId}`
  return c.json({ message: 'SmartLead disconnected' })
})

// ---- Campaigns (for picker) ----

// List campaigns from SmartLead (proxied to avoid exposing API key to frontend)
smartlead.get('/campaigns', async (c) => {
  const userId = c.get('user').userId
  const [settings] = await sql`
    SELECT api_key FROM smartlead_settings WHERE user_id = ${userId}
  `
  const apiKey = resolveApiKey(settings?.api_key || null)
  if (!apiKey) {
    return c.json({ error: 'SmartLead not configured — no API key available' }, 400)
  }

  try {
    const campaigns = await listCampaigns(apiKey)
    return c.json({ data: campaigns })
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to fetch campaigns' }, 502)
  }
})

// ---- Sync Single Contact ----

smartlead.post('/sync/:contactId', async (c) => {
  const userId = c.get('user').userId
  const { contactId } = c.req.param()

  // Get settings + resolve API key
  const [settings] = await sql`
    SELECT api_key, campaign_id FROM smartlead_settings WHERE user_id = ${userId}
  `
  const apiKey = resolveApiKey(settings?.api_key || null)
  const campaignId = settings?.campaign_id
  if (!apiKey || !campaignId) {
    return c.json({ error: 'SmartLead not configured. Set API key and campaign first.' }, 400)
  }

  // Get contact
  const [contact] = await sql<Contact[]>`
    SELECT * FROM contacts WHERE id = ${contactId} AND user_id = ${userId}
  `
  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }
  if (!contact.email) {
    return c.json({ error: 'Contact has no email — SmartLead requires an email address' }, 400)
  }

  try {
    const leadPayload = mapContactToLead(contact)
    const result = await addLeadToCampaign(apiKey, campaignId, leadPayload)

    // Try to add notes
    const noteContent = buildNoteContent(contact)
    if (noteContent && result.leadId) {
      try {
        await createLeadNote(apiKey, result.leadId, noteContent)
      } catch (noteErr) {
        console.warn('Failed to create lead note:', noteErr)
      }
    }

    // Record sync
    const now = new Date().toISOString()
    await sql`
      UPDATE contacts
      SET smartlead_lead_id = ${String(result.leadId || '')},
          smartlead_synced_at = ${now}
      WHERE id = ${contactId}
    `

    return c.json({
      data: {
        contactId,
        smartleadLeadId: result.leadId,
        syncedAt: now,
        notesSynced: !!noteContent,
      },
    })
  } catch (err: any) {
    console.error('SmartLead sync failed:', err)
    return c.json({ error: err.message || 'Sync failed' }, 502)
  }
})

// ---- Sync All Contacts (Bulk) ----

smartlead.post('/sync-all', async (c) => {
  const userId = c.get('user').userId

  // Get settings + resolve API key
  const [settings] = await sql`
    SELECT api_key, campaign_id FROM smartlead_settings WHERE user_id = ${userId}
  `
  const apiKey = resolveApiKey(settings?.api_key || null)
  const campaignId = settings?.campaign_id
  if (!apiKey || !campaignId) {
    return c.json({ error: 'SmartLead not configured. Set API key and campaign first.' }, 400)
  }

  // Get all contacts with email that haven't been synced yet
  const contactsToSync = await sql<Contact[]>`
    SELECT * FROM contacts
    WHERE user_id = ${userId}
      AND email IS NOT NULL
      AND email != ''
      AND smartlead_synced_at IS NULL
    ORDER BY created_at DESC
  `

  if (contactsToSync.length === 0) {
    return c.json({ data: { synced: 0, failed: 0, skipped: 0, message: 'All contacts already synced or have no email' } })
  }

  let synced = 0
  let failed = 0
  const errors: { contactId: string; name: string; error: string }[] = []

  for (const contact of contactsToSync) {
    try {
      const leadPayload = mapContactToLead(contact)
      const result = await addLeadToCampaign(apiKey, campaignId, leadPayload)

      // Try to add notes
      const noteContent = buildNoteContent(contact)
      if (noteContent && result.leadId) {
        try {
          await createLeadNote(apiKey, result.leadId, noteContent)
        } catch {
          // Non-fatal: note failed but lead was created
        }
      }

      // Record sync
      const now = new Date().toISOString()
      await sql`
        UPDATE contacts
        SET smartlead_lead_id = ${String(result.leadId || '')},
            smartlead_synced_at = ${now}
        WHERE id = ${contact.id}
      `
      synced++

      // Rate limit: SmartLead allows ~60 req/min
      // Each contact = 1-2 requests (add + note), so pause 2s between contacts
      if (synced < contactsToSync.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    } catch (err: any) {
      failed++
      errors.push({ contactId: contact.id, name: contact.name, error: err.message })
    }
  }

  return c.json({
    data: {
      synced,
      failed,
      total: contactsToSync.length,
      errors: errors.slice(0, 10), // Cap error list
    },
  })
})

export default smartlead
```

**Step 2: Mount the route in index.ts**

In `backend/src/index.ts`, add the import and route mount:

After line `import messaging from './routes/messaging.js'`, add:
```typescript
import smartlead from './routes/smartlead.js'
```

After line `app.route('/api/messaging', messaging)`, add:
```typescript
app.route('/api/smartlead', smartlead)
```

**Step 3: Commit**

```bash
git add backend/src/routes/smartlead.ts backend/src/index.ts
git commit -m "feat: add SmartLead settings and sync API routes"
```

---

## Task 4: Frontend API Layer

**Files:**
- Modify: `frontend/src/services/api.ts` (add `smartleadApi` section)
- Modify: `frontend/src/services/api.ts` (update `Contact` interface)

**Step 1: Update the Contact interface**

In `frontend/src/services/api.ts`, add two fields to the `Contact` interface (after `instagram_handle`):

```typescript
  smartlead_lead_id: string | null
  smartlead_synced_at: string | null
```

**Step 2: Add the SmartLead API methods**

At the end of `frontend/src/services/api.ts` (before the final closing), add:

```typescript
// SmartLead API
export const smartleadApi = {
  async getSettings() {
    return apiFetch<{ campaign_id: string | null; hasApiKey: boolean; hasGlobalKey: boolean; keyAvailable: boolean }>('/smartlead/settings')
  },

  async saveSettings(data: { apiKey?: string; campaignId?: string }) {
    return apiFetch<{ campaign_id: string | null; hasApiKey: boolean; hasGlobalKey: boolean; keyAvailable: boolean }>('/smartlead/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async deleteSettings() {
    return apiFetch('/smartlead/settings', { method: 'DELETE' })
  },

  async listCampaigns() {
    return apiFetch<{ id: number; name: string }[]>('/smartlead/campaigns')
  },

  async syncContact(contactId: string) {
    return apiFetch<{ contactId: string; smartleadLeadId: number; syncedAt: string; notesSynced: boolean }>(
      `/smartlead/sync/${contactId}`,
      { method: 'POST' }
    )
  },

  async syncAll() {
    return apiFetch<{ synced: number; failed: number; total: number; errors: any[] }>(
      '/smartlead/sync-all',
      { method: 'POST' }
    )
  },
}
```

**Step 3: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: add SmartLead API client methods to frontend"
```

---

## Task 5: Frontend — SmartLead Settings Card on Profile Screen (User Profile Mode)

**Files:**
- Modify: `frontend/src/screens/Profile.tsx`

This adds a "SmartLead CRM" settings card in the user profile section (when `!selectedContact`), placed after the "Messaging Integrations" card and before the "Account Actions" card.

**Step 1: Add SmartLead state variables**

At the top of the `Profile` component (near the other state declarations, around line 67), add:

```typescript
  // SmartLead state
  const [slSettings, setSlSettings] = useState<{ campaign_id: string | null; hasApiKey: boolean; hasGlobalKey: boolean; keyAvailable: boolean } | null>(null)
  const [slApiKey, setSlApiKey] = useState('')
  const [slCampaigns, setSlCampaigns] = useState<{ id: number; name: string }[]>([])
  const [slSelectedCampaign, setSlSelectedCampaign] = useState('')
  const [isSlSaving, setIsSlSaving] = useState(false)
  const [isSlSyncingAll, setIsSlSyncingAll] = useState(false)
  const [slSyncResult, setSlSyncResult] = useState<{ synced: number; failed: number; total: number } | null>(null)
  const [isSlLoadingCampaigns, setIsSlLoadingCampaigns] = useState(false)
```

**Step 2: Add SmartLead import**

Add `smartleadApi` to the import from `'../services/api'` at line 10:

```typescript
import { relationshipsApi, interactionsApi, aiApi, messagingApi, smartleadApi, Relationship, Interaction, Contact } from '../services/api';
```

**Step 3: Add SmartLead settings fetch in the user profile useEffect**

Inside the existing `useEffect` that fetches messaging accounts (around line 120-124, the one that runs when `!selectedContact`), add after the `messagingApi.listAccounts()` call:

```typescript
      // Fetch SmartLead settings
      smartleadApi.getSettings().then((res) => {
        if (res.data) {
          setSlSettings(res.data)
          setSlSelectedCampaign(res.data.campaign_id || '')
        }
      })
```

**Step 4: Add SmartLead handler functions**

Add these functions near the other handler functions in the component:

```typescript
  const handleSlLoadCampaigns = async () => {
    setIsSlLoadingCampaigns(true)
    const res = await smartleadApi.listCampaigns()
    if (res.data) setSlCampaigns(res.data)
    setIsSlLoadingCampaigns(false)
  }

  const handleSlSaveSettings = async () => {
    setIsSlSaving(true)
    const payload: { apiKey?: string; campaignId?: string } = {}
    if (slApiKey) payload.apiKey = slApiKey
    if (slSelectedCampaign) payload.campaignId = slSelectedCampaign

    const res = await smartleadApi.saveSettings(payload)
    if (res.data) {
      setSlSettings(res.data)
      setSlApiKey('')
      // Load campaigns if we just set the API key
      if (payload.apiKey) handleSlLoadCampaigns()
    }
    setIsSlSaving(false)
  }

  const handleSlDisconnect = async () => {
    await smartleadApi.deleteSettings()
    setSlSettings(null)
    setSlCampaigns([])
    setSlSelectedCampaign('')
    setSlApiKey('')
    setSlSyncResult(null)
  }

  const handleSlSyncAll = async () => {
    setIsSlSyncingAll(true)
    setSlSyncResult(null)
    const res = await smartleadApi.syncAll()
    if (res.data) setSlSyncResult(res.data)
    setIsSlSyncingAll(false)
  }
```

**Step 5: Add the SmartLead settings card JSX**

In the user profile section (the `!selectedContact` block), insert the following JSX **after** the "Messaging Integrations" closing `</div>` (around line 1447) and **before** the "Account Actions" `<div>` (around line 1449):

```tsx
            {/* SmartLead CRM Integration */}
            <div className="bg-surface-card p-5 rounded-2xl shadow-sm border border-white/5">
              <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-400 text-[16px]">sync</span>
                SmartLead CRM
              </h3>

              {!slSettings?.keyAvailable ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400">Connect your SmartLead.ai account to sync contacts as leads.</p>
                  <input
                    type="password"
                    value={slApiKey}
                    onChange={(e) => setSlApiKey(e.target.value)}
                    placeholder="SmartLead API Key"
                    className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-orange-400 outline-none transition-colors"
                  />
                  <button
                    onClick={handleSlSaveSettings}
                    disabled={!slApiKey || isSlSaving}
                    className="w-full py-2.5 rounded-xl bg-orange-500/20 text-orange-400 text-sm font-bold border border-orange-500/30 hover:bg-orange-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSlSaving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400"></div>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">link</span>
                    )}
                    Connect SmartLead
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-xs">SL</div>
                      <div>
                        <p className="text-sm font-medium text-white">SmartLead.ai</p>
                        <p className="text-xs text-gray-400">
                          {slSettings.campaign_id ? 'Connected & campaign set' : 'Connected — select a campaign'}
                          {slSettings.hasGlobalKey && !slSettings.hasApiKey && ' (using shared key)'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleSlDisconnect}
                      className="px-3 py-1.5 rounded-lg bg-red-900/20 text-red-400 text-xs font-bold border border-red-800/30 hover:bg-red-900/30"
                    >
                      Disconnect
                    </button>
                  </div>

                  {/* Optional: override with own API key */}
                  {slSettings.hasGlobalKey && !slSettings.hasApiKey && (
                    <details className="text-xs text-gray-500">
                      <summary className="cursor-pointer hover:text-gray-300 transition-colors">Use your own API key instead</summary>
                      <div className="mt-2 flex gap-2">
                        <input
                          type="password"
                          value={slApiKey}
                          onChange={(e) => setSlApiKey(e.target.value)}
                          placeholder="Your SmartLead API Key"
                          className="flex-1 bg-black/20 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-400 outline-none transition-colors"
                        />
                        <button
                          onClick={handleSlSaveSettings}
                          disabled={!slApiKey || isSlSaving}
                          className="px-3 py-2 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-bold border border-orange-500/30 hover:bg-orange-500/30 disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </details>
                  )}

                  {/* Campaign Selector */}
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Campaign</label>
                    <div className="flex gap-2">
                      <select
                        value={slSelectedCampaign}
                        onChange={(e) => setSlSelectedCampaign(e.target.value)}
                        className="flex-1 bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-orange-400 outline-none transition-colors"
                      >
                        <option value="">Select campaign...</option>
                        {slCampaigns.map((c) => (
                          <option key={c.id} value={String(c.id)}>{c.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleSlLoadCampaigns}
                        disabled={isSlLoadingCampaigns}
                        className="px-3 py-2.5 rounded-lg bg-white/5 border border-gray-700 text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                        title="Refresh campaigns"
                      >
                        <span className={`material-symbols-outlined text-[18px] ${isSlLoadingCampaigns ? 'animate-spin' : ''}`}>refresh</span>
                      </button>
                    </div>
                  </div>

                  {/* Save campaign selection */}
                  {slSelectedCampaign && slSelectedCampaign !== (slSettings.campaign_id || '') && (
                    <button
                      onClick={handleSlSaveSettings}
                      disabled={isSlSaving}
                      className="w-full py-2.5 rounded-xl bg-orange-500/20 text-orange-400 text-sm font-bold border border-orange-500/30 hover:bg-orange-500/30 transition-colors disabled:opacity-50"
                    >
                      {isSlSaving ? 'Saving...' : 'Save Campaign'}
                    </button>
                  )}

                  {/* Sync All Button */}
                  {slSettings.campaign_id && (
                    <button
                      onClick={handleSlSyncAll}
                      disabled={isSlSyncingAll}
                      className="w-full py-2.5 rounded-xl bg-orange-500 text-black text-sm font-bold hover:bg-orange-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSlSyncingAll ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                          Syncing all contacts...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                          Sync All to SmartLead
                        </>
                      )}
                    </button>
                  )}

                  {/* Sync Result */}
                  {slSyncResult && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs">
                      <p className="text-green-400 font-bold">{slSyncResult.synced} contacts synced</p>
                      {slSyncResult.failed > 0 && (
                        <p className="text-red-400 mt-1">{slSyncResult.failed} failed</p>
                      )}
                      <p className="text-gray-500 mt-1">{slSyncResult.total} total processed</p>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-gray-500 mt-3 flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[14px] mt-0.5">info</span>
                Only contacts with an email address can be synced. Notes and social handles are included. {slSettings?.hasGlobalKey && 'A shared API key is pre-configured by your admin.'}
              </p>
            </div>
```

**Step 6: Commit**

```bash
git add frontend/src/screens/Profile.tsx frontend/src/services/api.ts
git commit -m "feat: add SmartLead settings card to user profile screen"
```

---

## Task 6: Frontend — "Sync to SmartLead" Button on Contact Detail View

**Files:**
- Modify: `frontend/src/screens/Profile.tsx`

This adds a "Sync to SmartLead" button in the contact detail view (when `selectedContact` is set), in the action buttons area.

**Step 1: Add sync state for individual contact**

Add to the existing state declarations in the component (near the SmartLead state from Task 5):

```typescript
  const [isSlSyncingContact, setIsSlSyncingContact] = useState(false)
  const [slContactSyncStatus, setSlContactSyncStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [slContactSyncError, setSlContactSyncError] = useState('')
```

**Step 2: Add handler for single-contact sync**

Add near the other handler functions:

```typescript
  const handleSlSyncContact = async () => {
    if (!selectedContact?.id) return
    setIsSlSyncingContact(true)
    setSlContactSyncStatus('idle')
    setSlContactSyncError('')

    const res = await smartleadApi.syncContact(selectedContact.id)
    if (res.data) {
      setSlContactSyncStatus('success')
      // Update local contact with sync info
      updateContact(selectedContact.id, {
        smartlead_lead_id: String(res.data.smartleadLeadId),
        smartlead_synced_at: res.data.syncedAt,
      } as any)
    } else {
      setSlContactSyncStatus('error')
      setSlContactSyncError(res.error || 'Sync failed')
    }
    setIsSlSyncingContact(false)
  }
```

**Step 3: Reset sync status when contact changes**

In the existing `useEffect` that runs when `selectedContact?.id` changes (around line 75), add inside the `if (selectedContact?.id)` block:

```typescript
      setSlContactSyncStatus('idle')
      setSlContactSyncError('')
```

**Step 4: Add the sync button JSX**

In the contact detail section, find the "Meeting Prep & Log" buttons grid (around line 1657, the `<div className="grid grid-cols-2 gap-3">` block). **After** that grid's closing `</div>` (around line 1673), insert:

```tsx
        {/* SmartLead Sync */}
        {slSettings?.keyAvailable && slSettings.campaign_id && (
          <div>
            <button
              onClick={handleSlSyncContact}
              disabled={isSlSyncingContact || !selectedContact.email}
              className={`w-full flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 ${
                selectedContact.smartlead_synced_at || slContactSyncStatus === 'success'
                  ? 'bg-green-600/20 border border-green-500/30 text-green-400'
                  : 'bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30'
              }`}
            >
              {isSlSyncingContact ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400"></div>
                  Syncing...
                </>
              ) : selectedContact.smartlead_synced_at || slContactSyncStatus === 'success' ? (
                <>
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  Synced to SmartLead
                </>
              ) : !selectedContact.email ? (
                <>
                  <span className="material-symbols-outlined text-[20px]">warning</span>
                  No email — can't sync
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
                  Sync to SmartLead
                </>
              )}
            </button>
            {slContactSyncStatus === 'error' && (
              <p className="text-xs text-red-400 mt-1 text-center">{slContactSyncError}</p>
            )}
            {(selectedContact.smartlead_synced_at || slContactSyncStatus === 'success') && (
              <button
                onClick={handleSlSyncContact}
                disabled={isSlSyncingContact}
                className="w-full text-xs text-gray-500 hover:text-orange-400 mt-1 transition-colors"
              >
                Re-sync
              </button>
            )}
          </div>
        )}
```

**Step 5: Commit**

```bash
git add frontend/src/screens/Profile.tsx
git commit -m "feat: add Sync to SmartLead button on contact detail view"
```

---

## Task 7: Verify and Test End-to-End

**Step 1: Start the backend**

```bash
cd backend && npm run dev
```

Expected: Server starts on port 7000, no errors

**Step 2: Start the frontend**

```bash
cd frontend && npm run dev
```

Expected: Vite dev server starts on port 5173, no errors

**Step 3: Manual test checklist**

1. Navigate to Profile (user profile view, no contact selected)
2. Find the "SmartLead CRM" settings card
3. Enter a SmartLead API key and click "Connect SmartLead"
4. Click refresh to load campaigns and select one
5. Click "Save Campaign"
6. Click "Sync All to SmartLead" — verify it shows results (synced/failed counts)
7. Go to a contact detail (tap a contact from Dashboard)
8. Verify "Sync to SmartLead" button appears
9. For a contact with email: click "Sync to SmartLead" — verify it shows "Synced to SmartLead"
10. For a contact without email: verify button shows "No email — can't sync" and is disabled

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address any issues found during testing"
```

---

## Summary of SmartLead Files Changed

| File | Action |
|------|--------|
| `backend/migrations/006_smartlead.sql` | Create |
| `backend/src/db/schema.ts` | Modify (add table + columns) |
| `backend/src/services/smartlead.ts` | Create |
| `backend/src/routes/smartlead.ts` | Create |
| `backend/src/index.ts` | Modify (mount route) |
| `frontend/src/services/api.ts` | Modify (add Contact fields + smartleadApi) |
| `frontend/src/screens/Profile.tsx` | Modify (settings card + sync button) |

---
---

# Google Calendar Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sync Warmly reminders and meeting follow-up action items to users' personal Google Calendar. Users get a global auto-sync toggle plus per-reminder control to add/skip individual calendar events.

**Architecture:** Extend the existing Google OAuth flow to request calendar scopes and store refresh tokens. A new `google_calendar` service uses the refresh token to create/update/delete events via Google Calendar API v3. The `notifications` table tracks the linked `google_event_id`. When meeting follow-ups generate action items with due dates, those also create calendar events. Users toggle auto-sync on/off in Profile settings, and each reminder has an individual "Add to Calendar" button.

**Tech Stack:** Google Calendar API v3 (REST), Google OAuth2 (extended scopes), Hono (backend), React + Tailwind (frontend)

**API Key Model:** Uses the user's own Google account via OAuth — no shared key needed.

---

## Task 8: Database Migration — Google Calendar Tokens + Event Tracking

**Files:**
- Create: `backend/migrations/007_google_calendar.sql`
- Modify: `backend/src/db/schema.ts` (add new tables + columns)

**Step 1: Create the migration file**

Create `backend/migrations/007_google_calendar.sql`:

```sql
-- Store Google OAuth refresh tokens for Calendar access
-- Separate from auth because Calendar requires additional scopes
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  scopes TEXT NOT NULL,
  auto_sync BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_gcal_tokens_user ON google_calendar_tokens(user_id);

-- Track which notifications have been synced to Google Calendar
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS google_calendar_sync BOOLEAN DEFAULT true;
```

**Step 2: Add schema definitions to Drizzle**

In `backend/src/db/schema.ts`, add at the end:

```typescript
// ============ GOOGLE CALENDAR TOKENS ============
export const googleCalendarTokens = pgTable(
  'google_calendar_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    tokenExpiry: timestamp('token_expiry', { withTimezone: true }).notNull(),
    scopes: text('scopes').notNull(),
    autoSync: boolean('auto_sync').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdx: uniqueIndex('unique_gcal_user').on(table.userId),
  })
)
```

Also add to the existing `notifications` table definition (after `completedAt`, before `createdAt`):

```typescript
googleEventId: text('google_event_id'),
googleCalendarSync: boolean('google_calendar_sync').default(true),
```

**Step 3: Run the migration**

```bash
cd backend && psql "postgresql://warmly_app:WarmlyApp2026@127.0.0.1:5432/warmly" -f migrations/007_google_calendar.sql
```

Expected: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE` x2

**Step 4: Commit**

```bash
git add backend/migrations/007_google_calendar.sql backend/src/db/schema.ts
git commit -m "feat: add google calendar tokens table and notification sync columns"
```

---

## Task 9: Google Calendar OAuth Flow (Separate from Login)

**Files:**
- Create: `backend/src/routes/googleCalendar.ts`
- Modify: `backend/src/index.ts` (mount new route)

Google Calendar requires the `https://www.googleapis.com/auth/calendar.events` scope. This is **separate** from the login OAuth flow (which only requests `openid email profile`). We don't want to ask for calendar permission at login — only when the user explicitly connects Google Calendar.

**Step 1: Create the Google Calendar routes**

Create `backend/src/routes/googleCalendar.ts`:

```typescript
import { Hono } from 'hono'
import { sql, generateId } from '../db/postgres.js'
import { authMiddleware } from '../middleware/auth.js'

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

// Initiate Google Calendar OAuth (user must be logged in)
// Frontend opens this URL in a popup or redirect
googleCalendar.get('/connect', authMiddleware, async (c) => {
  const userId = c.get('user').userId

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return c.json({ error: 'Google OAuth not configured' }, 503)
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALENDAR_CALLBACK_URL,
    response_type: 'code',
    scope: CALENDAR_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state: userId, // Pass userId through OAuth state
  })

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

// OAuth callback — exchange code for tokens and store
googleCalendar.get('/callback', async (c) => {
  const code = c.req.query('code')
  const error = c.req.query('error')
  const userId = c.req.query('state') // userId passed via state param

  if (error || !code || !userId) {
    return c.redirect(`${FRONTEND_URL}/profile?gcal_error=${error || 'missing_code'}`)
  }

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
      // This can happen if user already granted access before
      // Try to update existing record with new access token
      const [existing] = await sql`
        SELECT id FROM google_calendar_tokens WHERE user_id = ${userId}
      `
      if (existing) {
        const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        await sql`
          UPDATE google_calendar_tokens
          SET access_token = ${tokens.access_token},
              token_expiry = ${expiry},
              updated_at = NOW()
          WHERE user_id = ${userId}
        `
        return c.redirect(`${FRONTEND_URL}/profile?gcal_connected=true`)
      }
      throw new Error('No refresh token received. Please revoke app access at https://myaccount.google.com/permissions and try again.')
    }

    const now = new Date().toISOString()
    const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Upsert token record
    const [existing] = await sql`
      SELECT id FROM google_calendar_tokens WHERE user_id = ${userId}
    `

    if (existing) {
      await sql`
        UPDATE google_calendar_tokens
        SET access_token = ${tokens.access_token},
            refresh_token = ${tokens.refresh_token},
            token_expiry = ${expiry},
            scopes = ${tokens.scope},
            updated_at = ${now}
        WHERE user_id = ${userId}
      `
    } else {
      const id = generateId()
      await sql`
        INSERT INTO google_calendar_tokens (id, user_id, access_token, refresh_token, token_expiry, scopes, auto_sync, created_at, updated_at)
        VALUES (${id}, ${userId}, ${tokens.access_token}, ${tokens.refresh_token}, ${expiry}, ${tokens.scope}, true, ${now}, ${now})
      `
    }

    return c.redirect(`${FRONTEND_URL}/profile?gcal_connected=true`)
  } catch (err: any) {
    console.error('Google Calendar OAuth error:', err)
    return c.redirect(`${FRONTEND_URL}/profile?gcal_error=auth_failed`)
  }
})

// ---- Settings & Status ----

googleCalendar.use('/status', authMiddleware)
googleCalendar.use('/settings', authMiddleware)
googleCalendar.use('/disconnect', authMiddleware)
googleCalendar.use('/sync/*', authMiddleware)

// Get connection status
googleCalendar.get('/status', async (c) => {
  const userId = c.get('user').userId
  const [token] = await sql`
    SELECT id, auto_sync, scopes, created_at FROM google_calendar_tokens WHERE user_id = ${userId}
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
  if (token) {
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

export default googleCalendar
```

**Step 2: Mount the route in index.ts**

In `backend/src/index.ts`, after the smartlead import, add:

```typescript
import googleCalendar from './routes/googleCalendar.js'
```

After `app.route('/api/smartlead', smartlead)`, add:

```typescript
app.route('/api/google-calendar', googleCalendar)
```

**Step 3: Commit**

```bash
git add backend/src/routes/googleCalendar.ts backend/src/index.ts
git commit -m "feat: add Google Calendar OAuth connect/disconnect flow"
```

---

## Task 10: Google Calendar API Service — Create/Update/Delete Events

**Files:**
- Create: `backend/src/services/googleCalendar.ts`

**Step 1: Create the Google Calendar service**

Create `backend/src/services/googleCalendar.ts`:

```typescript
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

// Refresh the access token if expired
async function getValidAccessToken(userId: string): Promise<string | null> {
  const [token] = await sql`
    SELECT access_token, refresh_token, token_expiry
    FROM google_calendar_tokens WHERE user_id = ${userId}
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
      console.error('Failed to refresh Google token:', await response.text())
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

// Check if user has Google Calendar connected and auto-sync enabled
export async function isCalendarConnected(userId: string): Promise<boolean> {
  const [token] = await sql`
    SELECT id FROM google_calendar_tokens WHERE user_id = ${userId}
  `
  return !!token
}

export async function isAutoSyncEnabled(userId: string): Promise<boolean> {
  const [token] = await sql`
    SELECT auto_sync FROM google_calendar_tokens WHERE user_id = ${userId}
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
```

**Step 2: Commit**

```bash
git add backend/src/services/googleCalendar.ts
git commit -m "feat: add Google Calendar API service with token refresh and event CRUD"
```

---

## Task 11: Integrate Calendar Sync into Notifications & Meeting Follow-Up Routes

**Files:**
- Modify: `backend/src/routes/notifications.ts` (auto-create events on reminder creation)
- Modify: `backend/src/routes/ai.ts` (auto-create events for meeting follow-up action items)
- Modify: `backend/src/routes/googleCalendar.ts` (add manual sync endpoint)

**Step 1: Add calendar sync to notification creation**

In `backend/src/routes/notifications.ts`, add import at the top:

```typescript
import {
  isAutoSyncEnabled,
  createCalendarEvent,
  buildReminderEvent,
  deleteCalendarEvent,
} from '../services/googleCalendar.js'
```

In the `POST /` handler (create notification), **after** the notification is inserted and retrieved, add:

```typescript
    // Auto-sync to Google Calendar if enabled
    if (notification.google_calendar_sync !== false) {
      const autoSync = await isAutoSyncEnabled(userId)
      if (autoSync) {
        // Get contact name for event title
        let contactName: string | null = null
        if (body.contactId) {
          const [contact] = await sql`SELECT name FROM contacts WHERE id = ${body.contactId}`
          contactName = contact?.name || null
        }

        const event = buildReminderEvent({
          note: notification.note,
          remindAt: notification.remind_at,
          contactName,
        })
        const eventId = await createCalendarEvent(userId, event)
        if (eventId) {
          await sql`UPDATE notifications SET google_event_id = ${eventId} WHERE id = ${notification.id}`
          notification.google_event_id = eventId
        }
      }
    }
```

In the `DELETE /:id` handler, **before** deleting the notification, add:

```typescript
    // Delete from Google Calendar if synced
    if (existing.google_event_id) {
      await deleteCalendarEvent(userId, existing.google_event_id)
    }
```

In the `PATCH /:id` handler, when marking as done (`status = 'done'`), **optionally** delete the calendar event:

```typescript
    // If marking as done, remove from Google Calendar
    if (body.status === 'done' && existing.google_event_id) {
      await deleteCalendarEvent(userId, existing.google_event_id)
    }
```

**Step 2: Add calendar sync to meeting follow-up**

In `backend/src/routes/ai.ts`, add import at the top:

```typescript
import {
  isAutoSyncEnabled,
  createCalendarEvent,
  buildReminderEvent,
  buildActionItemEvent,
} from '../services/googleCalendar.js'
```

In the meeting follow-up handler (`POST /meeting/follow-up/:contactId`), after the reminder notification is created, add:

```typescript
      // Sync reminder to Google Calendar if auto-sync enabled
      const autoSync = await isAutoSyncEnabled(userId)
      if (autoSync && createdReminder) {
        const event = buildReminderEvent({
          note: createdReminder.note,
          remindAt: createdReminder.remind_at,
          contactName: contact.name,
        })
        const eventId = await createCalendarEvent(userId, event)
        if (eventId) {
          await sql`UPDATE notifications SET google_event_id = ${eventId} WHERE id = ${createdReminder.id}`
        }
      }

      // Also sync action items with due dates to Google Calendar
      if (autoSync && result.actionItems?.length > 0) {
        for (const item of result.actionItems) {
          if (item.dueDate) {
            const event = buildActionItemEvent({
              task: item.task,
              dueDate: item.dueDate,
              contactName: contact.name,
            })
            await createCalendarEvent(userId, event)
          }
        }
      }
```

**Step 3: Add manual sync endpoint for individual notifications**

In `backend/src/routes/googleCalendar.ts`, add before the `export default`:

```typescript
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
```

Add the service imports at the top of `googleCalendar.ts`:

```typescript
import {
  createCalendarEvent,
  deleteCalendarEvent,
  buildReminderEvent,
} from '../services/googleCalendar.js'
```

**Step 4: Commit**

```bash
git add backend/src/routes/notifications.ts backend/src/routes/ai.ts backend/src/routes/googleCalendar.ts
git commit -m "feat: integrate Google Calendar sync into notifications and meeting follow-ups"
```

---

## Task 12: Frontend API Layer — Google Calendar

**Files:**
- Modify: `frontend/src/services/api.ts`

**Step 1: Update the Notification interface**

In the `Notification` interface in `frontend/src/services/api.ts`, add:

```typescript
  googleEventId: string | null
  googleCalendarSync: boolean
```

**Step 2: Add the Google Calendar API methods**

At the end of `frontend/src/services/api.ts`, add:

```typescript
// Google Calendar API
export const googleCalendarApi = {
  getConnectUrl() {
    // Returns the URL to redirect/open for Google Calendar OAuth
    return `${API_BASE}/google-calendar/connect`
  },

  async getStatus() {
    return apiFetch<{ connected: boolean; autoSync: boolean; connectedAt: string | null }>('/google-calendar/status')
  },

  async updateSettings(data: { autoSync: boolean }) {
    return apiFetch<{ autoSync: boolean }>('/google-calendar/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async disconnect() {
    return apiFetch('/google-calendar/disconnect', { method: 'POST' })
  },

  async syncNotification(notificationId: string) {
    return apiFetch<{ googleEventId: string }>(`/google-calendar/sync/notification/${notificationId}`, {
      method: 'POST',
    })
  },

  async unsyncNotification(notificationId: string) {
    return apiFetch(`/google-calendar/sync/notification/${notificationId}`, {
      method: 'DELETE',
    })
  },
}
```

**Step 3: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: add Google Calendar API client methods to frontend"
```

---

## Task 13: Frontend — Google Calendar Settings Card on Profile Screen

**Files:**
- Modify: `frontend/src/screens/Profile.tsx`

Add a "Google Calendar" settings card in the user profile section, after the SmartLead CRM card and before the Account Actions card.

**Step 1: Add state variables**

In the Profile component, add:

```typescript
  // Google Calendar state
  const [gcalStatus, setGcalStatus] = useState<{ connected: boolean; autoSync: boolean } | null>(null)
  const [isGcalDisconnecting, setIsGcalDisconnecting] = useState(false)
```

**Step 2: Add import**

Add `googleCalendarApi` to the import from `'../services/api'`.

**Step 3: Fetch Google Calendar status**

In the useEffect that runs when `!selectedContact` (same place where SmartLead settings are fetched), add:

```typescript
      // Fetch Google Calendar status
      googleCalendarApi.getStatus().then((res) => {
        if (res.data) setGcalStatus(res.data)
      })
```

Also check URL params for gcal_connected on mount (after the OAuth redirect):

```typescript
  // Check for Google Calendar OAuth redirect result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gcal_connected') === 'true') {
      setGcalStatus({ connected: true, autoSync: true })
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('gcal_error')) {
      console.error('Google Calendar connect error:', params.get('gcal_error'))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])
```

**Step 4: Add handler functions**

```typescript
  const handleGcalConnect = () => {
    // Redirect to Google Calendar OAuth flow
    // Need to pass the auth token so the backend knows who the user is
    const connectUrl = googleCalendarApi.getConnectUrl()
    // Open in same window — will redirect back after OAuth
    window.location.href = connectUrl
  }

  const handleGcalDisconnect = async () => {
    setIsGcalDisconnecting(true)
    await googleCalendarApi.disconnect()
    setGcalStatus({ connected: false, autoSync: false })
    setIsGcalDisconnecting(false)
  }

  const handleGcalAutoSyncToggle = async () => {
    if (!gcalStatus) return
    const newVal = !gcalStatus.autoSync
    const res = await googleCalendarApi.updateSettings({ autoSync: newVal })
    if (res.data) setGcalStatus({ ...gcalStatus, autoSync: res.data.autoSync })
  }
```

**Step 5: Add the Google Calendar settings card JSX**

Insert after the SmartLead CRM card and before the Account Actions card:

```tsx
            {/* Google Calendar Integration */}
            <div className="bg-surface-card p-5 rounded-2xl shadow-sm border border-white/5">
              <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400 text-[16px]">calendar_month</span>
                Google Calendar
              </h3>

              {!gcalStatus?.connected ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400">
                    Connect Google Calendar to automatically sync reminders and meeting follow-ups as calendar events.
                  </p>
                  <button
                    onClick={handleGcalConnect}
                    className="w-full py-2.5 rounded-xl bg-blue-500/20 text-blue-400 text-sm font-bold border border-blue-500/30 hover:bg-blue-500/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">link</span>
                    Connect Google Calendar
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-blue-400 text-[20px]">calendar_month</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Google Calendar</p>
                        <p className="text-xs text-green-400">Connected</p>
                      </div>
                    </div>
                    <button
                      onClick={handleGcalDisconnect}
                      disabled={isGcalDisconnecting}
                      className="px-3 py-1.5 rounded-lg bg-red-900/20 text-red-400 text-xs font-bold border border-red-800/30 hover:bg-red-900/30 disabled:opacity-50"
                    >
                      {isGcalDisconnecting ? '...' : 'Disconnect'}
                    </button>
                  </div>

                  {/* Auto-sync toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div>
                      <p className="text-sm font-medium text-white">Auto-sync reminders</p>
                      <p className="text-xs text-gray-400">New reminders & follow-ups sync automatically</p>
                    </div>
                    <button
                      onClick={handleGcalAutoSyncToggle}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        gcalStatus.autoSync ? 'bg-blue-500' : 'bg-gray-600'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          gcalStatus.autoSync ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500 mt-3 flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[14px] mt-0.5">info</span>
                {gcalStatus?.connected
                  ? 'Individual reminders can also be added/removed from calendar in the notification panel.'
                  : 'Reminders and meeting follow-up action items will appear as events in your primary Google Calendar.'}
              </p>
            </div>
```

**Step 6: Commit**

```bash
git add frontend/src/screens/Profile.tsx
git commit -m "feat: add Google Calendar settings card to user profile"
```

---

## Task 14: Frontend — Per-Notification Calendar Sync Button

**Files:**
- Modify: `frontend/src/components/NotificationItem.tsx`

Add a small calendar icon button on each notification item that lets users manually add/remove individual reminders from Google Calendar.

**Step 1: Read and update NotificationItem component**

Add a `onSyncCalendar` and `onUnsyncCalendar` prop to the component, and render a calendar sync icon:

In `NotificationItem.tsx`, update the component props to include:

```typescript
interface NotificationItemProps {
  notification: Notification
  onMarkDone: (id: string) => void
  onDelete: (id: string) => void
  onContactClick?: (contactId: string) => void
  onSyncCalendar?: (id: string) => Promise<void>
  onUnsyncCalendar?: (id: string) => Promise<void>
  calendarConnected?: boolean
}
```

Add a calendar button in the action buttons area of each notification item:

```tsx
{calendarConnected && (
  <button
    onClick={async (e) => {
      e.stopPropagation()
      if (notification.googleEventId) {
        await onUnsyncCalendar?.(notification.id)
      } else {
        await onSyncCalendar?.(notification.id)
      }
    }}
    className={`p-1.5 rounded-lg transition-colors ${
      notification.googleEventId
        ? 'text-blue-400 hover:bg-blue-500/20'
        : 'text-gray-500 hover:bg-white/10 hover:text-blue-400'
    }`}
    title={notification.googleEventId ? 'Remove from Google Calendar' : 'Add to Google Calendar'}
  >
    <span className="material-symbols-outlined text-[16px]">
      {notification.googleEventId ? 'event_available' : 'calendar_add_on'}
    </span>
  </button>
)}
```

**Step 2: Update NotificationPanel to pass calendar props**

In `NotificationPanel.tsx`, import `googleCalendarApi` and add state + handlers:

```typescript
import { googleCalendarApi } from '../services/api'

// Inside the component:
const [calendarConnected, setCalendarConnected] = useState(false)

useEffect(() => {
  googleCalendarApi.getStatus().then((res) => {
    if (res.data) setCalendarConnected(res.data.connected)
  })
}, [])

const handleSyncCalendar = async (notificationId: string) => {
  const res = await googleCalendarApi.syncNotification(notificationId)
  if (res.data) fetchNotifications() // Refresh to show updated state
}

const handleUnsyncCalendar = async (notificationId: string) => {
  await googleCalendarApi.unsyncNotification(notificationId)
  fetchNotifications()
}
```

Pass these to each `<NotificationItem>`:

```tsx
<NotificationItem
  key={notification.id}
  notification={notification}
  onMarkDone={markDone}
  onDelete={deleteNotification}
  onContactClick={handleContactClick}
  calendarConnected={calendarConnected}
  onSyncCalendar={handleSyncCalendar}
  onUnsyncCalendar={handleUnsyncCalendar}
/>
```

**Step 3: Commit**

```bash
git add frontend/src/components/NotificationItem.tsx frontend/src/components/NotificationPanel.tsx
git commit -m "feat: add per-notification Google Calendar sync/unsync buttons"
```

---

## Task 15: Handle Auth — Connect Route Needs User Identity

**Files:**
- Modify: `backend/src/routes/googleCalendar.ts`

The `/connect` endpoint redirects to Google OAuth. The callback needs to know which user initiated the flow. Currently we pass `userId` via the `state` param. But the `/connect` endpoint uses `authMiddleware` which requires a JWT — this works for API calls but not for browser redirects.

**Step 1: Use a temporary token approach**

Modify the `/connect` handler to generate a short-lived token stored in the DB, and pass it via `state`:

```typescript
// In the connect handler, replace the state param approach:
googleCalendar.get('/connect', authMiddleware, async (c) => {
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
    ON CONFLICT (user_id) DO UPDATE SET id = ${stateToken}, access_token = 'pending', token_expiry = ${expiry}, updated_at = NOW()
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

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})
```

Update the callback to look up the user from the state token:

```typescript
// In the callback handler, replace the userId lookup:
  const stateToken = c.req.query('state')

  // Look up user from state token
  const [pending] = await sql`
    SELECT user_id FROM google_calendar_tokens WHERE id = ${stateToken} AND access_token = 'pending'
  `
  if (!pending) {
    return c.redirect(`${FRONTEND_URL}/profile?gcal_error=invalid_state`)
  }
  const userId = pending.user_id
```

**Note:** This is already partially handled in the Task 9 code. The key thing is the connect endpoint needs the JWT token. The frontend should call this endpoint through a redirect that includes the auth token. A simpler approach: make the frontend call an API endpoint that returns the OAuth URL, then redirect:

Actually, the simplest approach: change `/connect` to return the URL instead of redirecting, so the frontend can add auth headers:

```typescript
googleCalendar.get('/connect-url', authMiddleware, async (c) => {
  const userId = c.get('user').userId
  // ... generate state token and OAuth URL ...
  return c.json({ data: { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` } })
})
```

Then the frontend calls this API, gets the URL, and does `window.location.href = url`.

**Step 2: Update frontend connect handler**

```typescript
  const handleGcalConnect = async () => {
    const res = await googleCalendarApi.getConnectUrl()
    if (res.data?.url) {
      window.location.href = res.data.url
    }
  }
```

Update the frontend API:

```typescript
  async getConnectUrl() {
    return apiFetch<{ url: string }>('/google-calendar/connect-url')
  },
```

**Step 3: Commit**

```bash
git add backend/src/routes/googleCalendar.ts frontend/src/services/api.ts frontend/src/screens/Profile.tsx
git commit -m "feat: fix Google Calendar connect flow with auth-aware URL generation"
```

---

## Task 16: Verify and Test End-to-End (Google Calendar)

**Step 1: Prerequisites**

Ensure these env vars are set on the backend:
- `GOOGLE_CLIENT_ID` (already used for login)
- `GOOGLE_CLIENT_SECRET` (already used for login)
- `GOOGLE_CALENDAR_CALLBACK_URL` (new — e.g. `https://mywarmly.app/api/google-calendar/callback`)

Add the callback URL to your Google Cloud Console OAuth redirect URIs.

**Step 2: Start backend & frontend**

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

**Step 3: Manual test checklist**

1. Navigate to Profile (user profile view)
2. Find the "Google Calendar" settings card
3. Click "Connect Google Calendar" — verify redirect to Google consent screen
4. Authorize calendar access — verify redirect back with "Connected" status
5. Toggle "Auto-sync reminders" on/off — verify setting persists
6. Create a new reminder — verify it appears in Google Calendar (if auto-sync on)
7. Open notification panel — verify calendar icon on each reminder
8. Click calendar icon on a non-synced reminder — verify event created in Google Calendar
9. Click calendar icon on a synced reminder — verify event removed from Google Calendar
10. Use "Prep Meeting" → "Log Meeting" with follow-up — verify action items appear in Google Calendar
11. Click "Disconnect" — verify Google Calendar events are cleaned up

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address any issues found during Google Calendar testing"
```

---

## Summary of All Google Calendar Files Changed

| File | Action |
|------|--------|
| `backend/migrations/007_google_calendar.sql` | Create |
| `backend/src/db/schema.ts` | Modify (add google_calendar_tokens table + notification columns) |
| `backend/src/services/googleCalendar.ts` | Create |
| `backend/src/routes/googleCalendar.ts` | Create |
| `backend/src/routes/notifications.ts` | Modify (auto-sync on create/delete/done) |
| `backend/src/routes/ai.ts` | Modify (sync follow-up action items) |
| `backend/src/index.ts` | Modify (mount route) |
| `frontend/src/services/api.ts` | Modify (add Notification fields + googleCalendarApi) |
| `frontend/src/screens/Profile.tsx` | Modify (settings card) |
| `frontend/src/components/NotificationItem.tsx` | Modify (per-item sync button) |
| `frontend/src/components/NotificationPanel.tsx` | Modify (pass calendar props) |

---
---

# Combined Summary — All Files

## SmartLead Integration (Tasks 1–7)

| File | Action |
|------|--------|
| `backend/migrations/006_smartlead.sql` | Create |
| `backend/src/db/schema.ts` | Modify |
| `backend/src/services/smartlead.ts` | Create |
| `backend/src/routes/smartlead.ts` | Create |
| `backend/src/index.ts` | Modify |
| `frontend/src/services/api.ts` | Modify |
| `frontend/src/screens/Profile.tsx` | Modify |

## Google Calendar Integration (Tasks 8–16)

| File | Action |
|------|--------|
| `backend/migrations/007_google_calendar.sql` | Create |
| `backend/src/db/schema.ts` | Modify |
| `backend/src/services/googleCalendar.ts` | Create |
| `backend/src/routes/googleCalendar.ts` | Create |
| `backend/src/routes/notifications.ts` | Modify |
| `backend/src/routes/ai.ts` | Modify |
| `backend/src/index.ts` | Modify |
| `frontend/src/services/api.ts` | Modify |
| `frontend/src/screens/Profile.tsx` | Modify |
| `frontend/src/components/NotificationItem.tsx` | Modify |
| `frontend/src/components/NotificationPanel.tsx` | Modify |
