import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET METHOD: Retrieve a specific user's watchlist.
 * Endpoint: GET /api/watchlist?userId=...
 */
export async function GET(req: NextRequest) {
  try {
    // 1. SECURITY HANDSHAKE (SESSION VERIFICATION)
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Access is restricted to authenticated Sentry agents.',
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    // CROSS-TENANT SECURITY GUARD: Ensure logged-in user can only query their own data slot
    if (userId !== (session.user as { id: string }).id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: Cross-tenant node surveillance scans are prohibited.',
        },
        { status: 403 }
      );
    }

    // Fetch from physical table "wishlists" (mapped to wishlist in Prisma)
    const watchlist = await prisma.wishlist.findMany({
      where: { userId },
      orderBy: { assetId: 'asc' },
    });

    return NextResponse.json({ success: true, data: watchlist }, { status: 200 });
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST METHOD: Add a new coin to a user's watchlist.
 * Endpoint: POST /api/watchlist
 * Payload: { "userId": "...", "assetId": "bitcoin", "assetName": "Bitcoin" }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. SECURITY HANDSHAKE (SESSION VERIFICATION)
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Access is restricted to authenticated Sentry agents.',
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { userId, assetId, assetName } = body;

    if (!userId || !assetId || !assetName) {
      return NextResponse.json(
        { success: false, error: 'User ID, assetId, and assetName are required' },
        { status: 400 }
      );
    }

    // CROSS-TENANT SECURITY GUARD: Ensure user can only insert records under their own account
    if (userId !== (session.user as { id: string }).id) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Forbidden: You cannot modify surveillance properties belonging to other accounts.',
        },
        { status: 403 }
      );
    }

    // Pre-emptively validate that the userId exists in the database to prevent P2003 foreign key violations
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid supervisor session. No security agent registered under ID: ${userId}`,
        },
        { status: 403 }
      );
    }

    const cleanAssetId = assetId.toLowerCase().trim();
    const cleanAssetName = assetName.trim();

    // Check duplicate using Prisma wishlist model
    const existingItem = await prisma.wishlist.findUnique({
      where: {
        userId_assetId: {
          userId,
          assetId: cleanAssetId,
        },
      },
    });

    if (existingItem) {
      return NextResponse.json(
        { success: false, error: 'Asset already exists in watchlist' },
        { status: 409 }
      );
    }

    const newItem = await prisma.wishlist.create({
      data: {
        userId,
        assetId: cleanAssetId,
        assetName: cleanAssetName,
      },
    });

    return NextResponse.json({ success: true, data: newItem }, { status: 201 });
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE METHOD: Remove a coin from a user's watchlist.
 * Endpoint: DELETE /api/watchlist?userId=...&assetId=...
 */
export async function DELETE(req: NextRequest) {
  try {
    // 1. SECURITY HANDSHAKE (SESSION VERIFICATION)
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Access is restricted to authenticated Sentry agents.',
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const assetId = searchParams.get('assetId');

    if (!userId || !assetId) {
      return NextResponse.json(
        { success: false, error: 'User ID and assetId are required' },
        { status: 400 }
      );
    }

    // CROSS-TENANT SECURITY GUARD: Ensure user can only delete their own watchlist nodes
    if (userId !== (session.user as { id: string }).id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: You cannot terminate security feeds belonging to other accounts.',
        },
        { status: 403 }
      );
    }

    const cleanAssetId = assetId.toLowerCase().trim();

    await prisma.wishlist.delete({
      where: {
        userId_assetId: {
          userId,
          assetId: cleanAssetId,
        },
      },
    });

    return NextResponse.json({ success: true, message: 'Removed from watchlist' }, { status: 200 });
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
