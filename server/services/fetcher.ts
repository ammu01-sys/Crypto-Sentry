// ==============================================================================
// BACKGROUND PRICING SYNCHRONIZER (TYPESCRIPT)
// ==============================================================================
// This service manages the automated polling loop that fetches live data from our
// CoinGecko client and caches the parsed values in memory for other services to use.

import logger from '../utils/logger';
import cache from './cache';
import { fetchAllMarkets } from './coingecko';

let isFetching = false; // Global execution lock to prevent parallel executions
let cycleCount = 0; // Keeps track of ticks to trigger split updates (full vs partial)

/**
 * Executes a single price synchronization check.
 * Gathers the latest prices and populates our memory cache.
 */
export async function pollPrices(): Promise<void> {
  if (isFetching) {
    logger.warn(
      'Previous background pricing synchronization is still running. Skipping this tick to prevent parallel overlap.'
    );
    return;
  }

  isFetching = true;
  logger.info('Background Price Fetcher starting CoinGecko synchronization...');

  try {
    // 1. Determine cycle type: Force full refresh on first boot (cycleCount === 0),
    // otherwise run a full refresh once every 10 cycles (5 minutes since tick interval is 30s).
    // All other cycles run a partial refresh (fetching page 1 only).
    const isCacheEmpty = cycleCount === 0;
    const isFullRefreshTime = cycleCount % 10 === 0;
    const fullRefresh = isCacheEmpty || isFullRefreshTime;

    logger.info(
      `Running ${fullRefresh ? 'FULL (up to 1000 assets)' : 'PARTIAL (top 250 assets)'} synchronization cycle...`
    );

    // Call fetchAllMarkets with fullRefresh parameters and bypassCache = true
    const markets = await fetchAllMarkets(fullRefresh, true);

    if (!markets || !Array.isArray(markets)) {
      logger.warn(
        'Received invalid or empty dataset from CoinGecko. Skipping memory cache synchronization.'
      );
      return;
    }

    // 2. Map & Cache retrieved items
    for (const coin of markets) {
      if (!coin.id) continue;

      cache.set(`price:${coin.id}`, {
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h,
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        image: coin.image, // NEW: Capture asset logo URL
      });
    }

    // Store global sync timestamp to monitor stale states
    cache.set('system:last_updated', Date.now());

    cycleCount++;
    logger.info(
      `Successfully synchronized ${markets.length} asset feeds in Memory Cache. Cycle Count: ${cycleCount}`
    );
  } catch (error: any) {
    logger.error('Failed to update background price feeds: %s', error.message || error);
  } finally {
    isFetching = false;
  }
}

// Global variable holding the running setInterval reference
let pollingIntervalId: NodeJS.Timeout | null = null;

/**
 * Mounts and triggers the recurring price fetcher schedule.
 *
 * @param intervalMs How often the poller should execute (Defaults to 30000ms)
 */
export function startFetcher(intervalMs = 30000): void {
  if (pollingIntervalId) return;

  // Sync prices immediately on server start
  pollPrices();

  // Schedule subsequent sync loops
  pollingIntervalId = setInterval(pollPrices, intervalMs);
  logger.info(`Background pricing feed scheduled to run every ${intervalMs}ms.`);
}

/**
 * Safely stops and clears the pricing loop.
 */
export function stopFetcher(): void {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
    logger.info('Background pricing feed stopped.');
  }
}
