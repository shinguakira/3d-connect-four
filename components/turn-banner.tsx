"use client";

import { useEffect, useState } from "react";

interface TurnBannerProps {
  // Bumped whenever a fresh turn-change should animate. The banner re-mounts
  // via React's `key` prop so the same player can re-trigger if needed.
  triggerKey: number;
  label: string;
  color: string;
  // "あなた" / "AI" / "プレイヤー1" etc. — short. Falls back to label if empty.
  sublabel?: string;
  // If true, render a "vs OPPONENT" feel (slightly different sweep direction).
  isOpponent?: boolean;
}

// Fire-Emblem-style turn-change overlay. Two diagonal slabs sweep across the
// screen from opposite edges, meeting in the middle where the active player's
// label sits. Auto-dismisses after ~1.4s. Pointer-events disabled so it never
// blocks the underlying 3D canvas.
export function TurnBanner({ triggerKey, label, color, sublabel, isOpponent }: TurnBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (triggerKey === 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1400);
    return () => clearTimeout(t);
  }, [triggerKey]);

  if (!visible) return null;

  // Skew direction flips for the opponent so the two players' banners read
  // visually opposite: red player = "/" slope, blue opponent = "\" slope.
  const skewDeg = isOpponent ? 6 : -6;
  const topDir = isOpponent ? "-translate-x-full" : "translate-x-full";
  const bottomDir = isOpponent ? "translate-x-full" : "-translate-x-full";

  // Label length tiers — shorter labels get the full punch, longer ones
  // (e.g. 20-char online player names) shrink and are allowed to wrap.
  const labelLen = label.length;
  const labelSizeClass =
    labelLen <= 10
      ? "text-3xl md:text-6xl"
      : labelLen <= 16
        ? "text-2xl md:text-5xl"
        : "text-xl md:text-4xl";

  return (
    <div
      key={triggerKey}
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
      aria-hidden="true"
    >
      {/* upper diagonal slab — slides in fast, holds briefly, slides out */}
      <div
        className="absolute left-0 right-0 top-1/2 h-32 md:h-40 origin-center shadow-2xl turn-banner-slab-top"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${color} 8%, ${color} 92%, transparent 100%)`,
          transform: `translateY(-110%) skewY(${skewDeg}deg) ${topDir === "translate-x-full" ? "translateX(100%)" : "translateX(-100%)"}`,
        }}
      />
      {/* lower diagonal slab */}
      <div
        className="absolute left-0 right-0 top-1/2 h-32 md:h-40 origin-center shadow-2xl turn-banner-slab-bottom"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${color} 8%, ${color} 92%, transparent 100%)`,
          transform: `translateY(10%) skewY(${skewDeg}deg) ${bottomDir === "translate-x-full" ? "translateX(100%)" : "translateX(-100%)"}`,
          opacity: 0.85,
        }}
      />
      {/* center text plate */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="turn-banner-text text-center px-8 md:px-12">
          <div
            className={`${labelSizeClass} font-black tracking-normal md:tracking-wider text-white drop-shadow-[0_3px_6px_rgba(0,0,0,0.5)] break-words leading-tight max-w-[90vw]`}
            style={{ textShadow: `0 0 18px ${color}cc, 0 2px 4px rgba(0,0,0,0.6)` }}
          >
            {label}
          </div>
          {sublabel && (
            <div className="mt-2 text-sm md:text-base font-semibold tracking-[0.3em] uppercase text-white/85 drop-shadow">
              {sublabel}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes turn-banner-slab-top {
          0% {
            transform: translateY(-110%) skewY(${skewDeg}deg) ${isOpponent ? "translateX(-110%)" : "translateX(110%)"};
            opacity: 0;
          }
          18% {
            transform: translateY(-110%) skewY(${skewDeg}deg) translateX(0%);
            opacity: 1;
          }
          78% {
            transform: translateY(-110%) skewY(${skewDeg}deg) translateX(0%);
            opacity: 1;
          }
          100% {
            transform: translateY(-110%) skewY(${skewDeg}deg) ${isOpponent ? "translateX(110%)" : "translateX(-110%)"};
            opacity: 0;
          }
        }
        @keyframes turn-banner-slab-bottom {
          0% {
            transform: translateY(10%) skewY(${skewDeg}deg) ${isOpponent ? "translateX(110%)" : "translateX(-110%)"};
            opacity: 0;
          }
          18% {
            transform: translateY(10%) skewY(${skewDeg}deg) translateX(0%);
            opacity: 0.85;
          }
          78% {
            transform: translateY(10%) skewY(${skewDeg}deg) translateX(0%);
            opacity: 0.85;
          }
          100% {
            transform: translateY(10%) skewY(${skewDeg}deg) ${isOpponent ? "translateX(-110%)" : "translateX(110%)"};
            opacity: 0;
          }
        }
        @keyframes turn-banner-text {
          0% {
            transform: scale(0.6);
            opacity: 0;
            filter: blur(8px);
          }
          25% {
            transform: scale(1.08);
            opacity: 1;
            filter: blur(0);
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
          78% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1.05);
            opacity: 0;
          }
        }
        :global(.turn-banner-slab-top) {
          animation: turn-banner-slab-top 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        :global(.turn-banner-slab-bottom) {
          animation: turn-banner-slab-bottom 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        :global(.turn-banner-text) {
          animation: turn-banner-text 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>
    </div>
  );
}
