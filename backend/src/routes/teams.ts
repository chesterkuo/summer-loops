import { Hono } from 'hono'
import { sql, generateId } from '../db/postgres.js'
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
teams.get('/', async (c) => {
  const userId = c.get('user').userId

  // Get teams where user is a member
  const rows = await sql<(Team & { role: string; member_count: string; contact_count: string })[]>`
    SELECT t.*, tm.role,
           (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count,
           (SELECT COUNT(*) FROM shared_contacts WHERE team_id = t.id) as contact_count
    FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    WHERE tm.user_id = ${userId}
    ORDER BY t.created_at DESC
  `

  return c.json({
    data: rows.map(r => ({
      ...r,
      member_count: Number(r.member_count),
      contact_count: Number(r.contact_count)
    }))
  })
})

// Get single team
teams.get('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  // Verify user is a member
  const [membership] = await sql<{ role: string }[]>`
    SELECT role FROM team_members WHERE team_id = ${id} AND user_id = ${userId}
  `

  if (!membership) {
    return c.json({ error: 'Team not found or access denied' }, 404)
  }

  const [team] = await sql<Team[]>`SELECT * FROM teams WHERE id = ${id}`

  if (!team) {
    return c.json({ error: 'Team not found' }, 404)
  }

  // Get members
  const members = await sql`
    SELECT u.id, u.name, u.email, u.avatar_url, tm.role
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = ${id}
    ORDER BY tm.role ASC, u.name ASC
  `

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
  const userId = c.get('user').userId
  const body = await c.req.json<{ name: string }>()

  if (!body.name?.trim()) {
    return c.json({ error: 'Team name is required' }, 400)
  }

  const id = generateId()
  const now = new Date().toISOString()

  // Create team
  await sql`
    INSERT INTO teams (id, name, owner_id, created_at)
    VALUES (${id}, ${body.name.trim()}, ${userId}, ${now})
  `

  // Add owner as member
  await sql`
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (${id}, ${userId}, 'owner')
  `

  const [team] = await sql<Team[]>`SELECT * FROM teams WHERE id = ${id}`

  return c.json({ data: team }, 201)
})

// Update team
teams.put('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<{ name?: string }>()

  // Verify user is owner or admin
  const [membership] = await sql<{ role: string }[]>`
    SELECT role FROM team_members WHERE team_id = ${id} AND user_id = ${userId}
  `

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return c.json({ error: 'Permission denied' }, 403)
  }

  if (body.name !== undefined) {
    await sql`UPDATE teams SET name = ${body.name.trim()} WHERE id = ${id}`
  }

  const [team] = await sql<Team[]>`SELECT * FROM teams WHERE id = ${id}`

  return c.json({ data: team })
})

// Delete team
teams.delete('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  // Verify user is owner
  const [team] = await sql<Team[]>`
    SELECT * FROM teams WHERE id = ${id} AND owner_id = ${userId}
  `

  if (!team) {
    return c.json({ error: 'Team not found or not the owner' }, 403)
  }

  // Delete team (cascades to team_members and shared_contacts)
  await sql`DELETE FROM teams WHERE id = ${id}`

  return c.json({ message: 'Team deleted' })
})

// Add team member
teams.post('/:id/members', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<{ email: string; role?: 'admin' | 'member' }>()

  // Verify user is owner or admin
  const [membership] = await sql<{ role: string }[]>`
    SELECT role FROM team_members WHERE team_id = ${id} AND user_id = ${userId}
  `

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return c.json({ error: 'Permission denied' }, 403)
  }

  // Find user by email
  const [targetUser] = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE email = ${body.email}
  `

  if (!targetUser) {
    return c.json({ error: 'User not found with that email' }, 404)
  }

  // Check if already a member
  const [existing] = await sql`
    SELECT * FROM team_members WHERE team_id = ${id} AND user_id = ${targetUser.id}
  `

  if (existing) {
    return c.json({ error: 'User is already a team member' }, 409)
  }

  // Add member
  const role = body.role || 'member'
  await sql`
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (${id}, ${targetUser.id}, ${role})
  `

  return c.json({ message: 'Member added', userId: targetUser.id, role }, 201)
})

// Remove team member
teams.delete('/:id/members/:memberId', async (c) => {
  const userId = c.get('user').userId
  const { id, memberId } = c.req.param()

  // Verify user is owner or admin
  const [membership] = await sql<{ role: string }[]>`
    SELECT role FROM team_members WHERE team_id = ${id} AND user_id = ${userId}
  `

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return c.json({ error: 'Permission denied' }, 403)
  }

  // Can't remove owner
  const [targetMembership] = await sql<{ role: string }[]>`
    SELECT role FROM team_members WHERE team_id = ${id} AND user_id = ${memberId}
  `

  if (!targetMembership) {
    return c.json({ error: 'Member not found' }, 404)
  }

  if (targetMembership.role === 'owner') {
    return c.json({ error: 'Cannot remove team owner' }, 403)
  }

  await sql`DELETE FROM team_members WHERE team_id = ${id} AND user_id = ${memberId}`

  return c.json({ message: 'Member removed' })
})

// Share contact with team
teams.post('/:id/share', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<{ contactId: string; visibility?: 'basic' | 'full' }>()

  // Verify user is team member
  const [membership] = await sql`
    SELECT role FROM team_members WHERE team_id = ${id} AND user_id = ${userId}
  `

  if (!membership) {
    return c.json({ error: 'Not a team member' }, 403)
  }

  // Verify user owns the contact
  const [contact] = await sql`
    SELECT * FROM contacts WHERE id = ${body.contactId} AND user_id = ${userId}
  `

  if (!contact) {
    return c.json({ error: 'Contact not found or not yours' }, 404)
  }

  // Check if already shared
  const [existing] = await sql`
    SELECT * FROM shared_contacts WHERE contact_id = ${body.contactId} AND team_id = ${id}
  `

  if (existing) {
    // Update visibility
    await sql`
      UPDATE shared_contacts SET visibility = ${body.visibility || 'basic'}
      WHERE contact_id = ${body.contactId} AND team_id = ${id}
    `
    return c.json({ message: 'Contact sharing updated' })
  }

  // Share contact
  await sql`
    INSERT INTO shared_contacts (contact_id, team_id, shared_by_id, visibility)
    VALUES (${body.contactId}, ${id}, ${userId}, ${body.visibility || 'basic'})
  `

  return c.json({ message: 'Contact shared' }, 201)
})

// Unshare contact
teams.delete('/:id/share/:contactId', async (c) => {
  const userId = c.get('user').userId
  const { id, contactId } = c.req.param()

  // Verify user shared the contact or is admin/owner
  const [shared] = await sql<SharedContact[]>`
    SELECT * FROM shared_contacts WHERE contact_id = ${contactId} AND team_id = ${id}
  `

  if (!shared) {
    return c.json({ error: 'Shared contact not found' }, 404)
  }

  const [membership] = await sql<{ role: string }[]>`
    SELECT role FROM team_members WHERE team_id = ${id} AND user_id = ${userId}
  `

  if (shared.shared_by_id !== userId && (!membership || !['owner', 'admin'].includes(membership.role))) {
    return c.json({ error: 'Permission denied' }, 403)
  }

  await sql`DELETE FROM shared_contacts WHERE contact_id = ${contactId} AND team_id = ${id}`

  return c.json({ message: 'Contact unshared' })
})

// Get team's shared contacts
teams.get('/:id/contacts', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  // Verify user is team member
  const [membership] = await sql`
    SELECT role FROM team_members WHERE team_id = ${id} AND user_id = ${userId}
  `

  if (!membership) {
    return c.json({ error: 'Not a team member' }, 403)
  }

  const contacts = await sql`
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
    WHERE sc.team_id = ${id}
    ORDER BY c.name ASC
  `

  return c.json({ data: contacts })
})

// Share ALL contacts with team (bulk share)
teams.post('/:id/share-all', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<{ visibility?: 'basic' | 'full' }>()

  // Verify user is team member
  const [membership] = await sql`
    SELECT role FROM team_members WHERE team_id = ${id} AND user_id = ${userId}
  `

  if (!membership) {
    return c.json({ error: 'Not a team member' }, 403)
  }

  // Get all user's contacts that are not already shared
  const userContacts = await sql<{ id: string }[]>`
    SELECT c.id FROM contacts c
    WHERE c.user_id = ${userId}
    AND c.id NOT IN (
      SELECT contact_id FROM shared_contacts WHERE team_id = ${id}
    )
  `

  const visibility = body.visibility || 'basic'
  let sharedCount = 0

  // Share each contact
  for (const contact of userContacts) {
    await sql`
      INSERT INTO shared_contacts (contact_id, team_id, shared_by_id, visibility)
      VALUES (${contact.id}, ${id}, ${userId}, ${visibility})
    `
    sharedCount++
  }

  return c.json({
    data: { sharedCount },
    message: `Shared ${sharedCount} contacts`
  }, 201)
})

// Get user's auto-share setting for a team
teams.get('/:id/auto-share', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const [membership] = await sql<{ auto_share: boolean; auto_share_visibility: string }[]>`
    SELECT auto_share, auto_share_visibility FROM team_members WHERE team_id = ${id} AND user_id = ${userId}
  `

  if (!membership) {
    return c.json({ error: 'Not a team member' }, 403)
  }

  return c.json({
    data: {
      autoShare: membership.auto_share,
      visibility: membership.auto_share_visibility || 'basic'
    }
  })
})

// Update user's auto-share setting for a team
teams.put('/:id/auto-share', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<{ autoShare: boolean; visibility?: 'basic' | 'full' }>()

  // Verify user is team member
  const [membership] = await sql`
    SELECT role FROM team_members WHERE team_id = ${id} AND user_id = ${userId}
  `

  if (!membership) {
    return c.json({ error: 'Not a team member' }, 403)
  }

  await sql`
    UPDATE team_members
    SET auto_share = ${body.autoShare}, auto_share_visibility = ${body.visibility || 'basic'}
    WHERE team_id = ${id} AND user_id = ${userId}
  `

  return c.json({
    data: {
      autoShare: body.autoShare,
      visibility: body.visibility || 'basic'
    },
    message: 'Auto-share settings updated'
  })
})

export default teams
