/**
 * Fula (ff) phonemizer — Fulfulde, canonical IPA (authored). Longest-match g2p (g2p.ts) +
 * penultimate stress; no lexicon. text() tokenizes Fula words (incl. ɓ ɗ ŋ ɲ ƴ) / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
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
// the corpus groups thousands with COMMAS (2,243, 100,000) and writes decimals with DOTS (1.5, 3.50);
// the TOKEN swallows the separators so the tier can still see the number next to its unit/sign.
const TOKEN = new RegExp(
    `(${hostWordRun(["Latin", "Adlam"])})|([1-9]\\d{0,2}(?:,\\d{3})+(?:\\.\\d+)?|\\d+\\.\\d+|\\d+[\\u{1E950}-\\u{1E959}]*|\\d*[\\u{1E950}-\\u{1E959}]+)|([.!?…,;:])`,
    "gu",
);

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it is no longer also
 * deciding where the script boundary falls.
 */
const NATIVE_CLASS = "[a-zɓɗŋɲƴñA-ZƁƊŊƝƳÑ\\u{1E900}-\\u{1E94A}]";
const nat = makeNativiser(NATIVE_CLASS, "u");

// ⚠ PERCENT IS COMPOSED, NOT ASSERTED: "e teemedere" ("in a hundred") is built from two attested pieces —
// the preposition `e` and `teemedere` = 100 from this engine's own number data. A single-word form was tried
// and appears in neither Fula text nor the epitran referee, and a wrong percent word is worse than a dropped
// sign.
// Nouns stay SINGULAR after numerals, so one form suffices. "e wakkati gootel" = per hour.
const SYMBOLS = makeSymbolNormalizer({
    // ⚠ Declaring `multiply` HERE is what makes ASCII `x` read like `×`: otherwise `6x6 cm` reads the `x` as a
    // LETTER NAME, and `NxN` is the commoner written form. One word, so `by` defaults to it.
    multiply: { times: "je" },
    percent: ["e teemedere"],
    currency: { "$": ["dollar"], "€": ["euro"], "¥": ["yen"], "£": ["pound"] },
    units: { km: ["kilometre"], m: ["metre"], kg: ["kilogram"], mm: ["milimeta"], cm: ["santimeta"] },
    // ⚠ THE PREPOSITION IS THE ONLY PART THAT IS DENOMINATOR-INDEPENDENT, so it is all `unitPer` holds.
    // The rest — the noun AND the class-agreeing "one" after it — belongs to the denominator, because the
    // shared tier composes `${per} ${dPhrase}` and there is no slot for a word AFTER the noun. Declaring
    // the whole phrase as `unitPer` (as this did) appended the denominator to a phrase that already named
    // one: `133m/s` composed *e wakkati gootel sahaawa*, "per hour second".
    unitPer: "e", // 160 km/h -> teemedere e cappanɗe jeegom kilometre e wakkati gootel
    // ⚠ `s` IS DELIBERATELY ABSENT, and its absence is the reading. `gootel` is not the plain numeral —
    // `numberToWords(1)` is *goo* — it is the form of "one" agreeing with `wakkati`'s noun class, and the
    // form agreeing with `sahaawa`'s class is UNSOURCED. The corpus cannot settle it: all 16 `wakkati`
    // instances are "time" in the general sense (`ha wakkati sare`, `wakkati gulɗum`), not one of them a
    // rate, and `gootel` occurs once. With `s` undeclared the shared tier returns the text untouched, so
    // `133m/s` reads its letters — recoverable — instead of asserting *per hour*, which it did before and
    // which is the "wrong word is worse than a dropped sign" case this file already argues for `percent`.
    rateDenominators: { h: "wakkati gootel" },
    // ⚠ POSTPOSED — kiloomeeteer kaaree (squared), meeteer kubik (cubed). Both come from ff.wikipedia rather
    // than from spoken-corpus text, which attests no measure word at all: `kaaree` recurs across country and
    // place articles, the class that cannot state its subject without an area figure. That is where a unit's
    // measure word lives when the language has no maths articles.
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
    // officeholders. Same count, different word (⚠ the bare modifier is never the attestation — twice over, in one language).
    // The loan is kept because it is unambiguous in the slot and a wrong word is worse than a plainer one;
    // picking between two single-article Wikipedia forms is a judgement for a speaker of the language.
    exponentWords: { squared: ["kaaree"], cubed: ["kubik"], position: "after" },
});

class FulaPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal/era/version steps need
        // the number and its suffix still adjacent, which the tier would break.
        return assembleClauses(SYMBOLS(normalizeFula(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // numbers: Adlam digits folded to ASCII, composed to Fula words (numbers.ts: quinary 6–9), then g2p
            else if (m[2]) {
                // ⚠ THE FOLDED, STRIPPED STRING IS PASSED AS `raw` (#1095) — Adlam digits first, so the
                // fallback reads ASCII, and separators removed, so it reads only digits.
                const digits = foldAdlamDigits(m[2]).replace(/,/gu, "");
                for (const wd of numberToWords(Number(digits), digits).split(" ")) sink.emit(phonemizeWord(wd));
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
