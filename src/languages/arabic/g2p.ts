/**
 * Arabic diacritized grapheme→phoneme engine (Modern Standard Arabic, broad phonemic). Takes FULLY-VOWELLED
 * Arabic (harakat present) and produces canonical IPA — cleanroom, rule-based, no lexicon. Short-vowel
 * restoration for bare text is a separate pre-pass (the neural diacritizer); this engine assumes the vowels
 * are already there. Arabic is stored in logical order = phonetic order, so RTL is a non-issue.
 * See docs/investigations/ar_native_bringup_investigation.md for the convention.
 */

import { MANIFEST } from "./manifest.ts";

// All Arabic DATA — script inventory + maps — is consolidated in arabic.jsonc; here we bind it to the readable
// local names the parsing algorithm below uses.
const CONS = MANIFEST.consonants;
const SUN = new Set(MANIFEST.sunLetters);
const PROCLITIC = MANIFEST.proclitics;
const M = MANIFEST.marks,
    L = MANIFEST.letters;
const FATHA = M.fatha,
    KASRA = M.kasra,
    DAMMA = M.damma,
    SUKUN = M.sukun,
    SHADDA = M.shadda;
const TANWIN_A = M.fathatan,
    TANWIN_I = M.kasratan,
    TANWIN_U = M.dammatan,
    DAGGER = M.daggerAlif;
const ALIF = L.alif,
    ALIF_MAQSURA = L.alifMaqsura,
    ALIF_MADDA = L.alifMadda,
    TAA_MARBUTA = L.taaMarbuta,
    WAW = L.waw,
    YA = L.ya;
const HARAKAT = new Set([
    FATHA,
    KASRA,
    DAMMA,
    SUKUN,
    SHADDA,
    TANWIN_A,
    TANWIN_I,
    TANWIN_U,
    DAGGER,
]);

export interface Seg {
    ph: string; // IPA phoneme(s)
    vowel: boolean; // is a syllable nucleus
}

/**
 * Resolve the vowel from a gathered harakat `hk` plus the following LETTER at index i (a long vowel/diphthong
 * consumes a following ا/ي/و). Decoupling the harakat from the shadda first means the fatḥa/shadda mark order
 * (نَّا vs نَّا) doesn't affect long-vowel detection. Returns the IPA vowel ("" = sukun/none) and next index.
 */
function resolveVowel(
    hk: string,
    s: string,
    i: number,
): { v: string; next: number } {
    const after = (k: number): string => s[k] ?? "";
    const bareGlide = (k: number): boolean => !HARAKAT.has(after(k + 1)); // ي/و with no harakat of its own = long-vowel marker
    switch (hk) {
        case FATHA:
            if (
                after(i) === ALIF ||
                after(i) === ALIF_MAQSURA ||
                after(i) === DAGGER
            )
                return { v: "aː", next: i + 1 };
            if (after(i) === YA && after(i + 1) === SUKUN)
                return { v: "aj", next: i + 2 };
            if (after(i) === WAW && after(i + 1) === SUKUN)
                return { v: "aw", next: i + 2 };
            return { v: "a", next: i };
        case KASRA:
            if (after(i) === YA && bareGlide(i))
                return { v: "iː", next: i + 1 };
            return { v: "i", next: i };
        case DAMMA:
            if (after(i) === WAW && bareGlide(i))
                return { v: "uː", next: i + 1 };
            return { v: "u", next: i };
        case DAGGER:
            return { v: "aː", next: i };
        case TANWIN_A:
            return { v: "an", next: i };
        case TANWIN_I:
            return { v: "in", next: i };
        case TANWIN_U:
            return { v: "un", next: i };
        default:
            return { v: "", next: i }; // sukun / no marker
    }
}

/** Gather the combining-mark cluster after a consonant (shadda + one harakat, in any order). */
function gatherMarks(
    s: string,
    i: number,
): { shadda: boolean; hk: string; next: number } {
    let shadda = false,
        hk = "";
    while (HARAKAT.has(s[i] ?? "")) {
        if (s[i] === SHADDA) shadda = true;
        else hk = s[i]!;
        i++;
    }
    return { shadda, hk, next: i };
}

/** Scan a fully-diacritized Arabic word into segments (consonants + vowel nuclei). */
export function toSegments(word: string): Seg[] {
    const s = word;
    const n = s.length;
    const segs: Seg[] = [];
    const pushCons = (ph: string): void => {
        segs.push({ ph, vowel: false });
    };
    const pushVowel = (v: string): void => {
        if (v !== "") segs.push({ ph: v, vowel: true });
    };

    // Emit the article at lam index `lamIdx` (drop ل for a sun letter — it geminates via its shadda; keep l
    // for a moon letter). Returns the index of the first root letter.
    const short: Record<string, string> = {
        [FATHA]: "a",
        [KASRA]: "i",
        [DAMMA]: "u",
    };
    const emitArticle = (lamIdx: number): number => {
        let j = lamIdx + 1,
            shadda = false,
            vowelMark = "";
        while (HARAKAT.has(s[j] ?? "")) {
            if (s[j] === SHADDA) shadda = true;
            else vowelMark = s[j]!;
            j++;
        }
        if (shadda) {
            pushCons("lː");
            const r = resolveVowel(vowelMark, s, j);
            pushVowel(r.v);
            return r.next;
        } // الّذي/الله: geminate + its (possibly long) vowel
        if (!SUN.has(s[j] ?? "")) pushCons("l"); // moon letter keeps l (sun letter: drop l, it geminates via its shadda)
        return j;
    };

    let i = 0;
    if (s[i] === ALIF && s[i + 1] === "ل") {
        // word-initial article الـ
        pushCons("ʔ");
        pushVowel("a");
        i = emitArticle(i + 1);
    } else if (
        PROCLITIC[s[i]!] &&
        short[s[i + 1] ?? ""] &&
        s[i + 2] === ALIF &&
        s[i + 3] === "ل"
    ) {
        pushCons(PROCLITIC[s[i]!]!);
        pushVowel(short[s[i + 1]!]!);
        i = emitArticle(i + 3); // proclitic + الـ (alif elides)
    } else if (s[i] === "ل" && s[i + 1] === KASRA && s[i + 2] === "ل") {
        // لِلـ = li + article (alif dropped)
        pushCons("l");
        pushVowel("i");
        i = emitArticle(i + 2);
    } else if (s[i] === ALIF && HARAKAT.has(s[i + 1] ?? "")) {
        pushCons("ʔ"); // word-initial bare alif + harakat = glottal onset
        const { hk, next } = gatherMarks(s, i + 1);
        const r = resolveVowel(hk, s, next);
        pushVowel(r.v);
        i = r.next;
    } else if (s[i] === ALIF_MADDA) {
        pushCons("ʔ");
        pushVowel("aː");
        i += 1;
    }

    while (i < n) {
        const c = s[i]!;
        if (CONS[c] !== undefined) {
            let ph = CONS[c]!;
            i++;
            const marks = gatherMarks(s, i); // shadda + harakat in any order, then the long-vowel letter
            if (marks.shadda) ph += "ː"; // gemination → length mark Cː (consistent; espeak vacillates CC/Cː)
            pushCons(ph);
            const { v, next } = resolveVowel(marks.hk, s, marks.next);
            pushVowel(v);
            i = next;
        } else if (c === ALIF_MADDA) {
            pushCons("ʔ");
            pushVowel("aː");
            i++;
        } else if (c === ALIF || c === ALIF_MAQSURA) {
            // bare alif after a consonant = long aː (accusative alif تحريما)
            const prev = segs[segs.length - 1];
            if (prev && !prev.vowel) pushVowel("aː");
            i++;
        } else if (c === TAA_MARBUTA) {
            i++;
        } // taː marbuːta: silent in pausal form (the preceding fatḥa is the ending)
        else {
            i++;
        } // harakat already consumed / unknown → skip
    }
    return segs;
}
