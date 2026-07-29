/**
 * Korean (ko) phonemizer — Seoul standard, canonical IPA, espeak-independent. Hangul g2p (g2p.ts) with the full
 * cross-syllable sandhi + coda neutralisation; no lexicon. text() tokenizes Hangul words / numbers / punctuation.
 * See docs/investigations/ko_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { phonemizeWord } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

export { phonemizeWord };

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([가-힣]+)|(\d+)|([.!?…,;:])/gu;

// #562 symbol normalization — Korean: hangul loans through the ordinary engine.
const SYMBOLS = makeSymbolNormalizer({
    percent: ["퍼센트"],
    currency: { "$": ["달러"] },
    units: { km: ["킬로미터"], cm: ["센티미터"], mm: ["밀리미터"] },
});

class KoreanPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(SYMBOLS(input), TOKEN, (m, sink) => {
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
