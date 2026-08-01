/**
 * Hausa (ha) phonemizer — Kano standard, canonical IPA, espeak-independent (AUTHORED beyond-espeak). Boko-
 * orthography g2p (g2p.ts) + penultimate stress + a Wiktionary-derived tone lexicon. text() tokenizes Hausa
 * words (incl. ɓ ɗ ƙ ƴ and apostrophe as a letter) / numbers / punctuation.
 * See docs/investigations/ha_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { phonemizeWord } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeHausa } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

export { phonemizeWord };

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// Hausa Boko letters incl. ɓ ɗ ƙ ƴ (and their capitals) + apostrophe (a letter: 'yan, 'a'a).
// #562: the corpus groups thousands with COMMAS (6,387, 783,562) and writes decimals with DOTS (1.5,
// 12.8); the TOKEN swallows the separators so the tier can still see the number next to its unit/sign.
const TOKEN =
    /([a-zɓɗƙƴA-ZƁƊƘƳ'’]+)|(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+|\d+)|([.!?…,;:])/gu;

// #562 symbol normalization — Hausa: % is "kashi" BEFORE the number (the corpus's "kashi 80%"); nouns
// stay SINGULAR after numerals; the unit words are the corpus's own borrowings (kilomita, mita).
const SYMBOLS = makeSymbolNormalizer({
    percent: ["kashi"],
    percentPrefix: true,
    currency: { "$": ["dollar"], "€": ["euro"], "¥": ["yen"], "£": ["fam"] },
    units: { km: ["kilomita"], m: ["mita"], kg: ["kilogram"], mm: ["milimita"], cm: ["santimita"] },
    exponentWords: { squared: ["murabba'i"], cubed: ["cubic"] },
});

class HausaPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's era/version/rate steps need the
        // number and its suffix still adjacent, which the tier would break.
        return assembleClauses(SYMBOLS(normalizeHausa(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1].replace(/’/g, "'")));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2].replace(/,/gu, ""))).split(" "))
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
