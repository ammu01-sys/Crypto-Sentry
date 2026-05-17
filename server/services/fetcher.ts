// ==============================================================================
// BACKGROUND SNAPSHOT SYNCHRONIZER (TYPESCRIPT)
// ==============================================================================
// This service manages the automated 30-second polling loop that fetches live 
// snapshots from CoinGecko and populates the global memory cache.

import logger from '../utils/logger';
import cache from './cache';
import { fetchMarketSnapshot } from './coingecko';

let isFetching = false; // Execution lock to prevent overlapping cycles

/**
 * Executes a fresh market snapshot synchronization.
 * Completely replaces relevant memory cache entries with new data.
 */
export async function pollPrices(): Promise<void> {
  if (isFetching) {
    logger.warn('Snapshot synchronization already in progress. Skipping cycle.');
    return;
  }

  isFetching = true;

  try {
    // 1. Fetch fresh top 20 snapshot
    const markets = await fetchMarketSnapshot();

    if (!markets || markets.length === 0) {
      logger.warn('Received empty snapshot. Cache remains unchanged.');
      return;
    }

    // 2. Deterministic Cache Update
    // We update the global cache with fresh values. 
    // Note: Other systems (like the detector) read from this global cache.
    for (const coin of markets) {
      cache.set(`price:${coin.id}`, {
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h,
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        image: coin.image,
      });
    }

    // Monitor system health via sync timestamp
    cache.set('system:last_updated', Date.now());

    logger.info(`Background Engine: Cache updated with fresh ${markets.length} coin snapshot.`);
  } catch (error: any) {
    logger.error('Background Snapshot Sync Failure: %s', error.message || error);
  } finally {
    isFetching = false;
  }
}

let pollingIntervalId: NodeJS.Timeout | null = null;

/**
 * Starts the 30-second snapshot synchronization loop.
 */
export function startFetcher(intervalMs = 30000): void {
  if (pollingIntervalId) return;

  // Run immediate first sync
  pollPrices();

  // Set deterministic interval
  pollingIntervalId = setInterval(pollPrices, intervalMs);
  logger.info(`Background Snapshot Synchronizer active (Interval: ${intervalMs}ms)`);
}

/**
 * Safely terminates the synchronization loop.
 */
export function stopFetcher(): void {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
    logger.info('Background Snapshot Synchronizer stopped.');
  }
}
