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

/** Turkish-locale lowercase WITHOUT the circumflex fold: İ→i and I→ı (JS toLowerCase would give i̇ / i). */
export function trCase(word: string): string {
    return word.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
}

/** One lowercased code point with its circumflex folded (â/î/û→a/i/u); any other is returned as is. */
const foldCircumflex = (c: string): string => MANIFEST.circumflexFold[c] ?? c;

/** Turkish-locale lowercase: İ→i and I→ı (JS toLowerCase would give i̇ / i). Then fold circumflex â/î/û→a/i/u. */
export function trLower(word: string): string {
    return trCase(word).replace(/[âîû]/g, foldCircumflex);
}

/**
 * ⚠ A CIRCUMFLEX ON A BACK VOWEL MARKS THE CONSONANT BEFORE IT, NOT THE VOWEL. In Turkish orthography â and û
 * after k, g or l say that the consonant is PALATAL: kâr [caɾ] "profit" against kar [kaɾ] "snow", lâle with a
 * clear l, rüzgâr, hikâye. Folding â→a first erased exactly that (#1523): the scan saw a back vowel and gave
 * k, ɡ and dark ɫ. kaikki (Wiktionary) has kâr /ˈcaːɾ/ and rüzgâr /ɾyzˈɟaɾ/. The test is derived from the fold
 * table rather than a second list: a circumflex letter whose fold is a BACK vowel (â→a, û→u). î folds to the
 * front i, which palatalizes by itself.
 */
const palatalizes = (raw: string): boolean => raw !== foldCircumflex(raw) && BACK.has(foldCircumflex(raw));

/** Turkish word → segment list. */
export function toSegments(word: string): Seg[] {
    // The scan reads the FOLDED letters; `raw` keeps the circumflex for the palatal test (the fold is one code
    // point to one code point, so the two arrays stay aligned).
    const raw = [...trCase(word)];
    const chars = raw.map(foldCircumflex);
    const segs: Seg[] = [];
    let prevVowel = ""; // last vowel LETTER seen (for l-darkness / ğ)
    let gMerge = ""; // a ğ just lengthened this vowel letter; a following same vowel merges
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        const next = chars[i + 1] ?? "";
        const prevC = chars[i - 1] ?? "";
        const palatal = palatalizes(raw[i + 1] ?? ""); // k/g/l before â/û (kâr, lâle)
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
            else if (segs.length > 0 && segs[segs.length - 1]!.nucleus) {
                segs[segs.length - 1]!.ph += "ː";
                gMerge = prevVowel;
            } // lengthen prev vowel
            // ⚠ ONLY A VOWEL: ğ lengthens the vowel before it. After a consonant (no native word has one) it was
            // lengthening the CONSONANT (`rğa` → ɾːa, #1523); there it is now silent.
            continue;
        }
        // l: dark ɫ next to a back vowel, clear l next to a front vowel. Onset l keys on the FOLLOWING vowel,
        // coda l on the PRECEDING vowel.
        if (c === "l") {
            const ctx = isVowel(next) ? next : prevVowel;
            segs.push({ ph: BACK.has(ctx) && !palatal ? "ɫ" : "l", nucleus: false });
            continue;
        }
        // k/g palatalize to c/ɟ in the environment of a FRONT vowel — an onset keys on the FOLLOWING vowel
        // (asker → asceɾ), a coda on the PRECEDING vowel (renk → ɾeɲc, türk → tyɾc, direkt → diɾect). Same
        // onset/coda logic as l above.
        if (c === "k") {
            const ctx = isVowel(next) ? next : prevVowel;
            segs.push({ ph: FRONT.has(ctx) || palatal ? "c" : "k", nucleus: false });
            continue;
        }
        // g → ɟ before a front vowel (majority of the gold; the ɡ cases like bölge are lexical), else ɡ.
        if (c === "g") {
            const ctx = isVowel(next) ? next : prevVowel;
            segs.push({ ph: FRONT.has(ctx) || palatal ? "ɟ" : "ɡ", nucleus: false });
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
