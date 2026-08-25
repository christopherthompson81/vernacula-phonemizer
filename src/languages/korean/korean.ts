/**
 * Korean (ko) phonemizer — Seoul standard, canonical IPA. Hangul g2p (g2p.ts) with the full
 * cross-syllable sandhi + coda neutralisation; no lexicon. text() tokenizes Hangul words / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { phonemizeWord } from "./g2p.ts";
import { numberToWords, spellDigits } from "./numbers.ts";
import { normalizeKorean } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

export { phonemizeWord };

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([가-힣]+)|(\d+)|([.!?…,;:])/gu;

// symbol normalization — Korean: hangul loans through the ordinary engine. The UNITS moved to
// normalize.ts, which needs them before its range/decimal rules and needs them JOINED to the number
// (this tier always inserts a space); % and the currency sign stay here, where the shared machinery
// already places the word after the number, which is also Korean's order.
const SYMBOLS = makeSymbolNormalizer({
    percent: MANIFEST.symbols.percent,
    currency: MANIFEST.symbols.currency,
    multiply: MANIFEST.symbols.multiply,
});

class KoreanPhonemizer implements Phonemizer {
    text(input: string): string {
        // SYMBOLS FIRST, then normalizeKorean: % and $ have to see plain ASCII digits, and normalize's
        // decimal rule rewrites 1.5 to 일점오, which would leave a following % with no number to attach to.
        return assembleClauses(normalizeKorean(SYMBOLS(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            // ⚠ ABOVE 2^53 THIS USED TO EMIT NOTHING — `numberToWords` returns "" for an integer whose low
            // digits the float has already lost (composing it would be confidently WRONG), and "" went
            // straight to the sink, so the NUMBER was deleted from the reading. The refusal is right; the
            // else was missing. Digit-at-a-time is what normalize.ts already gives a decimal tail.
            else if (m[2]) {
                const words = numberToWords(Number(m[2]));
                sink.emit(phonemizeWord(words === "" ? spellDigits(m[2]) : words));
            }
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Korean phonemizer (Hangul g2p + sandhi). */
export function createKorean(): Phonemizer {
    return new KoreanPhonemizer();
}
