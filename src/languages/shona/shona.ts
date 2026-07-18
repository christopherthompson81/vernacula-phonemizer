/**
 * Shona / chiShona (sn) phonemizer — Bantu (S10, Standard Zezuru), the Latin orthography, canonical IPA,
 * espeak-independent. A pure greedy longest-match scan over the grapheme table (manifest.ts): Shona syllables are
 * open CV with a prenasalized cluster as a single onset unit, so no coda or syllabification logic is needed. The
 * signatures: IMPLOSIVES ⟨b d⟩→ɓ ɗ (vs breathy ⟨bh dh⟩→b̤ d̤), WHISTLED sibilants ⟨sv zv⟩→ȿ ɀ, PRENASALIZED
 * ⟨mb nd ng nz nj⟩ → ᵐb ⁿd ᵑɡ ⁿz ⁿd͡ʒ (⟨ng'⟩→ŋ). Tone (H/L) is unwritten → DEFERRED (segmental output only).
 * See docs/investigations/sn_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Phonemize a single Shona word to canonical IPA (segmental; no tone — Shona tone is unwritten). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    let out = "";
    let i = 0;
    while (i < w.length) {
        let matched = false;
        for (const key of GRAPHEME_KEYS) {
            if (w.startsWith(key, i)) {
                out += G[key]!;
                i += key.length;
                matched = true;
                break;
            }
        }
        if (!matched) i++; // unknown char → skip
    }
    return out;
}

// A word (Shona letters + the ⟨ng'⟩ apostrophe, incl. the typographic ’) / number / punctuation token.
const TOKEN = /([a-z'’]+)|(\d+)|([.!?…,;:])/giu;

class ShonaPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1].replace(/’/gu, "'")));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Shona phonemizer (greedy rule g2p; tone deferred). */
export function createShona(): Phonemizer {
    return new ShonaPhonemizer();
}
