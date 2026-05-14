// ==============================================================================
// NEXTAUTH MIDDLEWARE SECURITY CONFIGURATION
// ==============================================================================
// NextAuth coordinates user logins, issues secure HTTP-only cookies, and manages
// active sessions across both your API routes and your React components.
//
// This configuration file defines:
// 1. CredentialsProvider: How to securely authorize users using their email/password.
// 2. JWT & Session Callbacks: How to pass the user's database ID to the browser.
// 3. custom sign-in/error pages.

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma'; // Reuses our global database connector singleton
import bcrypt from 'bcrypt'; // Library used to securely hash and compare passwords

export const authOptions: NextAuthOptions = {
  // 1. LOGIN PROVIDERS
  // Defines how users are allowed to register or sign in. We are using Credentials (Email & Password).
  providers: [
    CredentialsProvider({
      name: 'Credentials', // Label used for NextAuth default internal forms
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'user@example.com' },
        password: { label: 'Password', type: 'password' },
      },

      // AUTHORIZATION ENGINE:
      // This function executes automatically whenever a login attempt is submitted to Next.js.
      async authorize(credentials) {
        // A. Parameters Validation: Check if the user input fields are filled
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter both email and password.');
        }

        // B. Database Query: Search Supabase to see if the user exists
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        // C. Existence Check: Stop if no account was found with that email
        if (!user) {
          throw new Error('No user found with this email.');
        }

        // D. Password Decryption Check:
        // We never store plain passwords. This function takes the plain text password
        // entered by the user, encrypts it on the fly usingbcrypt's hashing factors,
        // and checks if the result matches the database string.
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error('Incorrect password.');
        }

        // E. Return User Profile:
        // If everything checks out, return the user object. NextAuth will compile this
        // object inside a secure JSON Web Token (JWT).
        return {
          id: user.id,
          email: user.email,
        };
      },
    }),
  ],

  // 2. SESSION CONSTRAINTS
  session: {
    strategy: 'jwt', // We are using stateless JSON Web Tokens for fast session checks
    maxAge: 30 * 24 * 60 * 60, // Session Token Validity Duration: 30 Days (Seconds)
  },

  // 3. SECURITY CALLBACKS (JWT & Session Mapping)
  callbacks: {
    // CALLBACK A: JSON WEB TOKEN
    // Runs automatically whenever a JWT token is created or read on the backend.
    // We intercept this token and attach the user's unique database ID ('id') to it.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    // CALLBACK B: ACTIVE CLIENT SESSION
    // Runs whenever a client-side component queries 'useSession()' or 'getSession()'.
    // We read the user's ID from our secure backend JWT token and expose it to the
    // frontend browser session safely.
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id as string;
      }
      return session;
    },
  },

  // 4. NEXTAUTH SECRET KEY
  // Used to digitally sign and encrypt your session cookies, protecting them from tampering.
  secret: process.env.NEXTAUTH_SECRET,

  // 5. ROUTING REDIRECTIONS
  // Tells NextAuth where to redirect the user if they try to access restricted pages.
  pages: {
    signIn: '/login', // Custom Login form route
    error: '/auth/error', // Custom error redirection route
  },
};
