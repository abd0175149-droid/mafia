import { config } from 'dotenv';
config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://mafia_user:mafia_pass@localhost:5432/mafia_db',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  SESSION_SECRET: process.env.SESSION_SECRET || 'mafia-dev-secret-change-in-production',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
} as const;

// Validation
const requiredInProduction: (keyof typeof env)[] = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'SESSION_SECRET'];

if (env.NODE_ENV === 'production') {
  for (const key of requiredInProduction) {
    if (!env[key] || env[key] === '') {
      console.error(`❌ Missing required environment variable: ${key}`);
      process.exit(1);
    }
  }
}
