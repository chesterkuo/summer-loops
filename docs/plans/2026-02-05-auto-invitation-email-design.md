# Auto Invitation Email After Card Scan

## Overview

Automatically send an invitation email when a user scans a business card that includes an email address. The invitation invites the contact to join Warmly.

## Requirements

- **Trigger**: Automatically after saving contact with email (from card scan)
- **Tone**: Personal introduction mentioning the inviter by name
- **Links**: Web signup (mywarmly.app) as primary, iOS App Store link secondary
- **Deduplication**: One invitation per email address globally (across all users)

## Flow

```
User scans business card → Saves contact with email
                                    ↓
                        Backend creates contact
                                    ↓
                        Check: Has this email been invited before?
                           ↓                    ↓
                          Yes                   No
                           ↓                    ↓
                        Skip silently      Send invitation email
                                                ↓
                                    Record in invitations table
                                                ↓
                        Frontend shows toast: "Invitation sent to [name]"
```

## Database Schema

```sql
CREATE TABLE contact_invitations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  email TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_invitations_email ON contact_invitations(email);
```

## Email Template

**Subject**: `[User's Name] wants to stay connected on Warmly`

**Body**:
- Greeting with contact's name
- Personal message: "[User's Name] just added you to their professional network on Warmly"
- Primary CTA: "Join Warmly" button → https://mywarmly.app
- Secondary: "Download the iOS app" link → https://apps.apple.com/us/app/mywarmly/id6757930392
- Footer: Brief app description

## API Changes

`POST /contacts` response adds:
```json
{
  "contact": { ... },
  "invitationSent": true | false
}
```

## Frontend Changes

- Show toast notification when `invitationSent: true`
- Toast message: "Invitation sent to [name]"
- Auto-dismiss after 3 seconds

## Files to Modify

| Location | File | Changes |
|----------|------|---------|
| Backend | `src/db/schema.sql` | Add `contact_invitations` table |
| Backend | `src/utils/email.ts` | Add `sendContactInviteEmail()` function |
| Backend | `src/routes/contacts.ts` | Check dedup + send email on create |
| Frontend | `src/screens/ScanCard.tsx` | Show toast when `invitationSent: true` |
| Frontend | `src/i18n/locales/*.json` | Add translation for toast message |
