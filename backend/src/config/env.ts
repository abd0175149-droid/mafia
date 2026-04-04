import { config } from 'dotenv';
config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://mafia_user:mafia_pass@localhost:5432/mafia_db',
  SESSION_SECRET: process.env.SESSION_SECRET || 'mafia-dev-secret-change-in-production',
  JWT_SECRET: process.env.JWT_SECRET || 'mafia-jwt-secret-change-in-production',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
} as const;

// Validation
const requiredInProduction: (keyof typeof env)[] = ['SESSION_SECRET', 'JWT_SECRET'];

if (env.NODE_ENV === 'production') {
  for (const key of requiredInProduction) {
    if (!env[key] || env[key] === '' || String(env[key]).includes('change-in-production')) {
      console.warn(`⚠️ Environment variable ${key} should be changed for production.`);
    }
  }
}
