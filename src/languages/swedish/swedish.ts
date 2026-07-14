/**
 * Swedish (sv) phonemizer — Central Standard Swedish (rikssvenska), canonical IPA, espeak-independent. Rule-based
 * g2p (g2p.ts) + first-syllable stress (the native default); a small exception map covers irregular function
 * words. text() tokenizes words / numbers / punctuation. Phase 1 is SEGMENTAL — pitch accent (accent 1/2) is
 * deferred to Phase 2. See docs/sv_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const EXCEPTIONS = MANIFEST.exceptions;

/** One Swedish word → canonical IPA. First-syllable stress: ˈ before the first nucleus (monosyllables carry
 *  none, per repo convention). Irregular function words come from the exception map verbatim. */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    const exc = EXCEPTIONS[w];
    if (exc !== undefined) return exc;

    const segs = toSegments(w);
    const nuclei = segs.filter((s) => s.vowel).length;
    let out = "",
        seenNucleus = false;
    for (const s of segs) {
        if (s.vowel && !seenNucleus) {
            seenNucleus = true;
            if (nuclei > 1) out += "ˈ"; // polysyllable → mark first-syllable stress
        }
        out += s.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([a-zåäöA-ZÅÄÖ]+)|(\d+(?:[.,]\d+)?)|([.!?…,;:])/gu;

class SwedishPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const [intPart, frac] = m[2].split(/[.,]/);
                for (const wd of numberToWords(Number(intPart)).split(" ")) sink.emit(phonemizeWord(wd));
                if (frac !== undefined) {
                    sink.emit(phonemizeWord("komma"));
                    for (const d of frac)
                        for (const wd of numberToWords(Number(d)).split(" ")) sink.emit(phonemizeWord(wd));
                }
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Swedish phonemizer (rule g2p + first-syllable stress + a function-word exception map). */
export function createSwedish(): Phonemizer {
    return new SwedishPhonemizer();
}
