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
/**
 * THE SURVEILLANCE SCANNER
 * This loop runs every 30 seconds and acts like a security guard.
 * It checks EVERY user's alert limits against the LIVE prices in our memory cache.
 */
export async function evaluateAlerts(): Promise<void> {
  logger.info('[DETECTOR] ─── Surveillance scan starting ───');

  try {
    // 1. GATHER DATA
    // Fetch all users and their global watchlist mapping in bulk
    const [users, watchlists] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, globalThreshold: true },
      }),
      prisma.wishlist.findMany({
        select: { userId: true, assetId: true },
      }),
    ]);

    logger.info(`[DETECTOR] Found ${users.length} user(s), ${watchlists.length} watchlist item(s) in DB.`);

    // Map watchlists by user for O(1) lookup: userId -> Set of assetIds
    const watchlistMap = new Map<string, Set<string>>();
    for (const item of watchlists) {
      if (!watchlistMap.has(item.userId)) {
        watchlistMap.set(item.userId, new Set());
      }
      watchlistMap.get(item.userId)?.add(item.assetId);
    }

    const cachedData = cache.getAll();
    const priceKeys = Object.keys(cachedData).filter((k: string) => k.startsWith('price:'));

    logger.info(`[DETECTOR] Price cache has ${priceKeys.length} coin(s): [${priceKeys.map(k => k.replace('price:', '')).join(', ')}]`);

    if (priceKeys.length === 0) {
      logger.warn('[DETECTOR] ⚠ No prices in cache yet — Express backend may still be fetching from CoinGecko. Skipping scan.');
      return;
    }

    if (users.length === 0) {
      logger.warn('[DETECTOR] ⚠ No users found in DB. Skipping scan.');
      return;
    }

    // 2. THE SCAN LOOP
    // For every coin in our price snapshot...
    for (const key of priceKeys) {
      const assetId = key.replace('price:', '');
      const cached = cache.get<CachedPrice>(key);
      if (!cached) continue;

      const currentChange = cached.change24h;
      const currentPrice = cached.price;
      const symbol = cached.symbol.toUpperCase();

      let terminalLogIssued = false;

      // ...and for every user in the system...
      for (const user of users) {
        // WATCHLIST FILTER: Only proceed if the user is actively watching this asset
        const userWatchlist = watchlistMap.get(user.id);
        if (!userWatchlist || !userWatchlist.has(assetId)) {
          continue;
        }

        const threshold = user.globalThreshold;

        // 3. DEFINE THE "CRIMES" (Triggers)
        const tasks = [
          { type: 'SENTRY_DROP', active: threshold < 0 && currentChange <= threshold },
          { type: 'SENTRY_SPIKE', active: threshold > 0 && currentChange >= threshold },
          { type: 'SENTRY_VOLATILITY', active: Math.abs(currentChange) >= 15.0 },
        ];

        // DIAGNOSTIC: Log evaluation result for every user/coin match
        logger.info(
          `[DETECTOR] User ${user.id.slice(0,8)} | ${symbol} | ` +
          `24h: ${currentChange.toFixed(2)}% | threshold: ${threshold}% | ` +
          `DROP=${tasks[0].active} SPIKE=${tasks[1].active} VOLATILITY=${tasks[2].active}`
        );

        for (const task of tasks) {
          const trackerKey = `${user.id}:${assetId}:${task.type}`;

          if (!task.active) {
            alertTracker.delete(trackerKey);
            continue;
          }

          const lastState = alertTracker.get(trackerKey);
          const now = Date.now();

          // 4. DEDUPLICATION (The "Anti-Spam" Logic)
          let shouldAlert = !lastState;
          if (lastState) {
            const priceDelta = Math.abs(currentPrice - lastState.price) / (lastState.price || 1);
            const changeDelta = Math.abs(currentChange - lastState.change);
            const timeDelta = now - lastState.timestamp;

            if (timeDelta > 10 * 60 * 1000 && (priceDelta > 0.01 || changeDelta > 1.0)) {
              shouldAlert = true;
            } else {
              logger.debug(
                `[DETECTOR] Suppressed duplicate ${task.type} for ${symbol} — timeDelta: ${Math.round(timeDelta/1000)}s, priceDelta: ${(priceDelta*100).toFixed(2)}%`
              );
            }
          }

          if (shouldAlert) {
            const timeWindow = Math.floor(now / (30 * 60 * 1000));
            const fingerprint = `${user.id}:${assetId}:${task.type}:${timeWindow}`;

            try {
              const cleanMessage = `[${task.type}] ${symbol} | Price: $${currentPrice.toFixed(2)} | 24h_Delta: ${currentChange.toFixed(2)}% | Threshold: ${threshold}%`;

              // 5. RECORD THE EVENT
              await prisma.eventLog.create({
                data: {
                  userId: user.id,
                  assetId,
                  event: task.type,
                  message: cleanMessage,
                  fingerprint,
                },
              });

              logger.warn(`[ALERT_SAVED] ${task.type} for ${symbol} saved to DB for user ${user.id.slice(0,8)}.`);
            } catch (dbError: any) {
              if (dbError.code === 'P2002') {
                // Fingerprint already exists in DB for this 30-min window — not an error, just skip
                logger.debug(`[DETECTOR] Fingerprint collision for ${task.type}/${symbol} — already logged this window.`);
              } else {
                // Real DB error — surface it so we can diagnose
                logger.error(`[DETECTOR] DB write failed for ${task.type}/${symbol}: ${dbError.message}`);
              }
            }

            // Always update in-memory tracker regardless of DB outcome
            alertTracker.set(trackerKey, {
              price: currentPrice,
              change: currentChange,
              timestamp: now,
            });

            if (!terminalLogIssued) {
              logger.warn(`[WATCHLIST_BREACH] ${task.type} detected for ${symbol} on user ${user.id}.`);
              terminalLogIssued = true;
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
