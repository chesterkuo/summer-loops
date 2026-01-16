import { Hono } from 'hono'
import { getDb, generateId } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

const teams = new Hono()

// Apply auth middleware to all routes
teams.use('*', authMiddleware)

interface Team {
  id: string
  name: string
  owner_id: string
  created_at: string
}

interface TeamMember {
  team_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
}

interface SharedContact {
  contact_id: string
  team_id: string
  shared_by_id: string
  visibility: 'basic' | 'full'
}

// List user's teams
teams.get('/', (c) => {
  const db = getDb()
  const userId = c.get('user').userId

  // Get teams where user is a member
  const rows = db.query(`
    SELECT t.*, tm.role,
           (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count,
           (SELECT COUNT(*) FROM shared_contacts WHERE team_id = t.id) as contact_count
    FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    WHERE tm.user_id = ?
    ORDER BY t.created_at DESC
  `).all(userId) as (Team & { role: string; member_count: number; contact_count: number })[]

  return c.json({ data: rows })
})

// Get single team
teams.get('/:id', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  // Verify user is a member
  const membership = db.query(
    'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
  ).get(id, userId) as { role: string } | null

  if (!membership) {
    return c.json({ error: 'Team not found or access denied' }, 404)
  }

  const team = db.query('SELECT * FROM teams WHERE id = ?').get(id) as Team | null

  if (!team) {
    return c.json({ error: 'Team not found' }, 404)
  }

  // Get members
  const members = db.query(`
    SELECT u.id, u.name, u.email, u.avatar_url, tm.role
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = ?
    ORDER BY tm.role ASC, u.name ASC
  `).all(id)

  return c.json({
    data: {
      ...team,
      members,
      currentUserRole: membership.role
    }
  })
})

// Create team
teams.post('/', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const body = await c.req.json<{ name: string }>()

  if (!body.name?.trim()) {
    return c.json({ error: 'Team name is required' }, 400)
  }

  const id = generateId()
  const now = new Date().toISOString()

  // Create team
  db.query(`
    INSERT INTO teams (id, name, owner_id, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id, body.name.trim(), userId, now)

  // Add owner as member
  db.query(`
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (?, ?, 'owner')
  `).run(id, userId)

  const team = db.query('SELECT * FROM teams WHERE id = ?').get(id) as Team

  return c.json({ data: team }, 201)
})

// Update team
teams.put('/:id', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<{ name?: string }>()

  // Verify user is owner or admin
  const membership = db.query(
    'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
  ).get(id, userId) as { role: string } | null

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return c.json({ error: 'Permission denied' }, 403)
  }

  if (body.name !== undefined) {
    db.query('UPDATE teams SET name = ? WHERE id = ?').run(body.name.trim(), id)
  }

  const team = db.query('SELECT * FROM teams WHERE id = ?').get(id) as Team

  return c.json({ data: team })
})

// Delete team
teams.delete('/:id', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  // Verify user is owner
  const team = db.query(
    'SELECT * FROM teams WHERE id = ? AND owner_id = ?'
  ).get(id, userId) as Team | null

  if (!team) {
    return c.json({ error: 'Team not found or not the owner' }, 403)
  }

  // Delete team (cascades to team_members and shared_contacts)
  db.query('DELETE FROM teams WHERE id = ?').run(id)

  return c.json({ message: 'Team deleted' })
})

// Add team member
teams.post('/:id/members', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<{ email: string; role?: 'admin' | 'member' }>()

  // Verify user is owner or admin
  const membership = db.query(
    'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
  ).get(id, userId) as { role: string } | null

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return c.json({ error: 'Permission denied' }, 403)
  }

  // Find user by email
  const targetUser = db.query(
    'SELECT id FROM users WHERE email = ?'
  ).get(body.email) as { id: string } | null

  if (!targetUser) {
    return c.json({ error: 'User not found with that email' }, 404)
  }

  // Check if already a member
  const existing = db.query(
    'SELECT * FROM team_members WHERE team_id = ? AND user_id = ?'
  ).get(id, targetUser.id)

  if (existing) {
    return c.json({ error: 'User is already a team member' }, 409)
  }

  // Add member
  const role = body.role || 'member'
  db.query(`
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (?, ?, ?)
  `).run(id, targetUser.id, role)

  return c.json({ message: 'Member added', userId: targetUser.id, role }, 201)
})

// Remove team member
teams.delete('/:id/members/:memberId', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id, memberId } = c.req.param()

  // Verify user is owner or admin
  const membership = db.query(
    'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
  ).get(id, userId) as { role: string } | null

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return c.json({ error: 'Permission denied' }, 403)
  }

  // Can't remove owner
  const targetMembership = db.query(
    'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
  ).get(id, memberId) as { role: string } | null

  if (!targetMembership) {
    return c.json({ error: 'Member not found' }, 404)
  }

  if (targetMembership.role === 'owner') {
    return c.json({ error: 'Cannot remove team owner' }, 403)
  }

  db.query('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(id, memberId)

  return c.json({ message: 'Member removed' })
})

// Share contact with team
teams.post('/:id/share', async (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<{ contactId: string; visibility?: 'basic' | 'full' }>()

  // Verify user is team member
  const membership = db.query(
    'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
  ).get(id, userId)

  if (!membership) {
    return c.json({ error: 'Not a team member' }, 403)
  }

  // Verify user owns the contact
  const contact = db.query(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?'
  ).get(body.contactId, userId)

  if (!contact) {
    return c.json({ error: 'Contact not found or not yours' }, 404)
  }

  // Check if already shared
  const existing = db.query(
    'SELECT * FROM shared_contacts WHERE contact_id = ? AND team_id = ?'
  ).get(body.contactId, id)

  if (existing) {
    // Update visibility
    db.query('UPDATE shared_contacts SET visibility = ? WHERE contact_id = ? AND team_id = ?')
      .run(body.visibility || 'basic', body.contactId, id)
    return c.json({ message: 'Contact sharing updated' })
  }

  // Share contact
  db.query(`
    INSERT INTO shared_contacts (contact_id, team_id, shared_by_id, visibility)
    VALUES (?, ?, ?, ?)
  `).run(body.contactId, id, userId, body.visibility || 'basic')

  return c.json({ message: 'Contact shared' }, 201)
})

// Unshare contact
teams.delete('/:id/share/:contactId', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id, contactId } = c.req.param()

  // Verify user shared the contact or is admin/owner
  const shared = db.query(
    'SELECT * FROM shared_contacts WHERE contact_id = ? AND team_id = ?'
  ).get(contactId, id) as SharedContact | null

  if (!shared) {
    return c.json({ error: 'Shared contact not found' }, 404)
  }

  const membership = db.query(
    'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
  ).get(id, userId) as { role: string } | null

  if (shared.shared_by_id !== userId && (!membership || !['owner', 'admin'].includes(membership.role))) {
    return c.json({ error: 'Permission denied' }, 403)
  }

  db.query('DELETE FROM shared_contacts WHERE contact_id = ? AND team_id = ?').run(contactId, id)

  return c.json({ message: 'Contact unshared' })
})

// Get team's shared contacts
teams.get('/:id/contacts', (c) => {
  const db = getDb()
  const userId = c.get('user').userId
  const { id } = c.req.param()

  // Verify user is team member
  const membership = db.query(
    'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
  ).get(id, userId)

  if (!membership) {
    return c.json({ error: 'Not a team member' }, 403)
  }

  const contacts = db.query(`
    SELECT
      c.id, c.name, c.company, c.title,
      CASE WHEN sc.visibility = 'full' THEN c.email ELSE NULL END as email,
      CASE WHEN sc.visibility = 'full' THEN c.phone ELSE NULL END as phone,
      sc.visibility,
      u.name as shared_by_name,
      sc.shared_by_id
    FROM shared_contacts sc
    JOIN contacts c ON c.id = sc.contact_id
    JOIN users u ON u.id = sc.shared_by_id
    WHERE sc.team_id = ?
    ORDER BY c.name ASC
  `).all(id)

  return c.json({ data: contacts })
})

export default teams
