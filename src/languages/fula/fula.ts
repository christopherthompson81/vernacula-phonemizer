/**
 * Fula (ff) phonemizer — Fulfulde, canonical IPA, espeak-independent (authored). Longest-match g2p (g2p.ts) +
 * penultimate stress; no lexicon. text() tokenizes Fula words (incl. ɓ ɗ ŋ ɲ ƴ) / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { phonemizeWord as g2pWord } from "./g2p.ts";
import { adlamToLatin, isAdlam } from "./fulaAdlam.ts";
import { MANIFEST } from "./manifest.ts";

/** One Fula word → canonical IPA. Accepts BOTH scripts: the Latin (Boko) orthography and Adlam (𞤀𞤁𞤂𞤃) —
 *  Adlam is transliterated to Boko first, then the shared longest-match g2p runs (identical IPA either way). */
export function phonemizeWord(word: string): string {
    return g2pWord(isAdlam(word) ? adlamToLatin(word) : word);
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// Fula words in Latin (incl. ɓ ɗ ŋ ɲ ƴ) OR Adlam (letters U+1E900–1E943 + its combining marks U+1E944–1E94A).
const TOKEN = /([a-zɓɗŋɲƴñA-ZƁƊŊƝƳÑ\u{1E900}-\u{1E94A}]+)|(\d+)|([.!?…,;:])/gu;

class FulaPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}
export function createFula(): Phonemizer {
    return new FulaPhonemizer();
}
