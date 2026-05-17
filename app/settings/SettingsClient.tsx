'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Settings as SettingsIcon,
  LayoutDashboard,
  BellRing,
  Save,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

interface SettingsClientProps {
  userId: string;
  initialThreshold: number;
}

export default function SettingsClient({ userId, initialThreshold }: SettingsClientProps) {
  const [threshold, setThreshold]           = useState<number>(initialThreshold);
  const [savedThreshold, setSavedThreshold] = useState<number>(initialThreshold);
  const [isSaving, setIsSaving]             = useState<boolean>(false);
  const [status, setStatus]                 = useState<'idle' | 'unsaved' | 'saving' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg]             = useState<string>('');

  const hasUnsavedChanges = threshold !== savedThreshold;

  // Track unsaved state
  useEffect(() => {
    if (threshold !== savedThreshold) {
      setStatus('unsaved');
    } else if (status === 'unsaved') {
      setStatus('idle');
    }
  }, [threshold, savedThreshold]);

  // Auto-dismiss success after 4s
  useEffect(() => {
    if (status === 'success') {
      const t = setTimeout(() => setStatus('idle'), 4000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedThreshold(threshold);
        setStatus('success');
      } else {
        setErrorMsg(data.error || 'Sync failed. Try again.');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Network failure. Check connection.');
      setStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex cyber-scanlines">

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside className="w-64 border-r border-zinc-800 bg-[#080808]/80 backdrop-blur-xl p-6 hidden lg:flex flex-col justify-between flex-shrink-0">
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-3 px-2 py-1.5 border border-[#00FF41]/20 rounded-lg bg-[#00FF41]/5">
            <Shield className="w-6 h-6 text-[#00FF41] animate-pulse flex-shrink-0" />
            <div>
              <p className="text-sm font-bold tracking-widest text-[#00FF41] font-mono leading-none">SENTRY.v4</p>
              <p className="text-[9px] font-mono text-zinc-500 tracking-wider">CORE_TACTICAL</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="space-y-1">
            <Link
              href="/dashboard"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-900/50 transition-all"
            >
              <LayoutDashboard className="w-4 h-4 text-zinc-500 flex-shrink-0" />
              DASHBOARD
            </Link>
            <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider text-[#00FF41] bg-[#00FF41]/5 border-l-2 border-[#00FF41]">
              <SettingsIcon className="w-4 h-4 text-[#00FF41] flex-shrink-0" />
              SETTINGS_CONFIG
            </div>
          </nav>
        </div>

        {/* Status */}
        <div className="pt-4 border-t border-zinc-800/60">
          <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-zinc-900/40 border border-zinc-800/40">
            <div className="w-2 h-2 rounded-full bg-[#00FF41] animate-ping flex-shrink-0" />
            <div>
              <p className="text-[10px] font-mono text-zinc-300 font-semibold uppercase">AGENT: ONLINE</p>
              <p className="text-[8px] font-mono text-zinc-500">SETTINGS_SYNC_ENABLED</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto">

        {/* Header */}
        <header className="flex justify-between items-center pb-3 border-b border-zinc-800/60">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-5 h-5 text-[#00FF41]" />
            <div>
              <h2 className="text-sm font-bold font-mono tracking-widest text-zinc-100">
                SYSTEM_CONFIGURATION // CONFIG_SHELL
              </h2>
              <p className="text-[10px] font-mono text-zinc-400">
                SECURE CONSOLE SETTINGS // AGENT: {userId.substring(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs font-mono text-zinc-500 hover:text-[#00FF41] transition-colors bg-zinc-900/50 px-3 py-1.5 rounded border border-zinc-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            RETURN_TO_DASHBOARD
          </Link>
        </header>

        {/* ── THRESHOLD CARD ─────────────────────────────────────────────────── */}
        <div className="max-w-3xl w-full mx-auto flex flex-col gap-6">
          <div className="border border-zinc-800 rounded-xl bg-[#0a0a0a] p-6 flex flex-col gap-8 relative">

            {/* Glow blob */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#00FF41]/5 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none" />

            {/* Section header */}
            <div className="flex items-center gap-3 pb-4 border-b border-zinc-800/60">
              <div className="p-2 bg-[#00FF41]/10 rounded-lg border border-[#00FF41]/20">
                <BellRing className="text-[#00FF41] w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-mono tracking-widest uppercase text-white">
                  Global Surveillance Sensitivity
                </h3>
                <p className="text-[10px] text-zinc-500 font-mono">
                  Configure the automated trigger threshold for autonomous market detection.
                </p>
              </div>
            </div>

            {/* Live value display */}
            <div className="flex justify-between items-end flex-wrap gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Selected Threshold</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black font-mono text-[#00FF41]" style={{ textShadow: '0 0 20px rgba(0,255,65,0.5)' }}>
                    {threshold > 0 ? `+${threshold}` : threshold}%
                  </span>
                  <span className="text-xs font-mono text-zinc-500 uppercase">
                    {threshold < 0 ? 'DROP_DETECTION' : threshold > 0 ? 'SPIKE_DETECTION' : 'NEUTRAL'}
                  </span>
                </div>
              </div>
              <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-lg max-w-[240px]">
                <p className="text-[9px] font-mono text-zinc-400 leading-relaxed uppercase">
                  <span className="text-[#00FF41] font-bold">INFO: </span>
                  {Math.abs(threshold) < 3
                    ? 'High sensitivity. Expect frequent logs for minor movements.'
                    : 'Tactical sensitivity. Alerts on significant market shifts only.'}
                </p>
              </div>
            </div>

            {/* Slider */}
            <div className="relative px-2">
              <input
                type="range"
                min="-15"
                max="15"
                step="0.5"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-[#00FF41] focus:outline-none"
              />
              <div className="flex justify-between mt-3 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                <span>Extreme Drop (-15%)</span>
                <span>Neutral (0%)</span>
                <span>Extreme Spike (+15%)</span>
              </div>
              {/* Center tick */}
              <div className="absolute left-1/2 -top-0.5 w-px h-2 bg-zinc-600 -translate-x-1/2" />
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-950/60 border border-zinc-800/60 rounded-xl">
                <div className="flex items-center gap-2 text-[10px] font-bold font-mono text-white uppercase tracking-wider mb-2">
                  <ChevronRight className="w-3 h-3 text-[#00FF41]" />
                  Sensitivity Dynamics
                </div>
                <p className="text-[10px] text-zinc-500 font-mono leading-relaxed">
                  Lower absolute values (e.g., -1%) increase surveillance frequency. High values (e.g., -10%) isolate extreme events.
                </p>
              </div>
              <div className="p-4 bg-zinc-950/60 border border-zinc-800/60 rounded-xl">
                <div className="flex items-center gap-2 text-[10px] font-bold font-mono text-white uppercase tracking-wider mb-2">
                  <ChevronRight className="w-3 h-3 text-[#00FF41]" />
                  Global Application
                </div>
                <p className="text-[10px] text-zinc-500 font-mono leading-relaxed">
                  This threshold applies across your entire tracked watchlist monitored by SENTRY.
                </p>
              </div>
            </div>

            {/* ── SAVE CONTROLS ─────────────────────────────────────────────── */}
            <div className="border-t border-zinc-800 pt-6 flex items-center justify-between gap-4 flex-wrap">

              {/* Status badge */}
              <div className="flex items-center min-h-[36px]">
                {status === 'unsaved' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-mono bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    UNSAVED_CHANGES — SYNC REQUIRED
                  </div>
                )}
                {status === 'idle' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-mono bg-[#00FF41]/5 text-[#00FF41]/50 border border-[#00FF41]/10">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    VAULT_SYNC_CURRENT
                  </div>
                )}
                {status === 'success' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-mono bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/30">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    THRESHOLD SYNCED TO VAULT ✓
                  </div>
                )}
                {status === 'error' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/30">
                    <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {errorMsg}
                  </div>
                )}
              </div>

              {/* Save button — always rendered, always visible */}
              <button
                id="save-threshold-btn"
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges}
                className={[
                  'flex items-center gap-2.5 px-6 py-3 rounded font-bold font-mono text-xs tracking-widest',
                  'border transition-all duration-200 active:scale-95',
                  hasUnsavedChanges
                    ? 'bg-[#00FF41] text-black border-[#00FF41] cursor-pointer hover:bg-[#00e639]'
                    : 'bg-transparent text-[#00FF41]/30 border-[#00FF41]/15 cursor-not-allowed',
                  isSaving ? 'opacity-70' : '',
                ].join(' ')}
                style={hasUnsavedChanges ? { boxShadow: '0 0 20px rgba(0,255,65,0.4)' } : {}}
              >
                {isSaving
                  ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  : <Save className="w-4 h-4 flex-shrink-0" />
                }
                {isSaving ? 'SYNCING_WITH_VAULT...' : hasUnsavedChanges ? 'SAVE_SURVEILLANCE_SETTINGS' : 'SETTINGS_SAVED ✓'}
              </button>
            </div>

          </div>

          {/* Placeholder card */}
          <div className="p-8 border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-center gap-3 opacity-50">
            <SettingsIcon className="w-8 h-8 text-zinc-700" />
            <div>
              <h4 className="text-xs font-bold font-mono text-zinc-400 uppercase tracking-[0.2em]">Additional Modules Offline</h4>
              <p className="text-[10px] text-zinc-600 font-mono mt-1">Future config expansions will be deployed here.</p>
            </div>
          </div>
        </div>

        <footer className="pt-4 border-t border-zinc-800/40 text-center">
          <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-[0.3em]">
            BITBASH CRYPTO SENTRY // TERMINAL_CONFIG_v4.0.1
          </p>
        </footer>
      </main>
    </div>
  );
}
