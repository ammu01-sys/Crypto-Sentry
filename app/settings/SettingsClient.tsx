'use client';

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Settings as SettingsIcon, 
  LayoutDashboard, 
  Star, 
  BellRing, 
  TrendingUp, 
  User, 
  Play, 
  Terminal, 
  Save, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Loader2,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage({ userId, initialThreshold }: { userId: string, initialThreshold: number }) {
  const [threshold, setThreshold] = useState(initialThreshold);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: data.message || 'Settings synchronized successfully.', type: 'success' });
      } else {
        setMessage({ text: data.error || 'Failed to sync settings.', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Network encryption failure. Please retry.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex cyber-scanlines">
      {/* 1. TACTICAL SIDEBAR NAVIGATION */}
      <aside className="w-64 border-r border-zinc-800 bg-[#080808]/80 backdrop-blur-xl p-6 hidden lg:flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2 py-1.5 border border-[#00FF41]/20 rounded-lg bg-[#00FF41]/5 shadow-[0_0_10px_rgba(0,255,65,0.05)]">
            <Shield className="w-6 h-6 text-[#00FF41] animate-pulse" />
            <div>
              <h1 className="text-sm font-bold tracking-widest text-[#00FF41] font-mono leading-none">
                SENTRY.v4
              </h1>
              <span className="text-[9px] font-mono text-zinc-500 tracking-wider">
                CORE_TACTICAL
              </span>
            </div>
          </div>

          <nav className="space-y-1">
            <Link href="/dashboard" className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-all text-zinc-400 hover:text-white hover:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-4.5 h-4.5 text-zinc-500" />
                <span>DASHBOARD</span>
              </div>
            </Link>
            <div className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-all text-[#00FF41] bg-[#00FF41]/5 border-l-2 border-[#00FF41] shadow-[0_0_15px_rgba(0,255,65,0.05)]">
              <div className="flex items-center gap-3">
                <SettingsIcon className="w-4.5 h-4.5 text-[#00FF41]" />
                <span>SETTINGS_CONFIG</span>
              </div>
            </div>
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-zinc-800/60">
          <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-zinc-900/40 border border-zinc-800/40">
            <div className="w-2 h-2 rounded-full bg-[#00FF41] animate-ping" />
            <div className="min-w-0">
              <p className="text-[10px] font-mono text-zinc-300 font-semibold truncate uppercase">
                AGENT: ONLINE
              </p>
              <p className="text-[8px] font-mono text-zinc-500 truncate">SETTINGS_SYNC_ENABLED</p>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. MAIN SETTINGS WORKSPACE */}
      <main className="flex-1 flex flex-col min-w-0 p-6 space-y-6 overflow-y-auto">
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
          
          <Link href="/dashboard" className="flex items-center gap-2 text-xs font-mono text-zinc-500 hover:text-[#00FF41] transition-colors bg-zinc-900/50 px-3 py-1.5 rounded border border-zinc-800">
            <ArrowLeft className="w-3.5 h-3.5" />
            RETURN_TO_DASHBOARD
          </Link>
        </header>

        <div className="max-w-3xl mx-auto w-full space-y-6 py-4 animate-fadeIn">
          {/* Global Surveillance Threshold Section */}
          <section className="cyber-panel p-6 space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00FF41]/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-[#00FF41]/10 transition-all duration-700" />
            
            <div className="flex items-center gap-3 pb-4 border-b border-zinc-800/60">
              <div className="p-2 bg-[#00FF41]/10 rounded-lg border border-[#00FF41]/20">
                <BellRing className="text-[#00FF41] w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-mono tracking-widest uppercase text-white">
                  Global Surveillance Sensitivity
                </h3>
                <p className="text-[10px] text-zinc-500 font-mono tracking-tight">
                  Configure the automated trigger threshold for autonomous market detection.
                </p>
              </div>
            </div>

            <div className="space-y-10 py-4">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Selected Threshold</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black font-terminal-mono text-[#00FF41] phosphor-glow-green">
                      {threshold > 0 ? `+${threshold}` : threshold}%
                    </span>
                    <span className="text-xs font-mono text-zinc-500 uppercase tracking-tighter">
                      {threshold < 0 ? 'DROP_DETECTION' : 'SPIKE_DETECTION'}
                    </span>
                  </div>
                </div>
                <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-lg max-w-[240px]">
                  <p className="text-[9px] font-mono text-zinc-400 leading-relaxed uppercase tracking-tight">
                    <span className="text-[#00FF41] font-bold">INFO:</span> {Math.abs(threshold) < 3 ? 'High sensitivity. Expect frequent logs for minor movements.' : 'Tactical sensitivity. Alerts generated only on significant market shifts.'}
                  </p>
                </div>
              </div>

              {/* INTERACTIVE SLIDER */}
              <div className="relative pt-6 px-2">
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="0.5"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#00FF41] focus:outline-none"
                />
                <div className="flex justify-between mt-4 text-[9px] font-mono text-zinc-600 uppercase tracking-widest px-1">
                  <span>Extreme Drop (-15%)</span>
                  <span>Neutral (0%)</span>
                  <span>Extreme Spike (+15%)</span>
                </div>
                
                {/* Visual marker for 0 */}
                <div className="absolute left-1/2 top-6 w-px h-2 bg-zinc-700 -translate-x-1/2" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div className="p-4 bg-zinc-950/40 border border-zinc-800/60 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold font-mono text-white uppercase tracking-wider">
                    <ChevronRight className="w-3 h-3 text-[#00FF41]" />
                    Sensitivity Dynamics
                  </div>
                  <p className="text-[10px] text-zinc-500 font-mono leading-relaxed">
                    Lower absolute values (e.g., -1%) increase surveillance frequency. High values (e.g., -10%) isolate extreme outlier events.
                  </p>
                </div>
                <div className="p-4 bg-zinc-950/40 border border-zinc-800/60 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold font-mono text-white uppercase tracking-wider">
                    <ChevronRight className="w-3 h-3 text-[#00FF41]" />
                    Global Application
                  </div>
                  <p className="text-[10px] text-zinc-500 font-mono leading-relaxed">
                    This threshold applies across your entire tracked watchlist and the global top asset index monitored by SENTRY.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-zinc-800/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {message && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-mono ${message.type === 'success' ? 'bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'} animate-fadeIn`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {message.text}
                  </div>
                )}
              </div>
              
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2.5 px-6 py-2.5 bg-[#00FF41] text-black font-bold font-mono text-xs rounded-lg hover:bg-[#00cc33] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(0,255,65,0.2)] hover:shadow-[0_0_30px_rgba(0,255,65,0.4)] active:scale-95"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? 'SYNCING_WITH_VAULT...' : 'SAVE_SURVEILLANCE_SETTINGS'}
              </button>
            </div>
          </section>

          {/* Future Settings Placeholder */}
          <section className="p-8 border border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 opacity-60">
            <SettingsIcon className="w-8 h-8 text-zinc-700" />
            <div>
              <h4 className="text-xs font-bold font-mono text-zinc-400 uppercase tracking-[0.2em]">Additional Modules Offline</h4>
              <p className="text-[10px] text-zinc-600 font-mono">Future configuration expansions (API Keys, Discord Webhooks, Notification Scopes) will be deployed here.</p>
            </div>
          </section>
        </div>

        <footer className="pt-6 border-t border-zinc-800/60 text-center">
          <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.3em]">
            BITBASH CRYPTO SENTRY // TERMINAL_CONFIG_v4.0.1
          </p>
        </footer>
      </main>
    </div>
  );
}
