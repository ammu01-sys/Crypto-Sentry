import { NextResponse } from 'next/server';

// 1. BASELINE VALUE CONFIGURATION (Fallback Mock Dataset)
const initialBases: Record<string, number> = {
  bitcoin: 80245.0,
  ethereum: 2292.65,
  solana: 88.65,
  ripple: 2.42,
  cardano: 0.94,
  dogecoin: 0.39,
  avalanche: 32.8,
  chainlink: 17.65,
  polkadot: 5.88,
  near: 5.44,
};

const initialChanges: Record<string, number> = {
  bitcoin: 3.42,
  ethereum: -1.25,
  solana: 12.84,
  ripple: 4.88,
  cardano: -2.15,
  dogecoin: 18.54,
  avalanche: -5.4,
  chainlink: 1.12,
  polkadot: -0.45,
  near: 8.92,
};

const currentBases = { ...initialBases };
const currentChanges = { ...initialChanges };

const assetMetadata: Record<string, { name: string; symbol: string }> = {
  bitcoin: { name: 'Bitcoin', symbol: 'BTC' },
  ethereum: { name: 'Ethereum', symbol: 'ETH' },
  solana: { name: 'Solana', symbol: 'SOL' },
  ripple: { name: 'Ripple', symbol: 'XRP' },
  cardano: { name: 'Cardano', symbol: 'ADA' },
  dogecoin: { name: 'Dogecoin', symbol: 'DOGE' },
  avalanche: { name: 'Avalanche', symbol: 'AVAX' },
  chainlink: { name: 'Chainlink', symbol: 'LINK' },
  polkadot: { name: 'Polkadot', symbol: 'DOT' },
  near: { name: 'Near', symbol: 'NEAR' },
};

/**
 * GET METHOD: Retrieve Live Pricing Data
 * This API acts as a "Proxy." Instead of asking CoinGecko directly (which is slow),
 * it asks our background Express engine for the cached prices.
 */
export async function GET() {
  // The URL of our background engine's memory cache
  const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/cache`;

  try {
    // 1. ATTEMPT TO FETCH FROM BACKGROUND CACHE
    // We use 'no-store' to ensure we always get the absolute latest prices from the engine.
    const response = await fetch(backendUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Backend Cache API returned status: ${response.status}`);
    }

    const json = await response.json();
    const cacheData = json.cache ? json.cache : json;
    const keys = Object.keys(cacheData);
    const priceKeys = keys.filter((key) => key.startsWith('price:'));

    // 2. DATA TRANSFORMATION
    // We convert the raw cache data into a clean format that the UI can easily map over.
    if (priceKeys.length > 0) {
      const data = priceKeys.map((key) => {
        const id = key.replace('price:', '');
        const val = cacheData[key];
        return {
          id,
          name: val.name || id,
          symbol: val.symbol || id.toUpperCase(),
          price: parseFloat(val.price || 0),
          change24h: parseFloat(val.change24h || 0),
          image: val.image || null,   // ← coin logo URL from CoinGecko
        };
      });

      const lastUpdated = cacheData['system:last_updated'] || Date.now();

      return NextResponse.json(
        {
          success: true,
          data,
          lastUpdated,
          isMock: false, // Signals the UI that this is REAL data
        },
        { status: 200 }
      );
    }

    throw new Error('Invalid database cache structures.');
  } catch (error) {
    // 3. GRACEFUL RECOVERY (Offline Fallback)
    // If the Express backend is offline, we don't show an error.
    // Instead, we "drift" a mock dataset so the UI still looks alive.
    const data = Object.keys(currentBases).map((id) => {
      // Create a tiny bit of random movement so prices "tick" in the UI
      const drift = Math.random() * 0.003 - 0.0015;
      currentBases[id] += currentBases[id] * drift;
      currentChanges[id] += drift * 100;

      const isLowDenom = id === 'ripple' || id === 'cardano' || id === 'dogecoin';
      const precision = isLowDenom ? 4 : 2;

      return {
        id,
        name: assetMetadata[id]?.name || id,
        symbol: assetMetadata[id]?.symbol || id.toUpperCase(),
        price: parseFloat(currentBases[id].toFixed(precision)),
        change24h: parseFloat(currentChanges[id].toFixed(2)),
      };
    });

    return NextResponse.json(
      {
        success: true,
        data,
        lastUpdated: 0, 
        isMock: true, // Signals the UI that we are in "Offline/Demo" mode
        fallbackMessage: 'Serving local offline mock fallback.',
      },
      { status: 200 }
    );
  }
}


export const dynamic = 'force-dynamic';
