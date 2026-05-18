// API: create, fetch, and delete price-drop alert targets per authenticated user.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET METHOD: Retrieve registered alerts.
 * Endpoint: GET /api/alerts (or GET /api/alerts?assetId=bitcoin)
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
    const assetId = searchParams.get('assetId');

    // Fetch alerts filtered by user (mandatory) and asset if requested
    const alerts = await prisma.alert.findMany({
      where: {
        userId: (session.user as any).id,
        ...(assetId ? { assetId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: alerts }, { status: 200 });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST METHOD: Establish a new price drop alert.
 * Endpoint: POST /api/alerts
 * Payload: { "assetId": "bitcoin", "price": "96240.50", "dropPercentage": "5.0" }
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
    const { assetId, price, dropPercentage } = body;

    if (!assetId || price === undefined || dropPercentage === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters: assetId, price, dropPercentage',
        },
        { status: 400 }
      );
    }

    const cleanAssetId = assetId.toLowerCase().trim();

    const newAlert = await prisma.alert.create({
      data: {
        userId: (session.user as any).id,
        assetId: cleanAssetId,
        price: parseFloat(price),
        dropPercentage: parseFloat(dropPercentage),
      },
    });

    // 2. PERSISTENT AUDIT LOGGING
    // Log the establishment of the alert in the historical log table
    await prisma.eventLog.create({
      data: {
        userId: (session.user as any).id,
        assetId: cleanAssetId,
        event: 'ALERT_TRIGGERED', // Use unified event for log filtering
        message: `Security interceptor armed at $${parseFloat(price).toFixed(2)} (-${parseFloat(dropPercentage)}% threshold)`,
      },
    });

    return NextResponse.json({ success: true, data: newAlert }, { status: 201 });
  } catch (error) {
    console.error('Error establishing alert:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE METHOD: Disarm / remove an alert.
 * Endpoint: DELETE /api/alerts?id=UUID
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required query parameter: id',
        },
        { status: 400 }
      );
    }

    await prisma.alert.delete({
      where: { id },
    });

    return NextResponse.json(
      { success: true, message: 'Alert disarmed successfully.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error disarming alert:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
