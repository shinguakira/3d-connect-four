// Shared validation rules for online player input. Used by API routes (the
// trust boundary) and surfaced to the UI so client and server agree on what
// counts as a valid name.

export const MIN_NAME_LEN = 1;
export const MAX_NAME_LEN = 20;

// Count user-perceived characters. Codepoints (via for-of) is a good middle
// ground:
//   - ASCII, hiragana, katakana, kanji: 1 each (matches intuition).
//   - Surrogate-pair emoji (e.g. game-pad): 1 each. (`.length` would say 2.)
//   - Combining marks: each counted separately (rare in player names).
// Intl.Segmenter "grapheme" would be more precise but isn't worth the cost
// here — the 20 cap is a generous UX limit, not a security boundary.
export function countCodepoints(s: string): number {
  let n = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const _ of s) n++;
  return n;
}

// Match ASCII control chars (incl. tab, newline, vertical-tab, form-feed, CR)
// + DEL. Defined via String.fromCharCode so the source file stays pure ASCII.
const CONTROL_CHAR_RE = new RegExp(
  "[" + String.fromCharCode(0) + "-" + String.fromCharCode(31) + String.fromCharCode(127) + "]",
  "g",
);

export type NameValidationResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

// Validate a raw player-name input from an API request body. Returns either
// the cleaned name (control chars stripped, trimmed) or a human-readable
// Japanese error message safe to surface in the UI.
export function validatePlayerName(raw: unknown): NameValidationResult {
  if (typeof raw !== "string") {
    return { ok: false, error: "プレイヤー名を入力してください" };
  }
  const cleaned = raw.replace(CONTROL_CHAR_RE, "").trim();
  const len = countCodepoints(cleaned);
  if (len < MIN_NAME_LEN) {
    return { ok: false, error: "プレイヤー名を入力してください" };
  }
  if (len > MAX_NAME_LEN) {
    return {
      ok: false,
      error: `プレイヤー名は ${MAX_NAME_LEN} 文字以内で入力してください`,
    };
  }
  return { ok: true, name: cleaned };
}
