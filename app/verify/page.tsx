// 2FA verification page: prompts users to enter their TOTP code before accessing the dashboard.
'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, RefreshCw, Smartphone, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function VerifyPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [token, setToken] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
    if (status === 'authenticated' && (session?.user as any)?.is2FAVerified) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rememberDevice }),
      });

      const data = await res.json();

      if (data.success) {
        setIsSuccess(true);
        // Update the session to reflect the new is2FAVerified status
        await update(); 
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        setError(data.error || 'VERIFICATION_FAILED');
      }
    } catch (err) {
      setError('NETWORK_TIMEOUT_RETRY');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || isSuccess) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 cyber-scanlines">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-12 h-12 text-[#00FF41] animate-spin" />
          <p className="text-[#00FF41] font-mono text-xs tracking-[0.2em] animate-pulse">
            {isSuccess ? 'ACCESS_GRANTED_DECRYPTING...' : 'INITIALIZING_SENTRY_GATEWAY...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4 cyber-scanlines relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00FF41]/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="cyber-panel p-8 backdrop-blur-xl bg-[#080808]/80 border-[#00FF41]/20">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-[#00FF41]/10 rounded-2xl flex items-center justify-center border border-[#00FF41]/30 shadow-[0_0_20px_rgba(0,255,65,0.1)] mb-4">
              <Shield className="w-8 h-8 text-[#00FF41]" />
            </div>
            <h1 className="text-xl font-bold tracking-widest text-white font-mono mb-2">
              TWO-STEP VERIFICATION
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase text-center">
              Identity confirmed via Google. Enter the security code from your authenticator app to access the surveillance terminal.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-zinc-400 tracking-widest uppercase block ml-1">
                Security Code
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-[#00FF41] transition-colors">
                  <Smartphone className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="000 000"
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-[#050505] border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-center text-2xl font-mono tracking-[0.5em] text-[#00FF41] placeholder:text-zinc-800 focus:outline-none focus:border-[#00FF41]/50 focus:ring-1 focus:ring-[#00FF41]/20 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${
                    rememberDevice ? 'bg-[#00FF41] border-[#00FF41]' : 'bg-zinc-900 border-zinc-700'
                  }`}>
                    {rememberDevice && <CheckCircle2 className="w-3.5 h-3.5 text-black font-bold" />}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 group-hover:text-zinc-200 transition-colors uppercase tracking-wider">
                  Remember this device for 30 days
                </span>
              </label>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg flex items-center gap-3 text-red-500 font-mono text-[10px] uppercase tracking-wider"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading || token.length < 6}
              className="w-full py-4 bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/30 hover:bg-[#00FF41]/20 hover:border-[#00FF41]/50 rounded-xl text-xs font-mono font-bold tracking-[0.2em] transition-all shadow-[0_0_20px_rgba(0,255,65,0.1)] hover:shadow-[0_0_30px_rgba(0,255,65,0.2)] flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed group overflow-hidden relative"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>DECRYPTING_CODE...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>AUTHORIZE_ACCESS</span>
                </>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-900 text-center">
            <button 
              onClick={() => router.push('/login')}
              className="text-[10px] font-mono text-zinc-500 hover:text-[#00FF41] transition-colors uppercase tracking-[0.2em]"
            >
              Back to Login
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-4 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
          <span>Encrypted Session</span>
          <span>•</span>
          <span>Sentry Node v1.0</span>
        </div>
      </motion.div>
    </div>
  );
}
