import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateTwoFactorSecret, generateQRCode, verifyToken } from '@/lib/two-factor';

/**
 * GET: Generates 2FA secret and QR code for setup
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user.email;
    if (!userEmail) {
      return NextResponse.json({ success: false, error: 'Email missing' }, { status: 400 });
    }

    const secret = generateTwoFactorSecret();
    const qrCodeUrl = await generateQRCode(userEmail, secret);

    return NextResponse.json({ success: true, secret, qrCodeUrl });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST: Finalizes 2FA setup by verifying first code
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { secret, token } = await req.json();
    if (!secret || !token) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    const isValid = verifyToken(token, secret);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 400 });
    }

    const userId = (session.user as any).id;
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      },
    });

    return NextResponse.json({ success: true, message: '2FA_ENABLED_SUCCESSFULLY' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE: Disables 2FA for the user
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        trustedDeviceToken: null, // Clear trusted devices when 2FA is disabled
      },
    });

    return NextResponse.json({ success: true, message: '2FA_DISABLED_SUCCESSFULLY' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
