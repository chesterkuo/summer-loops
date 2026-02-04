import { Hono } from 'hono'
import { sql, generateId } from '../db/postgres.js'
import { generateToken, getExpirationMs } from '../utils/jwt.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendPasswordResetEmail } from '../utils/email.js'
import type { User } from '../types/index.js'

const auth = new Hono()

// Accept any pending team invites for this email
async function acceptPendingInvites(userId: string, email: string): Promise<void> {
  try {
    const invites = await sql<{ id: string; team_id: string; role: string }[]>`
      SELECT id, team_id, role FROM team_invites
      WHERE email = ${email} AND status = 'pending'
    `

    for (const invite of invites) {
      // Check not already a member
      const [existing] = await sql`
        SELECT 1 FROM team_members WHERE team_id = ${invite.team_id} AND user_id = ${userId}
      `
      if (!existing) {
        await sql`
          INSERT INTO team_members (team_id, user_id, role)
          VALUES (${invite.team_id}, ${userId}, ${invite.role})
        `
      }
      await sql`UPDATE team_invites SET status = 'accepted' WHERE id = ${invite.id}`
    }
  } catch (err) {
    console.error('Error accepting pending invites:', err)
  }
}

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// Demo account credentials
const DEMO_EMAIL = 'demo@warmly.app'
const DEMO_PASSWORD = 'demo123'
const DEMO_USER_ID = 'demo-user-001'

// Check if Google OAuth is configured
function isOAuthConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
}

// Password validation
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' }
  }
  return { valid: true }
}

// Email validation
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// ==================== Email/Password Auth ====================

// Signup with email/password
auth.post('/signup', async (c) => {
  const body = await c.req.json() as { email?: string; password?: string; name?: string }

  // Validate input
  if (!body.email || !body.password || !body.name) {
    return c.json({ error: 'Email, password, and name are required' }, 400)
  }

  if (!validateEmail(body.email)) {
    return c.json({ error: 'Invalid email format' }, 400)
  }

  const passwordValidation = validatePassword(body.password)
  if (!passwordValidation.valid) {
    return c.json({ error: passwordValidation.error }, 400)
  }

  if (body.name.trim().length < 1 || body.name.length > 100) {
    return c.json({ error: 'Name must be between 1 and 100 characters' }, 400)
  }

  // Check if email already exists
  const [existingUser] = await sql`SELECT id FROM users WHERE email = ${body.email.toLowerCase()}`
  if (existingUser) {
    return c.json({ error: 'Email already registered' }, 409)
  }

  try {
    // Hash password using Bun's built-in bcrypt
    const passwordHash = await Bun.password.hash(body.password, {
      algorithm: 'bcrypt',
      cost: 12
    })

    const userId = generateId()
    const now = new Date().toISOString()
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(body.name)}&background=39E079&color=fff`

    await sql`
      INSERT INTO users (id, email, name, avatar_url, password_hash, auth_provider, created_at, updated_at)
      VALUES (${userId}, ${body.email.toLowerCase()}, ${body.name.trim()}, ${avatarUrl}, ${passwordHash}, 'email', ${now}, ${now})
    `

    const [user] = await sql<User[]>`SELECT * FROM users WHERE id = ${userId}`

    // Accept any pending team invites
    await acceptPendingInvites(userId, body.email.toLowerCase())

    // Generate JWT token
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
    }, 201)
  } catch (error) {
    console.error('Signup error:', error)
    return c.json({ error: 'Failed to create account' }, 500)
  }
})

// Login with email/password
auth.post('/login', async (c) => {
  const body = await c.req.json() as { email?: string; password?: string }

  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password are required' }, 400)
  }

  // Find user by email
  const [user] = await sql<User[]>`SELECT * FROM users WHERE email = ${body.email.toLowerCase()}`

  if (!user) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  // Check if user has password (might be Google OAuth only)
  const passwordHash = (user as any).password_hash
  if (!passwordHash) {
    const authProvider = (user as any).auth_provider
    if (authProvider === 'google') {
      return c.json({ error: 'This account uses Google login. Please sign in with Google.' }, 401)
    }
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  try {
    // Verify password
    const isValid = await Bun.password.verify(body.password, passwordHash)
    if (!isValid) {
      return c.json({ error: 'Invalid email or password' }, 401)
    }

    // Accept any pending team invites
    await acceptPendingInvites(user.id, user.email)

    // Generate JWT token
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
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ error: 'Login failed' }, 500)
  }
})

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
    let [user] = await sql<User[]>`SELECT * FROM users WHERE google_id = ${googleUser.id}`

    const now = new Date().toISOString()

    if (!user) {
      // Create new user
      const userId = generateId()
      await sql`
        INSERT INTO users (id, email, name, avatar_url, google_id, created_at, updated_at)
        VALUES (${userId}, ${googleUser.email}, ${googleUser.name}, ${googleUser.picture}, ${googleUser.id}, ${now}, ${now})
      `

      ;[user] = await sql<User[]>`SELECT * FROM users WHERE id = ${userId}`
    } else {
      // Update existing user
      await sql`
        UPDATE users SET name = ${googleUser.name}, avatar_url = ${googleUser.picture}, updated_at = ${now} WHERE id = ${user.id}
      `

      ;[user] = await sql<User[]>`SELECT * FROM users WHERE id = ${user.id}`
    }

    // Accept any pending team invites
    await acceptPendingInvites(user.id, user.email)

    // Generate JWT token
    const token = await generateToken({
      userId: user.id,
      email: user.email,
      name: user.name
    })

    // Set cookie and redirect to frontend
    return c.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`, 302)
  } catch (error) {
    console.error('OAuth callback error:', error)
    return c.redirect(`${FRONTEND_URL}/login?error=auth_failed`)
  }
})

// ==================== Password Reset ====================

// Request password reset code
auth.post('/forgot-password', async (c) => {
  const body = await c.req.json() as { email?: string }

  if (!body.email || !validateEmail(body.email)) {
    return c.json({ message: 'If an account exists, a reset code has been sent.' })
  }

  const email = body.email.toLowerCase()

  try {
    const [user] = await sql<User[]>`SELECT * FROM users WHERE email = ${email}`

    // Always return 200 — never reveal if email exists
    if (!user) {
      return c.json({ message: 'If an account exists, a reset code has been sent.' })
    }

    // Skip if Google-only or demo account
    const authProvider = (user as any).auth_provider
    if (authProvider === 'google' || authProvider === 'demo') {
      return c.json({ message: 'If an account exists, a reset code has been sent.' })
    }

    // Rate limit: 1 per 60s per user
    const [recentReset] = await sql`
      SELECT id FROM password_resets
      WHERE user_id = ${user.id} AND created_at > NOW() - INTERVAL '60 seconds'
      ORDER BY created_at DESC LIMIT 1
    `
    if (recentReset) {
      return c.json({ message: 'If an account exists, a reset code has been sent.' })
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const resetId = generateId()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    // Invalidate old codes
    await sql`UPDATE password_resets SET used = TRUE WHERE user_id = ${user.id} AND used = FALSE`

    // Insert new reset
    await sql`
      INSERT INTO password_resets (id, user_id, code, expires_at)
      VALUES (${resetId}, ${user.id}, ${code}, ${expiresAt})
    `

    // Send email
    await sendPasswordResetEmail(email, code)

    return c.json({ message: 'If an account exists, a reset code has been sent.' })
  } catch (error) {
    console.error('Forgot password error:', error)
    return c.json({ message: 'If an account exists, a reset code has been sent.' })
  }
})

// Reset password with code
auth.post('/reset-password', async (c) => {
  const body = await c.req.json() as { email?: string; code?: string; newPassword?: string }

  if (!body.email || !validateEmail(body.email)) {
    return c.json({ error: 'Valid email is required' }, 400)
  }

  if (!body.code || !/^\d{6}$/.test(body.code)) {
    return c.json({ error: 'A valid 6-digit code is required' }, 400)
  }

  const passwordValidation = validatePassword(body.newPassword || '')
  if (!passwordValidation.valid) {
    return c.json({ error: passwordValidation.error }, 400)
  }

  const email = body.email.toLowerCase()

  try {
    const [user] = await sql<User[]>`SELECT * FROM users WHERE email = ${email}`
    if (!user) {
      return c.json({ error: 'Invalid code or email' }, 400)
    }

    const [reset] = await sql`
      SELECT * FROM password_resets
      WHERE user_id = ${user.id} AND code = ${body.code} AND used = FALSE AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `

    if (!reset) {
      return c.json({ error: 'Invalid or expired code' }, 400)
    }

    // Mark code as used
    await sql`UPDATE password_resets SET used = TRUE WHERE id = ${reset.id}`

    // Hash new password
    const passwordHash = await Bun.password.hash(body.newPassword!, {
      algorithm: 'bcrypt',
      cost: 12,
    })

    // Update user password
    await sql`UPDATE users SET password_hash = ${passwordHash}, updated_at = ${new Date().toISOString()} WHERE id = ${user.id}`

    return c.json({ message: 'Password has been reset successfully' })
  } catch (error) {
    console.error('Reset password error:', error)
    return c.json({ error: 'Failed to reset password' }, 500)
  }
})

// Get current user info
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user')

  const [dbUser] = await sql<User[]>`
    SELECT id, email, name, avatar_url, bio, created_at FROM users WHERE id = ${user.userId}
  `

  if (!dbUser) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({
    data: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      avatarUrl: (dbUser as any).avatar_url,
      bio: (dbUser as any).bio,
      createdAt: (dbUser as any).created_at
    }
  })
})

// Update current user info
auth.put('/me', authMiddleware, async (c) => {
  const user = c.get('user')
  const body = await c.req.json() as { name?: string; avatarUrl?: string; bio?: string }

  // Validate input
  if (!body.name && !body.avatarUrl && body.bio === undefined) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  const now = new Date().toISOString()

  if (body.name) {
    if (body.name.trim().length < 1 || body.name.length > 100) {
      return c.json({ error: 'Name must be between 1 and 100 characters' }, 400)
    }
  }

  if (body.bio !== undefined && body.bio && body.bio.length > 500) {
    return c.json({ error: 'Bio must be less than 500 characters' }, 400)
  }

  // Build and execute update
  const [existing] = await sql<User[]>`SELECT * FROM users WHERE id = ${user.userId}`

  await sql`
    UPDATE users SET
      name = ${body.name?.trim() || existing.name},
      avatar_url = ${body.avatarUrl || (existing as any).avatar_url},
      bio = ${body.bio !== undefined ? (body.bio || null) : (existing as any).bio},
      updated_at = ${now}
    WHERE id = ${user.userId}
  `

  // Fetch updated user
  const [dbUser] = await sql<User[]>`
    SELECT id, email, name, avatar_url, bio, created_at FROM users WHERE id = ${user.userId}
  `

  if (!dbUser) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({
    data: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      avatarUrl: (dbUser as any).avatar_url,
      bio: (dbUser as any).bio,
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

// Delete account
auth.delete('/account', authMiddleware, async (c) => {
  const user = c.get('user')

  // Don't allow deleting demo account
  if (user.userId === DEMO_USER_ID) {
    return c.json({ error: 'Cannot delete demo account' }, 403)
  }

  try {
    // Delete the user (cascades to all related data)
    await sql`DELETE FROM users WHERE id = ${user.userId}`

    return c.json({
      data: {
        message: 'Account deleted successfully'
      }
    })
  } catch (error) {
    console.error('Delete account error:', error)
    return c.json({ error: 'Failed to delete account' }, 500)
  }
})

// Check OAuth configuration status
auth.get('/status', (c) => {
  return c.json({
    data: {
      googleOAuthConfigured: isOAuthConfigured(),
      emailPasswordEnabled: true,
      demoAccount: {
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD
      }
    }
  })
})

// Initialize demo account with sample data
auth.post('/demo', async (c) => {
  // Get or create demo user
  let [user] = await sql<User[]>`SELECT * FROM users WHERE id = ${DEMO_USER_ID}`

  if (!user) {
    const now = new Date().toISOString()
    const passwordHash = await Bun.password.hash(DEMO_PASSWORD, {
      algorithm: 'bcrypt',
      cost: 12
    })

    await sql`
      INSERT INTO users (id, email, name, avatar_url, password_hash, auth_provider, created_at, updated_at)
      VALUES (${DEMO_USER_ID}, ${DEMO_EMAIL}, 'Chester', 'https://ui-avatars.com/api/?name=Chester&background=39E079&color=fff', ${passwordHash}, 'demo', ${now}, ${now})
    `
    ;[user] = await sql<User[]>`SELECT * FROM users WHERE id = ${DEMO_USER_ID}`

    // Initialize sample data for demo user
    await initializeDemoData(DEMO_USER_ID)
  } else {
    // Update password hash if demo user exists but might not have password
    const existingHash = (user as any).password_hash
    if (!existingHash) {
      const passwordHash = await Bun.password.hash(DEMO_PASSWORD, {
        algorithm: 'bcrypt',
        cost: 12
      })
      await sql`UPDATE users SET password_hash = ${passwordHash}, auth_provider = 'demo' WHERE id = ${DEMO_USER_ID}`
    }
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

// Initialize demo data with sample contacts and relationships
async function initializeDemoData(userId: string): Promise<void> {
  const now = new Date().toISOString()

  // Sample contacts
  const sampleContacts = [
    { id: 'contact-demo-001', name: 'Lisa Wong', company: 'Meta', title: 'Staff Frontend Engineer', email: 'lisa.wong@meta.com' },
    { id: 'contact-demo-003', name: 'Michael Chen', company: 'Google', title: 'Senior Product Manager', email: 'michael.chen@google.com' },
    { id: 'contact-demo-004', name: 'Sarah Kim', company: 'Apple', title: 'UX Designer', email: 'sarah.kim@apple.com' },
    { id: 'contact-demo-005', name: 'David Lee', company: 'Amazon', title: 'Software Engineer', email: 'david.lee@amazon.com' },
    { id: 'contact-demo-006', name: 'Emily Zhang', company: 'Netflix', title: 'Data Scientist', email: 'emily.zhang@netflix.com' },
    { id: 'contact-demo-007', name: 'Jason Park', company: 'Uber', title: 'Engineering Manager', email: 'jason.park@uber.com' },
    { id: 'contact-demo-008', name: 'Jennifer Wu', company: 'Airbnb', title: 'Marketing Director', email: 'jennifer.wu@airbnb.com' },
  ]

  for (const contact of sampleContacts) {
    const [existing] = await sql`SELECT id FROM contacts WHERE id = ${contact.id}`
    if (!existing) {
      await sql`
        INSERT INTO contacts (id, user_id, name, company, title, email, source, created_at, updated_at)
        VALUES (${contact.id}, ${userId}, ${contact.name}, ${contact.company}, ${contact.title}, ${contact.email}, 'manual', ${now}, ${now})
      `
    }
  }

  // Sample relationships (user to contacts)
  const sampleRelationships = [
    { contactId: 'contact-demo-001', strength: 5, type: 'colleague', howMet: 'Former team at startup' },
    { contactId: 'contact-demo-003', strength: 3, type: 'professional', howMet: 'Tech conference 2024' },
    { contactId: 'contact-demo-004', strength: 4, type: 'colleague', howMet: 'Previous company' },
    { contactId: 'contact-demo-005', strength: 2, type: 'acquaintance', howMet: 'LinkedIn connection' },
    { contactId: 'contact-demo-006', strength: 3, type: 'professional', howMet: 'Meetup group' },
    { contactId: 'contact-demo-007', strength: 4, type: 'friend', howMet: 'Hackathon partner' },
    { contactId: 'contact-demo-008', strength: 3, type: 'professional', howMet: 'Introduced by Lisa' },
  ]

  for (const rel of sampleRelationships) {
    const relId = `rel-demo-${rel.contactId}`
    const [existing] = await sql`SELECT id FROM relationships WHERE id = ${relId}`
    if (!existing) {
      await sql`
        INSERT INTO relationships (id, user_id, contact_a_id, is_user_relationship, relationship_type, strength, how_met, created_at, updated_at)
        VALUES (${relId}, ${userId}, ${rel.contactId}, true, ${rel.type}, ${rel.strength}, ${rel.howMet}, ${now}, ${now})
      `
    }
  }

  // Some contact-to-contact relationships for network graph
  const contactRelationships = [
    { from: 'contact-demo-001', to: 'contact-demo-003', strength: 4, type: 'colleague' },
    { from: 'contact-demo-001', to: 'contact-demo-008', strength: 3, type: 'friend' },
    { from: 'contact-demo-003', to: 'contact-demo-005', strength: 4, type: 'colleague' },
    { from: 'contact-demo-004', to: 'contact-demo-006', strength: 2, type: 'professional' },
    { from: 'contact-demo-005', to: 'contact-demo-007', strength: 3, type: 'colleague' },
  ]

  for (const rel of contactRelationships) {
    const relId = `rel-demo-${rel.from}-${rel.to}`
    const [existing] = await sql`SELECT id FROM relationships WHERE id = ${relId}`
    if (!existing) {
      await sql`
        INSERT INTO relationships (id, user_id, contact_a_id, contact_b_id, is_user_relationship, relationship_type, strength, created_at, updated_at)
        VALUES (${relId}, ${userId}, ${rel.from}, ${rel.to}, false, ${rel.type}, ${rel.strength}, ${now}, ${now})
      `
    }
  }

  console.log('Demo data initialized for user:', userId)
}

export default auth
