/**
 * Thai tone computation — ported from espeak-ng-portable src/thaiPron.ts (itself from Wiktionary Module:th-pron,
 * CC-BY-SA, tone facts as provenance). The tone is a deterministic function of initial-consonant CLASS ×
 * syllable LIFE × vowel LENGTH × any tone mark (the "tone triangle").
 */
export type ThaiConsonantClass = "mid" | "high" | "low";
export type ThaiTone = "mid" | "low" | "falling" | "high" | "rising";

/** Thai consonant → tonal CLASS (อักษร กลาง/สูง/ต่ำ). The 44 consonants: 9 mid, 11 high, 24 low. */
const THAI_CLASS: Readonly<Record<string, ThaiConsonantClass>> = {
  // mid (กลาง) — 9
  ก: "mid", จ: "mid", ฎ: "mid", ฏ: "mid", ด: "mid", ต: "mid", บ: "mid", ป: "mid", อ: "mid",
  // high (สูง) — 11
  ข: "high", ฃ: "high", ฉ: "high", ฐ: "high", ถ: "high", ผ: "high", ฝ: "high",
  ศ: "high", ษ: "high", ส: "high", ห: "high",
  // low (ต่ำ) — 24
  ค: "low", ฅ: "low", ฆ: "low", ง: "low", ช: "low", ซ: "low", ฌ: "low", ญ: "low",
  ฑ: "low", ฒ: "low", ณ: "low", ท: "low", ธ: "low", น: "low", พ: "low", ฟ: "low",
  ภ: "low", ม: "low", ย: "low", ร: "low", ล: "low", ฬ: "low", ว: "low", ฮ: "low",
};

/**
 * The four Thai tone marks ◌่◌้◌๊◌๋ (mai ek/tho/tri/chattawa), plus a combining macron
 * ◌̄ that appears ONLY in Wiktionary respellings to force mid tone — it never occurs in
 * real Thai text, so a caller scanning real orthography will only ever pass the four.
 */
export type ThaiToneMark = "่" | "้" | "๊" | "๋" | "̄";

/** Tone from an explicit TONE MARK × consonant class (th-pron `tFromMark`). */
const TONE_FROM_MARK: Readonly<Record<ThaiToneMark, Record<ThaiConsonantClass, ThaiTone>>> = {
  "่": { high: "low", mid: "low", low: "falling" }, //     mai ek
  "้": { high: "falling", mid: "falling", low: "high" }, // mai tho
  "๊": { high: "high", mid: "high", low: "high" }, //       mai tri
  "๋": { high: "rising", mid: "rising", low: "rising" }, // mai chattawa
  "̄": { high: "mid", mid: "mid", low: "mid" }, //          forced mid (respelling macron)
};

/** Tone with NO mark, from syllable LIFE+LENGTH × class (th-pron `tNoMark`). */
const TONE_NO_MARK: Readonly<Record<string, Record<ThaiConsonantClass, ThaiTone>>> = {
  "dead-short": { high: "low", mid: "low", low: "high" },
  "dead-long": { high: "low", mid: "low", low: "falling" },
  live: { high: "rising", mid: "mid", low: "mid" },
};

/** IPA tone-contour letters per tone (th-pron `tLevels`). */
export const THAI_TONE_IPA: Readonly<Record<ThaiTone, string>> = {
  high: "˦˥", mid: "˧", low: "˨˩", rising: "˩˩˦", falling: "˥˩",
};

/** Tonal class of a Thai initial consonant, or undefined if not a consonant. */
export function thaiConsonantClass(consonant: string): ThaiConsonantClass | undefined {
  return THAI_CLASS[consonant];
}

/**
 * The EFFECTIVE tonal class of a syllable initial, applying the leading-consonant
 * raise — the single most error-prone step when computing Thai tone:
 *  - a silent leading ห raises a following sonorant (low class) to HIGH (หมา → rising);
 *  - a silent leading อ in the four อย words (อย่า อยาก อยู่ อย่าง) makes ย behave MID.
 * Pass the base initial plus the silent leader (if any — the Phase-2b syllable parser
 * identifies it). Centralising this here means `computeThaiTone` callers can't forget
 * the raise: they ask THIS for the class. Returns undefined if `initial` isn't a consonant.
 */
export function thaiEffectiveClass(initial: string, silentLeader?: "ห" | "อ"): ThaiConsonantClass | undefined {
  if (thaiConsonantClass(initial) === undefined) return undefined;
  if (silentLeader === "ห") return "high"; // ห is high class; it governs the syllable's tone
  if (silentLeader === "อ") return "mid"; //  อ is mid class (the อย words)
  return thaiConsonantClass(initial);
}

/**
 * Compute the lexical tone of a Thai syllable.
 *  - `consonantClass`: the EFFECTIVE class of the initial — use `thaiEffectiveClass`
 *    so a silent ห/อ leader is applied (passing the raw low class of e.g. ม in หมา
 *    yields the wrong tone).
 *  - `life`: "live" (sonorant/open-long coda, or a live-exception vowel) or "dead"
 *    (stop coda, or open-short).
 *  - `length`: vowel length. NOTE it is IGNORED for live syllables (mirrors th-pron's
 *    single `live` key) — the caller may pass the measured length unconditionally.
 *  - `mark`: the syllable's single tone mark, if any (it overrides life/length). The
 *    caller must reject syllables with >1 tone mark upstream (th-pron returns nil on
 *    `[่้๊๋̄].?[่้๊๋̄]`); this takes one already-resolved mark.
 */
export function computeThaiTone(
  consonantClass: ThaiConsonantClass,
  life: "live" | "dead",
  length: "long" | "short",
  mark?: ThaiToneMark,
): ThaiTone {
  if (mark) return TONE_FROM_MARK[mark][consonantClass];
  const key = life === "live" ? "live" : `dead-${length}`;
  return TONE_NO_MARK[key]![consonantClass];
}

