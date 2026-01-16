import { getDb } from '../db/index.js'
import type { Contact, Relationship } from '../types/index.js'

export interface PathNode {
  contactId: string
  name: string
  company: string | null
  title: string | null
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
}

interface GraphEdge {
  from: string
  to: string
  strength: number
  type: string | null
}

/**
 * Build adjacency list from relationships
 */
function buildGraph(userId: string): {
  nodes: Map<string, GraphNode>
  adjacency: Map<string, GraphEdge[]>
} {
  const db = getDb()

  // Get all contacts
  const contacts = db.query(
    'SELECT id, name, company, title FROM contacts WHERE user_id = ?'
  ).all(userId) as Pick<Contact, 'id' | 'name' | 'company' | 'title'>[]

  // Get all relationships
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

  // Add all contacts as nodes
  for (const contact of contacts) {
    nodes.set(contact.id, {
      id: contact.id,
      name: contact.name,
      company: contact.company,
      title: contact.title
    })
    adjacency.set(contact.id, [])
  }

  // Add edges from relationships (using snake_case as returned from SQLite)
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
        return {
          contactId: id,
          name: node.name,
          company: node.company,
          title: node.title
        }
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
 */
export function searchPaths(
  userId: string,
  targetDescription: string,
  maxHops: number = 4,
  topK: number = 5
): { targetContact: GraphNode | null; paths: PathResult[] } {
  const db = getDb()

  // Search for matching contacts
  const searchPattern = `%${targetDescription}%`
  const matches = db.query(`
    SELECT id, name, company, title FROM contacts
    WHERE user_id = ? AND (name LIKE ? OR company LIKE ? OR title LIKE ?)
    LIMIT 1
  `).all(userId, searchPattern, searchPattern, searchPattern) as Pick<Contact, 'id' | 'name' | 'company' | 'title'>[]

  if (matches.length === 0) {
    return { targetContact: null, paths: [] }
  }

  const target = matches[0]
  const paths = findPaths(userId, target.id, maxHops, topK)

  return {
    targetContact: {
      id: target.id,
      name: target.name,
      company: target.company,
      title: target.title
    },
    paths
  }
}
