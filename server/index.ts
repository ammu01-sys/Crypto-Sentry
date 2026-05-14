// ==============================================================================
// SENTRY EXPRESS BACKEND ENGINE BOOTSTRAPPER (TYPESCRIPT)
// ==============================================================================
// This is the core entry point of your standalone background engine.
// It runs independently of Next.js, hosting a light REST API on Port 4000 while
// maintaining automated background poll intervals (fetchers & detectors).

// 1. ENVIRONMENT LOAD
// Must run as the absolute first command! Loads configurations from .env
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import logger from './utils/logger';
import cache from './services/cache';
import { startFetcher, stopFetcher } from './services/fetcher';
import { startDetector, stopDetector } from './services/detector';

const app = express();
const PORT = process.env.PORT || 4000;

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
  logger.info(`  SENTRY EXPRESS ENGINE STARTED ON PORT ${PORT} `);
  logger.info(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`=======================================================`);

  // Launch background trackers
  startFetcher(30000); // Poll CoinGecko and update price cache every 30s (30000ms)
  startDetector(30000); // Check database price alert thresholds every 30s (30000ms)
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
