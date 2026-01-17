import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://warmly_app:WarmlyApp2026@127.0.0.1:5432/warmly',
  },
  verbose: true,
  strict: true,
} satisfies Config
