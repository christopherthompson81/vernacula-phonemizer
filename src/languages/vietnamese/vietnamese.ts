/**
 * Vietnamese (vi) phonemizer — Northern/Hanoi, canonical IPA, espeak-independent. Vietnamese is written as
 * space-separated monosyllables; each syllable → onset + glide + nucleus + tone + coda (g2p.ts). Tones are
 * Chao contour letters after the nucleus. text() tokenizes syllables / numbers / punctuation.
 * See docs/investigations/vi_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { phonemizeSyllable } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

/** One Vietnamese syllable/word → IPA. */
export function phonemizeWord(word: string): string {
    return phonemizeSyllable(word);
}

export type ForeignPhonemizer = (latin: string) => string;

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A Vietnamese syllable (letters incl. precomposed diacritics + combining marks), a number, or clause punctuation.
const TOKEN = /([a-zà-ỹăâđêôơưÀ-Ỹ̀-̣]+)|(\d+)|([.!?…,;:])/giu;

// #562 symbol normalization — Vietnamese: unit words emitted as SEPARATE SYLLABLES (ki lô mét), because
// the engine phonemizes per syllable and "kilômét" is not one valid syllable.
const SYMBOLS = makeSymbolNormalizer({
    percent: ["phần trăm"],
    currency: { "$": ["đô la"], "¥": ["yên"] },
    units: { km: ["ki lô mét"], mm: ["mi li mét"], cm: ["xen ti mét"], kg: ["ki lô gam"] },
});

class VietnamesePhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(SYMBOLS(input), TOKEN, (m, sink) => {
            if (m[1]) {
                // A token that is not a valid Vietnamese syllable (paris, sofia, facebook) used to return ""
                // and vanish from the output. Route it through `foreign` (English) instead — code-switched
                // proper nouns are pervasive in Vietnamese text, and a missing word is worse than an
                // English-phoneme one.
                const ipa = phonemizeSyllable(m[1]);
                if (ipa !== "") sink.emit(ipa);
                else if (this.foreign) sink.emit(this.foreign(m[1]));
            }
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

/** Build the Vietnamese phonemizer (rule g2p over the closed rhyme set). `foreign` reads tokens that are
 *  not valid Vietnamese syllables — foreign proper nouns — instead of dropping them. */
export function createVietnamese(foreign?: ForeignPhonemizer): Phonemizer {
    return new VietnamesePhonemizer(foreign);
}
