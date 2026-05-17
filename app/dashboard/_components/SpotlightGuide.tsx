'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';

// 1. DATA TYPES & SCHEMA DEFINITIONS
export interface OnboardingStep {
  targetId: string;
  title: string;
  description: string;
  targetTab?: 'dashboard' | 'watchlist' | 'alerts' | 'market' | 'profile';
}

interface TutorialContextType {
  activeStep: number;
  isActive: boolean;
  steps: OnboardingStep[];
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  // --- SIDEBAR / LEFT PANEL GUIDANCE ---
  {
    targetId: 'sidebar-nav',
    title: '1. SECURE NAVIGATION CONSOLE',
    description:
      'Welcome to Sentry.v4 Tactical Console. This left sidebar is your main navigation console. Use it to jump between live surveillance views, monitor system telemetry, and manage agent configurations.',
    targetTab: 'dashboard',
  },
  {
    targetId: 'nav-dashboard',
    title: '2. DASHBOARD COMMAND',
    description:
      'The Dashboard view gives you an immediate macroscopic summary of global liquidity, real-time spot tickers, active threat alert audit logs, and malware risk coefficients.',
    targetTab: 'dashboard',
  },
  {
    targetId: 'nav-alerts',
    title: '3. ACTIVE ALERTS MONITOR',
    description:
      'The Active Alerts view lets you manage armed drop threshold interceptors. Configure custom percentage drop limits to receive automated flash crash security signals.',
    targetTab: 'alerts',
  },
  {
    targetId: 'nav-watchlist',
    title: '4. WATCHLIST TRACKER',
    description:
      'The Watchlist view tracks specific nodes you have starred for active surveillance, giving you dedicated live spot matrices and directional volatility indicators.',
    targetTab: 'watchlist',
  },
  {
    targetId: 'nav-market',
    title: '5. MARKET DATA EXPLORER',
    description:
      'The Market Data view hosts the complete digital asset terminal. Search, filter, and sort through real-time spot rate feeds from global liquidity pools.',
    targetTab: 'market',
  },
  {
    targetId: 'nav-profile',
    title: '6. USER PROFILE & SETTINGS',
    description:
      'The User Profile view lets you manage your terminal clearance identity, adjust global security drop thresholds, toggle compact UI views, and execute session self-destruct termination.',
    targetTab: 'profile',
  },

  // --- CORE APPLICATION SECTIONS WALKTHROUGH ---
  {
    targetId: 'portfolio-analytics',
    title: '7. MACRO LIQUIDITY & RISK METRICS',
    description:
      'Here on the main dashboard, monitor global digital asset market capitalization, 24-hour volume, and real-time volatility coefficients reflecting buy pressure against sell walls.',
    targetTab: 'dashboard',
  },
  {
    targetId: 'price-cards',
    title: '8. REAL-TIME ASSET TICKERS',
    description:
      'Live spot tracking for primary nodes (BTC / ETH / SOL). Features responsive micro-sparklines displaying localized 24-hour directional volatility.',
    targetTab: 'dashboard',
  },
  {
    targetId: 'alert-log',
    title: '9. THREAT ALERT AUDIT FEED',
    description:
      'An immutable security feed tracing threshold breach events, baseline price deviations, system status updates, and emergency flash crash alerts.',
    targetTab: 'dashboard',
  },
  {
    targetId: 'search-filter-system',
    title: '10. SEARCH & FILTER ENGINE',
    description:
      'On the Market Data view, use this interactive querying engine to filter nodes by name, symbol, or asset ID in real-time, with instant volatility sorting options.',
    targetTab: 'market',
  },
  {
    targetId: 'settings-logout-section',
    title: '11. SETTINGS & SECURITY PROTOCOLS',
    description:
      'Inside the User Profile, adjust armed intercept drop limits via slider, toggle automated sentry guard background trackers, or execute secure session termination.',
    targetTab: 'profile',
  },
];

// 2. CONTEXT DECLARATION
const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [activeStep, setActiveStep] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const { update: updateSession } = useSession();

  const startTutorial = () => {
    setActiveStep(0);
    setIsActive(true);
  };

  const nextStep = () => {
    if (activeStep < ONBOARDING_STEPS.length - 1) {
      setActiveStep((prev) => prev + 1);
    } else {
      skipTutorial();
    }
  };

  const prevStep = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const skipTutorial = async () => {
    setIsActive(false);
    
    // Persist to Database via API
    try {
      const res = await fetch('/api/user/tutorial', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        // Update local session state to prevent future auto-triggers
        await updateSession();
      }
    } catch (error) {
      console.error('Failed to persist tutorial status:', error);
    }
  };

  return (
    <TutorialContext.Provider
      value={{
        activeStep,
        isActive,
        steps: ONBOARDING_STEPS,
        startTutorial,
        nextStep,
        prevStep,
        skipTutorial,
      }}
    >
      {children}
      <SpotlightOverlay />
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}

// 3. HOLE-PUNCH GRAPHICS & TOOLTIP ELEMENT
function SpotlightOverlay() {
  const { activeStep, isActive, steps, nextStep, prevStep, skipTutorial } = useTutorial();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const observerRef = useRef<MutationObserver | null>(null);

  const step = steps[activeStep];

  // Auto Scroll & Dynamic Positioning Engine
  useEffect(() => {
    if (!isActive || !step) {
      setRect(null);
      return;
    }

    const updatePosition = () => {
      const element = document.getElementById(step.targetId);
      if (element) {
        // Fetch coordinates of target DOM node
        const bounding = element.getBoundingClientRect();
        setRect(bounding);

        // Calculate dynamic tooltip positioning (below, above, or centered based on screen estate)
        const tooltipWidth = Math.min(340, window.innerWidth - 32);
        const tooltipHeight = 220;

        let top = bounding.bottom + 16;
        let left = bounding.left + bounding.width / 2 - tooltipWidth / 2;

        if (top + tooltipHeight > window.innerHeight && bounding.top > tooltipHeight) {
          // Put above if not enough space below
          top = bounding.top - tooltipHeight - 16;
        }

        // Clamp inside browser boundaries to prevent clipping on mobile, tablet, and desktop
        left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, left));
        top = Math.max(16, Math.min(window.innerHeight - tooltipHeight - 16, top));

        setTooltipPos({ top, left });
      } else {
        // Element not mounted or switching tabs, fallback to center screen
        console.warn(`[SENTRY_GUIDE] Target element #${step.targetId} not found in DOM. Falling back to center.`);
        setRect(null);
        setTooltipPos({
          top: window.innerHeight / 2 - 100,
          left: window.innerWidth / 2 - 170,
        });
      }
    };

    // 1. Smoothly scroll target into view automatically
    const scrollTarget = () => {
      const element = document.getElementById(step.targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    };

    // Execute scroll and position update
    setTimeout(() => {
      scrollTarget();
      updatePosition();
    }, 150);

    // Hook listeners for responsive updates
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    // Watch for DOM changes to recalculate positions as components mount/render
    observerRef.current = new MutationObserver(updatePosition);
    observerRef.current.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isActive, step, activeStep]);

  if (!isActive) return null;

  // Render Hole-Punch Overlay & Floating Tooltip with smooth transition mechanics
  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none">
      {/* 1. Backdrop Shade Mask with Hole Punch Circle */}
      {rect ? (
        <div
          className="fixed z-40 pointer-events-none rounded-2xl shadow-[0_0_0_9999px_rgba(5,5,5,0.85)] transition-all duration-500 ease-out border-2 border-[#00FF41]/40"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: '0 0 0 9999px rgba(5, 5, 5, 0.85), 0 0 15px rgba(0, 255, 65, 0.4)',
          }}
        />
      ) : (
        // Full screen cover if target is not found
        <div className="fixed inset-0 z-40 bg-black/80 pointer-events-auto" />
      )}

      {/* 2. Floating Info Box Container */}
      <div
        className="fixed z-50 pointer-events-auto transition-all duration-500 ease-out"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-[340px] bg-[#111111] border border-[#00FF41]/30 rounded-[12px] p-5 shadow-[0_4px_30px_rgba(0,255,65,0.15)] cyber-scanlines relative overflow-hidden"
          >
            {/* Corner Decorative Tech Notches */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00FF41]" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00FF41]" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00FF41]" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00FF41]" />

            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-mono text-[#00FF41] tracking-widest bg-[#00FF41]/10 px-2 py-0.5 rounded border border-[#00FF41]/20">
                SENTRY GUIDE [{activeStep + 1}/{steps.length}]
              </span>
              <button
                onClick={skipTutorial}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-mono"
              >
                SKIP_
              </button>
            </div>

            <h3 className="text-sm font-bold text-white tracking-wide mb-2 uppercase font-terminal-mono">
              {step?.title || 'TACTICAL UPDATE'}
            </h3>

            <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-4 min-h-[50px]">
              {step?.description}
            </p>

            <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-800">
              <div className="flex gap-1">
                {steps.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === activeStep ? 'w-4 bg-[#00FF41]' : 'w-1.5 bg-zinc-800'
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                {activeStep > 0 && (
                  <button
                    onClick={prevStep}
                    className="text-xs font-mono border border-zinc-800 hover:border-zinc-700 text-zinc-400 px-3 py-1.5 rounded bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
                  >
                    PREV
                  </button>
                )}
                <button
                  onClick={nextStep}
                  className="text-xs font-mono bg-[#00FF41] text-black font-semibold px-3 py-1.5 rounded hover:scale-105 active:scale-95 transition-all shadow-[0_0_10px_rgba(0,255,65,0.4)] hover:shadow-[0_0_15px_rgba(0,255,65,0.6)]"
                >
                  {activeStep === steps.length - 1 ? 'LAUNCH_' : 'NEXT →'}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
