/**
 * Turkish grapheme→phoneme engine. Turkish orthography is shallow and near-1:1 (vowel harmony is already
 * encoded in the spelling), so this is a left-to-right scan with a few context rules — no lexicon:
 *   - vowels are phonemic: a e ı i o ö u ü → a e ɯ i o ø u y (front = e i ö ü, back = a ı o u).
 *   - k/g palatalize before a FRONT vowel: k→c always (asker→asceɾ); g→ɟ only when not after a consonant
 *     (gel→ɟel but bölge→bølɡe).
 *   - l is DARK ɫ next to a back vowel, clear l next to a front vowel (okul→okuɫ, dil→dil) — the ɫ census
 *     contribution.
 *   - ğ (yumuşak g) after e/i → j glide (değil→dejil); elsewhere it lengthens the preceding vowel and a
 *     following identical vowel merges (dağ→daː, soğuk→soːuk, düğün→dyːn).
 *   - a doubled consonant geminates to Cː (teşekkür→teʃekːyɾ).
 * Stress (final-syllable default + a lexicon) and number reading are applied downstream. See
 * for the convention.
 */

import { MANIFEST } from "./manifest.ts";

// Vowel/consonant tables + harmony classes are DATA (turkish.jsonc). g/k/l/ğ are handled specially in the scan.
const VOWEL_IPA = MANIFEST.vowels.ipa;
const FRONT = new Set(MANIFEST.vowels.front);
const FRONT_UNROUND = new Set(MANIFEST.vowels.frontUnround);
const BACK = new Set(MANIFEST.vowels.back);
const CONS_IPA = MANIFEST.consonants;
// Doubled STOPS/affricates geminate to Cː (teşekkür→teʃekːyɾ); doubled sonorants/fricatives stay written double.
const GEMINATE = new Set(MANIFEST.geminate);
const isVowel = (c: string): boolean => c !== "" && c in VOWEL_IPA;

export interface Seg {
    ph: string; // IPA phoneme(s)
    nucleus: boolean; // is a syllable nucleus (a vowel)
}

/** Turkish-locale lowercase: İ→i and I→ı (JS toLowerCase would give i̇ / i). Then fold circumflex â/î/û→a/i/u. */
export function trLower(word: string): string {
    return word
        .replace(/İ/g, "i")
        .replace(/I/g, "ı")
        .toLowerCase()
        .replace(/[âîû]/g, (c) => MANIFEST.circumflexFold[c] ?? c);
}

/** Turkish word → segment list. */
export function toSegments(word: string): Seg[] {
    const chars = [...trLower(word)];
    const segs: Seg[] = [];
    let prevVowel = ""; // last vowel LETTER seen (for l-darkness / ğ)
    let gMerge = ""; // a ğ just lengthened this vowel letter; a following same vowel merges
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        const next = chars[i + 1] ?? "";
        const prevC = chars[i - 1] ?? "";
        // Vowel.
        if (c in VOWEL_IPA) {
            if (gMerge === c && c !== "ı") {
                gMerge = "";
                prevVowel = c;
                continue;
            } // ğ-merge: identical vowel folds (ı never merges: yaptığı→ɯːɯ)
            gMerge = "";
            segs.push({ ph: VOWEL_IPA[c]!, nucleus: true });
            prevVowel = c;
            continue;
        }
        gMerge = "";
        // Geminate stop/affricate → length mark (the second of a doubled stop).
        if (c === prevC && GEMINATE.has(c)) {
            segs.push({ ph: "ː", nucleus: false });
            continue;
        }
        // ğ (yumuşak g).
        if (c === "ğ") {
            if (FRONT_UNROUND.has(prevVowel))
                segs.push({ ph: "j", nucleus: false }); // değil → dejil
            else if (segs.length > 0) {
                segs[segs.length - 1]!.ph += "ː";
                gMerge = prevVowel;
            } // lengthen prev vowel
            continue;
        }
        // l: dark ɫ next to a back vowel, clear l next to a front vowel. Onset l keys on the FOLLOWING vowel,
        // coda l on the PRECEDING vowel.
        if (c === "l") {
            const ctx = isVowel(next) ? next : prevVowel;
            segs.push({ ph: BACK.has(ctx) ? "ɫ" : "l", nucleus: false });
            continue;
        }
        // k/g palatalize to c/ɟ in the environment of a FRONT vowel — an onset keys on the FOLLOWING vowel
        // (asker → asceɾ), a coda on the PRECEDING vowel (renk → ɾeɲc, türk → tyɾc, direkt → diɾect). Same
        // onset/coda logic as l above.
        if (c === "k") {
            const ctx = isVowel(next) ? next : prevVowel;
            segs.push({ ph: FRONT.has(ctx) ? "c" : "k", nucleus: false });
            continue;
        }
        // g → ɟ before a front vowel (majority of the gold; the ɡ cases like bölge are lexical), else ɡ.
        if (c === "g") {
            const ctx = isVowel(next) ? next : prevVowel;
            segs.push({ ph: FRONT.has(ctx) ? "ɟ" : "ɡ", nucleus: false });
            continue;
        }
        const cons = CONS_IPA[c];
        if (cons !== undefined) segs.push({ ph: cons, nucleus: false });
        // else: unknown char (punctuation slipped in) → skip
    }
    // Nasal PLACE assimilation: /n/ takes the place of a following velar/palatal stop — [ŋ] before k/ɡ
    // (angut → aŋɡut, denk → deŋk when back), [ɲ] before c/ɟ (renk → ɾeɲc, brifing → bɾifiɲɟ). Standard Turkish.
    for (let i = 0; i < segs.length - 1; i++) {
        if (segs[i]!.ph !== "n") continue;
        const nx = segs[i + 1]!.ph;
        if (nx === "k" || nx === "ɡ") segs[i]!.ph = "ŋ";
        else if (nx === "c" || nx === "ɟ") segs[i]!.ph = "ɲ";
    }
    return segs;
}
