import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';
import bcrypt from 'bcrypt';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authOptions: NextAuthOptions = {
  // Using PrismaAdapter to automatically manage Users, Accounts, and Sessions in PostgreSQL
  adapter: PrismaAdapter(prisma),

  providers: [
    // 1. Google Authentication Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true, // Link Google accounts to existing email-based accounts
      authorization: {
        params: {
          access_type: "offline",
          response_type: "code"
        }
      }
    }),

    // 2. Custom Credentials Provider (Email/Username + Password)
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        identifier: { label: 'Email or Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error('Please enter your email or username and password.');
        }

        const identifier = credentials.identifier.trim();
        const isEmail = EMAIL_REGEX.test(identifier);

        const user = (isEmail
          ? await prisma.user.findUnique({ where: { email: identifier.toLowerCase() } })
          : await prisma.user.findUnique({ where: { username: identifier } })) as any;

        if (!user) {
          throw new Error('No account found with that email or username. Please sign up.');
        }

        if (!user.password) {
          // Account exists but was created via OAuth (no password stored).
          // Show a generic error — never reveal which provider was used.
          throw new Error('Invalid credentials. Please check your details and try again.');
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
        if (!isPasswordValid) {
          throw new Error('Invalid credentials. Please check your password.');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.username,
          username: user.username,
          twoFactorEnabled: user.twoFactorEnabled,
          hasSeenTutorial: user.hasSeenTutorial,
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days persistence
    updateAge: 24 * 60 * 60,   // Update session every 24 hours
  },

  callbacks: {
    async jwt({ token, user, account, trigger }) {
      const { cookies } = await import('next/headers');

      if (user) {
        token.id = user.id;
        token.username = (user as any).username || (user as any).name || '';
        token.twoFactorEnabled = (user as any).twoFactorEnabled || false;
        token.is2FAVerified = !(user as any).twoFactorEnabled;
        token.hasSeenTutorial = (user as any).hasSeenTutorial ?? false;

        // Always fetch the latest profile from DB on sign-in to ensure accuracy
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { username: true, twoFactorEnabled: true, hasSeenTutorial: true, trustedDeviceToken: true }
        }) as any;

        if (!dbUser) {
          // User was deleted right at sign-in moment
          return token;
        }

        // Overwrite with authoritative DB values
        if (dbUser.username) token.username = dbUser.username;
        token.twoFactorEnabled = dbUser.twoFactorEnabled;
        token.hasSeenTutorial = dbUser.hasSeenTutorial ?? false; // KEY: always fresh from DB

        // TRUSTED DEVICE CHECK
        if (dbUser.twoFactorEnabled) {
          const cookieStore = await cookies();
          const trustedToken = cookieStore.get('trusted_device')?.value;
          if (trustedToken && dbUser.trustedDeviceToken === trustedToken) {
            token.is2FAVerified = true;
          }
        }
      }

      if (account) {
        token.provider = account.provider;
      }

      // Handle custom updates (e.g., after successful 2FA verification or tutorial completion)
      if (trigger === "update" && token) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { hasSeenTutorial: true }
        }) as any;

        if (dbUser) {
          token.hasSeenTutorial = dbUser.hasSeenTutorial;
        }

        // Always mark as verified if we are updating (usually happens after 2FA)
        token.is2FAVerified = true;
      }

      return token;
    },

    async session({ session, token }) {
      // SECURITY: Validate user existence in DB on every session restore
      // This prevents "orphaned sessions" where a user is deleted from DB but has a valid JWT
      const dbUser = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { id: true }
      });

      if (!dbUser) {
        console.warn(`[AUTH] Orphaned session detected for user ${token.id}. Invalidating...`);
        return null as any; // Forces logout in NextAuth
      }

      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).username = token.username as string;
        (session.user as any).is2FAVerified = token.is2FAVerified as boolean;
        (session.user as any).twoFactorEnabled = token.twoFactorEnabled as boolean;
        (session.user as any).hasSeenTutorial = token.hasSeenTutorial as boolean;
        (session.user as any).provider = token.provider as string;
      }
      return session;
    },

    async signIn({ user, account, profile }) {
      console.log('[AUTH_DIAGNOSTIC] SignIn Triggered:', { email: user.email, provider: account?.provider });

      // 1. Google OAuth Flow
      if (account?.provider === 'google') {
        if (!user.email) {
          console.error('[AUTH_DIAGNOSTIC] Google login failed: No email provided.');
          return false;
        }

        // Check if the user already exists in our database
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, username: true }
        });

        console.log('[AUTH_DIAGNOSTIC] Database check result:', existingUser);

        // CASE A: NEW USER (Sign Up)
        if (!existingUser) {
          console.log(`[AUTH_DIAGNOSTIC] First-time Google user detected: ${user.email}. Allowing account creation.`);
          return true;
        }

        // CASE B: EXISTING USER (Login)
        console.log(`[AUTH_DIAGNOSTIC] Existing Google user verified: ${user.email}.`);
      }
      return true;
    },
  },

  events: {
    async signIn({ user, account }) {
      // 1. Fetch current database state to check for missing username
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { username: true, email: true }
      });

      const dataToUpdate: any = { lastLoginAt: new Date() };

      // 2. Automated Username Patch: If the user (e.g. from Google) has no username, assign their display name
      if (dbUser && !dbUser.username) {
        // Prefer the exact display name provided by Google. If not available, use the email prefix.
        let baseName = (user as any).name?.trim() || (dbUser.email ?? 'user').split('@')[0];
        // Clean up the name to be URL-safe and remove spaces
        baseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

        // Check if this username is already taken
        let finalUsername = baseName;
        let suffix = 1;
        let usernameExists = true;

        while (usernameExists) {
          const existing = await prisma.user.findUnique({
            where: { username: finalUsername },
            select: { id: true }
          });

          if (existing) {
            finalUsername = `${baseName}_${suffix}`;
            suffix++;
          } else {
            usernameExists = false;
          }
        }

        dataToUpdate.username = finalUsername;
        console.log(`[AUTH_DIAGNOSTIC] Patched missing username for ${dbUser.email}: ${dataToUpdate.username}`);
      }

      // 3. Record telemetry and sync profile
      await (prisma.user as any).update({
        where: { id: user.id },
        data: dataToUpdate,
      });
    },
  },

  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
};
