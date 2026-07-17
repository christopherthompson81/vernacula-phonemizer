/**
 * Hausa (ha) phonemizer — Kano standard, canonical IPA, espeak-independent (AUTHORED beyond-espeak). Boko-
 * orthography g2p (g2p.ts) + penultimate stress + a Wiktionary-derived tone lexicon. text() tokenizes Hausa
 * words (incl. ɓ ɗ ƙ ƴ and apostrophe as a letter) / numbers / punctuation.
 * See docs/investigations/ha_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { phonemizeWord } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

export { phonemizeWord };

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// Hausa Boko letters incl. ɓ ɗ ƙ ƴ (and their capitals) + apostrophe (a letter: 'yan, 'a'a).
const TOKEN = /([a-zɓɗƙƴA-ZƁƊƘƳ'’]+)|(\d+)|([.!?…,;:])/gu;

class HausaPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1].replace(/’/g, "'")));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" "))
                    sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Hausa phonemizer (authored Boko g2p + tone lexicon). */
export function createHausa(): Phonemizer {
    return new HausaPhonemizer();
}
