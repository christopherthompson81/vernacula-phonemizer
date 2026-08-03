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

// #562 symbol normalization — Fula. Percent reads "e teemedere" (in a hundred) — COMPOSED from two
// attested pieces (`e` ×92 in the corpus, `teemedere` = 100 in this engine's own number data) rather than
// asserted as a single word: the form this shipped with, "tere", appears in neither the corpus nor the
// epitran referee's 1,777-word list, and a wrong percent word is worse than a dropped sign (playbook).
// Nouns stay SINGULAR after numerals, so one form suffices.
// The unit words are the corpus's own borrowings (kilometre, metre); "e wakkati gootel" = per hour.
const SYMBOLS = makeSymbolNormalizer({
    percent: ["e teemedere"],
    currency: { "$": ["dollar"], "€": ["euro"], "¥": ["yen"], "£": ["pound"] },
    units: { km: ["kilometre"], m: ["metre"], kg: ["kilogram"], mm: ["milimeta"], cm: ["santimeta"] },
    unitPer: "e wakkati gootel", // 160 km/h -> teemedere e cappanɗe jeegom kilometre e wakkati gootel
    rateDenominators: { h: "wakkati", s: "sahaawa" },
    // Both sourced from ff.wikipedia, because the FLEURS corpus attests no measure word at all. Postposed:
    //   kiloomeeteer kaaree  "468 kiloomeeteer kaaree (181 mi kaaree)"        ← squared
    //   meeteer kubik        "60 miliyoŋ meeteer kubik (2.1×10⁹ cu ft)"       ← cubed
    // `kaaree` is attested across at least six independent articles (Farayse, Roosiya, Belaruusiya, Abuko,
    // Akinyele, Aouk Aoukale) — every one a COUNTRY or a place, which is the article class that cannot state
    // its subject without an area figure. That is where a unit's measure word lives; the maths articles this
    // wiki does not have would have been the harder route.
    //
    // ⚠ `kaare` AND `kaaree` ARE DIFFERENT WORDS, one letter apart, and the shorter one is the SHAPE:
    // "Suudu juulirde nduu ko kaare, ceŋol mum ko dome mawɗo" (the prayer hall is square, with a dome).
    // A first pass probed `kaare` and `karre`, read ×1 shape and ×1 proper noun, and concluded this language
    // had no squared word at all — a word-first probe cannot find a spelling you did not guess. `punndi` ×5,
    // the third candidate, is a PUBLICATION NAME inside reference citations.
    //
    // ⚠ THE CUBE WORD IS AN OPEN QUESTION, and `kubik` is the CAUTIOUS choice rather than the best-attested
    // one. The slot probe turned up a native competitor with more in-article instances:
    //   meeteer kubik        ×1, 1 article   "60 miliyoŋ meeteer kubik (2.1×10⁹ cu ft)"
    //   meeteer kuuɓtodinɗo  ×4, 1 article   "28 000 000 meeteer kuuɓtodinɗo (990 000 000 ft kuuɓtodinɗo)"
    // The second is glossed against `cu ft` in its own text and is applied productively (to `ft` as well as
    // to `meeteer`), which argues it is the real modifier. But BOTH sit in exactly one article, which this
    // wiki's own tooling rule calls a LEAD rather than a finding, and the native form is polysemous: its bare
    // token is ALSO ×4 here and every one of those is a job title — `Hooreejo kuuɓtodinɗo`, in a list of
    // officeholders. Same count, different word (trap 37 twice over, in one language).
    // The loan is kept because it is unambiguous in the slot and a wrong word is worse than a plainer one;
    // picking between two single-article Wikipedia forms is a judgement for a speaker of the language.
    exponentWords: { squared: ["kaaree"], cubed: ["kubik"], position: "after" },
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
