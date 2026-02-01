-- v1.2 AI Features: Relationship Coach, Meeting Briefs, Smart Reminders
-- DO NOT RUN against production until v1.1 App Store review is approved

CREATE TABLE IF NOT EXISTS relationship_health_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  health_score INTEGER NOT NULL CHECK(health_score BETWEEN 0 AND 100),
  days_since_interaction INTEGER,
  avg_interaction_frequency_days REAL,
  suggested_action TEXT,
  suggested_message TEXT,
  priority TEXT CHECK(priority IN ('urgent','due','maintain','healthy')),
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_health_scores_user ON relationship_health_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_health_scores_priority ON relationship_health_scores(user_id, priority);

CREATE TABLE IF NOT EXISTS meeting_briefs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  brief_content JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_briefs_user_contact ON meeting_briefs(user_id, contact_id);

CREATE TABLE IF NOT EXISTS smart_reminder_suggestions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  suggestion_text TEXT NOT NULL,
  reason TEXT NOT NULL,
  suggested_date TIMESTAMPTZ NOT NULL,
  confidence REAL CHECK(confidence BETWEEN 0 AND 1),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smart_reminders_user ON smart_reminder_suggestions(user_id, status);
