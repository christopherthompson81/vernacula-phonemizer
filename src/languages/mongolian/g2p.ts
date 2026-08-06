/**
 * Mongolian (mn) grapheme→phoneme engine — Cyrillic, canonical IPA. A greedy longest-match scan
 * (diphthongs / doubled long vowels before single letters) that emits IPA segments tagged nucleus/short. Context
 * rules the table can't express live here: back-harmony (г→ɢ / х→χ next to back vowels а/о/у, else ɡ / x), the
 * iotated letters е/ё/я/ю → glide+vowel (glide only word-initially or after a vowel), and the soft sign ь which
 * FRONTS the preceding vowel (а→æ, о→œ) and drops. The DEEP-orthography reduction (non-initial short vowels → ə /
 * word-final deletion) and final devoicing are applied downstream in mongolian.ts.
 */
import { MANIFEST } from "./manifest.ts";

const V = MANIFEST.vowels;
const LONG = MANIFEST.longVowels;
const DIPH = MANIFEST.diphthongs;
const CONS = MANIFEST.consonants;
const BACK = new Set([...MANIFEST.backVowels]);

export interface Seg {
    ph: string;
    nucleus: boolean;
    short: boolean; // a single (short) vowel — eligible for reduction/deletion; long vowels & diphthongs are false
}

// Iotated single vowel letters → their bare vowel IPA (a preceding glide j is added when word-initial / post-vowel).
const IOTATED: Record<string, string> = { я: "a", ё: "ɔ", ю: "ʊ", е: "e" };
// ь fronts the preceding vowel (palatal + front-rounding): back → front counterpart.
const FRONT: Record<string, string> = { a: "æ", ɔ: "œ", ʊ: "u", "aː": "æː", "ɔː": "œː", "ʊː": "uː" };

/** Mongolian word → IPA segment list (nucleus/short flags drive reduction + deletion in mongolian.ts). */
export function toSegments(word: string): Seg[] {
    const chars = [...word.toLowerCase()];
    // Harmony is LOCAL (the nearest vowel), so loanwords that break word-harmony still get the right г/х place
    // (Герман: г next to е → front ɡ, not the back ɢ the word-final а would force).
    const nearestBack = (i: number): boolean => {
        for (let d = 1; d < chars.length; d++) {
            const r = chars[i + d], l = chars[i - d];
            if (r && (r in V || "яёею".includes(r))) return BACK.has(r) || "яёю".includes(r);
            if (l && (l in V || "яёею".includes(l))) return BACK.has(l) || "яёю".includes(l);
        }
        return chars.some((c) => BACK.has(c));
    };
    const consIpa = (c: string, i: number): string => {
        if (c === "г") return nearestBack(i) ? "ɢ" : "ɡ";
        if (c === "х") return nearestBack(i) ? "χ" : "x";
        return CONS[c]!;
    };
    const segs: Seg[] = [];
    let i = 0;
    while (i < chars.length) {
        const c = chars[i]!;
        const pair = c + (chars[i + 1] ?? "");
        // 2-char nuclei first (greedy): diphthongs then doubled long vowels.
        if (DIPH[pair]) { segs.push({ ph: DIPH[pair]!, nucleus: true, short: false }); i += 2; continue; }
        if (LONG[pair]) { segs.push({ ph: LONG[pair]!, nucleus: true, short: false }); i += 2; continue; }
        // Iotated vowel letter → optional glide + short vowel nucleus.
        if (c in IOTATED) {
            const last = segs[segs.length - 1];
            if (segs.length === 0 || last?.nucleus) segs.push({ ph: "j", nucleus: false, short: false });
            segs.push({ ph: IOTATED[c]!, nucleus: true, short: true });
            i += 1;
            continue;
        }
        // Single short vowel.
        if (c in V) { segs.push({ ph: V[c]!, nucleus: true, short: true }); i += 1; continue; }
        // Soft sign: front the last vowel nucleus, then drop.
        if (c === "ь") {
            for (let k = segs.length - 1; k >= 0; k--) {
                if (segs[k]!.nucleus) { segs[k]!.ph = FRONT[segs[k]!.ph] ?? segs[k]!.ph; break; }
            }
            i += 1;
            continue;
        }
        if (c === "ъ") { i += 1; continue; } // hard sign: separator, no phoneme
        if (c in CONS) { segs.push({ ph: consIpa(c, i), nucleus: false, short: false }); i += 1; continue; }
        i += 1; // unknown char (punctuation) → skip
    }
    return segs;
}
