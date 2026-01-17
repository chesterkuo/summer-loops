import { getDb } from '../db/index.js'
import type { Contact, Relationship } from '../types/index.js'

export interface PathNode {
  contactId: string
  name: string
  company: string | null
  title: string | null
  // Team source info (if contact came from team sharing)
  teamSource?: {
    teamId: string
    teamName: string
    sharedByUserId: string
    sharedByUserName: string
  }
}

export interface PathEdge {
  from: string
  to: string
  strength: number
  type: string | null
}

export interface PathResult {
  path: PathNode[]
  edges: PathEdge[]
  pathStrength: number
  hops: number
  estimatedSuccessRate: number
}

interface GraphNode {
  id: string
  name: string
  company: string | null
  title: string | null
  // Team source info (if contact came from team sharing)
  teamSource?: {
    teamId: string
    teamName: string
    sharedByUserId: string
    sharedByUserName: string
  }
}

interface GraphEdge {
  from: string
  to: string
  strength: number
  type: string | null
}

/**
 * Build adjacency list from relationships including team shared contacts
 */
function buildGraph(userId: string): {
  nodes: Map<string, GraphNode>
  adjacency: Map<string, GraphEdge[]>
} {
  const db = getDb()

  // Get all user's own contacts
  const contacts = db.query(
    'SELECT id, name, company, title FROM contacts WHERE user_id = ?'
  ).all(userId) as Pick<Contact, 'id' | 'name' | 'company' | 'title'>[]

  // Get all user's relationships
  const relationships = db.query(
    'SELECT * FROM relationships WHERE user_id = ?'
  ).all(userId) as Relationship[]

  const nodes = new Map<string, GraphNode>()
  const adjacency = new Map<string, GraphEdge[]>()

  // Add user as a node
  nodes.set(userId, {
    id: userId,
    name: 'You',
    company: null,
    title: null
  })
  adjacency.set(userId, [])

  // Add all user's own contacts as nodes
  for (const contact of contacts) {
    nodes.set(contact.id, {
      id: contact.id,
      name: contact.name,
      company: contact.company,
      title: contact.title
    })
    adjacency.set(contact.id, [])
  }

  // Add edges from user's relationships (using snake_case as returned from SQLite)
  for (const relationship of relationships) {
    const rel = relationship as any
    const isUserRel = rel.is_user_relationship === 1
    const contactA = rel.contact_a_id
    const contactB = rel.contact_b_id

    const edge: GraphEdge = {
      from: isUserRel ? userId : contactA,
      to: isUserRel ? contactA : (contactB || contactA),
      strength: rel.strength,
      type: rel.relationship_type
    }

    // Add bidirectional edges
    const fromEdges = adjacency.get(edge.from) || []
    fromEdges.push(edge)
    adjacency.set(edge.from, fromEdges)

    const toEdges = adjacency.get(edge.to) || []
    toEdges.push({
      from: edge.to,
      to: edge.from,
      strength: edge.strength,
      type: edge.type
    })
    adjacency.set(edge.to, toEdges)
  }

  // ============ CROSS-TEAM PATH DISCOVERY ============
  // Get teams the user is a member of
  const userTeams = db.query(`
    SELECT t.id as team_id, t.name as team_name
    FROM teams t
    JOIN team_members tm ON t.id = tm.team_id
    WHERE tm.user_id = ?
  `).all(userId) as { team_id: string; team_name: string }[]

  // For each team, get shared contacts from other team members
  for (const team of userTeams) {
    // Get team members (excluding current user)
    const teamMembers = db.query(`
      SELECT tm.user_id, u.name as user_name
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ? AND tm.user_id != ?
    `).all(team.team_id, userId) as { user_id: string; user_name: string }[]

    // For each team member, get their shared contacts
    for (const member of teamMembers) {
      // Add team member as a node (virtual connection from user to teammate)
      const memberNodeId = `teammate:${member.user_id}`
      if (!nodes.has(memberNodeId)) {
        nodes.set(memberNodeId, {
          id: memberNodeId,
          name: member.user_name,
          company: null,
          title: 'Team Member',
          teamSource: {
            teamId: team.team_id,
            teamName: team.team_name,
            sharedByUserId: member.user_id,
            sharedByUserName: member.user_name
          }
        })
        adjacency.set(memberNodeId, [])

        // Add edge from user to teammate (strong connection - same team)
        const userToTeammateEdge: GraphEdge = {
          from: userId,
          to: memberNodeId,
          strength: 4, // Strong connection (teammates)
          type: 'teammate'
        }
        const userEdges = adjacency.get(userId) || []
        userEdges.push(userToTeammateEdge)
        adjacency.set(userId, userEdges)

        // Bidirectional
        const teammateEdges = adjacency.get(memberNodeId) || []
        teammateEdges.push({
          from: memberNodeId,
          to: userId,
          strength: 4,
          type: 'teammate'
        })
        adjacency.set(memberNodeId, teammateEdges)
      }

      // Get contacts shared by this team member
      const sharedContacts = db.query(`
        SELECT c.id, c.name, c.company, c.title, sc.visibility
        FROM shared_contacts sc
        JOIN contacts c ON sc.contact_id = c.id
        WHERE sc.team_id = ? AND sc.shared_by_id = ?
      `).all(team.team_id, member.user_id) as {
        id: string
        name: string
        company: string | null
        title: string | null
        visibility: string
      }[]

      // Add shared contacts as nodes (if not already added)
      for (const sharedContact of sharedContacts) {
        const teamContactId = `team:${team.team_id}:${sharedContact.id}`

        if (!nodes.has(teamContactId)) {
          nodes.set(teamContactId, {
            id: teamContactId,
            name: sharedContact.name,
            company: sharedContact.company,
            title: sharedContact.title,
            teamSource: {
              teamId: team.team_id,
              teamName: team.team_name,
              sharedByUserId: member.user_id,
              sharedByUserName: member.user_name
            }
          })
          adjacency.set(teamContactId, [])
        }

        // Add edge from team member to their shared contact
        const memberToContactEdge: GraphEdge = {
          from: `teammate:${member.user_id}`,
          to: teamContactId,
          strength: 3, // Moderate strength (teammate knows this contact)
          type: 'team_shared'
        }
        const memberEdges = adjacency.get(`teammate:${member.user_id}`) || []
        memberEdges.push(memberToContactEdge)
        adjacency.set(`teammate:${member.user_id}`, memberEdges)

        // Bidirectional
        const contactEdges = adjacency.get(teamContactId) || []
        contactEdges.push({
          from: teamContactId,
          to: `teammate:${member.user_id}`,
          strength: 3,
          type: 'team_shared'
        })
        adjacency.set(teamContactId, contactEdges)
      }
    }
  }

  return { nodes, adjacency }
}

/**
 * Find introduction paths using modified Dijkstra's algorithm
 * Path strength = minimum edge strength along path (weakest link principle)
 */
export function findPaths(
  userId: string,
  targetContactId: string,
  maxHops: number = 4,
  topK: number = 5
): PathResult[] {
  const { nodes, adjacency } = buildGraph(userId)

  if (!nodes.has(targetContactId)) {
    return []
  }

  // BFS with path tracking
  const results: PathResult[] = []
  const visited = new Set<string>()

  interface QueueItem {
    nodeId: string
    path: string[]
    edges: GraphEdge[]
    minStrength: number
  }

  const queue: QueueItem[] = [{
    nodeId: userId,
    path: [userId],
    edges: [],
    minStrength: 5 // Start with max strength
  }]

  while (queue.length > 0 && results.length < topK * 2) {
    const current = queue.shift()!

    if (current.nodeId === targetContactId) {
      // Found a path
      const pathNodes = current.path.map(id => {
        const node = nodes.get(id)!
        const pathNode: PathNode = {
          contactId: id,
          name: node.name,
          company: node.company,
          title: node.title
        }
        // Include team source info if available
        if (node.teamSource) {
          pathNode.teamSource = node.teamSource
        }
        return pathNode
      })

      const pathEdges = current.edges.map(e => ({
        from: e.from,
        to: e.to,
        strength: e.strength,
        type: e.type
      }))

      results.push({
        path: pathNodes,
        edges: pathEdges,
        pathStrength: current.minStrength,
        hops: current.path.length - 1,
        estimatedSuccessRate: Math.min(0.9, current.minStrength * 0.15 + 0.10)
      })

      continue
    }

    if (current.path.length > maxHops) {
      continue
    }

    // Explore neighbors
    const neighbors = adjacency.get(current.nodeId) || []
    for (const edge of neighbors) {
      if (current.path.includes(edge.to)) {
        continue // Avoid cycles
      }

      queue.push({
        nodeId: edge.to,
        path: [...current.path, edge.to],
        edges: [...current.edges, edge],
        minStrength: Math.min(current.minStrength, edge.strength)
      })
    }

    // Sort queue by path strength (descending) to find strongest paths first
    queue.sort((a, b) => b.minStrength - a.minStrength)
  }

  // Sort results by path strength and return top K
  results.sort((a, b) => {
    if (b.pathStrength !== a.pathStrength) {
      return b.pathStrength - a.pathStrength
    }
    return a.hops - b.hops // Prefer shorter paths
  })

  return results.slice(0, topK)
}

/**
 * Search for paths to a target by description (name, company, title)
 * Now includes cross-team search - searches user's contacts first, then team shared contacts
 */
export function searchPaths(
  userId: string,
  targetDescription: string,
  maxHops: number = 4,
  topK: number = 5
): { targetContact: GraphNode | null; paths: PathResult[]; isTeamContact?: boolean } {
  const db = getDb()
  const searchPattern = `%${targetDescription}%`

  // 1. First search user's own contacts
  const ownMatches = db.query(`
    SELECT id, name, company, title FROM contacts
    WHERE user_id = ? AND (name LIKE ? OR company LIKE ? OR title LIKE ?)
    LIMIT 1
  `).all(userId, searchPattern, searchPattern, searchPattern) as Pick<Contact, 'id' | 'name' | 'company' | 'title'>[]

  if (ownMatches.length > 0) {
    const target = ownMatches[0]
    const paths = findPaths(userId, target.id, maxHops, topK)

    return {
      targetContact: {
        id: target.id,
        name: target.name,
        company: target.company,
        title: target.title
      },
      paths,
      isTeamContact: false
    }
  }

  // 2. If no own contact found, search team shared contacts
  // Get teams the user is a member of
  const userTeams = db.query(`
    SELECT team_id FROM team_members WHERE user_id = ?
  `).all(userId) as { team_id: string }[]

  if (userTeams.length === 0) {
    return { targetContact: null, paths: [] }
  }

  const teamIds = userTeams.map(t => t.team_id)
  const placeholders = teamIds.map(() => '?').join(',')

  // Search for matching contacts shared by teammates
  const teamMatches = db.query(`
    SELECT DISTINCT
      c.id, c.name, c.company, c.title,
      sc.team_id, t.name as team_name,
      sc.shared_by_id as shared_by_user_id, u.name as shared_by_name
    FROM shared_contacts sc
    JOIN contacts c ON sc.contact_id = c.id
    JOIN teams t ON sc.team_id = t.id
    JOIN users u ON sc.shared_by_id = u.id
    WHERE sc.team_id IN (${placeholders})
      AND sc.shared_by_id != ?
      AND (c.name LIKE ? OR c.company LIKE ? OR c.title LIKE ?)
    LIMIT 1
  `).all(...teamIds, userId, searchPattern, searchPattern, searchPattern) as {
    id: string
    name: string
    company: string | null
    title: string | null
    team_id: string
    team_name: string
    shared_by_user_id: string
    shared_by_name: string
  }[]

  if (teamMatches.length === 0) {
    return { targetContact: null, paths: [] }
  }

  const teamTarget = teamMatches[0]
  // Use the special team contact ID format for path finding
  const teamContactId = `team:${teamTarget.team_id}:${teamTarget.id}`
  const paths = findPaths(userId, teamContactId, maxHops, topK)

  return {
    targetContact: {
      id: teamTarget.id,
      name: teamTarget.name,
      company: teamTarget.company,
      title: teamTarget.title,
      teamSource: {
        teamId: teamTarget.team_id,
        teamName: teamTarget.team_name,
        sharedByUserId: teamTarget.shared_by_user_id,
        sharedByUserName: teamTarget.shared_by_name
      }
    },
    paths,
    isTeamContact: true
  }
}
