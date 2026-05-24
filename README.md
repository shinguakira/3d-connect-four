# 3D Connect Four

> **Languages:** **English** · [日本語](README.ja.md)

A three-dimensional take on Connect Four, played on a **4×4×4** cube. Drop pieces under gravity into any (x, z) column and win by lining up four in any of the 13 possible directions — rows, columns, depth, face diagonals, or space diagonals.

Built with Next.js 15, React 19, TypeScript, Three.js (`@react-three/fiber`), and Tailwind CSS. Supports **local 2-player**, **vs AI** (3 difficulties), and **online multiplayer** over Server-Sent Events.

![Title screen](doc/images/01-title.png)

---

## Features

- 🧊 **True 3D board** — 64 cells in a 4×4×4 cube, rendered with Three.js / `@react-three/fiber`.
- 🎯 **All 13 win directions** — rows, columns, vertical stacks, face diagonals, and full-cube space diagonals.
- 🤖 **Heuristic AI** with three difficulties (easy / normal / hard): immediate-win detection, opponent-threat blocking, line-evaluation + lookahead.
- 🌐 **Online multiplayer** — quick match, create-room, or join-by-ID; state is broadcast over SSE.
- 💡 **Reach hints** — visualizes your own "one piece away from winning" lines. Crucially, the opponent never sees yours.
- 🎨 **Customization** — per-player colors, grid toggles, AI difficulty selector.
- 📱 **Responsive** — touch controls (1 finger = orbit, 2 = zoom, tap = drop) on mobile.

---

## Quick start

```sh
pnpm install
pnpm dev          # → http://localhost:3000
```

> This project uses **pnpm** (lockfile: `pnpm-lock.yaml`). Don't mix in `npm install` — peer-dep resolution differs and you'll fight ERESOLVE errors.

### Scripts

| Command                | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `pnpm dev`             | Start dev server (Turbopack)                           |
| `pnpm build`           | Production build                                       |
| `pnpm start`           | Run the production server                              |
| `pnpm lint`            | Lint with oxlint                                       |
| `pnpm test`            | Run unit tests (Vitest)                                |
| `pnpm test:e2e`        | Run Playwright end-to-end tests                        |
| `pnpm docs:screenshots`| Regenerate `doc/images/*.png` for the user manual      |

### Environment

| Variable               | Purpose                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | Origin used to resolve absolute URLs for OpenGraph / Twitter card images (prod).         |

---

## Game modes

| Mode             | Description                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| **2 player**     | Pass-and-play on the same screen.                                                                |
| **vs AI**        | Three difficulty levels. The AI runs entirely in the browser.                                    |
| **Online**       | Real-time multiplayer over SSE. Quick-match, host-a-room, or join-by-ID.                         |

For controls and screen-by-screen walkthroughs, see [doc/user-manual.md](doc/user-manual.md) (Japanese).

---

## Project layout

```
app/
├── layout.tsx              # Root layout + site metadata (OG / favicon)
├── icon.svg                # Favicon
├── apple-icon.svg          # iOS home-screen icon
├── page.tsx                # Top-level state machine (menu / playing / online-*)
└── api/game/               # Online-play API routes (REST + SSE)
components/
├── title-page.tsx          # Title / mode selector
├── game-page.tsx           # In-game 3D canvas + UI
├── online-menu.tsx         # Quick-match / create / join tabs
├── online-waiting.tsx      # Pre-game lobby
└── ui/                     # shadcn/ui (Radix) primitives
hooks/
└── useOnlineGame.ts        # SSE client + REST helpers
lib/
├── game-logic.ts           # Pure rules: board, win check, reach detection
└── game-manager.ts         # In-memory room registry (server)
tests/
├── unit/                   # Vitest
└── e2e/                    # Playwright
doc/
├── game.md                 # Rules & internals (Japanese)
├── user-manual.md          # End-user manual (Japanese)
└── images/                 # Screenshots used in the manual
```

Deeper architecture notes for AI agents (Claude Code, Codex, Cursor, etc.) live in [AGENTS.md](AGENTS.md).

---

## Online multiplayer notes

- Room state lives in an **in-process singleton** (`lib/game-manager.ts`). It is **lost on server restart** and does not survive horizontal scaling — for serverless production deployments, swap it for Redis or similar.
- Live state is pushed via **Server-Sent Events** at `app/api/game/[roomId]/events/route.ts`. Clients reconnect with exponential backoff (up to 5 attempts).
- Inactive rooms are garbage-collected after 30 minutes.

---

## Tech stack

| Area          | Choice                                                            |
| ------------- | ----------------------------------------------------------------- |
| Framework     | Next.js 15 (App Router)                                           |
| Language      | TypeScript 5 (strict)                                             |
| UI            | React 19, Radix UI, Tailwind CSS, shadcn/ui                       |
| 3D            | Three.js, `@react-three/fiber`, `@react-three/drei`               |
| Icons         | lucide-react                                                      |
| Test          | Vitest (unit), Playwright (e2e + screenshots)                     |
| Package mgr   | pnpm                                                              |

---

## History

Originally scaffolded with [v0.dev](https://v0.dev) and then substantially rewritten by hand.
