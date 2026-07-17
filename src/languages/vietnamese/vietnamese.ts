/**
 * Vietnamese (vi) phonemizer — Northern/Hanoi, canonical IPA, espeak-independent. Vietnamese is written as
 * space-separated monosyllables; each syllable → onset + glide + nucleus + tone + coda (g2p.ts). Tones are
 * Chao contour letters after the nucleus. text() tokenizes syllables / numbers / punctuation.
 * See docs/investigations/vi_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { phonemizeSyllable } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

/** One Vietnamese syllable/word → IPA. */
export function phonemizeWord(word: string): string {
    return phonemizeSyllable(word);
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A Vietnamese syllable (letters incl. precomposed diacritics + combining marks), a number, or clause punctuation.
const TOKEN = /([a-zà-ỹăâđêôơưÀ-Ỹ̀-̣]+)|(\d+)|([.!?…,;:])/giu;

class VietnamesePhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeSyllable(m[1]));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" "))
                    sink.emit(phonemizeSyllable(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Vietnamese phonemizer (rule g2p over the closed rhyme set). */
export function createVietnamese(): Phonemizer {
    return new VietnamesePhonemizer();
}
