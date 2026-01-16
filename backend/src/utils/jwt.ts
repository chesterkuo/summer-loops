import * as jose from 'jose'

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

// Convert expiration string to seconds
function parseExpiration(exp: string): number {
  const match = exp.match(/^(\d+)(s|m|h|d)$/)
  if (!match) return 7 * 24 * 60 * 60 // Default 7 days

  const value = parseInt(match[1])
  const unit = match[2]

  switch (unit) {
    case 's': return value
    case 'm': return value * 60
    case 'h': return value * 60 * 60
    case 'd': return value * 24 * 60 * 60
    default: return 7 * 24 * 60 * 60
  }
}

const secret = new TextEncoder().encode(JWT_SECRET)
const expirationSeconds = parseExpiration(JWT_EXPIRES_IN)

export interface JWTPayload {
  userId: string
  email: string
  name: string
}

export async function generateToken(payload: JWTPayload): Promise<string> {
  const token = await new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expirationSeconds}s`)
    .setSubject(payload.userId)
    .sign(secret)

  return token
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret)

    return {
      userId: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string
    }
  } catch (error) {
    return null
  }
}

export function getExpirationMs(): number {
  return expirationSeconds * 1000
}
