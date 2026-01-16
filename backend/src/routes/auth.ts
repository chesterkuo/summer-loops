import { Hono } from 'hono'
import { getDb, generateId } from '../db/index.js'
import { generateToken, getExpirationMs, verifyToken } from '../utils/jwt.js'
import { authMiddleware } from '../middleware/auth.js'
import type { User } from '../types/index.js'

const auth = new Hono()

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// Check if Google OAuth is configured
function isOAuthConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
}

// Redirect to Google OAuth
auth.get('/google', (c) => {
  if (!isOAuthConfigured()) {
    return c.json({ error: 'Google OAuth not configured' }, 503)
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID!,
    redirect_uri: GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent'
  })

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

// Google OAuth callback
auth.get('/google/callback', async (c) => {
  if (!isOAuthConfigured()) {
    return c.json({ error: 'Google OAuth not configured' }, 503)
  }

  const code = c.req.query('code')
  const error = c.req.query('error')

  if (error) {
    return c.redirect(`${FRONTEND_URL}/login?error=${error}`)
  }

  if (!code) {
    return c.redirect(`${FRONTEND_URL}/login?error=no_code`)
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code'
      })
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens')
    }

    const tokens = await tokenResponse.json() as { access_token: string; id_token: string }

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })

    if (!userInfoResponse.ok) {
      throw new Error('Failed to get user info')
    }

    const googleUser = await userInfoResponse.json() as {
      id: string
      email: string
      name: string
      picture: string
    }

    // Find or create user in database
    const db = getDb()
    let user = db.query(
      'SELECT * FROM users WHERE google_id = ?'
    ).get(googleUser.id) as User | null

    const now = new Date().toISOString()

    if (!user) {
      // Create new user
      const userId = generateId()
      db.query(`
        INSERT INTO users (id, email, name, avatar_url, google_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId, googleUser.email, googleUser.name, googleUser.picture, googleUser.id, now, now)

      user = db.query('SELECT * FROM users WHERE id = ?').get(userId) as User
    } else {
      // Update existing user
      db.query(`
        UPDATE users SET name = ?, avatar_url = ?, updated_at = ? WHERE id = ?
      `).run(googleUser.name, googleUser.picture, now, user.id)

      user = db.query('SELECT * FROM users WHERE id = ?').get(user.id) as User
    }

    // Generate JWT token
    const token = await generateToken({
      userId: user.id,
      email: user.email,
      name: user.name
    })

    // Set cookie and redirect to frontend
    const maxAge = Math.floor(getExpirationMs() / 1000)

    return c.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`, 302)
  } catch (error) {
    console.error('OAuth callback error:', error)
    return c.redirect(`${FRONTEND_URL}/login?error=auth_failed`)
  }
})

// Get current user info
auth.get('/me', authMiddleware, (c) => {
  const user = c.get('user')
  const db = getDb()

  const dbUser = db.query(
    'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?'
  ).get(user.userId) as Omit<User, 'google_id' | 'updated_at'> | null

  if (!dbUser) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({
    data: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      avatarUrl: (dbUser as any).avatar_url,
      createdAt: (dbUser as any).created_at
    }
  })
})

// Refresh token
auth.post('/refresh', authMiddleware, async (c) => {
  const user = c.get('user')

  const newToken = await generateToken({
    userId: user.userId,
    email: user.email,
    name: user.name
  })

  return c.json({
    data: {
      token: newToken,
      expiresIn: getExpirationMs()
    }
  })
})

// Logout (client should clear token)
auth.post('/logout', (c) => {
  return c.json({ message: 'Logged out successfully' })
})

// Check OAuth configuration status
auth.get('/status', (c) => {
  return c.json({
    data: {
      googleOAuthConfigured: isOAuthConfigured(),
      demoMode: !isOAuthConfigured()
    }
  })
})

// Demo login (for development without OAuth)
auth.post('/demo', async (c) => {
  const db = getDb()
  const DEMO_USER_ID = 'demo-user-001'

  // Get or create demo user
  let user = db.query('SELECT * FROM users WHERE id = ?').get(DEMO_USER_ID) as User | null

  if (!user) {
    const now = new Date().toISOString()
    db.query(`
      INSERT INTO users (id, email, name, avatar_url, google_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      DEMO_USER_ID,
      'demo@summerloop.app',
      'Demo User',
      'https://ui-avatars.com/api/?name=Demo+User&background=39E079&color=fff',
      'google-demo-001',
      now,
      now
    )
    user = db.query('SELECT * FROM users WHERE id = ?').get(DEMO_USER_ID) as User
  }

  const token = await generateToken({
    userId: user.id,
    email: user.email,
    name: user.name
  })

  return c.json({
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: (user as any).avatar_url
      },
      expiresIn: getExpirationMs()
    }
  })
})

export default auth
