// API: validates a submitted TOTP code and stamps the session as 2FA-verified.
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/two-factor';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { token, rememberDevice } = await req.json();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
    }

    const userId = (session.user as any).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true },
    });

    if (!user || !user.twoFactorSecret) {
      return NextResponse.json({ success: false, error: '2FA not enabled' }, { status: 400 });
    }

    const isValid = verifyToken(token, user.twoFactorSecret);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Invalid verification code' }, { status: 400 });
    }

    // If "Remember this device" is checked, issue a trusted device token
    if (rememberDevice) {
      const deviceToken = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: userId },
        data: { trustedDeviceToken: deviceToken },
      });

      // Set a long-lived secure cookie
      const cookieStore = await cookies();
      cookieStore.set('trusted_device', deviceToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });
    }

    return NextResponse.json({ success: true, message: 'VERIFICATION_SUCCESS' });
  } catch (error) {
    console.error('2FA Verification Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
