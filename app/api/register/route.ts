// API: registers new users with hashed password, validates email/username uniqueness.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Only letters, numbers, underscores, hyphens — 3 to 24 chars
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,24}$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, username } = body;

    // 1. Required fields
    if (!email || !password || !username) {
      return NextResponse.json(
        { success: false, error: 'Email, username, and password are all required.' },
        { status: 400 }
      );
    }

    const cleanEmail    = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    // 2. Email format
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address format.' },
        { status: 400 }
      );
    }

    // 3. Username format (3–24 chars, letters/numbers/underscore/hyphen)
    if (!USERNAME_REGEX.test(cleanUsername)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Username must be 3–24 characters and contain only letters, numbers, underscores, or hyphens.',
        },
        { status: 400 }
      );
    }

    // 4. Password length
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    // 5. Duplicate email check
    const emailConflict = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (emailConflict) {
      return NextResponse.json(
        { success: false, error: 'Account already exists with this email. Please log in.' },
        { status: 409 }
      );
    }

    // 6. Duplicate username check
    const usernameConflict = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });
    if (usernameConflict) {
      return NextResponse.json(
        { success: false, error: 'Username is already taken. Choose a different one.' },
        { status: 409 }
      );
    }

    // 7. Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        email:    cleanEmail,
        username: cleanUsername,
        password: hashedPassword,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Account created successfully.',
        user: { id: newUser.id, email: newUser.email, username: newUser.username },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error during registration.' },
      { status: 500 }
    );
  }
}
