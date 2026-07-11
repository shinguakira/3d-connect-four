# TypeScript 7 (tsgo) type-check upgrade — 3d-connect-four

Swapped the standalone type-check step from classic `tsc` to the TypeScript 7
native (Go) compiler, shipped as `@typescript/native-preview` → the `tsgo` binary.
Next.js 15.5.18 App Router, pnpm, Three.js + React Three Fiber.

## Result

| Compiler | Mode | Time |
|---|---|---|
| tsc 5.x | cold | ~12,400 ms |
| tsc 5.x | warm (incremental) | ~7,500 ms |
| tsgo 7.0 | full, every run | ~1,700 ms |

≈4.4× faster than warm tsc, ≈7× vs cold. No `.tsbuildinfo` cache, so ~1.7s every run.

**Parity verified:** tsc and tsgo emit the *identical* 61 diagnostics (byte-for-byte
diff clean). This repo does **not** type-check clean — see "Pre-existing errors" below —
but both compilers agree exactly, which is the parity guarantee that matters.

`next build` re-validated: exit 0, compiles, 8/8 static pages.

## Changes made

- `pnpm add -D @typescript/native-preview` (pinned `7.0.0-dev.20260707.2`).
- `package.json`: added `"type-check": "tsgo --noEmit"` and
  `"type-check:tsc": "tsc --noEmit"` (fallback / cross-check). There was **no**
  type-check script before this.
- `tsconfig.json`: added `"noUncheckedSideEffectImports": false`.

## Gotchas encountered (vs the generic create-next-app playbook)

- **TS5102 (baseUrl removed):** N/A here — this tsconfig never had `baseUrl`;
  it already used the `@/*` → `./*` path mapping. Nothing to rewrite.
- **TS2882 (global CSS side-effect import):** hit as expected —
  `app/layout.tsx` has `import "./globals.css"`. tsgo defaults
  `noUncheckedSideEffectImports` to `true`; classic tsc defaults `false`.
  Fixed with the one-line `"noUncheckedSideEffectImports": false`.

## Pre-existing type errors (NOT introduced by this upgrade)

The repo carries 61 pre-existing type errors, tolerated at build time via
`typescript.ignoreBuildErrors: true` in `next.config.mjs`. Both tsc and tsgo
report them identically. Breakdown:

- 56× TS18047 `'ctx'/'canvas' possibly null` in `components/background/animated-*.tsx`
- 3× TS7016 `Could not find a declaration file for module 'three'` — **`@types/three`
  is not installed** (only `three` is a dep). Add `-D @types/three` to fix.
- 1× TS7006 implicit-any param in `components/game-page.tsx:1308`
- 1× TS2322 `Player` not assignable to `Player | null` in `lib/game-manager.ts:58`

Fixing these was out of scope for the compiler swap. `type-check`/`type-check:tsc`
will report a non-zero exit until they are addressed.

## Caveats

- tsgo is a dev preview (stable ~Q3 2026); `type-check:tsc` kept as cross-check.
- `next build` still uses its own bundled classic tsc — but with
  `ignoreBuildErrors: true` here, build safety is governed by that flag, not the
  compiler choice. The speedup is only the standalone `type-check` step.

## Replicate on another repo

Install the preview → point `type-check` at tsgo (keep `tsc` fallback) → run tsgo,
fix TS5102/TS2882 as needed → confirm the diagnostic set matches tsc → verify `next build`.
