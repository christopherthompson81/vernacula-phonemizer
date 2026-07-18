/**
 * Chichewa / Chinyanja (nya) phonemizer — Bantu (N31), the Latin orthography, canonical IPA, espeak-independent.
 * A pure greedy longest-match scan over the grapheme table (manifest.ts): Chichewa is open CV with prenasalised
 * clusters as single onset units, so no coda/syllabification logic is needed. Signatures: IMPLOSIVES ⟨b d⟩→ɓ ɗ,
 * the retroflex-tap liquid ⟨l⟩=⟨r⟩→ɽ, PRENASALISED ⟨mb nd ng⟩→ᵐb ⁿd ᵑɡ (⟨ng'⟩→ŋ), aspirates ⟨ph th kh⟩→pʰ tʰ kʰ.
 * Tone (H/L) is unwritten → DEFERRED (segmental output only). See docs/investigations/nya_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Phonemize a single Chichewa word to canonical IPA (segmental; no tone — Chichewa tone is unwritten). */
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

// A word (Chichewa letters + the ⟨ng'⟩ apostrophe, incl. the typographic ’) / number / punctuation token.
const TOKEN = /([a-z'’]+)|(\d+)|([.!?…,;:])/giu;

class ChichewaPhonemizer implements Phonemizer {
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

/** Build the Chichewa phonemizer (greedy rule g2p; tone deferred). */
export function createChichewa(): Phonemizer {
    return new ChichewaPhonemizer();
}
