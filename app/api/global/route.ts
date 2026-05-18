// API: fetches global crypto market cap and 24h volume from CoinGecko with 60s in-process cache.
import { NextResponse } from 'next/server';

// Fallback static values when CoinGecko is unavailable
const FALLBACK = {
  totalMarketCap: 2_120_000_000_000,    // $2.12T
  totalVolume24h: 84_320_000_000,        // $84.32B
  marketCapChange24h: 1.84,              // +1.84%
};

// Simple in-process cache to avoid hammering CoinGecko on every poll
let cachedGlobal: typeof FALLBACK | null = null;
let cacheTs = 0;
const CACHE_TTL_MS = 60_000; // refresh at most once per minute

export async function GET() {
  try {
    const now = Date.now();

    if (cachedGlobal && now - cacheTs < CACHE_TTL_MS) {
      return NextResponse.json({ success: true, data: cachedGlobal, isMock: false });
    }

    const res = await fetch('https://api.coingecko.com/api/v3/global', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });

    if (!res.ok) throw new Error(`CoinGecko /global returned ${res.status}`);

    const json = await res.json();
    const d = json.data;

    const payload = {
      totalMarketCap: d.total_market_cap?.usd ?? FALLBACK.totalMarketCap,
      totalVolume24h: d.total_volume?.usd ?? FALLBACK.totalVolume24h,
      marketCapChange24h: d.market_cap_change_percentage_24h_usd ?? FALLBACK.marketCapChange24h,
    };

    cachedGlobal = payload;
    cacheTs = now;

    return NextResponse.json({ success: true, data: payload, isMock: false });
  } catch {
    return NextResponse.json({
      success: true,
      data: FALLBACK,
      isMock: true,
    });
  }
}

export const dynamic = 'force-dynamic';
