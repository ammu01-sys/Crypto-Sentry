import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';

// Simple robust regex validation for email envelopes
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST METHOD: Registers a new security agent in the system.
 * Endpoint: POST /api/register
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // 1. PARAMETERS INTEGRITY CHECK
    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Both email and password fields are required to establish an identity node.',
        },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. INPUT ENVELOPE STRUCTURAL VALIDATIONS
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: 'Registration rejected: Invalid email address pattern.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Registration rejected: Passwords must be at least 6 characters long to secure encryption bounds.',
        },
        { status: 400 }
      );
    }

    // 3. COLLISION VERIFICATION (PREVENT DUPLICATES)
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Identity conflict: An agent has already claimed this credentials slot.',
        },
        { status: 409 }
      );
    }

    // 4. CRYPTOGRAPHIC PROTECTION LAYERS
    // Generate secure encryption salt and salt-hash on top of plain passwords
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 5. ATOMIC Supabase TRANSACTION
    const newUser = await prisma.user.create({
      data: {
        email: cleanEmail,
        password: hashedPassword,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Security credentials compiled successfully. Profile active.',
        user: {
          id: newUser.id,
          email: newUser.email,
          createdAt: newUser.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration processing fault:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Surveillance terminal registry crashed due to an internal server fault.',
      },
      { status: 500 }
    );
  }
}
