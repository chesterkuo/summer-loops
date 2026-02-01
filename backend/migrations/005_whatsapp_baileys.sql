-- WhatsApp Baileys integration tables

-- Store Baileys auth credentials per user
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT,
  status TEXT DEFAULT 'disconnected' CHECK(status IN ('disconnected','connecting','connected','logged_out')),
  creds JSONB,
  connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Store Baileys Signal protocol keys (pre-keys, sender keys, etc.)
CREATE TABLE IF NOT EXISTS whatsapp_auth_keys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  key_type TEXT NOT NULL,
  key_id TEXT NOT NULL,
  key_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, key_type, key_id)
);

-- Track imported WhatsApp contacts
CREATE TABLE IF NOT EXISTS whatsapp_contact_imports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wa_jid TEXT NOT NULL,
  wa_name TEXT,
  phone_number TEXT,
  imported_to_contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','imported','skipped')),
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, wa_jid)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_user_id ON whatsapp_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_auth_keys_session_id ON whatsapp_auth_keys(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contact_imports_user_id ON whatsapp_contact_imports(user_id);
