/**
 * Uzbek (uz) number WORDS — cardinal and ordinal, shared by the engine (uzbek.ts) and the normalization
 * layer (normalize.ts). Turkic decimal composition: units + tens + hundred/thousand/million/billion,
 * concatenated with spaces (no fusion) — 11 = oʻn bir, 25 = yigirma besh, 1978 = ming toʻqqiz yuz yetmish
 * sakkiz. A bare 100/1000 drops the leading "bir" (yuz, ming) but million+ keeps it (bir million).
 *
 * ORDINALS: cardinal with the ordinal suffix on its LAST word only — -nchi after a vowel-final stem
 * (olti → oltinchi, yigirma → yigirmanchi), -inchi after a consonant (besh → beshinchi, toʻqqiz →
 * toʻqqizinchi). 1970 → ming toʻqqiz yuz yetmishinchi. The written convention `N-word` (16-noyabr,
 * 1978-yil, 190-oʻrin) is resolved via `ordinalWords` in normalize.ts — see the orthographic rule in
 * romanOrdinals.ts: an Arabic numeral takes a hyphen for the ordinal suffix.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { NumbersDef } from "../../core/numbers.ts";

const NUM = loadManifest<{ numbers: NumbersDef }>(import.meta.url, "uzbek.jsonc").numbers;
export type UzbekNumberWords = NumbersDef;

/** Turkic decimal composition: units + tens + hundred/thousand/… concatenated (no fusion, space-separated). */
export function turkicNumberWords(n: number, d: NumbersDef): (string | null)[] {
    if (n < 10) return [d.units[n]!];
    if (n < 100) {
        const t = Math.floor(n / 10) * 10,
            u = n % 10;
        return [d.tens[String(t)]!, ...(u ? [d.units[u]!] : [])];
    }
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        return [...(h > 1 ? [d.units[h]!] : []), d.magnitudes.hundred!, ...(r ? turkicNumberWords(r, d) : [])];
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return [...(th > 1 ? turkicNumberWords(th, d) : []), d.magnitudes.thousand!, ...(r ? turkicNumberWords(r, d) : [])];
    }
    if (n < 1_000_000_000) {
        const m = Math.floor(n / 1_000_000),
            r = n % 1_000_000;
        return [...turkicNumberWords(m, d), d.magnitudes.million!, ...(r ? turkicNumberWords(r, d) : [])];
    }
    const b = Math.floor(n / 1_000_000_000),
        r = n % 1_000_000_000;
    return [...turkicNumberWords(b, d), d.magnitudes.billion!, ...(r ? turkicNumberWords(r, d) : [])];
}

/** Integer → Uzbek words. Undefined/null gaps render as "?"; returns "" for unrenderable input. */
export function numberToWords(n: number): string {
    if (!Number.isFinite(n) || n < 0) return "";
    return turkicNumberWords(Math.floor(n), NUM)
        .map((w) => (w === null ? "?" : w))
        .join(" ");
}

/** Cardinal stem → ordinal. Vowel-final → -nchi (yigirma → yigirmanchi, olti → oltinchi); consonant-final →
 *  -inchi (toʻqqiz → toʻqqizinchi, sakson → saksoninchi). The comma-letter ʻ (U+02BB) is not a vowel, so
 *  `toʻrt` is correctly consonant-final → toʻrtinchi. Same rule as romanOrdinals.ts's `suffixed`. */
function suffixed(stem: string): string {
    return `${stem}${/[aeiou]$/u.test(stem) ? "" : "i"}nchi`;
}

/**
 * Integer → the Uzbek ORDINAL, ordinalizing only the LAST element: 1978 → ming toʻqqiz yuz yetmish
 * sakkizinchi, 190 → bir yuz toʻqsoninchi, 1000 → minginchi. Undefined outside the range the corpus's
 * ordinal contexts (years, centuries, dates, ranks) reach — well under 10^6.
 */
export function ordinalWords(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 1) return undefined;
    const words = turkicNumberWords(n, NUM).map((w) => (w === null ? "" : w));
    if (words.length === 0 || words.some((w) => w === "")) return undefined;
    words[words.length - 1] = suffixed(words[words.length - 1]!);
    return words.join(" ");
}
