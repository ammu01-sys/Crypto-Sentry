// Express surveillance engine entry point: boots the HTTP server, price fetcher, and alert detector.
// ==============================================================================
// SENTRY EXPRESS BACKEND ENGINE BOOTSTRAPPER (TYPESCRIPT)
// ==============================================================================
// This is the core entry point of your standalone background engine.
// It runs independently of Next.js, hosting a light REST API on Port 4000 while
// maintaining automated background poll intervals (fetchers & detectors).

// 1. ENVIRONMENT LOAD — MUST BE FIRST IMPORT
// env.ts guarantees dotenv runs before any module creates PrismaClient.
// With ESM hoisting, inline dotenv.config() is too late — Prisma would
// instantiate with no DATABASE_URL if env.ts isn't imported first.
import './env';

import express from 'express';
import cors from 'cors';
import logger from './utils/logger';
import cache from './services/cache';
import { startFetcher, stopFetcher } from './services/fetcher';
import { startDetector, stopDetector } from './services/detector';
import { PrismaClient } from '@prisma/client';

const app = express();
const PORT = process.env.PORT || 4000;
const prisma = new PrismaClient();

// ==============================================================================
// EXPRESS MIDDLEWARES (Security & Data Parsing)
// ==============================================================================

app.use(
  cors({
    origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json());

// Incoming request auditor
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// ==============================================================================
// API GATEWAY ROUTINGS
// ==============================================================================

// Route 1: Healthcheck API
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'Bitbash Crypto Sentry Express Engine is operational.',
    timestamp: new Date().toISOString(),
  });
});

// Route 2: System Status Monitor
app.get('/api/status', (req, res) => {
  res.status(200).json({
    success: true,
    engine: {
      name: 'bitbash-crypto-sentry-background-engine',
      version: '1.0.0',
      activePolling: true,
      activeDetector: true,
    },
    uptime: process.uptime(),
  });
});

// Route 3: Real-Time In-Memory Cache Viewer
app.get('/api/cache', (req, res) => {
  const cacheData = cache.getAll();
  res.status(200).json({
    success: true,
    cachedKeysCount: Object.keys(cacheData).length,
    cache: cacheData,
  });
});

// Route 4: Manual Alert Test — writes a real row to event_logs to verify DB write path
// Usage: GET http://localhost:4000/api/test-alert?userId=<any-valid-user-id>
app.get('/api/test-alert', async (req, res) => {
  const userId = req.query.userId as string | undefined;

  try {
    // If a userId is provided, write a real alert log
    if (userId) {
      const log = await prisma.eventLog.create({
        data: {
          userId,
          assetId: 'test-asset',
          event: 'SENTRY_TEST',
          message: '[SENTRY_TEST] BTC | Price: $99999.00 | 24h_Delta: -5.00% | Threshold: -2%',
          fingerprint: `test:${userId}:${Date.now()}`,
        },
      });
      logger.info(`[DB_TEST] Successfully wrote test alert log: ${log.id}`);
      return res.json({ success: true, message: 'Test alert written to DB.', logId: log.id });
    }

    // If no userId, just test DB connection
    const userCount = await prisma.user.count();
    return res.json({
      success: true,
      message: 'DB connection healthy.',
      userCount,
      hint: 'Add ?userId=<your-user-id> to write a test alert row.',
    });
  } catch (err: any) {
    logger.error(`[DB_TEST] DB write test failed: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// SERVER-WIDE UNHANDLED ERROR HANDLER
// ==============================================================================
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled Server Error: %O', err);
  res.status(500).json({
    success: false,
    error: 'Internal Background Engine Error.',
  });
});

// ==============================================================================
// SERVER LAUNCH & BACKGROUND SCHEDULERS
// ==============================================================================
const server = app.listen(PORT, () => {
  logger.info(`=======================================================`);
  logger.info(`  SENTRY EXPRESS ENGINE OPERATIONAL`);
  logger.info(`  Local:        http://localhost:${PORT}`);
  logger.info(`  Environment:  ${process.env.NODE_ENV || 'development'}`);
  logger.info(`=======================================================`);

  // Launch background trackers
  startFetcher(30000); // Poll CoinGecko and update price cache every 30s (30000ms)
  startDetector(30000); // Check database price alert thresholds every 30s (30000ms)

  // DB HEALTH CHECK — verify the Express server can read/write to PostgreSQL
  prisma.user.count()
    .then((count) => logger.info(`[DB_HEALTH] ✓ Connected to PostgreSQL — ${count} user(s) found.`))
    .catch((err) => logger.error(`[DB_HEALTH] ✗ Database connection FAILED: ${err.message} — Alerts will NOT be saved!`));
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use. Please terminate existing processes.`);
  } else {
    logger.error('Failed to start Express server: %O', err);
  }
  process.exit(1);
});

// ==============================================================================
// GRACEFUL SHUTDOWN HANDLERS (SIGINT/SIGTERM)
// ==============================================================================
const gracefulShutdown = () => {
  logger.info('Received shutdown signal. Commencing graceful termination...');

  stopFetcher(); // Stops active price polling
  stopDetector(); // Stops active alert scanner

  server.close(() => {
    logger.info('Express server closed. Node environment exited cleanly.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
