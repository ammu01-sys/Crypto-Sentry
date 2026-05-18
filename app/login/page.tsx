// Login page: authenticates users via email/password or Google OAuth with cyberpunk UI.
'use client';

import React, { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Key, AtSign, AlertTriangle, RefreshCw, Terminal } from 'lucide-react';
import GoogleLoginButton from '@/components/auth/GoogleLoginButton';

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.push('/dashboard');
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError('Please enter your email or username and password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        identifier: identifier.trim(),
        password,
      });

      if (result?.error) {
        setError(result.error || 'Invalid credentials. Please try again.');
        setIsLoading(false);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Authentication failed. Please try again.');
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center flex-col gap-3 font-mono">
        <RefreshCw className="w-8 h-8 text-[#00FF41] animate-spin" />
        <span className="text-xs text-[#00FF41] tracking-widest animate-pulse">INITIALIZING_SECURE_AUTH_LAYER...</span>
      </div>
    );
  }

  const inputCls =
    'w-full pl-10 pr-4 py-2.5 bg-[#050505]/60 border border-zinc-800 focus:border-[#00FF41]/40 rounded-lg text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#00FF41]/20 transition-all';

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden cyber-scanlines font-sans">
      <div className="absolute top-1/4 left-1/4 w-[250px] h-[250px] bg-[#00FF41]/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-2 border border-[#00FF41]/20 rounded-full bg-[#00FF41]/5 shadow-[0_0_15px_rgba(0,255,65,0.05)]">
            <Shield className="w-5 h-5 text-[#00FF41] animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-widest font-mono">ACCESS TERMINAL</h2>
          <p className="text-xs text-zinc-500 font-mono">BITBASH CRYPTO SENTRY</p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg flex items-start gap-2.5 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1 font-mono">
              <span className="text-[10px] text-red-400 font-bold block uppercase">SECURITY EXCEPTION</span>
              <p className="text-[11px] text-zinc-300 leading-tight">{error}</p>
            </div>
          </div>
        )}

        {/* Form panel */}
        <div className="bg-[#111111]/80 backdrop-blur-md border border-zinc-800/80 rounded-xl p-6 shadow-2xl relative">
          <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-[#00FF41]/30 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* EMAIL OR USERNAME */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-400 tracking-wider uppercase block">
                Email or Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-600">
                  <AtSign className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  disabled={isLoading}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="username/operator@gmail.com"
                  className={inputCls}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-400 tracking-wider uppercase block">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-600">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={inputCls}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/30 hover:bg-[#00FF41]/20 hover:border-[#00FF41]/50 rounded-lg text-xs font-mono font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(0,255,65,0.1)] hover:shadow-[0_0_20px_rgba(0,255,65,0.25)] flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>AUTHENTICATING...</span>
                </>
              ) : (
                <>
                  <Terminal className="w-4 h-4 text-[#00FF41]" />
                  <span>LOG IN</span>
                </>
              )}
            </button>
          </form>

          {/* OAUTH SEPARATOR */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-900"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-[#111111] px-2 text-zinc-600 font-mono">OR_SECURE_GATEWAY</span>
            </div>
          </div>

          {/* GOOGLE OAUTH */}
          <GoogleLoginButton text="Continue with Google" />

          <div className="mt-5 pt-4 border-t border-zinc-900 flex justify-between items-center text-[10px] font-mono text-zinc-500">
            <span>New here?</span>
            <Link href="/signup" className="text-[#00FF41] hover:underline font-bold tracking-wider uppercase">
              Create Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
