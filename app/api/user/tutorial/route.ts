import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST: Updates the hasSeenTutorial status for the current user
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    await (prisma.user as any).update({
      where: { id: userId },
      data: { hasSeenTutorial: true },
    });

    return NextResponse.json({ success: true, message: 'TUTORIAL_STATUS_UPDATED' });
  } catch (error) {
    console.error('Failed to update tutorial status:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
