# Incident: Next.js route conflict surfaced by 15.2.4 → 15.5.18 bump

**Date:** 2026-05-24
**Branch:** `develop`
**Reverted commit:** `55eaea7` (`feat(online): disconnect detection + per-tab session reconnect`)

## Symptom

After bumping Next.js from `15.2.4` → `15.5.18` (patching the React Flight
RCE — `GHSA-9qr9-h5gf-34mp`), the full E2E suite collapsed: only 12/63
tests passed, 30-minute wall time, with many online-flow tests failing
on `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.

That error means an API call meant to return JSON returned the Next.js
HTML error page instead.

## Root cause

The reconnect feature (commit `55eaea7`) added a snapshot endpoint at:

```
app/api/game/[roomId]/route.ts        ← NEW (reconnect validation)
```

Sibling literal routes already existed at:

```
app/api/game/create/route.ts
app/api/game/quick-match/route.ts
app/api/game/join/[roomId]/route.ts
```

Under **Next 15.2.4**, `POST /api/game/create` correctly routed to the
literal `create/route.ts` (literal-segment precedence). The full E2E
passed (63/63) at that point.

Under **Next 15.5.18**, the routing changed such that the dynamic
`[roomId]/route.ts` started matching first for `POST /api/game/create`
— and since that route file only exports `GET`, the dispatcher returned
**405 Method Not Allowed** as an HTML page. The client tried
`response.json()` on the HTML, got the `<!DOCTYPE` SyntaxError, and
every test that depended on creating a room cascaded.

So the issue is a **two-party regression**:

- The reconnect feature put a `route.ts` in a directory that already
  acted as a parent for literal-named children. Even if literal
  precedence held forever, this is a fragile place to put a handler.
- The Next 15.5.x dev-server routing change (intentional or not) was
  the trigger that turned a latent design issue into a hard failure.

Either side alone would have been fine.

## Resolution (this commit)

1. Bumped Next.js to `15.5.18` for the security fix — **kept**.
2. Reverted commit `55eaea7` in full — disconnect heartbeat + reconnect
   + the conflicting `[roomId]/route.ts` are all gone. (Revert commit:
   `54a453d`.)

Name validation (`06aeacc`) and the victory-perspective fix (`8cc8cac`)
are unaffected and remain.

## What we lose by reverting

- SSE heartbeat (10 s pings) — without it, a silently-dead opponent can
  show as connected up to the 30-min room TTL.
- Mid-game "相手切断" badge in the header.
- Page-reload reconnect via `sessionStorage`.
- The `GET /api/game/[roomId]` snapshot endpoint.

## When we re-add it

Use a path that **cannot** collide with sibling literal routes. Likely:

```
app/api/game/lookup/[roomId]/route.ts        ← safe, no literal siblings
```

Or, alternatively:

```
app/api/rooms/[roomId]/route.ts              ← whole new namespace
```

Before merging, validate by running the full E2E suite — do NOT trust
that "the individual specs pass". The Next routing behaviour is the
kind of thing only the full suite catches.

## Lessons

1. **Don't co-locate `route.ts` in a directory whose siblings include
   literal-named route directories** (`create/`, `join/`, etc.). Even if
   it works today, it's brittle.
2. **Run the full E2E after any dependency major/minor bump.** Unit
   tests + isolated spec passes are not enough — routing changes only
   surface across the full flow.
3. **There is no CI here.** If we don't run it locally, no one will.
   This is already called out in `AGENTS.md`.
