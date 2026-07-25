/**
 * Slovak (sk) phonemizer — canonical IPA, espeak-independent. Rule g2p (g2p.ts) + fixed FIRST-syllable stress with
 * secondary stress on even non-final nuclei (like Czech). Syllabic r̩/l̩ (and long ĺ/ŕ) count as nuclei.
 * text() tokenizes words / numbers / punctuation. See docs/investigations/sk_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords, readDigits } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

/** One Slovak word → canonical IPA with first-syllable primary stress + even-non-final secondary stress. */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    const nucIdx = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
    if (nucIdx.length === 0) return segs.map((s) => s.ph).join("");
    const last = nucIdx.length - 1;
    let out = "";
    let vi = -1;
    for (let i = 0; i < segs.length; i++) {
        if (segs[i]!.nucleus) {
            vi++;
            out += vi === 0 ? "ˈ" : vi >= 2 && vi % 2 === 0 && vi !== last ? "ˌ" : "";
        }
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([A-Za-zÁáÄäČčĎďÉéÍíĹĺĽľŇňÓóÔôŔŕŠšŤťÚúÝýŽž]+)|(\d+)|([.!?…,;:])/gu;

class SlovakPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                // ≤9 digits fits a safe integer (<1e9, the top composed magnitude) → compose; longer → read the raw
                // string digit-by-digit so the float conversion can't lose precision or go exponential.
                const words = m[2].length <= 9 ? numberToWords(Number(m[2])) : readDigits(m[2]);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            }
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Slovak phonemizer (rule g2p + first-syllable stress + cardinal numbers). */
export function createSlovak(): Phonemizer {
    return new SlovakPhonemizer();
}
