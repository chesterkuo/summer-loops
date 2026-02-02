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
