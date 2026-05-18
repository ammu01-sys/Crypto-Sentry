// Custom hook: polls /api/prices every 5s, maintains sparkline history, and streams live coin prices to the UI.
'use client';

import { useState, useEffect } from 'react';

export interface PriceData {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  image?: string; // Captured logo URL
  history: number[]; // List of historical prices for animating mini-sparklines
}

export function usePriceTicker(
  initialPrices: {
    id: string;
    name: string;
    symbol: string;
    price: number;
    change24h: number;
  }[]
) {
  const [prices, setPrices] = useState<PriceData[]>(() => {
    // Generate pre-loaded, realistic historic price logs so sparklines render fully populated on load
    return initialPrices.map((p) => {
      const history: number[] = [];
      let base = p.price;
      // Walk backwards to create a natural-looking mock history trail
      for (let i = 0; i < 12; i++) {
        base = base - base * (Math.random() * 0.006 - 0.003);
        history.unshift(parseFloat(base.toFixed(2)));
      }
      return {
        ...p,
        history,
      };
    });
  });

  const isLoading = false;
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [cacheTimestamp, setCacheTimestamp] = useState<number>(Date.now());
  const [isMock, setIsMock] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    const fetchLivePrices = async () => {
      setIsPolling(true);
      try {
        const response = await fetch('/api/prices');
        const payload = await response.json();

        if (active && payload.success && Array.isArray(payload.data)) {
          setPrices((prevPrices) => {
            return payload.data.map((liveCoin: any) => {
              const matchedPrev = prevPrices.find((p) => p.id === liveCoin.id);
              const updatedHistory = matchedPrev ? [...matchedPrev.history] : [];

              if (updatedHistory.length === 0) {
                // Fallback: seed history if none existed
                let base = liveCoin.price;
                for (let i = 0; i < 12; i++) {
                  base = base - base * (Math.random() * 0.004 - 0.002);
                  updatedHistory.unshift(parseFloat(base.toFixed(2)));
                }
              }

              // Push latest price tick & prune older ticks to maintain 12 maximum data nodes
              updatedHistory.push(liveCoin.price);
              if (updatedHistory.length > 12) {
                updatedHistory.shift();
              }

              return {
                id: liveCoin.id,
                name: liveCoin.name,
                symbol: liveCoin.symbol,
                price: liveCoin.price,
                change24h: liveCoin.change24h,
                image: liveCoin.image,
                history: updatedHistory,
              };
            });
          });

          setLastUpdated(new Date());
          setCacheTimestamp(payload.lastUpdated || 0);
          setIsMock(!!payload.isMock);
        }
      } catch (error) {
        console.error('Error polling pricing data from cache endpoint:', error);
      } finally {
        if (active) {
          setIsPolling(false);
        }
      }
    };

    // Poll every 5000 milliseconds (5 seconds)
    const pollingInterval = setInterval(fetchLivePrices, 5000);

    // Initial fetch to align instantly
    fetchLivePrices();

    return () => {
      active = false;
      clearInterval(pollingInterval);
    };
  }, []);

  return { prices, isLoading, lastUpdated, cacheTimestamp, isMock, isPolling };
}

export default usePriceTicker;
