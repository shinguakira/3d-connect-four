import { describe, it, expect } from "vitest";
import {
  MAX_NAME_LEN,
  MIN_NAME_LEN,
  countCodepoints,
  validatePlayerName,
} from "@/lib/online-validation";

describe("countCodepoints", () => {
  it("counts ASCII characters", () => {
    expect(countCodepoints("Alice")).toBe(5);
  });
  it("counts fullwidth Japanese as one each", () => {
    expect(countCodepoints("あいうえお")).toBe(5);
    expect(countCodepoints("漢字テスト")).toBe(5);
  });
  it("counts surrogate-pair emoji as one (not two)", () => {
    // U+1F3AE GAME-PAD is a surrogate pair in UTF-16; .length returns 2.
    expect("🎮".length).toBe(2);
    expect(countCodepoints("🎮")).toBe(1);
    expect(countCodepoints("a🎮b")).toBe(3);
  });
  it("counts empty as 0", () => {
    expect(countCodepoints("")).toBe(0);
  });
});

describe("validatePlayerName", () => {
  it("constants are sane", () => {
    expect(MIN_NAME_LEN).toBe(1);
    expect(MAX_NAME_LEN).toBe(20);
  });

  it("accepts a typical Latin name", () => {
    const r = validatePlayerName("Alice");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.name).toBe("Alice");
  });

  it("accepts up to MAX_NAME_LEN fullwidth Japanese characters", () => {
    const name = "あいうえおかきくけこさしすせそたちつてと"; // exactly 20
    expect(countCodepoints(name)).toBe(20);
    const r = validatePlayerName(name);
    expect(r.ok).toBe(true);
  });

  it("rejects MAX_NAME_LEN + 1 fullwidth Japanese characters", () => {
    const name = "あいうえおかきくけこさしすせそたちつてとな"; // 21
    expect(countCodepoints(name)).toBe(21);
    const r = validatePlayerName(name);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/20/);
  });

  it("rejects MAX_NAME_LEN + 1 Latin characters", () => {
    const r = validatePlayerName("A".repeat(MAX_NAME_LEN + 1));
    expect(r.ok).toBe(false);
  });

  it("accepts 20 emoji even though UTF-16 length would be 40", () => {
    const name = "🎮".repeat(20);
    expect(name.length).toBe(40);
    const r = validatePlayerName(name);
    expect(r.ok).toBe(true);
  });

  it("rejects 21 emoji", () => {
    const r = validatePlayerName("🎮".repeat(21));
    expect(r.ok).toBe(false);
  });

  it("rejects empty string", () => {
    const r = validatePlayerName("");
    expect(r.ok).toBe(false);
  });

  it("rejects whitespace-only", () => {
    expect(validatePlayerName("   ").ok).toBe(false);
    expect(validatePlayerName("\t\n  ").ok).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(validatePlayerName(undefined).ok).toBe(false);
    expect(validatePlayerName(null).ok).toBe(false);
    expect(validatePlayerName(42).ok).toBe(false);
    expect(validatePlayerName({}).ok).toBe(false);
  });

  it("strips leading/trailing whitespace", () => {
    const r = validatePlayerName("  Bob  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.name).toBe("Bob");
  });

  it("strips ASCII control characters from inside the string", () => {
    // Embed a literal tab + null + DEL between letters.
    const dirty =
      "A" + String.fromCharCode(9) + String.fromCharCode(0) + String.fromCharCode(127) + "B";
    const r = validatePlayerName(dirty);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.name).toBe("AB");
  });

  it("preserves internal spaces", () => {
    const r = validatePlayerName("Player One");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.name).toBe("Player One");
  });
});
