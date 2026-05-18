// Dedicated environment loader — must be the FIRST import in server/index.ts.
// With ESM (module: esnext), static imports are hoisted before module body code,
// so dotenv.config() inside index.ts runs AFTER other modules like detector.ts
// have already created new PrismaClient() with no DATABASE_URL set.
// By isolating dotenv loading here and importing this file first, we guarantee
// environment variables are available before ANY other module is evaluated.
import dotenv from 'dotenv';

const result = dotenv.config();

if (result.error) {
  console.error('[ENV] Failed to load .env file:', result.error.message);
} else {
  console.log('[ENV] Environment variables loaded successfully.');
}

// Verify critical vars are present
const required = ['DATABASE_URL', 'NEXTAUTH_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[ENV] CRITICAL: Required environment variable "${key}" is missing!`);
    process.exit(1);
  }
}
