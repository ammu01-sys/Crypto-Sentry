import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET METHOD: Retrieve event logs for the authenticated user.
 * Endpoint: GET /api/logs
 */
export async function GET(_req: NextRequest) {
  try {
    // 1. SECURITY HANDSHAKE
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. FETCH LOGS
    // We return logs owned by this user, newest first.
    const logs = await prisma.eventLog.findMany({
      where: {
        OR: [
          { userId: (session.user as any).id },
          { userId: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to recent 50 events
    });

    return NextResponse.json({ success: true, data: logs }, { status: 200 });
  } catch (error) {
    console.error('Error fetching event logs:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
