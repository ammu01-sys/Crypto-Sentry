// ==============================================================================
// ACTIVE PRICE ALERT TRIGGER DETECTOR (TYPESCRIPT)
// ==============================================================================
// This service runs a periodic background check that evaluates active user alerts
// against the live coin prices cached in memory.
//
// By reading the current price of an asset directly from our local memory cache,
// this evaluator runs instantly with near-zero latency, avoiding redundant database
// queries and protecting your server from API rate limits.

import logger from '../utils/logger';
import cache from './cache';
import { PrismaClient } from '@prisma/client';

// Instantiate Prisma Client for database scans
const prisma = new PrismaClient();

// Shape of cached prices inside memory
interface CachedPrice {
  price: number;
  change24h: number;
  name: string;
  symbol: string;
}

// State tracking to prevent redundant alert spam (Map: "userId:assetId:event" -> lastAlertState)
interface AlertState {
  price: number;
  change: number;
  timestamp: number;
}
const alertTracker = new Map<string, AlertState>();

/**
 * Pre-populates the in-memory tracker from the database to maintain deduplication across restarts.
 */
async function initializeCooldowns(): Promise<void> {
  try {
    const recentLogs = await prisma.eventLog.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 6 * 60 * 60 * 1000), // Check last 6 hours
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, assetId: true, event: true, message: true, createdAt: true },
    });

    for (const log of recentLogs) {
      if (log.userId) {
        const key = `${log.userId}:${log.assetId}:${log.event}`;
        if (!alertTracker.has(key)) {
          // Parse price and delta using the new standardized format
          const priceMatch = log.message.match(/Price: \$([0-9.-]+)/);
          const deltaMatch = log.message.match(/24h_Delta: ([0-9.-]+)%/);
          
          alertTracker.set(key, {
            price: priceMatch ? parseFloat(priceMatch[1]) : 0,
            change: deltaMatch ? parseFloat(deltaMatch[1]) : 0,
            timestamp: log.createdAt.getTime(),
          });
        }
      }
    }
    logger.info(`Initialized alert tracker with ${recentLogs.length} historical states.`);
  } catch (error) {
    logger.error('Failed to initialize alert tracker: %s', error);
  }
}

/**
 * Executes a global autonomous scan across all cached market assets.
 * Implements intelligent delta-based deduplication.
 */
export async function evaluateAlerts(): Promise<void> {
  logger.info('Executing global autonomous market surveillance scan...');

  try {
    const users = await (prisma as any).user.findMany({
      select: { id: true, globalThreshold: true },
    });

    const cachedData = cache.getAll();
    const priceKeys = Object.keys(cachedData).filter((k: string) => k.startsWith('price:'));

    if (priceKeys.length === 0 || users.length === 0) return;

    for (const key of priceKeys) {
      const assetId = key.replace('price:', '');
      const cached = cache.get<CachedPrice>(key);
      if (!cached) continue;

      const currentChange = cached.change24h;
      const currentPrice = cached.price;
      const symbol = cached.symbol.toUpperCase();

      let terminalLogIssued = false;

      for (const user of users) {
        const threshold = (user as any).globalThreshold;
        
        // Define surveillance tasks for this user/asset pair
        const tasks = [
          { type: 'SENTRY_DROP', active: threshold < 0 && currentChange <= threshold },
          { type: 'SENTRY_SPIKE', active: threshold > 0 && currentChange >= threshold },
          { type: 'SENTRY_VOLATILITY', active: Math.abs(currentChange) >= 15.0 },
        ];

        for (const task of tasks) {
          const trackerKey = `${user.id}:${assetId}:${task.type}`;

          if (!task.active) {
            // RESET LOGIC: Clear state if condition is no longer met
            alertTracker.delete(trackerKey);
            continue;
          }

          const lastState = alertTracker.get(trackerKey);
          const now = Date.now();

          // DEDUPLICATION & MOVEMENT VALIDATION
          let shouldAlert = !lastState;
          if (lastState) {
            const priceDelta = Math.abs(currentPrice - lastState.price) / (lastState.price || 1);
            const changeDelta = Math.abs(currentChange - lastState.change);
            const timeDelta = now - lastState.timestamp;

            // Trigger update if price moved >1% or delta moved >1% AND 10 mins passed
            if (timeDelta > 10 * 60 * 1000 && (priceDelta > 0.01 || changeDelta > 1.0)) {
              shouldAlert = true;
            }
          }

          if (shouldAlert) {
            const timeWindow = Math.floor(now / (30 * 60 * 1000));
            const fingerprint = `${user.id}:${assetId}:${task.type}:${timeWindow}`;

            try {
              const cleanMessage = `[${task.type}] ${symbol} | Price: $${currentPrice.toFixed(2)} | 24h_Delta: ${currentChange.toFixed(2)}% | Threshold: ${threshold}%`;

              await (prisma as any).eventLog.create({
                data: {
                  userId: user.id,
                  assetId,
                  event: task.type,
                  message: cleanMessage,
                  fingerprint,
                },
              });

              alertTracker.set(trackerKey, {
                price: currentPrice,
                change: currentChange,
                timestamp: now,
              });

              if (!terminalLogIssued) {
                logger.warn(`[SURVEILLANCE_BREACH] ${task.type} detected for ${symbol} @ threshold ${threshold}%. Syncing...`);
                terminalLogIssued = true;
              }
            } catch (dbError: any) {
              if (dbError.code === 'P2002') continue;
              throw dbError;
            }
          }
        }
      }
    }
  } catch (error: any) {
    logger.error('Sentry surveillance failure: %s', error.message || error);
  }
}

// Global variable holding the running setInterval reference
let evaluationIntervalId: NodeJS.Timeout | null = null;

/**
 * Mounts and starts the recurring alert evaluation schedule.
 *
 * @param intervalMs How often the detector should run (Defaults to 30000ms)
 */
export async function startDetector(intervalMs = 30000): Promise<void> {
  if (evaluationIntervalId) return;

  // Sync state from database to prevent duplicates across restarts
  await initializeCooldowns();

  // Execute initial scan immediately on server start
  evaluateAlerts();

  // Schedule subsequent scans
  evaluationIntervalId = setInterval(evaluateAlerts, intervalMs);
  logger.info(`Sentry trigger detector scheduled to run every ${intervalMs}ms.`);
}

/**
 * Safely stops and clears the alert evaluation loop.
 */
export function stopDetector(): void {
  if (evaluationIntervalId) {
    clearInterval(evaluationIntervalId);
    evaluationIntervalId = null;
    logger.info('Sentry trigger detector stopped.');
  }
}
