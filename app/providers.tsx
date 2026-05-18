// Wraps the app in NextAuth SessionProvider so useSession() works across all client components.
'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';

interface AuthProviderProps {
  children: React.ReactNode;
  session?: Session | null; // Pre-fetched server-side session to avoid initial client fetch error
}

export function AuthProvider({ children, session }: AuthProviderProps) {
  return (
    <SessionProvider
      session={session}
      basePath="/api/auth"
      refetchOnWindowFocus={false}
      refetchInterval={0}
      refetchWhenOffline={false}
    >
      {children}
    </SessionProvider>
  );
}
