import type { Metadata } from 'next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import { TutorialProvider } from './dashboard/_components/SpotlightGuide';
import { AuthProvider } from './providers';
import './globals.css';

// 1. HIGH-TECH MODERN TYPOGRAPHY LOADER
const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

// 2. SEARCH ENGINE OPTIMIZATION & METADATA INFRASTRUCTURE
export const metadata: Metadata = {
  title: 'SENTRY // CYBER-SECURITY CRYPTO MONITORING TERMINAL',
  description:
    'Advanced aggressive dark mode terminal monitoring global digital assets, liquidity index drops, and buy pressure metrics with sub-second polling surveillance.',
};

// 3. MAIN ROOT LAYOUT
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans bg-[#050505] text-white selection:bg-[#00FF41]/35 antialiased min-h-screen">
        <AuthProvider>
          <TutorialProvider>{children}</TutorialProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
