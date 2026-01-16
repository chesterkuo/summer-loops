import { Context, Next } from 'hono'
import { verifyToken, JWTPayload } from '../utils/jwt.js'

// Extend Hono context to include user
declare module 'hono' {
  interface ContextVariableMap {
    user: JWTPayload
  }
}

/**
 * Auth middleware - requires valid JWT token
 */
export async function authMiddleware(c: Context, next: Next) {
  // Get token from Authorization header or cookie
  const authHeader = c.req.header('Authorization')
  const cookieToken = c.req.header('Cookie')?.match(/token=([^;]+)/)?.[1]

  const token = authHeader?.replace('Bearer ', '') || cookieToken

  if (!token) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  const payload = await verifyToken(token)

  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  // Attach user to context
  c.set('user', payload)

  await next()
}

/**
 * Optional auth middleware - doesn't fail if no token
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  const cookieToken = c.req.header('Cookie')?.match(/token=([^;]+)/)?.[1]

  const token = authHeader?.replace('Bearer ', '') || cookieToken

  if (token) {
    const payload = await verifyToken(token)
    if (payload) {
      c.set('user', payload)
    }
  }

  await next()
}
