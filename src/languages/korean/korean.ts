/**
 * Korean (ko) phonemizer — Seoul standard, canonical IPA. Hangul g2p (g2p.ts) with the full
 * cross-syllable sandhi + coda neutralisation; no lexicon. text() tokenizes Hangul words / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { phonemizeWord } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeKorean } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

export { phonemizeWord };

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([가-힣]+)|(\d+)|([.!?…,;:])/gu;

// #562 symbol normalization — Korean: hangul loans through the ordinary engine. The UNITS moved to
// normalize.ts, which needs them before its range/decimal rules and needs them JOINED to the number
// (this tier always inserts a space); % and the currency sign stay here, where the shared machinery
// already places the word after the number, which is also Korean's order.
const SYMBOLS = makeSymbolNormalizer({
    // #586 `multiply` — this language DROPPED the sign outright. ⚠ STANDARD MATHEMATICAL REGISTER, not a corpus
    // attestation: the sweep failed exactly as the exponent sweep did, because the plausible hits are homographs
    // of PREPOSITIONS — es `por` ×23, it `per` ×25, ru `на` ×31 are all the preposition, never the operator.
    // One word, so `by` defaults to it; this language does not split dimension from product.
    multiply: { times: "곱하기" },
    percent: ["퍼센트"],
    currency: { "$": ["달러"] },
});

class KoreanPhonemizer implements Phonemizer {
    text(input: string): string {
        // SYMBOLS FIRST, then normalizeKorean: % and $ have to see plain ASCII digits, and normalize's
        // decimal rule rewrites 1.5 to 일점오, which would leave a following % with no number to attach to.
        return assembleClauses(normalizeKorean(SYMBOLS(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(phonemizeWord(numberToWords(Number(m[2]))));
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
