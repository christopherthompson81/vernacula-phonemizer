/**
 * Thai (th) phonemizer — canonical IPA, espeak-independent (authored). Abugida g2p (g2p.ts) with computed tone;
 * words in the frequency corpus are pre-segmented. text() tokenizes Thai runs / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { phonemizeWord } from "./g2p.ts";
import { MANIFEST } from "./manifest.ts";

export { phonemizeWord };

const TOKEN = /([฀-๿]+)|(\d+)|([.!?…,;:])/gu;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

class ThaiPhonemizer implements Phonemizer {
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
export function createThai(): Phonemizer {
    return new ThaiPhonemizer();
}
