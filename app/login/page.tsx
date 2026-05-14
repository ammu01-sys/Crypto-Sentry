'use client';

import React, { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Key, Mail, AlertTriangle, RefreshCw, Terminal } from 'lucide-react';

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  // Form input trackers
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI state variables
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-redirect if session is already active
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Simple structural checks
    if (!email.trim() || !password) {
      setError('Both email and password security keys must be provided.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: email.trim().toLowerCase(),
        password,
      });

      if (result?.error) {
        // Expose custom NextAuth errors or fallback to generalized credentials message
        setError(result.error || 'Identity rejection: Invalid email or password credentials.');
        setIsLoading(false);
      } else {
        // Trigger dashboard navigation upon successful terminal handshakes
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Handshake crash:', err);
      setError('Surveillance handshake failed: Internal authentication gateway timeout.');
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center flex-col gap-3 font-mono">
        <RefreshCw className="w-8 h-8 text-[#00FF41] animate-spin" />
        <span className="text-xs text-[#00FF41] tracking-widest animate-pulse">
          INITIALIZING_SECURE_AUTH_LAYER...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden cyber-scanlines font-sans">
      {/* Visual cyber underlay glows */}
      <div className="absolute top-1/4 left-1/4 w-[250px] h-[250px] bg-[#00FF41]/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Terminal Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-2 border border-[#00FF41]/20 rounded-full bg-[#00FF41]/5 shadow-[0_0_15px_rgba(0,255,65,0.05)]">
            <Shield className="w-5 h-5 text-[#00FF41] animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-widest font-mono">
            ACCESS TERMINAL
          </h2>
          <p className="text-xs text-zinc-500 font-mono">ESTABLISH SECURE LINK / BITBASH SENTRY</p>
        </div>

        {/* Dynamic Warning Dialog */}
        {error && (
          <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg flex items-start gap-2.5 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1 font-mono">
              <span className="text-[10px] text-red-400 font-bold block uppercase leading-none">
                SECURITY EXCEPTION TRIGGERED
              </span>
              <p className="text-[11px] text-zinc-300 leading-tight">{error}</p>
            </div>
          </div>
        )}

        {/* Tactical Glassmorphic Panel */}
        <div className="bg-[#111111]/80 backdrop-blur-md border border-zinc-800/80 rounded-xl p-6 shadow-2xl relative">
          <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-[#00FF41]/30 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* EMAIL INPUT FIELD */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-400 tracking-wider uppercase block">
                EMAIL IDENTIFIER
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-600">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@gmail.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#050505]/60 border border-zinc-850 focus:border-[#00FF41]/40 rounded-lg text-xs font-mono text-white placeholder-zinc-750 focus:outline-none focus:ring-1 focus:ring-[#00FF41]/20 transition-all"
                />
              </div>
            </div>

            {/* PASSWORD INPUT FIELD */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-400 tracking-wider uppercase block">
                SECURE PASSKEY
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-600">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#050505]/60 border border-zinc-850 focus:border-[#00FF41]/40 rounded-lg text-xs font-mono text-white placeholder-zinc-750 focus:outline-none focus:ring-1 focus:ring-[#00FF41]/20 transition-all"
                />
              </div>
            </div>

            {/* HANDSHAKE EXECUTION TRIGGER */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/30 hover:bg-[#00FF41]/20 hover:border-[#00FF41]/50 rounded-lg text-xs font-mono font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(0,255,65,0.1)] hover:shadow-[0_0_20px_rgba(0,255,65,0.25)] flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>SURVEILLANCE_HANDSHAKE_ACTIVE...</span>
                </>
              ) : (
                <>
                  <Terminal className="w-4 h-4 text-[#00FF41]" />
                  <span>INITIATE LOGIN</span>
                </>
              )}
            </button>
          </form>

          {/* Helper panel link footer */}
          <div className="mt-5 pt-4 border-t border-zinc-900 flex justify-between items-center text-[10px] font-mono text-zinc-500">
            <span>New User?</span>
            <Link
              href="/signup"
              className="text-[#00FF41] hover:underline font-bold tracking-wider uppercase"
            >
              REQUEST ACCESS
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
