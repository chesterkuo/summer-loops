import { Hono } from 'hono'
import { sql, generateId } from '../db/postgres.js'
import type { CreateRelationshipRequest, UpdateRelationshipRequest, Relationship, Contact } from '../types/index.js'
import { authMiddleware } from '../middleware/auth.js'

const relationships = new Hono()

// Apply auth middleware to all routes
relationships.use('*', authMiddleware)

// List all relationships
relationships.get('/', async (c) => {
  const userId = c.get('user').userId
  const { contactId } = c.req.query()

  let rows: Relationship[]

  if (contactId) {
    rows = await sql<Relationship[]>`
      SELECT * FROM relationships
      WHERE user_id = ${userId}
      AND (contact_a_id = ${contactId} OR contact_b_id = ${contactId})
      ORDER BY updated_at DESC
    `
  } else {
    rows = await sql<Relationship[]>`
      SELECT * FROM relationships
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
    `
  }

  return c.json({ data: rows })
})

// Get graph data for visualization (includes team shared contacts)
relationships.get('/graph', async (c) => {
  const userId = c.get('user').userId

  // Get all contacts for this user
  const contacts = await sql<Pick<Contact, 'id' | 'name' | 'company' | 'title'>[]>`
    SELECT id, name, company, title FROM contacts WHERE user_id = ${userId}
  `

  // Get all relationships
  const rels = await sql<Relationship[]>`
    SELECT * FROM relationships WHERE user_id = ${userId}
  `

  // Build nodes (including user as center)
  const nodes: any[] = [
    {
      id: 'user',
      name: 'You',
      company: null,
      title: null,
      degree: 0,
      isTeamContact: false,
      isTeammate: false
    },
    ...contacts.map(contact => {
      // Check if direct connection to user (is_user_relationship is boolean in PostgreSQL)
      const directConnection = rels.find(
        r => (r as any).is_user_relationship === true &&
        ((r as any).contact_a_id === contact.id || (r as any).contact_b_id === contact.id)
      )
      return {
        id: contact.id,
        name: contact.name,
        company: contact.company,
        title: contact.title,
        degree: directConnection ? 1 : 2,
        isTeamContact: false,
        isTeammate: false
      }
    })
  ]

  // Build edges (using snake_case as returned from PostgreSQL)
  const edges: any[] = rels.map(rel => {
    const r = rel as any
    return {
      source: r.is_user_relationship === true ? 'user' : r.contact_a_id,
      target: r.is_user_relationship === true ? r.contact_a_id : (r.contact_b_id || r.contact_a_id),
      strength: r.strength,
      type: r.relationship_type,
      isTeamEdge: false
    }
  })

  // ============ ADD TEAM SHARED CONTACTS ============
  // Get teams the user is a member of
  const userTeams = await sql<{ team_id: string; team_name: string }[]>`
    SELECT t.id as team_id, t.name as team_name
    FROM teams t
    JOIN team_members tm ON t.id = tm.team_id
    WHERE tm.user_id = ${userId}
  `

  const addedTeammates = new Set<string>()
  const addedTeamContacts = new Set<string>()

  for (const team of userTeams) {
    // Get team members (excluding current user)
    const teamMembers = await sql<{ user_id: string; user_name: string }[]>`
      SELECT tm.user_id, u.name as user_name
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ${team.team_id} AND tm.user_id != ${userId}
    `

    for (const member of teamMembers) {
      const teammateNodeId = `teammate:${member.user_id}`

      // Add teammate node (if not already added)
      if (!addedTeammates.has(member.user_id)) {
        addedTeammates.add(member.user_id)
        nodes.push({
          id: teammateNodeId,
          name: member.user_name,
          company: null,
          title: 'Team Member',
          degree: 1,
          isTeamContact: false,
          isTeammate: true,
          teamName: team.team_name
        })

        // Add edge from user to teammate
        edges.push({
          source: 'user',
          target: teammateNodeId,
          strength: 4,
          type: 'teammate',
          isTeamEdge: true
        })
      }

      // Get contacts shared by this team member
      const sharedContacts = await sql<{
        id: string
        name: string
        company: string | null
        title: string | null
        visibility: string
      }[]>`
        SELECT c.id, c.name, c.company, c.title, sc.visibility
        FROM shared_contacts sc
        JOIN contacts c ON sc.contact_id = c.id
        WHERE sc.team_id = ${team.team_id} AND sc.shared_by_id = ${member.user_id}
      `

      for (const sharedContact of sharedContacts) {
        const teamContactId = `team:${team.team_id}:${sharedContact.id}`

        // Add team contact node (if not already added)
        if (!addedTeamContacts.has(teamContactId)) {
          addedTeamContacts.add(teamContactId)
          nodes.push({
            id: teamContactId,
            name: sharedContact.name,
            company: sharedContact.company,
            title: sharedContact.title,
            degree: 2,
            isTeamContact: true,
            isTeammate: false,
            teamName: team.team_name,
            sharedBy: member.user_name
          })
        }

        // Add edge from teammate to their shared contact
        edges.push({
          source: teammateNodeId,
          target: teamContactId,
          strength: 3,
          type: 'team_shared',
          isTeamEdge: true
        })
      }
    }
  }

  return c.json({
    data: {
      nodes,
      edges
    }
  })
})

// Create relationship
relationships.post('/', async (c) => {
  const userId = c.get('user').userId
  const body = await c.req.json<CreateRelationshipRequest>()

  if (!body.contactAId) {
    return c.json({ error: 'contactAId is required' }, 400)
  }

  // Verify contacts exist
  const [contactA] = await sql`
    SELECT id FROM contacts WHERE id = ${body.contactAId} AND user_id = ${userId}
  `

  if (!contactA) {
    return c.json({ error: 'Contact A not found' }, 404)
  }

  if (body.contactBId) {
    const [contactB] = await sql`
      SELECT id FROM contacts WHERE id = ${body.contactBId} AND user_id = ${userId}
    `

    if (!contactB) {
      return c.json({ error: 'Contact B not found' }, 404)
    }
  }

  // Check for duplicate
  const [existing] = await sql`
    SELECT id FROM relationships
    WHERE user_id = ${userId} AND contact_a_id = ${body.contactAId}
    AND (contact_b_id = ${body.contactBId || null} OR (contact_b_id IS NULL AND ${body.contactBId || null} IS NULL))
  `

  if (existing) {
    return c.json({ error: 'Relationship already exists' }, 409)
  }

  const id = generateId()
  const now = new Date().toISOString()

  await sql`
    INSERT INTO relationships (
      id, user_id, contact_a_id, contact_b_id, is_user_relationship,
      relationship_type, strength, how_met, introduced_by_id,
      is_ai_inferred, verified, created_at, updated_at
    )
    VALUES (
      ${id}, ${userId}, ${body.contactAId}, ${body.contactBId || null},
      ${body.isUserRelationship || false}, ${body.relationshipType || null},
      ${body.strength || 3}, ${body.howMet || null}, ${body.introducedById || null},
      false, true, ${now}, ${now}
    )
  `

  const [relationship] = await sql<Relationship[]>`SELECT * FROM relationships WHERE id = ${id}`

  return c.json({ data: relationship }, 201)
})

// Update relationship
relationships.put('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<UpdateRelationshipRequest>()

  const [existing] = await sql<Relationship[]>`
    SELECT * FROM relationships WHERE id = ${id} AND user_id = ${userId}
  `

  if (!existing) {
    return c.json({ error: 'Relationship not found' }, 404)
  }

  const hasRelType = body.relationshipType !== undefined
  const hasStrength = body.strength !== undefined
  const hasHowMet = body.howMet !== undefined
  const hasVerified = body.verified !== undefined

  if (!hasRelType && !hasStrength && !hasHowMet && !hasVerified) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  const now = new Date().toISOString()

  await sql`
    UPDATE relationships SET
      relationship_type = ${hasRelType ? (body.relationshipType || null) : existing.relationshipType},
      strength = COALESCE(${hasStrength ? body.strength ?? null : null}, strength),
      how_met = ${hasHowMet ? (body.howMet || null) : existing.howMet},
      verified = COALESCE(${hasVerified ? body.verified ?? null : null}, verified),
      updated_at = ${now}
    WHERE id = ${id}
  `

  const [relationship] = await sql<Relationship[]>`SELECT * FROM relationships WHERE id = ${id}`

  return c.json({ data: relationship })
})

// Delete relationship
relationships.delete('/:id', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()

  const [existing] = await sql<Relationship[]>`
    SELECT * FROM relationships WHERE id = ${id} AND user_id = ${userId}
  `

  if (!existing) {
    return c.json({ error: 'Relationship not found' }, 404)
  }

  await sql`DELETE FROM relationships WHERE id = ${id}`

  return c.json({ message: 'Relationship deleted successfully' })
})

// Verify AI-inferred relationship
relationships.post('/:id/verify', async (c) => {
  const userId = c.get('user').userId
  const { id } = c.req.param()
  const body = await c.req.json<{ verified: boolean }>()

  const [existing] = await sql<Relationship[]>`
    SELECT * FROM relationships WHERE id = ${id} AND user_id = ${userId}
  `

  if (!existing) {
    return c.json({ error: 'Relationship not found' }, 404)
  }

  const now = new Date().toISOString()
  await sql`
    UPDATE relationships SET verified = ${body.verified}, updated_at = ${now} WHERE id = ${id}
  `

  const [relationship] = await sql<Relationship[]>`SELECT * FROM relationships WHERE id = ${id}`

  return c.json({ data: relationship })
})

export default relationships
