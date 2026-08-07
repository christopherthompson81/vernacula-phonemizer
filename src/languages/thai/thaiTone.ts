/**
 * Thai tone computation — from Wiktionary Module:th-pron (CC-BY-SA, tone facts as provenance).
 * The tone is a deterministic function of initial-consonant CLASS ×
 * syllable LIFE × vowel LENGTH × any tone mark (the "tone triangle").
 */
import { MANIFEST } from "./manifest.ts";

export type ThaiConsonantClass = "mid" | "high" | "low";
export type ThaiTone = "mid" | "low" | "falling" | "high" | "rising";

/**
 * The four Thai tone marks ◌่◌้◌๊◌๋ (mai ek/tho/tri/chattawa), plus a combining macron
 * ◌̄ that appears ONLY in Wiktionary respellings to force mid tone — it never occurs in
 * real Thai text, so a caller scanning real orthography will only ever pass the four.
 */
export type ThaiToneMark = "่" | "้" | "๊" | "๋" | "̄";

// The tone tables are DATA (thai.jsonc → tone). THAI_CLASS: consonant → tonal class (9 mid, 11 high, 24 low);
// TONE_FROM_MARK: mark × class; TONE_NO_MARK: (life+length) × class; THAI_TONE_IPA: tone → Chao letters.
const THAI_CLASS = MANIFEST.tone.class;
const TONE_FROM_MARK = MANIFEST.tone.fromMark;
const TONE_NO_MARK = MANIFEST.tone.noMark;

/** IPA tone-contour letters per tone (th-pron `tLevels`). */
export const THAI_TONE_IPA = MANIFEST.tone.ipa;

/** Tonal class of a Thai initial consonant, or undefined if not a consonant. */
export function thaiConsonantClass(
    consonant: string,
): ThaiConsonantClass | undefined {
    return THAI_CLASS[consonant];
}

/**
 * The EFFECTIVE tonal class of a syllable initial, applying the leading-consonant
 * raise — the single most error-prone step when computing Thai tone:
 *  - a silent leading ห raises a following sonorant (low class) to HIGH (หมา → rising);
 *  - a silent leading อ in the four อย words (อย่า อยาก อยู่ อย่าง) makes ย behave MID.
 * Pass the base initial plus the silent leader (if any — the syllable parser
 * identifies it). Centralising this here means `computeThaiTone` callers can't forget
 * the raise: they ask THIS for the class. Returns undefined if `initial` isn't a consonant.
 */
export function thaiEffectiveClass(
    initial: string,
    silentLeader?: "ห" | "อ",
): ThaiConsonantClass | undefined {
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
