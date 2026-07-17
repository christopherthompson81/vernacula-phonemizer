/**
 * Somali (so) phonemizer — Af-Soomaali (1972 Latin orthography), canonical IPA, espeak-independent. Rule-based
 * g2p (g2p.ts). Somali prominence is a grammatical pitch-ACCENT (tone), not lexical stress, and it is unwritten,
 * so no stress/tone mark is emitted (segmental output only — tone deferred). text() tokenizes words / numbers /
 * punctuation. See docs/investigations/so_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

/** Phonemize a single Somali word to canonical IPA (no tone/stress mark — Somali tone is unwritten). */
export function phonemizeWord(word: string): string {
    return toSegments(word)
        .map((s) => s.ph)
        .join("");
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A word (Somali letters + apostrophe for the glottal stop, incl. the typographic ’) / number / punctuation.
// g2p normalizes ’→', but the tokenizer must accept ’ or it would split su’aal and drop the glottal.
const TOKEN = /([a-z'ʼ’]+)|(\d+)|([.!?…,;:])/giu;

class SomaliPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Somali phonemizer (rule g2p; tone deferred). */
export function createSomali(): Phonemizer {
    return new SomaliPhonemizer();
}
