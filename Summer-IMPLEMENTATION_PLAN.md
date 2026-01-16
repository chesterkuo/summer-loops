# Summer Loop - Implementation Plan

## Overview

**Product**: Summer Loop (RelationPath)
**Description**: LLM-driven intelligent networking management and warm introduction path discovery platform

**Tech Stack**:
| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + TypeScript |
| Backend | Bun + Hono (web framework) |
| Database | SQLite3 (bun:sqlite) |
| LLM | Google Gemini 2.5 Flash |
| Auth | Google OAuth 2.0 |
| Graph Viz | D3.js |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                       │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Contacts │ │  Graph   │ │   Path   │ │  Search  │           │
│  │  Module  │ │  Module  │ │  Finder  │ │  Module  │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       └────────────┴────────────┴────────────┘                  │
│                          │                                       │
│                    Zustand Store                                 │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │ REST API (JSON)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Bun + Hono)                          │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │   Auth   │ │ Contacts │ │   Path   │ │    AI    │           │
│  │   API    │ │   API    │ │  Search  │ │ Services │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       └────────────┴────────────┴────────────┘                  │
│                          │                                       │
│  ┌───────────────────────┴───────────────────────┐              │
│  │              SQLite3 Database                  │              │
│  │         (bun:sqlite - local file)              │              │
│  └───────────────────────────────────────────────┘              │
│                          │                                       │
│  ┌───────────────────────┴───────────────────────┐              │
│  │           Google Gemini 2.5 Flash API          │              │
│  │      (OCR, NL Parsing, Inference, Gen)         │              │
│  └───────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
summer-loop/
│
├── package.json              # Root package (Bun workspaces)
├── .env.example              # Environment variables template
├── .gitignore
├── README.md
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts          # Entry point (Hono app)
│   │   │
│   │   ├── db/
│   │   │   ├── index.ts      # Database connection
│   │   │   ├── schema.sql    # DDL statements
│   │   │   └── migrate.ts    # Migration runner
│   │   │
│   │   ├── routes/
│   │   │   ├── index.ts      # Route aggregator
│   │   │   ├── auth.ts       # Google OAuth endpoints
│   │   │   ├── contacts.ts   # Contact CRUD + OCR + NL parse
│   │   │   ├── relationships.ts
│   │   │   ├── paths.ts      # Path search + message gen
│   │   │   ├── search.ts     # Smart search
│   │   │   ├── interactions.ts
│   │   │   └── teams.ts      # Phase 3
│   │   │
│   │   ├── services/
│   │   │   ├── gemini.ts     # Gemini API wrapper
│   │   │   ├── ocr.ts        # Business card OCR
│   │   │   ├── nlParser.ts   # Natural language parsing
│   │   │   ├── pathFinder.ts # Dijkstra-based path search
│   │   │   ├── inference.ts  # Relationship inference
│   │   │   └── messageGen.ts # Introduction message generation
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.ts       # JWT verification
│   │   │   ├── cors.ts       # CORS configuration
│   │   │   └── error.ts      # Error handler
│   │   │
│   │   ├── types/
│   │   │   └── index.ts      # TypeScript types
│   │   │
│   │   └── utils/
│   │       ├── jwt.ts        # JWT helpers
│   │       └── uuid.ts       # UUID generation
│   │
│   └── data/                 # SQLite database files (gitignored)
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── index.html
│   │
│   └── src/
│       ├── main.tsx          # Entry point
│       ├── App.tsx           # Router + providers
│       ├── index.css         # Global styles
│       │
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Dashboard.tsx
│       │   ├── Contacts.tsx
│       │   ├── ContactDetail.tsx
│       │   ├── PathFinder.tsx
│       │   ├── Graph.tsx
│       │   ├── Search.tsx
│       │   └── Settings.tsx
│       │
│       ├── components/
│       │   ├── ui/           # Base UI components
│       │   ├── layout/       # Header, Sidebar, etc.
│       │   ├── contacts/     # Contact-related
│       │   ├── graph/        # D3.js visualization
│       │   ├── path/         # Path visualization
│       │   └── search/       # Search components
│       │
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useContacts.ts
│       │   ├── useRelationships.ts
│       │   └── usePathSearch.ts
│       │
│       ├── stores/
│       │   ├── authStore.ts  # Zustand auth state
│       │   ├── contactStore.ts
│       │   └── uiStore.ts
│       │
│       ├── services/
│       │   └── api.ts        # API client (fetch wrapper)
│       │
│       ├── types/
│       │   └── index.ts
│       │
│       └── utils/
│
└── shared/
    └── types/
        └── index.ts          # Shared TypeScript types
```

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│    users    │       │   relationships │       │   contacts  │
├─────────────┤       ├─────────────────┤       ├─────────────┤
│ id (PK)     │◄──────│ user_id (FK)    │       │ id (PK)     │
│ email       │       │ contact_a_id(FK)│──────►│ user_id(FK) │
│ name        │       │ contact_b_id(FK)│──────►│ name        │
│ avatar_url  │       │ type            │       │ company     │
│ google_id   │       │ strength (1-5)  │       │ title       │
│ created_at  │       │ how_met         │       │ email       │
│ updated_at  │       │ is_ai_inferred  │       │ phone       │
└─────────────┘       │ confidence      │       │ linkedin_url│
                      │ verified        │       │ notes       │
                      │ last_interaction│       │ ai_summary  │
                      └─────────────────┘       │ source      │
                                                │ created_at  │
                                                └─────────────┘
                                                       │
                      ┌─────────────────┐              │
                      │ career_history  │              │
                      ├─────────────────┤              │
                      │ id (PK)         │              │
                      │ contact_id (FK) │◄─────────────┤
                      │ company         │              │
                      │ title           │              │
                      │ start_date      │              │
                      │ end_date        │              │
                      └─────────────────┘              │
                                                       │
                      ┌─────────────────┐              │
                      │education_history│              │
                      ├─────────────────┤              │
                      │ id (PK)         │              │
                      │ contact_id (FK) │◄─────────────┤
                      │ school          │              │
                      │ degree          │              │
                      │ field           │              │
                      │ start_year      │              │
                      │ end_year        │              │
                      └─────────────────┘              │
                                                       │
                      ┌─────────────────┐              │
                      │  interactions   │              │
                      ├─────────────────┤              │
                      │ id (PK)         │              │
                      │ user_id (FK)    │              │
                      │ contact_id (FK) │◄─────────────┘
                      │ type            │
                      │ notes           │
                      │ occurred_at     │
                      └─────────────────┘

┌─────────────────────┐       ┌─────────────┐
│introduction_requests│       │    tags     │
├─────────────────────┤       ├─────────────┤
│ id (PK)             │       │ id (PK)     │
│ user_id (FK)        │       │ user_id(FK) │
│ target_contact_id   │       │ name        │
│ target_description  │       │ color       │
│ path_data (JSON)    │       └─────────────┘
│ generated_message   │              │
│ status              │       ┌──────┴──────┐
│ created_at          │       │contact_tags │
│ updated_at          │       ├─────────────┤
└─────────────────────┘       │contact_id   │
                              │tag_id       │
                              └─────────────┘
```

### SQL Schema

```sql
-- Users (Google OAuth)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  google_id TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Contacts
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  title TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  notes TEXT,
  ai_summary TEXT,
  source TEXT CHECK(source IN ('manual', 'card_scan', 'linkedin', 'natural_language', 'calendar')),
  source_metadata TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Relationships (Graph Edges)
CREATE TABLE relationships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_a_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  contact_b_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
  is_user_relationship INTEGER DEFAULT 0,
  relationship_type TEXT,
  strength INTEGER DEFAULT 3 CHECK(strength >= 1 AND strength <= 5),
  how_met TEXT,
  introduced_by_id TEXT REFERENCES contacts(id),
  is_ai_inferred INTEGER DEFAULT 0,
  confidence_score REAL,
  verified INTEGER DEFAULT 0,
  last_interaction_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, contact_a_id, contact_b_id)
);

-- Career History
CREATE TABLE career_history (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  title TEXT,
  start_date TEXT,
  end_date TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Education History
CREATE TABLE education_history (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  school TEXT NOT NULL,
  degree TEXT,
  field TEXT,
  start_year INTEGER,
  end_year INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Interactions
CREATE TABLE interactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('meeting', 'call', 'message', 'email', 'other')),
  notes TEXT,
  occurred_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Introduction Requests
CREATE TABLE introduction_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_contact_id TEXT REFERENCES contacts(id),
  target_description TEXT,
  path_data TEXT, -- JSON array
  generated_message TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'accepted', 'introduced', 'success', 'failed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tags
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  UNIQUE(user_id, name)
);

-- Contact Tags (Junction)
CREATE TABLE contact_tags (
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

-- Teams (Phase 3)
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member')),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE shared_contacts (
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  shared_by_id TEXT NOT NULL REFERENCES users(id),
  visibility TEXT DEFAULT 'basic' CHECK(visibility IN ('basic', 'full')),
  PRIMARY KEY (contact_id, team_id)
);

-- Indexes
CREATE INDEX idx_contacts_user ON contacts(user_id);
CREATE INDEX idx_contacts_company ON contacts(company);
CREATE INDEX idx_relationships_user ON relationships(user_id);
CREATE INDEX idx_relationships_a ON relationships(contact_a_id);
CREATE INDEX idx_relationships_b ON relationships(contact_b_id);
CREATE INDEX idx_interactions_contact ON interactions(contact_id);
CREATE INDEX idx_career_contact ON career_history(contact_id);
CREATE INDEX idx_education_contact ON education_history(contact_id);
CREATE INDEX idx_intro_requests_user ON introduction_requests(user_id);
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/auth/google` | Redirect to Google OAuth | No |
| GET | `/api/auth/google/callback` | OAuth callback handler | No |
| POST | `/api/auth/refresh` | Refresh JWT token | Yes |
| POST | `/api/auth/logout` | Logout (invalidate token) | Yes |
| GET | `/api/auth/me` | Get current user info | Yes |

### Contacts

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/contacts` | List contacts (paginated, filterable) | Yes |
| GET | `/api/contacts/:id` | Get contact detail | Yes |
| POST | `/api/contacts` | Create contact manually | Yes |
| PUT | `/api/contacts/:id` | Update contact | Yes |
| DELETE | `/api/contacts/:id` | Delete contact | Yes |
| POST | `/api/contacts/scan` | OCR scan business card (multipart/form-data) | Yes |
| POST | `/api/contacts/parse` | Parse natural language input | Yes |
| POST | `/api/contacts/import-linkedin` | Import from LinkedIn URL | Yes |
| POST | `/api/contacts/:id/career` | Add career history entry | Yes |
| POST | `/api/contacts/:id/education` | Add education history entry | Yes |

### Relationships

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/relationships` | List all relationships | Yes |
| GET | `/api/relationships/graph` | Get graph data for visualization | Yes |
| POST | `/api/relationships` | Create relationship | Yes |
| PUT | `/api/relationships/:id` | Update relationship (strength, type) | Yes |
| DELETE | `/api/relationships/:id` | Delete relationship | Yes |
| POST | `/api/relationships/:id/verify` | Verify AI-inferred relationship | Yes |

### Path Search

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/paths/search` | Search introduction paths to target | Yes |
| POST | `/api/paths/generate-message` | Generate introduction request message | Yes |
| GET | `/api/paths/requests` | List introduction requests | Yes |
| POST | `/api/paths/requests` | Save introduction request | Yes |
| PUT | `/api/paths/requests/:id` | Update request status | Yes |

### AI Services

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/ai/infer` | Run relationship inference | Yes |
| POST | `/api/ai/summary/:contactId` | Generate contact summary | Yes |
| POST | `/api/ai/suggest-interaction/:contactId` | Get interaction suggestions | Yes |

### Search

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/search` | Natural language search | Yes |
| GET | `/api/search/similar/:contactId` | Find similar contacts | Yes |

### Interactions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/interactions` | List interactions (filterable by contact) | Yes |
| POST | `/api/interactions` | Record new interaction | Yes |
| GET | `/api/interactions/reminders` | Get interaction reminders | Yes |

### Tags

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/tags` | List user's tags | Yes |
| POST | `/api/tags` | Create tag | Yes |
| PUT | `/api/tags/:id` | Update tag | Yes |
| DELETE | `/api/tags/:id` | Delete tag | Yes |
| POST | `/api/contacts/:id/tags` | Add tags to contact | Yes |
| DELETE | `/api/contacts/:id/tags/:tagId` | Remove tag from contact | Yes |

### Teams (Phase 3)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/teams` | List user's teams | Yes |
| POST | `/api/teams` | Create team | Yes |
| PUT | `/api/teams/:id` | Update team | Yes |
| DELETE | `/api/teams/:id` | Delete team | Yes |
| POST | `/api/teams/:id/members` | Add team member | Yes |
| DELETE | `/api/teams/:id/members/:userId` | Remove team member | Yes |
| POST | `/api/teams/:id/share` | Share contact with team | Yes |
| GET | `/api/teams/:id/contacts` | List team's shared contacts | Yes |

---

## Key Algorithms

### 1. Path Search (Modified Dijkstra)

**Purpose**: Find the best introduction paths from user to target contact.

**Principle**: Weakest link determines path strength (like water pressure in pipes).

```typescript
interface PathResult {
  path: Array<{
    contactId: string;
    name: string;
    company: string;
    title: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    strength: number;
    type: string;
  }>;
  pathStrength: number;  // min(all edge strengths)
  hops: number;
  estimatedSuccessRate: number;  // pathStrength * 0.15 + 0.10
}

function findPaths(
  userId: string,
  targetContactId: string,
  maxHops: number = 4,
  topK: number = 5
): PathResult[] {
  // 1. Build adjacency list from relationships
  // 2. BFS/Dijkstra from user node
  // 3. Track path strength as min(edges so far)
  // 4. Prune paths exceeding maxHops
  // 5. Return topK paths sorted by pathStrength desc
}
```

### 2. Relationship Inference

**Purpose**: Automatically discover hidden relationships between contacts.

**Rules**:
- Same company + overlapping dates → Former colleagues (confidence based on overlap)
- Same school + overlapping years → Classmates
- Same industry + same city → May know each other (lower confidence)

```typescript
interface InferenceResult {
  contactAId: string;
  contactBId: string;
  inferredType: 'former_colleague' | 'classmate' | 'industry_connection';
  confidence: number;  // 0.0 - 1.0
  reasoning: string;
}

async function inferRelationships(userId: string): Promise<InferenceResult[]> {
  // 1. Get all contacts with career/education history
  // 2. Compare pairwise for overlaps
  // 3. Use Gemini for ambiguous cases
  // 4. Return with confidence scores
}
```

### 3. Relationship Decay

**Purpose**: Automatically reduce relationship strength over time without interaction.

```typescript
function calculateDecay(
  currentStrength: number,
  daysSinceLastInteraction: number
): number {
  if (daysSinceLastInteraction < 30) return currentStrength;
  if (daysSinceLastInteraction < 60) return Math.max(1, currentStrength - 0.5);
  if (daysSinceLastInteraction < 90) return Math.max(1, currentStrength - 1);
  return Math.max(1, currentStrength - 1.5);
}
```

---

## Gemini API Integration

### Configuration

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
```

### Business Card OCR

```typescript
async function scanBusinessCard(imageBase64: string): Promise<ContactData> {
  const result = await model.generateContent([
    `Analyze this business card and extract information as JSON:
    {
      "name": "Full name",
      "name_romanized": "Romanized name if in CJK",
      "company": "Company name",
      "title": "Job title",
      "email": "Email address",
      "phone": "Phone number(s) as array",
      "address": "Address if present",
      "website": "Website if present",
      "social": { "linkedin": "...", "other": "..." }
    }
    Return only valid JSON, no markdown.`,
    { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
  ]);

  return JSON.parse(result.response.text());
}
```

### Natural Language Parsing

```typescript
async function parseNaturalLanguage(input: string): Promise<ContactData> {
  const result = await model.generateContent(`
    Parse this description into structured contact data:
    "${input}"

    Extract as JSON:
    {
      "name": "",
      "company": "",
      "title": "",
      "industry": "",
      "how_met": { "event": "", "date": "", "introducer": "" },
      "notes": "",
      "skills": []
    }
    Return only valid JSON.
  `);

  return JSON.parse(result.response.text());
}
```

### Introduction Message Generation

```typescript
async function generateIntroMessage(
  path: PathResult,
  context: { goal: string; tone: 'formal' | 'casual' | 'brief' }
): Promise<string> {
  const result = await model.generateContent(`
    Generate an introduction request message in Traditional Chinese.

    Path: ${path.path.map(p => p.name).join(' → ')}
    Relationship chain: ${path.edges.map(e => e.type).join(' → ')}
    My goal: ${context.goal}
    Tone: ${context.tone}

    The message should:
    - Address the first intermediary respectfully
    - Reference our relationship
    - Clearly state why I want the introduction
    - Be concise and respectful

    Return only the message text.
  `);

  return result.response.text();
}
```

---

## Implementation Phases

### Phase 1: Core MVP - Foundation

#### Frontend UI (COMPLETED)

| Step | Task | Status | Files |
|------|------|--------|-------|
| 1.1 | Project setup (monorepo, configs) | ✅ Done | `package.json`, `tsconfig.json`, etc. |
| 1.11 | Frontend setup (React + Vite) | ✅ Done | `frontend/src/*` |
| 1.13 | Dashboard page | ✅ Done | `frontend/src/screens/Dashboard.tsx` |
| 1.15 | Contact detail page (Profile) | ✅ Done | `frontend/src/screens/Profile.tsx` |
| 1.16 | Path finder page | ✅ Done | `frontend/src/screens/PathDiscovery.tsx` |
| 1.17 | Basic layout + navigation | ✅ Done | `frontend/src/components/BottomNav.tsx` |
| 1.18 | Business card scan UI | ✅ Done | `frontend/src/screens/ScanCard.tsx` |
| 1.19 | Network graph visualization | ✅ Done | `frontend/src/screens/NetworkMap.tsx` |
| 1.20 | Voice memo UI | ✅ Done | `frontend/src/screens/VoiceMemo.tsx` |
| 1.21 | Draft request UI | ✅ Done | `frontend/src/screens/DraftRequest.tsx` |

#### Backend API (PENDING)

| Step | Task | Status | Files |
|------|------|--------|-------|
| 1.2 | Backend setup (Bun + Hono) | ✅ Done | `backend/src/index.ts` |
| 1.3 | Database setup (SQLite3 + migrations) | ✅ Done | `backend/src/db/*` |
| 1.4 | Google OAuth authentication | ⏳ Pending | `backend/src/routes/auth.ts`, `middleware/auth.ts` |
| 1.5 | Contact CRUD | ⏳ Pending | `backend/src/routes/contacts.ts` |
| 1.6 | Business card OCR | ⏳ Pending | `backend/src/services/ocr.ts` |
| 1.7 | Natural language parsing | ⏳ Pending | `backend/src/services/nlParser.ts` |
| 1.8 | Relationship management | ⏳ Pending | `backend/src/routes/relationships.ts` |
| 1.9 | Path search algorithm | ⏳ Pending | `backend/src/services/pathFinder.ts` |
| 1.10 | Message generation | ⏳ Pending | `backend/src/services/messageGen.ts` |
| 1.22 | Frontend API integration | ⏳ Pending | `frontend/src/services/api.ts`, `frontend/src/hooks/*` |

### Phase 2: Enhanced Features

| Step | Task | Files |
|------|------|-------|
| 2.1 | Career/education history UI | Contact forms |
| 2.2 | AI relationship inference | `backend/src/services/inference.ts` |
| 2.3 | Inference verification UI | Relationships page |
| 2.4 | LinkedIn URL import | `backend/src/services/linkedin.ts` |
| 2.5 | Batch card scanning | Camera/upload component |
| 2.6 | D3.js relationship graph | `frontend/src/components/graph/*` |
| 2.7 | Natural language search | `backend/src/routes/search.ts` |
| 2.8 | Similar contacts recommendation | Search results |

### Phase 3: Relationship Nurturing & Teams

| Step | Task | Files |
|------|------|-------|
| 3.1 | Interaction logging | Interactions API + UI |
| 3.2 | Relationship decay calculation | Scheduled job |
| 3.3 | Reminders system | Notifications component |
| 3.4 | Reciprocity tracking | Database + UI |
| 3.5 | Introduction progress tracking | Request status workflow |
| 3.6 | Team creation | Teams API |
| 3.7 | Contact sharing | Sharing permissions |
| 3.8 | Cross-team path discovery | Enhanced path search |

---

## Environment Variables

```env
# Backend
PORT=3000
NODE_ENV=development

# Database
DATABASE_PATH=./data/summer-loop.db

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# JWT
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_EXPIRES_IN=7d

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Frontend (Vite)
VITE_API_URL=http://localhost:3000/api
VITE_GOOGLE_CLIENT_ID=your-client-id
```

---

## Dependencies

### Backend (`backend/package.json`)

```json
{
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/node-server": "^1.8.0",
    "jose": "^5.2.0",
    "@google/generative-ai": "^0.2.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.3.0"
  }
}
```

### Frontend (`frontend/package.json`)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "zustand": "^4.5.0",
    "d3": "^7.8.0",
    "@react-oauth/google": "^0.12.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/d3": "^7.4.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

---

## Testing Strategy

### Unit Tests
- Database queries and operations
- Path search algorithm correctness
- JWT token generation/verification
- Gemini response parsing

### Integration Tests
- Full API endpoint testing
- OAuth flow testing
- File upload handling

### E2E Tests (Optional)
- Complete user flows with Playwright

---

## Verification Checklist

After implementation, verify:

- [ ] Google OAuth login works
- [ ] Can create contact manually
- [ ] Can scan business card and extract data
- [ ] Can input contact via natural language
- [ ] Can set relationship strength (1-5 stars)
- [ ] Can link two contacts with relationship
- [ ] Path search returns valid paths
- [ ] Message generation produces appropriate text
- [ ] D3.js graph renders correctly
- [ ] Search returns relevant results
- [ ] Data persists after restart

---

## Notes for UI/UX

- User will provide UI/UX examples
- Will integrate custom styling after base functionality
- Tailwind CSS for utility-first styling
- Responsive design for desktop/tablet/mobile web

---

*Document Version: 1.0*
*Last Updated: 2025-01-15*
