// ==============================================================================
// COINGECKO SNAPSHOT FETCHING ARCHITECTURE (TYPESCRIPT)
// ==============================================================================
// This service provides a deterministic, real-time snapshot of the top 20 
// cryptocurrencies by market cap. It avoids complex batching and pagination
// to ensure high reliability and low latency.

import axios from 'axios';
import logger from '../utils/logger';

// Define the CoinGecko Market asset model structure
export interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  image: string;
  [key: string]: any; 
}

// LOCAL SNAPSHOT CACHE
let snapshotCache: CoinGeckoMarket[] = [];
let lastSyncTimestamp = 0;

/**
 * Fetches a fresh snapshot of the top 20 coins from CoinGecko.
 * Completely replaces the existing cache with fresh data.
 */
export async function fetchMarketSnapshot(): Promise<CoinGeckoMarket[]> {
  const baseURL = process.env.COINGECKO_BASE_URL || 'https://api.coingecko.com/api/v3';
  const vsCurrency = process.env.COINGECKO_VS_CURRENCY || 'usd';

  logger.info('Initiating fresh CoinGecko market snapshot (Top 20 coins)...');

  try {
    const response = await axios.get<CoinGeckoMarket[]>(`${baseURL}/coins/markets`, {
      params: {
        vs_currency: vsCurrency,
        order: 'market_cap_desc',
        per_page: 20,
        page: 1,
        sparkline: false,
      },
      headers: {
        Accept: 'application/json',
      },
      timeout: 10000, 
    });

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Invalid response format from CoinGecko');
    }

    // SNAPSHOT REPLACEMENT: Completely overwrite the cache with new data
    snapshotCache = response.data;
    lastSyncTimestamp = Date.now();

    logger.info(`Successfully synchronized snapshot of ${snapshotCache.length} assets.`);
    return snapshotCache;
  } catch (error: any) {
    logger.error('Failed to fetch CoinGecko market snapshot: %s', error.message || error);
    // Return existing cache on failure (Stale but deterministic)
    return snapshotCache;
  }
}

/**
 * Returns the currently cached snapshot.
 */
export function getCachedSnapshot(): CoinGeckoMarket[] {
  return snapshotCache;
}

/**
 * Returns the timestamp of the last successful sync.
 */
export function getLastSyncTime(): number {
  return lastSyncTimestamp;
}
