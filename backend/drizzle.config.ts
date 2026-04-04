import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schemas/drizzle.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://mafia_user:mafia_pass@localhost:5432/mafia_db',
  },
});
