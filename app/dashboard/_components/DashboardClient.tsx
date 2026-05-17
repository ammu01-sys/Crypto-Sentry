'use client';

import React, { useState, useMemo, useEffect, useId, useRef } from 'react';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Star,
  BellRing,
  TrendingUp,
  User,
  Settings as SettingsIcon,
  Shield,
  Activity,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Power,
  RefreshCw,
  Terminal,
  AlertTriangle,
  Play,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  Lock,
  Upload,
} from 'lucide-react';
import { usePriceTicker } from '../_hooks/usePriceTicker';
import { useTutorial } from './SpotlightGuide';

// 1. DATA TYPE SCHEMAS
interface WatchlistItem {
  id: string;
  assetId: string;
  assetName: string;
}

interface AlertItem {
  id: string;
  assetId: string;
  price: number;
  dropPercentage: number;
  createdAt: Date;
}

interface EventLogItem {
  id: string;
  assetId: string;
  event: string;
  message: string;
  createdAt: Date;
}

interface DashboardClientProps {
  userId: string;
  userName: string;
  userEmail: string;
  initialWatchlist: WatchlistItem[];
  initialEventLogs: EventLogItem[];
  initialPrices: { id: string; name: string; symbol: string; price: number; change24h: number }[];
  initialThreshold: number;
  userImage?: string;
  hasSeenTutorial: boolean;
}

// Sparkline sub-component definition (defined standalone to prevent ID shifts and optimize render loops)
const Sparkline = ({
  history,
  isPositive,
  isMounted,
}: {
  history: number[];
  isPositive: boolean;
  isMounted: boolean;
}) => {
  const width = 120;
  const height = 36;
  const padding = 2;
  const uniqueId = useId();
  // Safe sanitized ID for the SVG gradient mapping (React useId returns strings with colons which are cleaned up)
  const gradientId = `glow-${uniqueId.replace(/:/g, '')}`;

  const points = useMemo(() => {
    if (history.length < 2) return '';
    const min = Math.min(...history);
    const max = Math.max(...history);
    const spread = max - min || 1;

    return history
      .map((val, idx) => {
        const x = (idx / (history.length - 1)) * (width - padding * 2) + padding;
        const y = height - ((val - min) / spread) * (height - padding * 2) - padding;
        return `${x},${y}`;
      })
      .join(' ');
  }, [history]);

  const strokeColor = isPositive ? '#00FF41' : '#ef4444';

  return (
    <div className="relative w-[120px] h-[36px]">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {/* Only render dynamic attributes and paths on client mount */}
        {isMounted && points && (
          <path
            d={`M ${padding},${height} L ${points} L ${width - padding},${height} Z`}
            fill={`url(#${gradientId})`}
          />
        )}
        {isMounted && points && (
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            points={points}
            className="transition-all duration-500 ease-in-out"
          />
        )}
        {isMounted && history.length > 0 && (
          <circle
            cx={width - padding * 2 + padding}
            cy={
              height -
              ((history[history.length - 1] - Math.min(...history)) /
                (Math.max(...history) - Math.min(...history) || 1)) *
              (height - padding * 2) -
              padding
            }
            r="2"
            fill={strokeColor}
            className="cyber-pulse"
          />
        )}
      </svg>
    </div>
  );
};

/**
 * Reusable high-fidelity asset logo component
 * Handles alignment, overflow, and fallback states for digital nodes.
 */
const CoinLogo = ({
  src,
  symbol,
  className = "w-7 h-7"
}: {
  src?: string;
  symbol: string;
  className?: string;
}) => {
  const [error, setError] = useState(false);

  return (
    <div className={`${className} shrink-0 rounded border border-zinc-800 bg-zinc-950 flex items-center justify-center overflow-hidden transition-all group-hover:border-[#00FF41]/30 shadow-[0_0_10px_rgba(0,0,0,0.2)]`}>
      {src && !error ? (
        <img
          src={src}
          alt={symbol}
          className="w-full h-full object-contain p-1 animate-fadeIn"
          onError={() => setError(true)}
        />
      ) : (
        <span className="text-[10px] font-bold text-[#00FF41] tracking-tighter uppercase">{symbol.slice(0, 3)}</span>
      )}
    </div>
  );
};

export default function DashboardClient({
  userId,
  userName,
  userEmail,
  initialWatchlist,
  initialEventLogs,
  initialPrices,
  initialThreshold,
  userImage,
  hasSeenTutorial,
}: DashboardClientProps) {
  const { data: session, update: updateSession } = useSession();
  // 2. STATE INITIALIZATIONS
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);


  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'watchlist' | 'alerts' | 'market' | 'profile' | 'settings'
  >('dashboard');

  // Surveillance Threshold State
  const [globalThreshold, setGlobalThreshold] = useState(initialThreshold);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Mobile Navigation State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 2FA Management State
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [setupSecret, setSetupSecret] = useState('');
  const [setupToken, setSetupToken] = useState('');

  const handleStart2FASetup = async () => {
    setIsSettingUp2FA(true);
    try {
      const res = await fetch('/api/auth/2fa/setup');
      const data = await res.json();
      if (data.success) {
        setQrCodeData(data.qrCodeUrl);
        setSetupSecret(data.secret);
      }
    } catch (err) {
      console.error('Failed to initiate 2FA setup:', err);
    }
  };

  const handleConfirm2FASetup = async () => {
    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: setupSecret, token: setupToken }),
      });
      const data = await res.json();
      if (data.success) {
        setIsSettingUp2FA(false);
        setSetupToken('');
        await updateSession(); // Refresh session to reflect 2FA enabled
        alert('TWO_FACTOR_AUTHENTICATION_ENABLED');
      } else {
        alert(data.error || 'VERIFICATION_FAILED');
      }
    } catch (err) {
      console.error('Failed to confirm 2FA setup:', err);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm('DISABLE_SENTRY_2FA_VAULT? Security will be downgraded.')) return;
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await updateSession();
        alert('2FA_DISABLED_SUCCESSFULLY');
      }
    } catch (err) {
      console.error('Failed to disable 2FA:', err);
    }
  };

  // Avatar upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const originalImageRef = useRef<string | null>(userImage || null); // Preserves original Google/session photo
  const [avatarPreview, setAvatarPreview] = useState<string | null>(userImage || null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarMessage(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setAvatarPreview(base64);    // Optimistic preview
      setPendingAvatarFile(base64); // Mark as pending save
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = async () => {
    if (!pendingAvatarFile) return;
    setIsUploadingAvatar(true);
    setAvatarMessage(null);
    try {
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: pendingAvatarFile }),
      });
      const data = await res.json();
      if (data.success) {
        setPendingAvatarFile(null);
        setAvatarMessage({ text: 'AVATAR_SYNCED_TO_VAULT ✓', type: 'success' });
        setTimeout(() => setAvatarMessage(null), 4000);
      } else {
        setAvatarMessage({ text: data.error || 'Upload failed.', type: 'error' });
      }
    } catch {
      setAvatarMessage({ text: 'Network error during upload.', type: 'error' });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarReset = async () => {
    setIsUploadingAvatar(true);
    setAvatarMessage(null);
    try {
      const res = await fetch('/api/user/avatar', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        // Revert to original Google/session image, not a blank placeholder
        setAvatarPreview(originalImageRef.current);
        setPendingAvatarFile(null);
        setAvatarMessage({ text: 'Reverted to original profile picture.', type: 'success' });
        setTimeout(() => setAvatarMessage(null), 4000);
      } else {
        setAvatarMessage({ text: data.error || 'Reset failed.', type: 'error' });
      }
    } catch {
      setAvatarMessage({ text: 'Network error during reset.', type: 'error' });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Close sidebar automatically when a tab is selected on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeTab]);

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setSettingsMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: globalThreshold }),
      });
      const data = await res.json();
      if (data.success) {
        setSettingsMessage({ text: 'SURVEILLANCE_VAULT_SYNCHRONIZED', type: 'success' });
      } else {
        setSettingsMessage({ text: data.error || 'SYNC_FAILURE', type: 'error' });
      }
    } catch (err) {
      setSettingsMessage({ text: 'NETWORK_ENCRYPTION_ERROR', type: 'error' });
    } finally {
      setIsSavingSettings(false);
      setTimeout(() => setSettingsMessage(null), 5000);
    }
  };
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(initialWatchlist);
  const [eventLogs, setEventLogs] = useState<EventLogItem[]>(
    initialEventLogs.map(l => ({ ...l, id: String(l.id) }))
  );

  // Custom Hook: Poll prices every 5s (now includes cache timestamps and mock statuses)
  const { prices, lastUpdated, cacheTimestamp, isMock, isPolling } = usePriceTicker(initialPrices);
  const { startTutorial, activeStep, isActive, steps } = useTutorial();

  // AUTO-START TUTORIAL: Fires once after mount for first-time users only.
  // Uses server-side DB value (hasSeenTutorial prop) — no race condition with session.
  useEffect(() => {
    if (!hasSeenTutorial && isMounted) {
      const timer = setTimeout(() => {
        startTutorial();
      }, 2000); // 2s buffer for dashboard to fully mount
      return () => clearTimeout(timer);
    }
  }, [isMounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Automatically switch active tab as the tutorial progresses
  useEffect(() => {
    if (isActive && steps[activeStep]?.targetTab) {
      setActiveTab(steps[activeStep].targetTab as any);
    }
  }, [isActive, activeStep, steps]);

  // Event Log Polling: Fetch recent history logs every 5 seconds to show triggered alerts instantly
  useEffect(() => {
    let active = true;
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/logs');
        const data = await res.json();
        if (active && data.success && Array.isArray(data.data)) {
          // Use a Map-based approach to ensure total client-side uniqueness by ID
          setEventLogs(prev => {
            const logMap = new Map();
            // Load existing logs
            prev.forEach(l => logMap.set(String(l.id), l));
            // Add new logs (overwrite with fresh data if ID matches)
            data.data.forEach((l: any) => logMap.set(String(l.id), { ...l, id: String(l.id) }));

            // Return sorted by date (newest first)
            return Array.from(logMap.values())
              .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 100); // Keep buffer of 100
          });
        }
      } catch (err) {
        console.error('Error background-polling event logs:', err);
      }
    };

    const interval = setInterval(fetchLogs, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Ticking client clock to update cache age counters dynamically every 1 second
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const cacheAge = useMemo(() => {
    if (!cacheTimestamp) return 999;
    return Math.max(0, Math.floor((currentTime - cacheTimestamp) / 1000));
  }, [cacheTimestamp, currentTime]);

  const isStale = isMock || cacheAge > 35;

  // Global market stats (market cap, volume, change) â€” polled every 60s
  const [globalMarket, setGlobalMarket] = useState({
    totalMarketCap: 2_120_000_000_000,
    totalVolume24h: 84_320_000_000,
    marketCapChange24h: 1.84,
    isMock: true,
  });

  useEffect(() => {
    let active = true;
    const fetchGlobal = async () => {
      try {
        const res = await fetch('/api/global');
        const json = await res.json();
        if (active && json.success && json.data) {
          setGlobalMarket({ ...json.data, isMock: !!json.isMock });
        }
      } catch {
        // keep existing fallback values
      }
    };
    fetchGlobal();
    const interval = setInterval(fetchGlobal, 60_000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  // Search & Filters states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<
    | 'highest_price'
    | 'lowest_price'
    | 'biggest_gainers'
    | 'biggest_losers'
    | 'highest_mcap'
    | 'default'
  >('default');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'gainers' | 'losers'>('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Automatically reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, sortOption]);
  // Memoized search, sort, and filter operations to avoid performance lag and unneeded re-renders
  const filteredAndSortedCoins = useMemo(() => {
    let result = prices.filter((coin) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        coin.name.toLowerCase().includes(query) ||
        coin.symbol.toLowerCase().includes(query) ||
        coin.id.toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === 'all' ||
        (categoryFilter === 'gainers' && coin.change24h > 0) ||
        (categoryFilter === 'losers' && coin.change24h < 0);

      return matchesSearch && matchesCategory;
    });

    if (sortOption === 'highest_price') {
      result = [...result].sort((a, b) => b.price - a.price);
    } else if (sortOption === 'lowest_price') {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sortOption === 'biggest_gainers') {
      result = [...result].sort((a, b) => b.change24h - a.change24h);
    } else if (sortOption === 'biggest_losers') {
      result = [...result].sort((a, b) => a.change24h - b.change24h);
    } else if (sortOption === 'highest_mcap') {
      const mcapOrder: Record<string, number> = {
        bitcoin: 10,
        ethereum: 9,
        ripple: 8,
        solana: 7,
        dogecoin: 6,
        cardano: 5,
        avalanche: 4,
        chainlink: 3,
        polkadot: 2,
        near: 1,
      };
      result = [...result].sort((a, b) => (mcapOrder[b.id] || 0) - (mcapOrder[a.id] || 0));
    }

    return result;
  }, [prices, searchQuery, sortOption, categoryFilter]);

  // Display Logic: Show only top 20 by default, or ALL matches when searching
  // Display Logic: Show paginated slice of filtered results
  const displayedCoins = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedCoins.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedCoins, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedCoins.length / ITEMS_PER_PAGE);

  // â”€â”€ LIVE MARKET ANALYTICS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Volatility Index: avg absolute 24h change across all coins, normalized 0-100
  const volatilityIndex = useMemo(() => {
    if (prices.length === 0) return 0;
    const avg = prices.reduce((s, c) => s + Math.abs(c.change24h), 0) / prices.length;
    return Math.min(parseFloat((avg * 5).toFixed(1)), 100);
  }, [prices]);
  const volatilityLabel =
    volatilityIndex < 33 ? 'LOW' : volatilityIndex < 55 ? 'MODERATE' : volatilityIndex < 75 ? 'HIGH' : 'EXTREME';
  const volatilityColor =
    volatilityIndex < 33 ? '#00FF41' : volatilityIndex < 55 ? '#facc15' : '#ef4444';

  // Buy Pressure: % of coins with positive 24h change
  const buyPressure = useMemo(() => {
    if (prices.length === 0) return 0;
    const gainers = prices.filter((c) => c.change24h > 0).length;
    return parseFloat(((gainers / prices.length) * 100).toFixed(1));
  }, [prices]);
  const buyPressureLabel =
    buyPressure < 35 ? 'BEARISH' : buyPressure < 50 ? 'CAUTIOUS' : buyPressure < 65 ? 'BULLISH' : buyPressure < 80 ? 'AGGRESSIVE' : 'EUPHORIC';

  // Market Status: derived from BTC/ETH volatility, altcoin volatility, and volume/cap ratio
  const marketStatus = useMemo(() => {
    if (prices.length === 0 || globalMarket.totalMarketCap === 0) {
      return { label: 'STABLE', color: '#00FF41' } as const;
    }

    const btc = prices.find((c) => c.id === 'bitcoin');
    const eth = prices.find((c) => c.id === 'ethereum');
    const btcEthVol = Math.max(
      btc ? Math.abs(btc.change24h) : 0,
      eth ? Math.abs(eth.change24h) : 0
    );

    const altcoins = prices.filter((c) => c.id !== 'bitcoin' && c.id !== 'ethereum');
    const altcoinVol =
      altcoins.length > 0
        ? altcoins.reduce((s, c) => s + Math.abs(c.change24h), 0) / altcoins.length
        : 0;

    const volumeToCapRatio =
      (globalMarket.totalVolume24h / globalMarket.totalMarketCap) * 100;

    // UNSTABLE: any signal breaches extreme thresholds
    const isUnstable =
      btcEthVol > 8 ||
      altcoinVol > 25 ||
      volumeToCapRatio > 8;

    // MODERATE: any signal in the mid-range zone
    const isModerate =
      btcEthVol > 3 ||
      altcoinVol > 10 ||
      volumeToCapRatio > 4;

    if (isUnstable) return { label: 'UNSTABLE', color: '#ef4444' } as const;
    if (isModerate) return { label: 'MODERATE', color: '#facc15' } as const;
    return { label: 'STABLE', color: '#00FF41' } as const;
  }, [prices, globalMarket]);
  // -----------------------------------------------------------------------------

  // Settings states

  // UI Loading Overlay
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 3. SECURE WATCHLIST NETWORKING (STAR TOGGLE)
  const toggleWatchlist = async (coinId: string, coinName: string) => {
    setActionLoading(coinId);
    const isStarred = watchlist.some((w) => w.assetId === coinId);

    try {
      if (isStarred) {
        // DELETE request to remove
        const res = await fetch(`/api/watchlist?userId=${userId}&assetId=${coinId}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (data.success) {
          setWatchlist((prev) => prev.filter((w) => w.assetId !== coinId));
          // Append audit log
          logSystemEvent(
            coinId,
            'WATCHLIST_REMOVED',
            `Terminated surveillance for node ${coinName.toUpperCase()}`
          );
        }
      } else {
        // POST request to add
        const res = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, assetId: coinId, assetName: coinName }),
        });
        const data = await res.json();
        if (data.success) {
          setWatchlist((prev) => [
            ...prev,
            { id: data.data.id, assetId: coinId, assetName: coinName },
          ]);
          // Append audit log
          logSystemEvent(
            coinId,
            'WATCHLIST_ADDED',
            `Initiated primary surveillance on node ${coinName.toUpperCase()}`
          );
        }
      }
    } catch (err) {
      console.error('Error modifying watchlist status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Helper: Append local system log events (Temporary UI feedback only)
  const logSystemEvent = (assetId: string, event: string, message: string) => {
    console.log(`[SENTRY_LOG] ${event}: ${assetId} - ${message}`);
  };

  // 4. SESSION TERMINATION
  const terminateSession = async () => {
    setActionLoading('session-terminate');
    setTimeout(async () => {
      await signOut({ callbackUrl: '/login' });
    }, 1500);
  };

  // Note: Sparkline sub-component definition moved to outer module level for optimal performance and matching useId hydration bounds.

  // Watchlist filtered prices
  const watchedCoins = useMemo(() => {
    return prices.filter((p) => watchlist.some((w) => w.assetId === p.id));
  }, [prices, watchlist]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex cyber-scanlines relative overflow-x-hidden">
      {/* 1. MOBILE NAVIGATION OVERLAY (Only visible when sidebar is open on small screens) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 1. LEFT NAVIGATION SIDEBAR PANEL */}
      <aside
        id="sidebar-nav"
        className={`fixed lg:static inset-y-0 left-0 w-[260px] lg:w-[240px] shrink-0 border-r border-[#00FF41]/10 bg-[#080808]/95 lg:bg-[#080808]/90 flex flex-col justify-between p-4 z-50 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
      >
        <div className="space-y-6">
          {/* Terminal Banner */}
          <div className="flex items-center gap-3 px-2 py-1.5 border border-[#00FF41]/20 rounded-lg bg-[#00FF41]/5 shadow-[0_0_10px_rgba(0,255,65,0.05)]">
            <Shield className="w-6 h-6 text-[#00FF41] animate-pulse" />
            <div>
              <h1 className="text-sm font-bold tracking-widest text-[#00FF41] font-mono leading-none">
                BITBASH
              </h1>
              <span className="text-[9px] font-mono text-zinc-500 tracking-wider">
                Crypto Surveillance Engine
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
              { id: 'watchlist', label: 'WATCHLIST', icon: Star, badge: watchlist.length },
              { id: 'alerts', label: 'SECURITY_ALERTS', icon: BellRing, badge: eventLogs.length },
              { id: 'market', label: 'MARKET_DATA', icon: TrendingUp },
              { id: 'profile', label: 'USER_PROFILE', icon: User },
              { id: 'settings', label: 'SETTINGS_CONFIG', icon: SettingsIcon },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-all relative ${isActive
                    ? 'text-[#00FF41] bg-[#00FF41]/5 border-l-2 border-[#00FF41] shadow-[0_0_15px_rgba(0,255,65,0.05)]'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4.5 h-4.5 ${isActive ? 'text-[#00FF41]' : 'text-zinc-500'}`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="text-[9px] font-bold bg-[#00FF41]/10 text-[#00FF41] px-1.5 py-0.5 rounded border border-[#00FF41]/30">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Footplate / Launch Guide */}
        <div className="space-y-3 pt-4 border-t border-zinc-800/60">
          <button
            onClick={startTutorial}
            className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-[10px] font-mono tracking-widest text-[#00FF41] flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play className="w-3 h-3" />
            GUIDED TUTORIAL
          </button>

          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-zinc-900/40 border border-zinc-800/40 hover:border-[#00FF41]/20 transition-all group">
            <div className="relative shrink-0">
              {userImage ? (
                <img src={userImage} alt={userName} className="w-8 h-8 rounded border border-zinc-800" />
              ) : (
                <div className="w-8 h-8 rounded border border-zinc-800 bg-zinc-950 flex items-center justify-center">
                  <User className="w-4 h-4 text-zinc-600" />
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#00FF41] border-2 border-[#050505]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-mono text-zinc-200 font-bold truncate uppercase tracking-wide group-hover:text-[#00FF41] transition-colors">
                {userName}
              </p>
              <p className="text-[8px] font-mono text-zinc-500 truncate">{userEmail}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. MAIN TERMINAL WORKSPACE */}
      <main
        className="flex-1 flex flex-col min-w-0 p-6 space-y-6"
      >
        {/* Terminal Header Bar */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* MOBILE HAMBURGER TOGGLE */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 border border-zinc-800 rounded-lg hover:border-[#00FF41]/30 text-zinc-400 hover:text-[#00FF41] transition-all"
            >
              <Terminal className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <Terminal className="w-5 h-5 text-[#00FF41]" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-bold font-mono tracking-widest text-zinc-100 truncate max-w-[180px] sm:max-w-none">
                  TERMINAL ONE
                </h2>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto font-mono">
            <div className="text-right">
              <span className="text-[9px] text-zinc-500 block leading-none">
                Local Time
              </span>
              <span className="text-xs text-[#00FF41] font-terminal-mono tracking-widest">
                {isMounted ? lastUpdated.toLocaleTimeString() : '--:--:--'}
              </span>
            </div>
            <div className="p-2 border border-zinc-800 bg-zinc-950 rounded-lg">
              <RefreshCw className="w-3.5 h-3.5 text-[#00FF41] animate-spin" />
            </div>

            {/* Premium Sentry Decouple Button */}
            <button
              onClick={terminateSession}
              disabled={actionLoading === 'session-terminate'}
              className={`px-3 py-1.5 border rounded-lg transition-all duration-300 flex items-center justify-center gap-2 font-mono text-xs ${actionLoading === 'session-terminate'
                ? 'text-red-500 border-red-950 bg-red-950/20 animate-pulse'
                : 'text-red-400 hover:text-white border-zinc-800 hover:border-red-500/50 hover:bg-red-950/25 hover:shadow-[0_0_15px_rgba(239,68,68,0.25)] hover:scale-[1.02] active:scale-[0.98]'
                }`}
              title="TERMINATE SURVEILLANCE SESSION (LOGOUT)"
            >
              {actionLoading === 'session-terminate' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-500" />
              ) : (
                <Power className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline uppercase text-[9px] font-bold tracking-widest">
                {actionLoading === 'session-terminate' ? 'SHUTTING_DOWN...' : 'Logout'}
              </span>
            </button>
          </div>
        </header>

        {/* DYNAMIC SYSTEM-WIDE CACHE MONITORING WARNINGS BANNER */}
        {isStale ? (
          <div className="p-4 border border-amber-500/30 rounded-xl bg-amber-950/10 backdrop-blur-md relative overflow-hidden shadow-[0_0_20px_rgba(245,158,11,0.05)] animate-pulse">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3 text-amber-500 font-mono text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-500 animate-bounce shrink-0" />
                <div>
                  <p className="font-bold uppercase tracking-widest text-amber-400">
                    CRITICAL: COINGECKO LIVE PRICING STALE
                  </p>
                  <p className="text-[10px] text-zinc-400 leading-tight">
                    {isMock
                      ? 'Express background surveillance server is unreachable. Offline drifted fallback active.'
                      : 'Database polling sync latency detected. Spot pricing is lagging behind live CoinGecko rates.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-right font-mono text-[10px]">
                <div>
                  <span className="text-zinc-500 block uppercase">LAST SUCCESSFUL SYNC:</span>
                  <span className="text-amber-400 font-bold font-terminal-mono">
                    {cacheTimestamp > 0 ? new Date(cacheTimestamp).toLocaleTimeString() : 'NEVER'}
                  </span>
                </div>
                <div className="px-2.5 py-1.5 border border-amber-500/20 bg-amber-950/20 rounded-lg text-amber-400 font-terminal-mono">
                  <span className="font-bold">AGE: {cacheAge}S</span>
                </div>
                {isPolling && (
                  <div className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[9px] animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    RE-FETCHING
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2 px-3 border border-[#00FF41]/20 rounded-lg bg-[#00FF41]/5 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] font-mono text-[#00FF41] shadow-[0_0_15px_rgba(0,255,65,0.02)]">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-ping" />
              <span> CONNECTION SECURE:  SURVEILLANCE MEMORY CACHE ACTIVE</span>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <span>SYNC TIMING: {cacheAge}S AGO</span>
              <span className="text-zinc-500">|</span>
              <span>POLL RATE: 5S</span>
            </div>
          </div>
        )}

        {/* 3. CONDITIONAL VIEWS RENDERING */}
        {activeTab === 'dashboard' && (
          <div className={`space-y-4 sm:space-y-6 flex-1`}>
            {/* Top row widget layout */}
            <div id="portfolio-analytics" className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
              {/* Market Overview Card */}
              <div id="market-overview" className="cyber-panel p-5 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-mono text-zinc-400 tracking-wider">
                      Market Overview
                    </span>
                    <Shield className="w-4 h-4 text-[#00FF41]/40" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-mono text-zinc-500 block uppercase">
                        Global Market CAP
                      </span>
                      <span className="text-xl font-bold font-terminal-mono text-white tracking-wide phosphor-glow-green">
                        ${isMounted
                          ? globalMarket.totalMarketCap >= 1e12
                            ? `${(globalMarket.totalMarketCap / 1e12).toFixed(2)}T`
                            : `${(globalMarket.totalMarketCap / 1e9).toFixed(1)}B`
                          : '---'}
                      </span>
                      <span className={`text-xs font-mono ml-2 font-semibold ${globalMarket.marketCapChange24h >= 0 ? 'text-[#00FF41]' : 'text-red-400'}`}>
                        {isMounted
                          ? `${globalMarket.marketCapChange24h >= 0 ? '+' : ''}${globalMarket.marketCapChange24h.toFixed(2)}%`
                          : '---'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-zinc-500 block uppercase">
                        24H Volume
                      </span>
                      <span className="text-md font-bold font-terminal-mono text-zinc-200">
                        ${isMounted
                          ? globalMarket.totalVolume24h >= 1e12
                            ? `${(globalMarket.totalVolume24h / 1e12).toFixed(2)}T`
                            : `${(globalMarket.totalVolume24h / 1e9).toFixed(2)}B`
                          : '---'}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono ml-2">{globalMarket.isMock ? 'EST' : 'LIVE'}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[9px] font-mono text-zinc-400">

                  <span className="font-bold text-[9px]" style={{ color: marketStatus.color }}>
                    {marketStatus.label}
                  </span>
                </div>
              </div>

              {/* Sentry Cyber Analytics Card */}
              <div
                id="sentry-analytics"
                className="cyber-panel p-5 lg:col-span-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-mono text-zinc-400 tracking-wider">
                      SENTRY ANALYTICS
                    </span>
                    <Activity className="w-4 h-4 text-[#00FF41]/40 animate-pulse" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Volatility Index Gauge */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-zinc-500 uppercase">Volatility Index</span>
                        <span className="font-semibold font-terminal-mono" style={{ color: volatilityColor }}>
                          {volatilityIndex}% [{volatilityLabel}]
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-950 border border-zinc-800 rounded overflow-hidden p-0.5 flex">
                        <div
                          className="h-full rounded transition-all duration-700"
                          style={{ width: `${volatilityIndex}%`, background: `linear-gradient(to right, #00FF41, ${volatilityColor})` }}
                        />
                      </div>
                      <p className="text-[9px] text-zinc-500 font-mono leading-tight">
                        Aggregated price movement fluctuations matching warning thresholds.
                      </p>
                    </div>

                    {/* Buy Pressure Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-zinc-500 uppercase">Buy Pressure</span>
                        <span className="text-[#00FF41] font-semibold font-terminal-mono">
                          {buyPressure}% [{buyPressureLabel}]
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-950 border border-zinc-800 rounded overflow-hidden p-0.5 flex">
                        <div
                          className="h-full bg-[#00FF41] rounded shadow-[0_0_8px_rgba(0,255,65,0.6)] transition-all duration-700"
                          style={{ width: `${buyPressure}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-zinc-500 font-mono leading-tight">
                        Reflects real-time buy order dominance against sell walls in centralized
                        order books.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Price Cards (BTC / ETH / SOL) */}
            <div id="price-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {prices.slice(0, 3).map((coin) => {
                const isPositive = coin.change24h >= 0;
                return (
                  <div
                    key={coin.id}
                    className="cyber-panel p-5 flex flex-col justify-between hover:border-[#00FF41]/30 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-start gap-3">
                        <CoinLogo src={coin.image} symbol={coin.symbol} className="w-10 h-10" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-400 font-mono">
                              {coin.symbol}
                            </span>
                            <span className="text-[10px] bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 font-mono">
                              {coin.name}
                            </span>
                          </div>
                          <h3 className="text-2xl font-bold font-terminal-mono text-white tracking-wide mt-1">
                            $
                            {coin.price.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </h3>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-flex items-center gap-0.5 text-xs font-bold font-mono px-2 py-0.5 rounded border ${isPositive
                            ? 'text-[#00FF41] bg-[#00FF41]/5 border-[#00FF41]/20'
                            : 'text-[#ef4444] bg-[#ef4444]/5 border-[#ef4444]/20'
                            }`}
                        >
                          {isPositive ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                          {isPositive ? '+' : ''}
                          {coin.change24h.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    {/* Dynamic SVGs Sparkline Graph */}
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-[9px] text-zinc-500 font-mono uppercase">
                        24H TICK VOLATILITY
                      </span>
                      <Sparkline
                        history={coin.history}
                        isPositive={isPositive}
                        isMounted={isMounted}
                      />
                    </div>

                    {/* Surveillance triggers */}
                    <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between">
                      <button
                        onClick={() => toggleWatchlist(coin.id, coin.name)}
                        className={`p-1.5 rounded transition-colors border ${watchlist.some((w) => w.assetId === coin.id)
                          ? 'text-[#00FF41] border-[#00FF41]/30 bg-[#00FF41]/10'
                          : 'text-zinc-500 border-zinc-800 hover:text-zinc-300'
                          }`}
                        title="Toggle Surveillance Track"
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom section split: Threat Log Feed Only (Market Data table moved to its own tab) */}
            <div className="grid grid-cols-1 gap-5">
              {/* Security Alert Log Feed */}
              <div id="alert-log" className="cyber-panel p-5 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800/60">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="text-[#ef4444] w-4.5 h-4.5 animate-bounce" />
                      <span className="text-xs font-mono text-zinc-100 tracking-wider">
                        THREAT ALERT AUDIT
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-red-500 bg-red-950/20 border border-red-500/30 px-2 py-0.5 rounded animate-pulse">
                      CRITICAL_FEED
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                    {eventLogs.length === 0 ? (
                      <p className="text-xs text-zinc-600 font-mono text-center py-8">
                        NO_ALERTS_LOGGED_IN_SESSION
                      </p>
                    ) : (
                      eventLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-2.5 rounded bg-zinc-950 border border-zinc-900 space-y-1"
                        >
                          <div className="flex justify-between items-center text-[9px] font-mono">
                            <span className="text-red-500 font-bold bg-red-950/40 px-1.5 py-0.5 rounded border border-red-500/20">
                              CRITICAL
                            </span>
                            <span className="text-zinc-500">
                              {isMounted
                                ? new Date(log.createdAt).toLocaleTimeString()
                                : '--:--:--'}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-zinc-200 font-mono">
                            {log.event}: {log.assetId.toUpperCase()}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-sans leading-tight">
                            {log.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>


              </div>
            </div>
          </div>
        )}

        {/* 4. WATCHLIST VIEW TAB */}
        {activeTab === 'watchlist' && (
          <div className="cyber-panel p-4 sm:p-6 flex-1 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-zinc-800 mb-6">
                <div className="flex items-center gap-2.5">
                  <Star className="text-[#00FF41] w-5 h-5 fill-current" />
                  <h3 className="text-sm font-bold font-mono tracking-widest">
                    MY WATCHLIST
                  </h3>
                </div>
                <span className="text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded">
                  MONITORING: {watchlist.length} NODES
                </span>
              </div>

              {watchlist.length === 0 ? (
                <div className="text-center py-24 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/20">
                  <Shield className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                  <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                    No nodes tagged for active surveillance.
                  </p>
                  <p className="text-[11px] text-zinc-500 font-mono mt-1">
                    Navigate back to Terminal Explorer to tag coins.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {watchedCoins.map((coin) => {
                    const isPositive = coin.change24h >= 0;
                    return (
                      <div
                        key={coin.id}
                        className="cyber-panel p-5 space-y-4 hover:border-[#00FF41]/40 transition-all"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-3">
                            <CoinLogo src={coin.image} symbol={coin.symbol} className="w-9 h-9" />
                            <div>
                              <span className="text-sm font-bold text-white font-mono truncate max-w-[120px] block">
                                {coin.name}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => toggleWatchlist(coin.id, coin.name)}
                            className="text-red-500 hover:text-red-400 transition-colors p-1"
                            title="Remove from watchlist"
                          >
                            <Power className="w-4.5 h-4.5" />
                          </button>
                        </div>

                        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                          <span className="text-[10px] font-mono text-zinc-500 block">
                            CURRENT PRICE
                          </span>
                          <span className="text-lg font-bold font-terminal-mono tracking-wide text-[#00FF41]">
                            $
                            {coin.price.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 pt-2 border-t border-zinc-800/40">
                          <span>DIRECTION</span>
                          <span
                            className={`font-bold ${isPositive ? 'text-[#00FF41]' : 'text-red-500'}`}
                          >
                            {isPositive ? 'SURGING' : 'BLEEDING'} ({coin.change24h.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. SECURITY ALERTS TAB */}
        {activeTab === 'alerts' && (
          <div className="cyber-panel p-4 sm:p-6 flex-1 flex flex-col justify-between overflow-y-auto animate-fadeIn">
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-zinc-800 mb-6">
                <div className="flex items-center gap-2.5">
                  <BellRing className="text-[#ef4444] w-5 h-5" />
                  <h3 className="text-sm font-bold font-mono tracking-widest uppercase">
                    ALERT LOG
                  </h3>
                </div>
                <span className="text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded">
                  LOG_COUNT: {eventLogs.length}
                </span>
              </div>

              <div className="space-y-4 pb-6 max-w-4xl">
                {eventLogs.length === 0 ? (
                  <div className="text-center py-24 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/10">
                    <AlertCircle className="w-12 h-12 text-zinc-700 mx-auto mb-3 animate-pulse" />
                    <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest font-bold">
                      No Security Logs Found in Terminal History
                    </p>
                    <p className="text-[10px] text-zinc-600 font-mono mt-1">
                      Armed interceptors and triggered alerts will appear here.
                    </p>
                  </div>
                ) : (
                  eventLogs.map((log) => {
                    const coin = prices.find((p) => p.id === log.assetId);
                    const symbol = coin?.symbol.toUpperCase() || log.assetId.toUpperCase();

                    // Extract triggered price and delta from the standardized message format
                    const priceMatch = log.message.match(/Price: \$([0-9.]+)/);
                    const deltaMatch = log.message.match(/24h_Delta: ([0-9.-]+)%/);

                    const triggeredPrice = priceMatch ? priceMatch[1] : '---';
                    const delta = deltaMatch ? `${deltaMatch[1]}%` : '';

                    // Clean up the message for the card
                    const displayMessage = log.message.split(' | ')[0].replace(/\[|\]/g, '');

                    return (
                      <div
                        key={log.id}
                        className="group relative bg-[#0C0C0C] border border-zinc-800/50 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 transition-all duration-300 hover:border-red-500/30 hover:bg-[#0F0F0F] hover:shadow-[0_0_25px_rgba(239,68,68,0.05)] animate-fadeIn"
                      >
                        {/* Left Side: Coin logo with red alert ring */}
                        <div className="relative shrink-0">
                          <CoinLogo
                            src={coin?.image}
                            symbol={symbol}
                            className="w-10 h-10 sm:w-12 sm:h-12"
                          />
                          {/* Red alert badge in corner */}
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                            <AlertTriangle className="w-2.5 h-2.5 text-white" />
                          </div>
                        </div>

                        {/* Center Content */}
                        <div className="flex-1 w-full">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-1">
                            <h4 className="text-xs sm:text-sm font-black text-white tracking-widest font-mono uppercase">
                              {symbol} CRITICAL
                            </h4>
                            <span className="text-[9px] sm:text-[10px] text-zinc-500 font-mono tracking-tighter">
                              @{triggeredPrice} USD
                            </span>
                            <span className="text-[9px] sm:text-[10px] text-zinc-600 font-mono sm:hidden ml-auto">
                              {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-zinc-400 font-mono tracking-tight leading-relaxed">
                            {displayMessage}
                          </p>
                        </div>

                        {/* Right Side: Timestamp (Desktop only) */}
                        <div className="hidden sm:flex text-right shrink-0 items-center gap-2 text-zinc-500 font-mono text-[10px] opacity-70">
                          <Clock className="w-3 h-3" />
                          <span>
                            {new Date(log.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* 6. MARKET DATA EXPANDED TAB */}
        {activeTab === 'market' && (
          <div className="cyber-panel p-6 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-zinc-800 mb-6">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="text-[#00FF41] w-5 h-5" />
                  <h3 className="text-sm font-bold font-mono tracking-widest uppercase">
                    MARKET EXPLORER
                  </h3>
                </div>
                <span className="text-xs font-mono text-[#00FF41] bg-[#00FF41]/5 border border-[#00FF41]/20 px-2.5 py-1 rounded">
                  SURVEILLANCE RESULTS: {filteredAndSortedCoins.length} / {prices.length} NODES
                </span>
              </div>

              {/* ADVANCED FILTER & SEARCH CONTROL GRID PANEL */}
              <div
                id="search-filter-system"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border border-zinc-800/80 bg-zinc-950/40 rounded-xl mb-6 shadow-[0_0_15px_rgba(0,0,0,0.3)]"
              >
                {/* Search Box Component */}
                <div className="md:col-span-2 relative">
                  <span className="text-[9px] font-mono text-zinc-500 block mb-1 uppercase tracking-wider">
                    Search Node
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, symbol, or asset ID (e.g. btc, solana)..."
                    className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-[#00FF41]/40 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all focus:shadow-[0_0_15px_rgba(0,255,65,0.05)]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 bottom-2 text-[10px] font-mono text-zinc-500 hover:text-white transition-colors"
                    >
                      [CLEAR]
                    </button>
                  )}
                </div>

                {/* Sort Option Dropdown Component */}
                <div>
                  <span className="text-[9px] font-mono text-zinc-500 block mb-1 uppercase tracking-wider">
                    Sort Ordering
                  </span>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-[#00FF41]/40 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="default">Default Volatility Index</option>
                    <option value="highest_price">Highest Market Price</option>
                    <option value="lowest_price">Lowest Market Price</option>
                    <option value="biggest_gainers">Biggest 24h Gainers</option>
                    <option value="biggest_losers">Biggest 24h Losers</option>
                    <option value="highest_mcap">Highest Market Cap</option>
                  </select>
                </div>

                {/* Quick Filters Group Component */}
                <div>
                  <span className="text-[9px] font-mono text-zinc-500 block mb-1 uppercase tracking-wider">
                    Tactical Filters
                  </span>
                  <div className="flex gap-1 h-[34px]">
                    {[
                      { id: 'all', label: 'ALL' },
                      { id: 'gainers', label: 'GAINERS' },
                      { id: 'losers', label: 'LOSERS' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setCategoryFilter(tab.id as any)}
                        className={`flex-1 text-[9px] font-mono font-bold border rounded-lg transition-all ${categoryFilter === tab.id
                          ? 'text-[#00FF41] border-[#00FF41]/40 bg-[#00FF41]/10 shadow-[0_0_8px_rgba(0,255,65,0.1)]'
                          : 'text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
                          }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* EMPTY STATE VIEW FALLBACK */}
              {filteredAndSortedCoins.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/10 mb-6">
                  <AlertTriangle className="w-10 h-10 text-amber-500/50 mx-auto mb-3 animate-pulse" />
                  <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest font-bold">
                    No Matching Network Nodes Resolved
                  </p>
                  <p className="text-[10px] text-zinc-600 font-mono mt-1">
                    Try adjusting your search criteria or hit override below to restore the
                    dashboard defaults.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSortOption('default');
                      setCategoryFilter('all');
                    }}
                    className="mt-4 px-3 py-1.5 border border-zinc-800 hover:border-[#00FF41]/30 rounded-lg text-[10px] font-mono text-zinc-400 hover:text-[#00FF41] hover:bg-[#00FF41]/5 transition-all"
                  >
                    RESET_FILTERS_OVERRIDE
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <table className="w-full text-left font-mono min-w-[700px]">
                    <thead>
                      <tr className="border-b border-zinc-800/80 text-[10px] text-zinc-500 uppercase tracking-widest">
                        <th className="py-3 px-4">ASSET INDEX</th>
                        <th className="py-3 px-4 text-right">LAST QUOTE (PRICE)</th>
                        <th className="py-3 px-4 text-right">24H DELTA</th>
                        <th className="py-3 px-4 text-right">MARKET CAPIFICATION</th>
                        <th className="py-3 px-4 text-right">SURVEILLANCE ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs animate-fadeIn">
                      {displayedCoins.map((coin) => {
                        const isStarred = watchlist.some((w) => w.assetId === coin.id);
                        const isPositive = coin.change24h >= 0;
                        const mcapEstimate =
                          coin.id === 'bitcoin'
                            ? '$1.88T'
                            : coin.id === 'ethereum'
                              ? '$410.2B'
                              : coin.id === 'solana'
                                ? '$86.5B'
                                : coin.id === 'ripple'
                                  ? '$114.2B'
                                  : coin.id === 'cardano'
                                    ? '$34.1B'
                                    : coin.id === 'dogecoin'
                                      ? '$55.3B'
                                      : coin.id === 'avalanche'
                                        ? '$14.2B'
                                        : coin.id === 'polkadot'
                                          ? '$8.6B'
                                          : coin.id === 'chainlink'
                                            ? '$10.8B'
                                            : '$5.1B';

                        return (
                          <tr
                            key={coin.id}
                            className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-all group"
                          >
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <CoinLogo src={coin.image} symbol={coin.symbol} />
                                <div className="flex flex-col">
                                  <span className="text-white font-bold tracking-tight">{coin.name}</span>
                                  <span className="text-[10px] text-zinc-500 uppercase font-mono">{coin.symbol}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-terminal-mono font-bold text-zinc-100">
                              $
                              {coin.price.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits:
                                  coin.id === 'ripple' ||
                                    coin.id === 'cardano' ||
                                    coin.id === 'dogecoin'
                                    ? 4
                                    : 2,
                              })}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span
                                className={`inline-flex items-center gap-0.5 text-xs font-bold font-mono px-2 py-0.5 rounded border ${isPositive
                                  ? 'text-[#00FF41] bg-[#00FF41]/5 border-[#00FF41]/20'
                                  : 'text-red-500 bg-red-950/10 border-red-500/20'
                                  }`}
                              >
                                {isPositive ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                                {isPositive ? '+' : ''}
                                {coin.change24h.toFixed(2)}%
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right text-zinc-300 font-terminal-mono font-medium">
                              {mcapEstimate}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex justify-end gap-2.5">
                                <button
                                  onClick={() => toggleWatchlist(coin.id, coin.name)}
                                  disabled={actionLoading === coin.id}
                                  className={`p-1.5 rounded-lg border transition-colors ${isStarred
                                    ? 'text-[#00FF41] border-[#00FF41]/35 bg-[#00FF41]/10 shadow-[0_0_8px_rgba(0,255,65,0.2)]'
                                    : 'text-zinc-600 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
                                    }`}
                                >
                                  <Star
                                    className={`w-3.5 h-3.5 ${isStarred ? 'fill-current' : ''}`}
                                  />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* PAGINATION INTERFACE */}
              {filteredAndSortedCoins.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-zinc-800/60 mt-2">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                    Displaying Assets {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedCoins.length)} of {filteredAndSortedCoins.length} Nodes
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-zinc-800 rounded-lg hover:border-[#00FF41]/30 hover:bg-[#00FF41]/5 disabled:opacity-30 disabled:hover:border-zinc-800 disabled:hover:bg-transparent transition-all group"
                    >
                      <ChevronLeft className="w-4 h-4 text-zinc-400 group-hover:text-[#00FF41]" />
                    </button>

                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum = currentPage;
                        if (totalPages <= 5) pageNum = i + 1;
                        else if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 flex items-center justify-center text-[10px] font-mono font-bold border rounded-lg transition-all ${currentPage === pageNum
                              ? 'text-[#00FF41] border-[#00FF41]/40 bg-[#00FF41]/10 shadow-[0_0_10px_rgba(0,255,65,0.1)]'
                              : 'text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
                              }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-zinc-800 rounded-lg hover:border-[#00FF41]/30 hover:bg-[#00FF41]/5 disabled:opacity-30 disabled:hover:border-zinc-800 disabled:hover:bg-transparent transition-all group"
                    >
                      <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-[#00FF41]" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 7. USER PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="cyber-panel p-4 sm:p-6 flex-1 flex flex-col gap-6 overflow-y-auto animate-fadeIn">
            <div className="max-w-xl w-full space-y-6">

              {/* Profile Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
                <User className="text-[#00FF41] w-5 h-5" />
                <h3 className="text-sm font-bold font-mono tracking-widest">USER PROFILE &amp; CREDENTIALS</h3>
              </div>

              {/* ── AVATAR SECTION ─────────────────────────────────────── */}
              <div className="border border-zinc-800/60 rounded-2xl bg-zinc-950/50 p-6 flex flex-col items-center gap-5">

                {/* Section label */}
                <div className="self-start flex items-center gap-2">
                  <div className="w-1 h-4 bg-[#00FF41] rounded-full" />
                  <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-[0.3em]">Agent Avatar</span>
                </div>

                {/* Avatar Circle with hover overlay */}
                <div
                  className="relative group cursor-pointer"
                  onClick={() => !isUploadingAvatar && fileInputRef.current?.click()}
                  title="Click to change avatar"
                >
                  {/* Outer glow ring */}
                  <div
                    className="w-28 h-28 rounded-full p-[2px] transition-all duration-300 group-hover:scale-105"
                    style={{ background: 'linear-gradient(135deg, #00FF41 0%, #004d14 50%, #00FF41 100%)' }}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden bg-zinc-900 flex items-center justify-center">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-75" />
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <User className="w-9 h-9 text-zinc-500" />
                          <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">NO IMG</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hover camera overlay */}
                  <div className="absolute inset-[2px] rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1 pointer-events-none">
                    <Upload className="w-5 h-5 text-[#00FF41]" />
                    <span className="text-[8px] font-mono text-[#00FF41] uppercase tracking-widest">Change</span>
                  </div>

                  {/* Subtle ping ring */}
                  <div className="absolute -inset-1 rounded-full border border-[#00FF41]/10 animate-ping pointer-events-none" />
                </div>

                {/* Hint text */}
                <p className="text-[10px] font-mono text-zinc-500 text-center leading-relaxed max-w-[220px]">
                  Click the avatar to upload a new photo.
                  <span className="text-zinc-600"> PNG / JPG / WebP — max 1MB.</span>
                </p>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />

                {/* ── Action Buttons — always below avatar ── */}
                <div className="flex flex-col items-center gap-2 w-full max-w-[260px]">

                  {/* Pending: confirm save */}
                  {pendingAvatarFile && (
                    <button
                      onClick={handleAvatarUpload}
                      disabled={isUploadingAvatar}
                      className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg bg-[#00FF41] text-black text-[11px] font-bold font-mono tracking-widest hover:bg-[#00e639] active:scale-[0.97] transition-all duration-200 disabled:opacity-60"
                      style={{ boxShadow: '0 0 20px rgba(0,255,65,0.4)' }}
                    >
                      {isUploadingAvatar
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
                        : <><Save className="w-3.5 h-3.5" /> Save Avatar</>
                      }
                    </button>
                  )}

                  {/* Change photo button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 text-[11px] font-mono tracking-widest hover:border-[#00FF41]/40 hover:text-[#00FF41] hover:bg-[#00FF41]/5 active:scale-[0.97] transition-all duration-200 disabled:opacity-40"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {pendingAvatarFile ? 'Choose Different' : 'Upload Photo'}
                  </button>

                  {/* Revert to original — only if a custom avatar is active (different from original) */}
                  {avatarPreview && avatarPreview !== originalImageRef.current && !pendingAvatarFile && (
                    <button
                      onClick={handleAvatarReset}
                      disabled={isUploadingAvatar}
                      className="w-full flex items-center justify-center gap-2.5 py-2 rounded-lg border border-zinc-800 text-zinc-500 text-[10px] font-mono tracking-widest hover:border-red-500/30 hover:text-red-400 hover:bg-red-950/10 active:scale-[0.97] transition-all duration-200 disabled:opacity-40"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Revert to Original
                    </button>
                  )}

                  {/* Status message */}
                  {avatarMessage && (
                    <div className={`flex items-center gap-2 text-[10px] font-mono pt-1 animate-fadeIn ${avatarMessage.type === 'success' ? 'text-[#00FF41]' : 'text-red-400'
                      }`}>
                      {avatarMessage.type === 'success'
                        ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      }
                      {avatarMessage.text}
                    </div>
                  )}
                </div>
              </div>

              {/* ── PROFILE FIELDS ────────────────────────────────────────── */}
              <div className="space-y-0 font-mono">
                <div className="flex items-center gap-4 py-3 border-b border-zinc-900">
                  <div className="w-2 h-2 rounded-full bg-[#00FF41] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[9px] text-zinc-600 uppercase tracking-widest block">Username</span>
                    <span className="text-sm font-bold text-white truncate block">{userName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 py-3 border-b border-zinc-900">
                  <div className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[9px] text-zinc-600 uppercase tracking-widest block">Email Address</span>
                    <span className="text-xs text-zinc-300 truncate block">{userEmail}</span>
                  </div>
                </div>

                {/* 2FA Status Row */}
                <div className="flex items-center gap-4 py-4 border-b border-zinc-900">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${(session?.user as any)?.twoFactorEnabled ? 'bg-[#00FF41]' : 'bg-zinc-700'}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] text-zinc-600 uppercase tracking-widest block">Two-Step Verification</span>
                    <span className="text-xs text-zinc-300">
                      {(session?.user as any)?.twoFactorEnabled ? 'SECURE_ACTIVE_TERMINAL' : 'INACTIVE'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if ((session?.user as any)?.twoFactorEnabled) {
                        handleDisable2FA();
                      } else {
                        handleStart2FASetup();
                      }
                    }}
                    className={`px-3 py-1.5 border rounded-lg text-[10px] font-bold tracking-widest transition-all ${(session?.user as any)?.twoFactorEnabled
                      ? 'text-red-400 border-red-950/30 hover:bg-red-950/20'
                      : 'text-[#00FF41] border-[#00FF41]/30 hover:bg-[#00FF41]/10'
                      }`}
                  >
                    {(session?.user as any)?.twoFactorEnabled ? 'DISABLE_2FA' : 'SETUP_2FA'}
                  </button>
                </div>

                {/* 2FA SETUP WIZARD (Inline) */}
                {isSettingUp2FA && (
                  <div className="mt-4 p-5 border border-[#00FF41]/20 bg-[#00FF41]/5 rounded-xl space-y-4 animate-fadeIn">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-[#00FF41]" />
                        <span className="text-[10px] font-bold font-mono tracking-[0.2em] text-[#00FF41]">INITIATING_2FA_VAULT_ENCRYPTION</span>
                      </div>
                      <button onClick={() => setIsSettingUp2FA(false)} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6 items-center">
                      {qrCodeData ? (
                        <div className="p-2 bg-white rounded-lg border-2 border-[#00FF41]/30 shadow-[0_0_20px_rgba(0,255,65,0.2)] shrink-0">
                          <img src={qrCodeData} alt="2FA QR Code" className="w-32 h-32" />
                        </div>
                      ) : (
                        <div className="w-32 h-32 flex items-center justify-center border border-zinc-800 rounded-lg shrink-0">
                          <RefreshCw className="w-5 h-5 animate-spin text-zinc-600" />
                        </div>
                      )}

                      <div className="flex-1 space-y-3">
                        <p className="text-[10px] text-zinc-400 font-mono leading-relaxed uppercase tracking-tighter">
                          1. Scan QR code with Google Authenticator.<br />
                          2. Enter the 6-digit code below.
                        </p>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="CODE"
                            value={setupToken}
                            onChange={(e) => setSetupToken(e.target.value.replace(/[^0-9]/g, ''))}
                            className="flex-1 bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-[#00FF41] focus:outline-none focus:border-[#00FF41]/50"
                          />
                          <button
                            onClick={handleConfirm2FASetup}
                            disabled={setupToken.length < 6}
                            className="px-4 py-2 bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/30 rounded-lg text-[10px] font-bold disabled:opacity-30 hover:bg-[#00FF41]/20 transition-all"
                          >
                            VERIFY
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-[#00FF41] animate-ping shrink-0" />
                  <div>
                    <span className="text-[9px] text-zinc-600 uppercase tracking-widest block">Status</span>
                    <span className="text-xs text-[#00FF41] font-bold uppercase">Active Session</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800/60 text-center text-[9px] font-mono text-zinc-500">
              SENTRY_PROFILE_AUTHENTICATED // SESSION_SECURE
            </div>
          </div>
        )}

        {/* 8. SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="cyber-panel p-4 sm:p-6 flex-1 flex flex-col justify-between overflow-y-auto animate-fadeIn">
            <div className="max-w-3xl mx-auto w-full space-y-6 sm:space-y-8 py-2 sm:py-4">
              <div className="flex items-center gap-3 pb-6 border-b border-zinc-800/60">
                <div className="p-3 bg-[#00FF41]/10 rounded-xl border border-[#00FF41]/20 shadow-[0_0_15px_rgba(0,255,65,0.05)]">
                  <SettingsIcon className="text-[#00FF41] w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold font-mono tracking-widest uppercase text-white">
                    SYSTEM SETTINGS
                  </h3>
                </div>
              </div>

              <div className="space-y-10 py-6 bg-zinc-950/20 p-8 rounded-2xl border border-zinc-900/50 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00FF41]/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-[#00FF41]/10 transition-all duration-700" />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] block">Trigger Sensitivity Threshold</span>
                    <div className="flex items-baseline gap-3">
                      <span
                        className={`text-5xl font-black font-terminal-mono transition-colors duration-300 ${globalThreshold < 0
                          ? 'text-red-500'
                          : 'text-[#00FF41] phosphor-glow-green'
                          }`}
                        style={globalThreshold < 0
                          ? { textShadow: '0 0 20px rgba(239,68,68,0.6), 0 0 40px rgba(239,68,68,0.3)' }
                          : undefined
                        }
                      >
                        {globalThreshold > 0 ? `+${globalThreshold}` : globalThreshold}%
                      </span>
                      <span className={`text-xs font-mono uppercase tracking-widest transition-colors duration-300 ${globalThreshold < 0 ? 'text-red-400' : 'text-zinc-400'
                        }`}>
                        {globalThreshold < 0 ? 'DROP_DETECTION' : globalThreshold === 0 ? 'NEUTRAL_IDLE' : 'SPIKE_DETECTION'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="relative pt-8 px-2">
                  <input
                    type="range"
                    min="-15"
                    max="15"
                    step="0.5"
                    value={globalThreshold}
                    onChange={(e) => setGlobalThreshold(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#00FF41] focus:outline-none shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"
                  />
                  <div className="flex justify-between mt-5 text-[9px] font-mono text-zinc-600 uppercase tracking-[0.2em] px-1 font-bold">
                    <span className="hover:text-red-500 transition-colors">CRITICAL_DROP (-15%)</span>
                    <span className="text-zinc-700">NEUTRAL (0%)</span>
                    <span className="hover:text-[#00FF41] transition-colors">MEGA_SPIKE (+15%)</span>
                  </div>
                  <div className="absolute left-1/2 top-8 w-0.5 h-2.5 bg-zinc-700 -translate-x-1/2" />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-zinc-800/60">
                {/* Status message - left */}
                <div className="w-full sm:w-auto">
                  {settingsMessage ? (
                    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-[10px] font-bold font-mono tracking-widest animate-fadeIn ${settingsMessage.type === 'success'
                      ? 'bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/30'
                      : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}>
                      {settingsMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                      {settingsMessage.text}
                    </div>
                  ) : (
                    <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                      Move slider then save to persist your threshold.
                    </p>
                  )}
                </div>

                {/* Save Button - right, always visible */}
                <button
                  id="settings-save-btn"
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="flex items-center gap-2.5 px-6 py-3 bg-[#00FF41] text-black font-bold font-mono text-xs tracking-widest rounded border border-[#00FF41] hover:bg-[#00e639] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex-shrink-0"
                  style={{ boxShadow: '0 0 20px rgba(0,255,65,0.35)' }}
                >
                  {isSavingSettings
                    ? <><RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" /> SYNCING_WITH_VAULT...</>
                    : <><Save className="w-4 h-4 flex-shrink-0" /> SAVE_SETTINGS</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
