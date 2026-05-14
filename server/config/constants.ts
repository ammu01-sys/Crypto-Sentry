// ==============================================================================
// CONFIGURATION CONSTANTS FOR CRYPTO SENTRY BACKGROUND ENGINE
// ==============================================================================

// Polling Configurations
export const POLLING_INTERVAL_MS = 5000; // Poll every 5 seconds

// Supported Crypto Ticker Presets
export const SUPPORTED_TOKENS = ['BTC', 'ETH', 'SOL'];

// API Configs (e.g. CoinGecko simple prices endpoints or similar stubs)
export const PRICE_FEED_URL = 'https://api.coingecko.com/api/v3/simple/price';

// Alert limits
export const MAX_ALERTS_PER_USER = 25;
