/**
 * DASHBOARD MAIN PAGE
 * This is the primary protected route of the application.
 * It serves as a container that checks for a valid user session 
 * before rendering the interactive Dashboard Client.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import DashboardClient from './_components/DashboardClient';
import { redirect } from 'next/navigation';

export default async function Page() {
  // 1. ACQUIRE CURRENT AUTHENTICATED AGENT CONTEXT
  // We check for the session on the SERVER side. 
  // This is faster and more secure than checking on the client.
  const session = await getServerSession(authOptions);

  // 2. PROTECTED ROUTE LOGIC
  // If no user is found, we immediately redirect to login.
  // This prevents unauthenticated users from seeing the dashboard layout.
  if (!session || !session.user) {
    redirect('/login');
  }

  const userId = (session.user as any).id;

  // 3. CONCURRENT PRISMA TELEMETRY QUERYING
  // Triggers parallel lookups to minimize server-side latency
  const watchlistRows = await prisma.wishlist.findMany({
    where: { userId },
    orderBy: { assetId: 'asc' },
  });

  const watchedAssetIds = watchlistRows.map((r) => r.assetId);

  const [logRows, userData] = await Promise.all([
    prisma.eventLog.findMany({
      where: {
        userId,
        assetId: { in: watchedAssetIds },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    (prisma as any).user.findUnique({
      where: { id: userId },
      select: { globalThreshold: true, hasSeenTutorial: true, image: true },
    }),
  ]);

  // Map database wishlist rows to clean Watchlist structures
  const initialWatchlist = watchlistRows.map((row) => ({
    id: row.id,
    assetId: row.assetId,
    assetName: row.assetName,
  }));

  // Initial prices corresponding to mock data structure for pre-load hydrate
  const initialPrices = [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', price: 96240.5, change24h: 3.42 },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', price: 3412.18, change24h: -1.25 },
    { id: 'solana', name: 'Solana', symbol: 'SOL', price: 184.95, change24h: 12.84 },
    { id: 'ripple', name: 'Ripple', symbol: 'XRP', price: 2.42, change24h: 4.88 },
    { id: 'cardano', name: 'Cardano', symbol: 'ADA', price: 0.94, change24h: -2.15 },
    { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', price: 0.39, change24h: 18.54 },
    { id: 'avalanche', name: 'Avalanche', symbol: 'AVAX', price: 32.8, change24h: -5.4 },
    { id: 'chainlink', name: 'Chainlink', symbol: 'LINK', price: 17.65, change24h: 1.12 },
    { id: 'polkadot', name: 'Polkadot', symbol: 'DOT', price: 5.88, change24h: -0.45 },
    { id: 'near', name: 'Near', symbol: 'NEAR', price: 5.44, change24h: 8.92 },
  ];

  return (
    <DashboardClient
      userId={userId}
      userName={(session.user as any).username || session.user.name || 'Agent'}
      userEmail={session.user.email || ''}
      userImage={(userData as any)?.image || session.user.image || undefined}
      initialWatchlist={initialWatchlist}
      initialEventLogs={logRows}
      initialPrices={initialPrices}
      initialThreshold={(userData as any)?.globalThreshold ?? -2.0}
      hasSeenTutorial={(userData as any)?.hasSeenTutorial ?? false}
    />
  );
}
export const dynamic = 'force-dynamic';
