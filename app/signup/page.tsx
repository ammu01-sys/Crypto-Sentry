'use client';

import React, { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Key, Mail, AlertTriangle, RefreshCw, Terminal, CheckCircle2 } from 'lucide-react';

export default function SignUpPage() {
  const { status } = useSession();
  const router = useRouter();

  // Form input trackers
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state variables
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
    setSuccess(null);

    // Frontend validations
    if (!email.trim() || !password || !confirmPassword) {
      setError('All core credential blocks must be compiled to establish connection.');
      return;
    }

    if (password.length < 6) {
      setError('Passphrases must contain at least 6 characters to safely arm system salts.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mismatched security blocks: Confirm password signature does not match.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Submit POST registry payload
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Registry failed: Identity node compilation rejected.');
        setIsLoading(false);
        return;
      }

      setSuccess('Identity slot successfully written! Synchronizing security parameters...');

      // 2. Automated Auto-Login handshake
      const result = await signIn('credentials', {
        redirect: false,
        email: email.trim().toLowerCase(),
        password,
      });

      if (result?.error) {
        // Fallback if login fails: redirect to manual sign-in page
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      } else {
        // Navigate directly to surveillance deck
        setTimeout(() => {
          router.push('/dashboard');
        }, 1200);
      }
    } catch (err) {
      console.error('Registration runtime error:', err);
      setError('Connection failure: Registry channel timed out.');
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center flex-col gap-3 font-mono">
        <RefreshCw className="w-8 h-8 text-[#00FF41] animate-spin" />
        <span className="text-xs text-[#00FF41] tracking-widest animate-pulse">
          ARMING_REGISTRY_CHANNELS...
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
          <h2 className="text-2xl font-bold text-white tracking-widest font-mono">RECRUIT AGENT</h2>
          <p className="text-xs text-zinc-500 font-mono">CREATE OPERATIVE NODE / BITBASH SENTRY</p>
        </div>

        {/* Dynamic Warning Alert */}
        {error && (
          <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg flex items-start gap-2.5 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1 font-mono">
              <span className="text-[10px] text-red-400 font-bold block uppercase leading-none">
                REGISTRY FAULT DETECTED
              </span>
              <p className="text-[11px] text-zinc-300 leading-tight">{error}</p>
            </div>
          </div>
        )}

        {/* Dynamic Success Alert */}
        {success && (
          <div className="p-3 bg-green-950/20 border border-[#00FF41]/30 rounded-lg flex items-start gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-[#00FF41] shrink-0 mt-0.5" />
            <div className="space-y-1 font-mono">
              <span className="text-[10px] text-[#00FF41] font-bold block uppercase leading-none">
                REGISTRY SLOT ALLOCATED
              </span>
              <p className="text-[11px] text-zinc-300 leading-tight">{success}</p>
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
                  disabled={isLoading || !!success}
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
                  disabled={isLoading || !!success}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#050505]/60 border border-zinc-850 focus:border-[#00FF41]/40 rounded-lg text-xs font-mono text-white placeholder-zinc-750 focus:outline-none focus:ring-1 focus:ring-[#00FF41]/20 transition-all"
                />
              </div>
            </div>

            {/* PASSWORD CONFIRM FIELD */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-400 tracking-wider uppercase block">
                VERIFY PASSKEY
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-600">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  disabled={isLoading || !!success}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#050505]/60 border border-zinc-850 focus:border-[#00FF41]/40 rounded-lg text-xs font-mono text-white placeholder-zinc-750 focus:outline-none focus:ring-1 focus:ring-[#00FF41]/20 transition-all"
                />
              </div>
            </div>

            {/* REGISTRY EXECUTION TRIGGER */}
            <button
              type="submit"
              disabled={isLoading || !!success}
              className="w-full py-2.5 bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/30 hover:bg-[#00FF41]/20 hover:border-[#00FF41]/50 rounded-lg text-xs font-mono font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(0,255,65,0.1)] hover:shadow-[0_0_20px_rgba(0,255,65,0.25)] flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>COMPILING_CREDENTIAL_NODE...</span>
                </>
              ) : (
                <>
                  <Terminal className="w-4 h-4 text-[#00FF41]" />
                  <span>Complete signup</span>
                </>
              )}
            </button>
          </form>

          {/* Helper panel link footer */}
          <div className="mt-5 pt-4 border-t border-zinc-900 flex justify-between items-center text-[10px] font-mono text-zinc-500">
            <span>Already Active?</span>
            <Link
              href="/login"
              className="text-[#00FF41] hover:underline font-bold tracking-wider uppercase"
            >
              BACK TO TERMINAL
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
