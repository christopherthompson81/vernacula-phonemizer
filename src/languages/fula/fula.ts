/**
 * Fula (ff) phonemizer — Fulfulde, canonical IPA, espeak-independent (authored). Longest-match g2p (g2p.ts) +
 * penultimate stress; no lexicon. text() tokenizes Fula words (incl. ɓ ɗ ŋ ɲ ƴ) / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { phonemizeWord as g2pWord } from "./g2p.ts";
import { adlamToLatin, isAdlam } from "./fulaAdlam.ts";
import { normalizeFula } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";
import { foldAdlamDigits, numberToWords } from "./numbers.ts";

/** One Fula word → canonical IPA. Accepts BOTH scripts: the Latin (Boko) orthography and Adlam (𞤀𞤁𞤂𞤃) —
 *  Adlam is transliterated to Boko first, then the shared longest-match g2p runs (identical IPA either way). */
export function phonemizeWord(word: string): string {
    return g2pWord(isAdlam(word) ? adlamToLatin(word) : word);
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// Fula words in Latin (incl. ɓ ɗ ŋ ɲ ƴ) OR Adlam (letters U+1E900–1E943 + its combining marks U+1E944–1E94A).
// The number class covers BOTH digit sets the two registered scripts use: ASCII 0–9 and Adlam 𞥐–𞥙 (U+1E950–1E959).
// #562: the corpus groups thousands with COMMAS (2,243, 100,000) and writes decimals with DOTS (1.5, 3.50);
// the TOKEN swallows the separators so the tier can still see the number next to its unit/sign.
const TOKEN =
    /([a-zɓɗŋɲƴñA-ZƁƊŊƝƳÑ\u{1E900}-\u{1E94A}]+)|(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+|\d+[\u{1E950}-\u{1E959}]*|\d*[\u{1E950}-\u{1E959}]+)|([.!?…,;:])/gu;

// #562 symbol normalization — Fula. "tere" is the percent word (the corpus reads % as nothing, so the
// number otherwise has no percent marker); nouns stay SINGULAR after numerals, so one form suffices.
// The unit words are the corpus's own borrowings (kilometre, metre); "e wakkati gootel" = per hour.
const SYMBOLS = makeSymbolNormalizer({
    percent: ["tere"],
    currency: { "$": ["dollar"], "€": ["euro"], "¥": ["yen"], "£": ["pound"] },
    units: { km: ["kilometre"], m: ["metre"], kg: ["kilogram"], mm: ["milimeta"], cm: ["santimeta"] },
    unitPer: "e wakkati gootel", // 160 km/h -> teemedere e cappanɗe jeegom kilometre e wakkati gootel
    rateDenominators: { h: "wakkati", s: "sahaawa" },
});

class FulaPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal/era/version steps need
        // the number and its suffix still adjacent, which the tier would break.
        return assembleClauses(SYMBOLS(normalizeFula(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            // numbers: Adlam digits folded to ASCII, composed to Fula words (numbers.ts: quinary 6–9), then g2p
            else if (m[2]) {
                const n = Number(foldAdlamDigits(m[2]).replace(/,/gu, ""));
                for (const wd of numberToWords(n).split(" ")) sink.emit(phonemizeWord(wd));
            }
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}
export function createFula(): Phonemizer {
    return new FulaPhonemizer();
}
