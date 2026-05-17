import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/user/avatar
 * Receives a base64 image string and stores it in the user's profile.
 * Max size: ~1MB base64 (~750KB raw image)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { imageBase64 } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ success: false, error: 'No image data received.' }, { status: 400 });
    }

    // Validate it's a real base64 image data URL
    if (!imageBase64.startsWith('data:image/')) {
      return NextResponse.json({ success: false, error: 'Invalid image format.' }, { status: 400 });
    }

    // Enforce a ~1MB limit (base64 is ~33% larger than raw)
    const MAX_SIZE = 1.4 * 1024 * 1024; // 1.4MB base64 ≈ ~1MB raw
    if (imageBase64.length > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'Image too large. Maximum size is 1MB.' }, { status: 413 });
    }

    // Save to DB
    await prisma.user.update({
      where: { id: userId },
      data: { image: imageBase64 },
    });

    return NextResponse.json({ success: true, image: imageBase64 }, { status: 200 });
  } catch (error) {
    console.error('[AVATAR] Upload error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * DELETE /api/user/avatar
 * Resets the user's avatar back to null (clears custom image).
 */
export async function DELETE(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    await prisma.user.update({
      where: { id: userId },
      data: { image: null },
    });

    return NextResponse.json({ success: true, message: 'Avatar cleared.' }, { status: 200 });
  } catch (error) {
    console.error('[AVATAR] Clear error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}
