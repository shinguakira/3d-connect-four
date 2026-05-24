"use client";

import { useMemo } from "react";

interface VictoryCrackersProps {
  // Changing this remounts and replays the burst. Pass `winner` or a tick.
  triggerKey: number | string;
  // Optional accent for one of the bursts. Falls back to a festive palette.
  accentColor?: string;
}

const PALETTE = [
  "#fde047", // yellow
  "#fb923c", // orange
  "#f472b6", // pink
  "#22d3ee", // cyan
  "#4ade80", // green
  "#a78bfa", // purple
  "#ffffff", // white sparkle
];

const SHAPES = ["rect", "square", "circle", "ribbon"] as const;
type Shape = (typeof SHAPES)[number];

interface Piece {
  id: number;
  origin: "left" | "right" | "center-burst";
  color: string;
  shape: Shape;
  w: number;
  h: number;
  tx: number; // horizontal travel (px)
  tyPeak: number; // upward peak height (negative px)
  rot: number; // final rotation (deg)
  dur: number; // animation duration (s)
  delay: number; // start delay (s)
}

// Deterministic-per-mount confetti burst. Two party-popper streams shoot
// inward + upward from the bottom-left and bottom-right corners, plus a
// small center burst behind the modal. Each piece arcs (up, then gravity
// down) while spinning, then fades. Pointer-events: none — never blocks UI.
export function VictoryCrackers({ triggerKey, accentColor }: VictoryCrackersProps) {
  const pieces = useMemo<Piece[]>(() => {
    void triggerKey; // recompute on remount
    const out: Piece[] = [];
    let id = 0;

    const palette = accentColor ? [accentColor, ...PALETTE] : PALETTE;

    // Left cracker: aims up-and-right
    for (let i = 0; i < 55; i++) {
      const angle = (-Math.PI / 2) + (Math.random() - 0.2) * 0.9; // mostly up, lean right
      const power = 320 + Math.random() * 420;
      out.push({
        id: id++,
        origin: "left",
        color: palette[Math.floor(Math.random() * palette.length)],
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        w: 6 + Math.random() * 8,
        h: 10 + Math.random() * 14,
        tx: Math.cos(angle) * power,
        tyPeak: Math.sin(angle) * power, // negative (upward)
        rot: (Math.random() - 0.5) * 1080,
        dur: 2.4 + Math.random() * 1.6,
        delay: Math.random() * 0.25,
      });
    }
    // Right cracker: aims up-and-left
    for (let i = 0; i < 55; i++) {
      const angle = (-Math.PI / 2) + (Math.random() - 0.8) * 0.9;
      const power = 320 + Math.random() * 420;
      out.push({
        id: id++,
        origin: "right",
        color: palette[Math.floor(Math.random() * palette.length)],
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        w: 6 + Math.random() * 8,
        h: 10 + Math.random() * 14,
        tx: Math.cos(angle) * power,
        tyPeak: Math.sin(angle) * power,
        rot: (Math.random() - 0.5) * 1080,
        dur: 2.4 + Math.random() * 1.6,
        delay: Math.random() * 0.25,
      });
    }
    // Center burst: radiates in all directions behind the modal for extra pop
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const power = 200 + Math.random() * 280;
      out.push({
        id: id++,
        origin: "center-burst",
        color: palette[Math.floor(Math.random() * palette.length)],
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        tx: Math.cos(angle) * power,
        tyPeak: Math.sin(angle) * power,
        rot: (Math.random() - 0.5) * 720,
        dur: 1.8 + Math.random() * 1.2,
        delay: Math.random() * 0.15,
      });
    }
    return out;
  }, [triggerKey, accentColor]);

  const renderPiece = (p: Piece) => {
    const positionStyle: React.CSSProperties =
      p.origin === "left"
        ? { left: "8%", bottom: "12%" }
        : p.origin === "right"
          ? { right: "8%", bottom: "12%" }
          : { left: "50%", top: "50%" };

    const shapeStyle: React.CSSProperties = (() => {
      switch (p.shape) {
        case "square":
          return { width: p.w, height: p.w, borderRadius: 2 };
        case "circle":
          return { width: p.w, height: p.w, borderRadius: "50%" };
        case "ribbon":
          return { width: p.w * 0.6, height: p.h * 1.4, borderRadius: 2 };
        case "rect":
        default:
          return { width: p.w, height: p.h, borderRadius: 1 };
      }
    })();

    return (
      <span
        key={p.id}
        className="confetti-piece"
        style={{
          position: "absolute",
          ...positionStyle,
          ...shapeStyle,
          background: p.color,
          boxShadow: `0 0 4px ${p.color}55`,
          // Pass per-piece motion as CSS variables; one keyframe drives everything.
          ["--tx" as never]: `${p.tx}px`,
          ["--ty-peak" as never]: `${p.tyPeak}px`,
          ["--rot" as never]: `${p.rot}deg`,
          animation: `confetti-fly ${p.dur}s ${p.delay}s cubic-bezier(0.22, 0.85, 0.45, 1) forwards`,
          opacity: 0,
        }}
      />
    );
  };

  return (
    <div
      key={triggerKey}
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
      aria-hidden="true"
    >
      {pieces.map(renderPiece)}
      {/* twin flash bursts at the cracker mouths */}
      <span
        className="confetti-flash"
        style={{ left: "8%", bottom: "12%", background: PALETTE[0] }}
      />
      <span
        className="confetti-flash"
        style={{ right: "8%", bottom: "12%", background: PALETTE[2] }}
      />

      <style jsx>{`
        @keyframes confetti-fly {
          0% {
            transform: translate(0, 0) rotate(0deg);
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          40% {
            transform: translate(calc(var(--tx) * 0.65), calc(var(--ty-peak) * 1.1))
              rotate(calc(var(--rot) * 0.4));
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), calc(var(--ty-peak) + 720px))
              rotate(var(--rot));
            opacity: 0;
          }
        }
        @keyframes confetti-flash {
          0% {
            transform: scale(0);
            opacity: 0.95;
          }
          40% {
            transform: scale(8);
            opacity: 0.6;
          }
          100% {
            transform: scale(14);
            opacity: 0;
          }
        }
        :global(.confetti-flash) {
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          filter: blur(6px);
          animation: confetti-flash 0.55s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
