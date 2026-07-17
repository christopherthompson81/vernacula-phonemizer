/**
 * Korean (ko) phonemizer — Seoul standard, canonical IPA, espeak-independent. Hangul g2p (g2p.ts) with the full
 * cross-syllable sandhi + coda neutralisation; no lexicon. text() tokenizes Hangul words / numbers / punctuation.
 * See docs/investigations/ko_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { phonemizeWord } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

export { phonemizeWord };

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([가-힣]+)|(\d+)|([.!?…,;:])/gu;

class KoreanPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
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
