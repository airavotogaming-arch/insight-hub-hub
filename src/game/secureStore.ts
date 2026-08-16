/**
 * Tamper-resistant localStorage.
 *
 * Values are stored as base64("<json>|<hash>") where the hash is a keyed
 * digest of the payload. Hand-editing the stored string in DevTools breaks
 * the digest, so the value is rejected and falls back to the default.
 *
 * This is obfuscation, not security: everything runs on the player's machine.
 * It stops casual cheating (editing a number in Application > Local Storage),
 * which is all that is possible without a server as referee.
 */

// Split so the literal never appears as one searchable string in the bundle.
const SALT = ["9f", "c1", "carn", "iv", "al", "7b3"].join("") + String(0x5f3759df);

function digest(input: string): string {
  // FNV-1a (32-bit) over the payload + salt, then a second pass with the
  // reversed payload so single-character edits cannot collide easily.
  const hash = (s: string) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  };
  const a = hash(input + SALT);
  const b = hash(SALT + [...input].reverse().join(""));
  return a.toString(36) + "-" + b.toString(36);
}

function encode(s: string): string {
  try {
    return btoa(unescape(encodeURIComponent(s)));
  } catch {
    return s;
  }
}

function decode(s: string): string {
  try {
    return decodeURIComponent(escape(atob(s)));
  } catch {
    return "";
  }
}

export function secureGet<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    const raw = decode(stored);
    const cut = raw.lastIndexOf("|");
    if (cut < 0) return fallback; // legacy or hand-written plain value: distrust it
    const payload = raw.slice(0, cut);
    const sig = raw.slice(cut + 1);
    if (sig !== digest(payload)) return fallback; // tampered
    return JSON.parse(payload) as T;
  } catch {
    return fallback;
  }
}

export const upgradeFlag = (key: string) => `${key}~up`;

export function secureSet(key: string, value: unknown): void {
  if (typeof localStorage === "undefined") return;
  try {
    const payload = JSON.stringify(value);
    localStorage.setItem(key, encode(`${payload}|${digest(payload)}`));
    // Once a key has ever been written in signed form, the legacy plain-text
    // upgrade path is closed for good.
    if (!key.endsWith("~up")) secureSet(upgradeFlag(key), true);
  } catch {
    /* storage full or blocked — nothing to do */
  }
}

export function secureRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Clamp to a safe, finite, non-negative integer. */
export function safeInt(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.floor(n)));
}

/**
 * One-time upgrade path: read a value written by the old plain-text format,
 * re-save it signed, and return it. Keeps existing players' progress instead
 * of silently resetting it when the signed format lands.
 */
export function secureGetOrMigrate<T>(key: string, fallback: T, parseLegacy: (raw: string) => T | undefined): T {
  if (typeof localStorage === "undefined") return fallback;
  const signed = secureGet<T | undefined>(key, undefined);
  if (signed !== undefined) return signed;
  // Legacy plain values are accepted exactly once per key. After that the
  // upgrade is marked done, so writing a plain number by hand is rejected
  // instead of being "migrated" into a trusted value.
  const flag = upgradeFlag(key);
  if (secureGet<boolean>(flag, false)) return fallback;
  secureSet(flag, true);
  const stored = localStorage.getItem(key);
  const legacy = stored ? parseLegacy(stored) : undefined;
  if (legacy === undefined) return fallback;
  secureSet(key, legacy);
  return legacy;
}

export const legacyNumber = (raw: string): number | undefined => {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : undefined;
};

export const legacyJson = <T,>(raw: string): T | undefined => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};
