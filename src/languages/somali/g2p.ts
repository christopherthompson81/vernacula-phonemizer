/**
 * Somali grapheme→phoneme engine. The 1972 Latin orthography is shallow and near-phonemic, so this is a
 * digraph-aware left-to-right scan — no lexicon:
 *   - long vowels ⟨aa ee ii oo uu⟩ → aː eː iː oː uː (tried before the single vowel).
 *   - consonant digraphs ⟨sh dh kh⟩ → ʃ ɖ χ (tried before the single letters).
 *   - the signature Cushitic consonants: ⟨c⟩→ʕ, ⟨x⟩→ħ (pharyngeals), ⟨q⟩→q (uvular), ⟨'⟩→ʔ (glottal).
 *   - a doubled consonant geminates to Cː (abbaan → abːaːn).
 * Tone (grammatical pitch-accent) is unwritten and not emitted.
 */
import { MANIFEST } from "./manifest.ts";

const LONG = MANIFEST.longVowels;
const SHORT = MANIFEST.shortVowels;
const DIGRAPH = MANIFEST.digraphs;
const CONS = MANIFEST.consonants;
const isVowelLetter = (c: string): boolean => c !== "" && c in SHORT;

export interface Seg {
    ph: string;
    nucleus: boolean;
}

/** Somali word → segment list. */
export function toSegments(word: string): Seg[] {
    const w = word.toLowerCase().replace(/’/g, "'");
    const n = w.length;
    const segs: Seg[] = [];
    let i = 0;
    while (i < n) {
        const c = w[i]!;
        const two = w.slice(i, i + 2);

        // Long vowel (doubled): aa/ee/ii/oo/uu.
        if (LONG[two]) {
            segs.push({ ph: LONG[two]!, nucleus: true });
            i += 2;
            continue;
        }
        // Consonant digraph: sh/dh/kh (+ gemination check below handles a doubled digraph).
        if (DIGRAPH[two]) {
            const ph = DIGRAPH[two]!;
            // A doubled digraph (e.g. ⟨dhdh⟩) geminates the result.
            if (w.slice(i + 2, i + 4) === two) {
                segs.push({ ph: ph + "ː", nucleus: false });
                i += 4;
            } else {
                segs.push({ ph, nucleus: false });
                i += 2;
            }
            continue;
        }
        // Short vowel.
        if (isVowelLetter(c)) {
            segs.push({ ph: SHORT[c]!, nucleus: true });
            i++;
            continue;
        }
        // Consonant (with gemination: a doubled single consonant → Cː).
        const cp = CONS[c];
        if (cp !== undefined) {
            if (w[i + 1] === c) {
                segs.push({ ph: cp + "ː", nucleus: false });
                i += 2;
            } else {
                segs.push({ ph: cp, nucleus: false });
                i++;
            }
            continue;
        }
        i++; // unknown char (punctuation) → skip
    }
    return segs;
}
