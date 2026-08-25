/**
 * Hausa (ha) phonemizer — Kano standard, canonical IPA (AUTHORED). Boko-
 * orthography g2p (g2p.ts) + penultimate stress + a Wiktionary-derived tone lexicon. text() tokenizes Hausa
 * words (incl. ɓ ɗ ƙ ƴ and apostrophe as a letter) / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { phonemizeWord } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeHausa } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

export { phonemizeWord };

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// Hausa Boko letters incl. ɓ ɗ ƙ ƴ (and their capitals) + apostrophe (a letter: 'yan, 'a'a).
// the corpus groups thousands with COMMAS (6,387, 783,562) and writes decimals with DOTS (1.5,
// 12.8); the TOKEN swallows the separators so the tier can still see the number next to its unit/sign.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'’")})|(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+\\.\\d+|\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zɓɗƙƴA-ZƁƊƘƳ'’]";
const nat = makeNativiser(NATIVE_CLASS, "u");

// symbol normalization — Hausa: % is "kashi" BEFORE the number (the corpus's "kashi 80%"); nouns
// stay SINGULAR after numerals; the unit words are the corpus's own borrowings (kilomita, mita).
const SYMBOLS = makeSymbolNormalizer({
    percent: MANIFEST.symbolTier.percent,
    currency: MANIFEST.symbolTier.currency,
    units: MANIFEST.symbolTier.units,
    exponentWords: MANIFEST.symbolTier.exponentWords,
    percentPrefix: MANIFEST.symbolTier.percentPrefix,
    multiply: MANIFEST.symbolTier.multiply,
});

class HausaPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's era/version/rate steps need the
        // number and its suffix still adjacent, which the tier would break.
        return assembleClauses(SYMBOLS(normalizeHausa(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1]).replace(/’/g, "'")));
            else if (m[2]) {
                // ⚠ `numberToWords` RETURNS "" ABOVE ITS AUTHORED 10¹² RANGE, and emitting that deleted the
                // number from the reading with nothing to hear — the fleet's 2^53 defect one magnitude down
                // (docs/investigations/bignum_fallback_investigation.md). Fall back to digit-at-a-time.
                const bare = m[2].replace(/,/gu, "");
                const composed = numberToWords(Number(bare));
                const words = composed === "" ? [...bare].map((c) => numberToWords(Number(c))) : composed.split(" ");
                for (const wd of words) if (wd !== "") sink.emit(phonemizeWord(wd));
            }
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
