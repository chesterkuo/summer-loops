-- v1.2 Messaging Bot Integration: LINE + WhatsApp
-- DO NOT RUN against production until v1.1 App Store review is approved

CREATE TABLE IF NOT EXISTS messaging_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK(platform IN ('line', 'whatsapp')),
  platform_user_id TEXT NOT NULL,
  display_name TEXT,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(platform, platform_user_id)
);

CREATE INDEX IF NOT EXISTS idx_messaging_accounts_user ON messaging_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_messaging_accounts_platform ON messaging_accounts(platform, platform_user_id);

CREATE TABLE IF NOT EXISTS linking_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK(platform IN ('line', 'whatsapp')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linking_tokens_token ON linking_tokens(token, platform);
