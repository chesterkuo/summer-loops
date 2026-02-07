-- Store Google OAuth refresh tokens for Contacts access
-- Separate from calendar tokens because Contacts requires different scopes
CREATE TABLE IF NOT EXISTS google_contacts_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  scopes TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_gcontacts_tokens_user ON google_contacts_tokens(user_id);
