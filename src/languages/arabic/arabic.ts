/**
 * Arabic (ar) phonemizer — canonical IPA (Modern Standard Arabic, broad phonemic), espeak-independent.
 * Diacritized g2p (g2p.ts) + quantity-sensitive stress. Phase 1 assumes vowelled input; a neural diacritizer
 * pre-pass (permissively-sourced) will restore short vowels for bare text in Phase 2.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments, type Seg } from "./g2p.ts";
import { numberToIpa } from "./numbers.ts";
import {
    createArabicDiacritizer,
    type ArabicDiacritizer,
} from "./diacritizer.ts";
import { restoreSkeletons } from "./restore.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { MANIFEST } from "./manifest.ts";

const isLongNucleus = (ph: string): boolean =>
    /ː/.test(ph) || ph === "aj" || ph === "aw" || /[aiu]n$/.test(ph);

/**
 * MSA quantity-sensitive stress. Syllabify (each vowel = a nucleus; a consonant between two vowels is the
 * next onset, so a syllable is closed only when ≥2 consonants follow / a trailing consonant at word end).
 * Stress: final if superheavy (CVVC/CVCC); else the last non-final heavy syllable within the last three;
 * else the first syllable.
 */
function stressedNucleus(segs: Seg[]): number {
    const nuclei = segs.map((s, i) => (s.vowel ? i : -1)).filter((i) => i >= 0);
    if (nuclei.length <= 1) return nuclei[0] ?? -1;

    const heavy: boolean[] = [],
        superheavy: boolean[] = [],
        longV: boolean[] = [];
    nuclei.forEach((vi, k) => {
        const long = isLongNucleus(segs[vi]!.ph);
        const end = k === nuclei.length - 1 ? segs.length : nuclei[k + 1]!;
        let consAfter = 0;
        for (let j = vi + 1; j < end; j++)
            if (!segs[j]!.vowel) consAfter += geminated(segs, j) ? 2 : 1;
        const coda = k === nuclei.length - 1 ? consAfter >= 1 : consAfter >= 2;
        longV[k] = long;
        heavy[k] = long || coda;
        superheavy[k] = (long && coda) || consAfter >= 2;
    });

    const last = nuclei.length - 1;
    if (superheavy[last]) return nuclei[last]!; // ultima superheavy (CVːC/CVCC) → ultima
    if (heavy[last]) return nuclei[last - 1]!; // ultima heavy (CVV/CVC) → penult
    if (heavy[last - 1]) return nuclei[last - 1]!; // ultima light, penult heavy → penult
    const ap = last - 2; // all-light ultima+penult → antepenult, UNLESS the
    if (ap >= 0 && heavy[ap] && !longV[ap]) return nuclei[last - 1]!; // antepenult is heavy by CODA only (madrasa → penult)
    return nuclei[Math.max(0, ap)]!; // else antepenult (light, or heavy by long vowel: ṭaːlib)
}

/** Is the consonant seg at index j a geminate (rendered Cː) — it fills both coda and following onset. */
function geminated(segs: Seg[], j: number): boolean {
    return /ː$/.test(segs[j]!.ph);
}

/** Phonemize a single diacritized Arabic word to canonical IPA (with a stress mark). */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    if (segs.length === 0) return "";
    const stress = stressedNucleus(segs);
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stress) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

// Clause / phrase punctuation (Arabic + ASCII) → canonical inline pause marks (authored data in arabic.jsonc).
const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A word (Arabic letters + harakat) / number (Arabic-Indic or ASCII digits) / punctuation token.
const TOKEN = /([ء-يٰٱً-ْـ]+)|([0-9٠-٩]+)|([۔.!؟?،,؛;:…])/gu;
/** Arabic-Indic digits ٠..٩ → ASCII. */
const toAscii = (d: string): string =>
    d.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));

class ArabicPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(numberToIpa(Number(toAscii(m[2]))));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Arabic phonemizer. Phase 1 expects diacritized input; a neural diacritizer pre-pass (Phase 2)
 *  will restore short vowels for bare text. Fully rule-based — no data files. */
export function createArabic(): Phonemizer {
    return new ArabicPhonemizer();
}

let diacritizer: Promise<ArabicDiacritizer | undefined> | undefined;
let phonemizer: Phonemizer | undefined;
// Tashkeela-derived PAUSAL restoration lexicon (undiacritized → vocalized) — the supplement that repairs words the
// neural diacritizer leaves as skeletons. Optional: absent → the restore pass falls back to epenthesis only.
let restoreLexicon: ReadonlyMap<string, string> | undefined;
function restoreLex(): ReadonlyMap<string, string> {
    if (restoreLexicon === undefined)
        restoreLexicon = loadTsvMap(import.meta.url, "diacritization.tsv", undefined, {
            optional: true,
        });
    return restoreLexicon;
}

/**
 * Phonemize BARE (undiacritized) Arabic. Runs the neural diacritizer pre-pass (ONNX, async) to restore short
 * vowels, then the synchronous g2p. Requires the optional `onnxruntime-node` dependency and the diacritizer
 * model beside this module; if the model is absent it falls back to phonemizing the input as-is (which is
 * correct only for already-diacritized text). Diacritized input can use the sync `phonemize(text, "ar")`.
 */
export async function phonemizeArabic(text: string): Promise<string> {
    if (diacritizer === undefined) diacritizer = createArabicDiacritizer();
    const diac = await diacritizer;
    const vocalized = diac ? await diac.diacritize(text) : text;
    // Supplement-only: repair words the diacritizer left as skeletons from the Tashkeela pausal lexicon (never
    // touches an already-voweled word) — see restore.ts. Skipped when no diacritizer ran (already-diacritized in).
    const restored = diac ? restoreSkeletons(vocalized, restoreLex()) : vocalized;
    if (phonemizer === undefined) phonemizer = createArabic();
    return phonemizer.text(restored);
}
