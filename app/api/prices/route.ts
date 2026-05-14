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

export async function GET() {
  const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/cache`;

  try {
    // Attempt to pull raw pricing cache records from Express Server
    const response = await fetch(backendUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Backend Cache API returned status: ${response.status}`);
    }

    const json = await response.json();

    // Supports both flat dictionary cache databases and nested formats:
    const cacheData = json.cache ? json.cache : json;
    const keys = Object.keys(cacheData);
    const priceKeys = keys.filter((key) => key.startsWith('price:'));

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
        };
      });

      const lastUpdated = cacheData['system:last_updated'] || Date.now();

      return NextResponse.json(
        {
          success: true,
          data,
          lastUpdated,
          isMock: false,
        },
        { status: 200 }
      );
    }

    throw new Error('Invalid database cache structures returned from Sentry backend.');
  } catch {
    // GRACEFUL RECOVERY FALLBACK: If Express is offline, drift mock dataset
    const data = Object.keys(currentBases).map((id) => {
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
        lastUpdated: 0, // 0 signals stale fallback
        isMock: true,
        fallbackMessage: 'Express backend unreachable. Serving local offline mock fallback.',
      },
      { status: 200 }
    );
  }
}

export const dynamic = 'force-dynamic';
