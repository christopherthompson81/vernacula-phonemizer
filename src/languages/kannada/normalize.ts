/**
 * Kannada (kn) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Measured over the kn_in FLEURS corpus (1,811 unique utterances, column 3 — the cased one):
 *   922 ZWNJ + 139 ZWJ + 6 ZWSP · 561 bare numerals (132 one-digit · 82 teens · 47 round tens ·
 *   73 two-digit non-round · 75 three-digit · 146 in the 1000-2999 band · 6 larger)
 *   42 comma-grouped numbers · 39 ordinal ನೇ/ನೆಯ · 29 decimals · 18 numeric ranges · 15 clock colons
 *   14 dotted Kannada abbreviations (ಕಿ.ಮೀ ×6 · ಯು.ಎಸ್ ×5 · ಮಿ.ಮೀ ×1 · ಡಿ.ಕೆ ×1) + 13 undotted ಕಿಮೀ/ಕಿಮಿ
 *   6 era markers (ಕ್ರಿ.ಪೂ ×5, ಕ್ರಿ.ಶ ×1) · 7 currency signs · 4 percent · 4 Kannada-script rate units
 *   2 vulgar fractions · 1 exponent (km²) · 1 degree · 1 Kannada digit · ~170 Latin tokens
 *
 * THE LARGEST DEFECT WAS NOT IN THIS LAYER — the same shape the Tamil and Telugu runs found, and for
 * overlapping reasons. Kannada fuses 21-99 into one word, has suppletive round hundreds (ಇನ್ನೂರು,
 * ಮುನ್ನೂರು, ಐನೂರು, ಒಂಬೈನೂರು) and takes combining magnitude forms before a remainder (ನೂರಾ, ಸಾವಿರದ,
 * ಲಕ್ಷದ). The shared `indicNumberWords` composer expresses none of the last two, so 1976 read as
 * ಸಾವಿರ ಒಂಬತ್ತು ನೂರು ಎಪ್ಪತ್ತು ಆರು where Kannada says ಸಾವಿರದ ಒಂಬೈನೂರಾ ಎಪ್ಪತ್ತಾರು. Fixed where it lives,
 * in kannada.jsonc + numbers.ts; this file composes on top of the corrected words.
 *
 * NO `\b` ANYWHERE. `\b` is defined on ASCII word characters and finds no boundary at all against
 * Kannada script. Every boundary here is an explicit `(?<![\p{L}\p{M}])` / `(?![\p{L}\p{M}])` lookaround.
 *
 * KANNADA DIGITS ೦-೯: the corpus contains exactly ONE (a ೪ in "೪ ಶೂಟರ್ಗಳಿಗೆ"), and it is a genuine
 * numeral, not a homoglyph typo. So the Persian/Tamil/Telugu negative result essentially holds — the
 * digit inventory is ASCII — while the Marathi positive result (×597) does not. kannada.ts already
 * folded the block in its own `number()`, but only for a token the tokenizer had already classed as a
 * digit run; step 2 folds it before any rule here so that a native-digit numeral can also carry a
 * percent sign, a unit or an ordinal suffix.
 *
 * LATIN RUNS ARE DELIBERATELY LEFT TO THE EMBEDDED FOREIGN PHONEMIZER. ~170 Latin tokens occur (US, UN,
 * NBA, DNA, UTC, GMT, MRI…) and the English path already spells the unpronounceable ones letter by
 * letter. A Latin→Kannada letter-name table would be invented data. What IS fixed here is the DOTTED
 * KANNADA spellings, whose interior dots were being read as clause breaks (step 6).
 */
import { foldNativeDigits } from "../../core/unicode.ts";
import { MANIFEST } from "./manifest.ts";
import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../../core/boundaries.ts";
import { postposedSign } from "../../core/postposedSign.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { numberToWords, ordinalToWords, ordinalStem, DECIMAL_WORD } from "./numbers.ts";
import { rewrite } from "../../core/provenance.ts";

/** Kannada letter+mark boundary. Never `\b`. */
/**
 * The SHARED symbol tier (percent / currency / units / exponent). Kept in this file rather than in
 * kannada.ts because its position in the ordering matters and the ordering is this file's job.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: MANIFEST.symbolTier.percent,
    currency: MANIFEST.symbolTier.currency,
    units: MANIFEST.symbolTier.units,
    exponentWords: MANIFEST.symbolTier.exponentWords,
    magnitudes: MANIFEST.symbolTier.magnitudes,
    ampersand: MANIFEST.symbolTier.ampersand,
    multiply: MANIFEST.symbolTier.multiply,
});

/**
 * Kannada unit abbreviations. The shared tier above is keyed on Latin spellings and cannot see these.
 * Both the dotted (ಕಿ.ಮೀ ×6) and undotted (ಕಿಮೀ ×9, ಕಿಮಿ ×4) forms occur, and both ಮೀ and ಮಿ appear as
 * the second element, so the vowel is matched either way. A SPACED variant is deliberately not matched:
 * `ಕಿ ಮೀ` occurs zero times here, and ಕಿ is a common Kannada dative clitic — trap #2, checked, not
 * assumed.
 */
const KM_RE = new RegExp(`${NOT_LETTER_BEFORE}(?:ಕಿ\\s*\\.\\s*ಮ[ೀಿ]|ಕಿಮ[ೀಿ])`, "gu");
/** ಮೈ for ಮೈಲಿ — ONLY as a rate numerator (40 ಮೈ/ಗಂ, ×1). The `/ಗಂ` guard is what keeps this off the
 *  many real Kannada words beginning ಮೈ (ಮೈಲಿಗಲ್ಲು, ಮೈಲರ್, ಮೈದಾನ) — trap #2. */
const MI_RATE_RE = new RegExp(`(\\d[\\d.]*)\\s?ಮೈ\\s*\\/\\s*ಗಂ\\.?`, "gu");

/** Era markers. ಕ್ರಿ.ಪೂ ×5, ಕ್ರಿ.ಶ ×1. ಕ್ರಿಸ್ತ, ಪೂರ್ವ and ಶಕ are all written out in this corpus. */
const ERA: Readonly<Record<string, string>> = {
    "ಪೂ": "ಕ್ರಿಸ್ತ ಪೂರ್ವ",
    "ಶ": "ಕ್ರಿಸ್ತ ಶಕ",
};

const LETTER = `(?:${[...MANIFEST.initialismLetterForms].sort((a, b) => b.length - a.length).join("|")})`;
/** A run of ≥2 dot-separated letter names. The run's TRAILING dot is consumed only when the sentence
 *  visibly continues, so a true sentence-final pause is never lost. */
const INITIALISM_RE = new RegExp(
    `${NOT_LETTER_BEFORE}${LETTER}(?:\\s*\\.\\s*${LETTER})+(?:\\s*\\.(?=\\s*[\\p{L}]))?${NOT_LETTER_AFTER}`,
    "gu",
);

/** Kannada rate denominators, in the dative — both attested verbatim in this corpus. */
const RATE_DENOM: Readonly<Record<string, string>> = { "ಗಂ": "ಗಂಟೆಗೆ", "ಸೆ": "ಸೆಕೆಂಡಿಗೆ" };

/**
 * The dative rate prefix, UNLESS the text already carries it. This corpus writes
 * "ಗಂಟೆಗೆ ಸುಮಾರು105 ಮೈಲಿಗಳಷ್ಟು (165 ಕಿಮಿ/ಗಂ)" — emitting the prefix unconditionally on an occurrence
 * that already has one gives "ಗಂಟೆಗೆ ಗಂಟೆಗೆ …", the duplicated-الساعة shape the Arabic run hit.
 */
function dative(word: string, full: string, offset: number): string {
    return new RegExp(`${word}\\s*$`, "u").test(full.slice(0, offset)) ? "" : `${word} `;
}

// Vulgar fractions
const VULGAR: Readonly<Record<string, string>> = { "¼": "ಕಾಲು", "½": "ಅರ್ಧ", "¾": "ಮುಕ್ಕಾಲು" };

/**
 * The Kannada normalizer. A numbered, ORDER-DEPENDENT sequence; the coupling is stated at each step
 * because a future reader cannot recover it from the code.
 */
export function normalizeKannada(input: string): string {
    // 1) ZERO-WIDTH characters (ZWNJ ×922, ZWJ ×139, ZWSP ×6 — the largest raw count in the corpus).
    //    Removed FIRST: every later rule asserts letter/digit adjacency, and an invisible character
    //    defeats all of them. It also fixes a defect of its own — the engine's word class is the
    //    Kannada block, which excludes U+200C/U+200D, so ಪಾಯಿಂಟ್‌ಗಳಿಂದ tokenized as TWO words and came
    //    out [pˈaːjĩɳʈ ɡˈaɭĩn̪d̪a], two primary stresses where the word has one. Every one of the 1,067
    //    instances sits immediately after a virama ್ (checked by printing the neighbours), so deleting
    //    the joiner leaves the identical akshara sequence and no phoneme changes.
    let s = rewrite(input, /[​‌‍﻿]/gu, "");  // ZWSP, ZWNJ, ZWJ, BOM

    // 2) KANNADA DIGITS ೦-೯ → ASCII (×1). Before every numeric rule below, so that a native-digit
    //    numeral is eligible for the same de-grouping, ordinal, percent and unit handling as an ASCII
    //    one. kannada.ts also folds them, but only inside a token the tokenizer already classed as a
    //    digit run, which is too late for any rule here.
    s = foldNativeDigits(s);

    // 3) DIGIT DE-GROUPING, before anything that reads punctuation. A grouping comma is otherwise
    //    clause punctuation: 1,000 was reading as "ಒಂದು <pause> ಸೊನ್ನೆ" — a pause plus a single zero,
    //    because the trailing 000 collapsed to one numeral. ×42, all Western 3-digit blocks (no Indian
    //    2-then-3 grouping occurs in this corpus).
    s = rewrite(s, /(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?:,\d|[^\d]|$))/gu, "");

    // 4) ORDINALS ನೇ / ನೆಯ (×39), AFTER de-grouping — unlike Telugu, this corpus does write an ordinal
    //    on a grouped numeral ("ಅವರ 1,000 ನೇ ಅಂಚೆ ಚೀಟಿ"), which the `(?<![\d.,])` guard would reject
    //    while the comma was still there. Kannada fuses the suffix onto the LAST cardinal word
    //    (15ನೇ → ಹದಿನೈದನೇ); emitted apart, ನೇ reached the g2p as a stray stressed [nˈeː]. The suffix
    //    is written both welded (16ನೇ) and spaced (15 ನೇ) in this corpus, hence the optional space, and
    //    may carry the nominaliser ದು (60ನೆಯದು), which rides along on the fused form.
    s = rewrite(s,
        new RegExp(`(?<![\\d.,])(\\d+)\\s*-?\\s*(ನೇ|ನೆಯ)(ದು)?${NOT_LETTER_AFTER}`, "gu"),
        (whole, digits: string, suffix: string, du: string | undefined) => {
            const n = Number(digits);
            if (!Number.isSafeInteger(n) || n === 0) return whole;
            const w = ordinalToWords(n, `${suffix}${du ?? ""}`);
            return w === "" ? whole : w;
        },
    );

    // 5) ERA markers, BEFORE the dotted-abbreviation rules (step 6) — ಕ್ರಿ.ಪೂ is a dotted pair by shape
    //    and would otherwise survive as two letters with the era lost. The trailing dot is consumed
    //    only when a letter or digit follows, so a sentence-final period is never eaten; all six here
    //    are mid-sentence (ಕ್ರಿ.ಪೂ. 356, ಕ್ರಿ.ಪೂ.5000, ಕ್ರಿ.ಶ. 1000–1300). A Kannada case clitic may be
    //    welded straight onto the abbreviation (ಕ್ರಿ.ಪೂದಲ್ಲಿ, ಕ್ರಿ.ಪೂವರೆಗೂ); it is left attached, which
    //    is grammatical on the expansion too — ಕ್ರಿಸ್ತ ಪೂರ್ವದಲ್ಲಿ, ಕ್ರಿಸ್ತ ಪೂರ್ವವರೆಗೂ.
    s = rewrite(s,
        new RegExp(`${NOT_LETTER_BEFORE}ಕ್ರಿ\\s*\\.\\s*(ಪೂ|ಶ)(?:\\s*\\.(?=\\s*[\\p{L}\\d]))?`, "gu"),
        (_m, k: string) => ERA[k]!,
    );

    // 6) MULTI-DOT ABBREVIATIONS before single-dot ones, else the interior dot survives as a phrase
    //    break: ಕಿ.ಮೀ was reading as [kˈi . mˈiː], two clauses, and ಯು.ಎಸ್ as two. The Kannada unit
    //    abbreviations go first because ಕಿ/ಮೀ are not letter names and the initialism rule cannot see
    //    them, and both run before the rate rule (step 7), which needs ಕಿ.ಮೀ already folded to a word.
    //
    //    The unit is expanded to ಕಿಲೋಮೀಟರ್ only when nothing is welded onto it. Two of the eight
    //    dotted/undotted instances carry a case clitic (ಕಿ.ಮೀಯಲ್ಲಿ, ಕಿ.ಮೀವರೆಗೆ, and ಕಿಮೀನಷ್ಟು); gluing
    //    the clitic to the expansion would produce ಕಿಲೋಮೀಟರ್ಯಲ್ಲಿ, a form Kannada does not build that
    //    way, so those keep the abbreviation and only lose the dot. Losing the dot is the whole defect;
    //    the expansion is a bonus that is only taken where it is safe.
    s = rewrite(s, KM_RE, (m, off: number, full: string) =>
        new RegExp(`^[\\p{L}\\p{M}]`, "u").test(full.slice(off + m.length))
            ? rewrite(m, /\s*\.\s*/gu, "")
            : "ಕಿಲೋಮೀಟರ್");
    s = rewrite(s, new RegExp(`${NOT_LETTER_BEFORE}ಮಿ\\s*\\.\\s*ಮೀ`, "gu"), "ಮಿಮೀ");
    s = rewrite(s, INITIALISM_RE, (m) => m.replace(/\s*\.\s*/gu, " ").trim());

    // 7) RATE units, BEFORE the shared symbol tier (step 9) can claim the numerator and strand the
    //    denominator. Kannada's rate is a dative PREFIX, attested verbatim in this corpus
    //    ("ಗಂಟೆಗೆ 83 ಕಿಮೀ", "ಸೆಕೆಂಡಿಗೆ 1.5 ಕಿಮಿ"), which is why `unitPer` is not declared on the shared
    //    tier. Step 6 has already folded ಕಿ.ಮೀ/ಕಿಮೀ to ಕಿಲೋಮೀಟರ್, so this matches the expanded word.
    s = rewrite(s,
        new RegExp(`(\\d[\\d.]*)\\s?ಕಿಲೋಮೀಟರ್\\s*\\/\\s*(ಗಂ|ಸೆ)\\.?${NOT_LETTER_AFTER}`, "gu"),
        (_m, n: string, den: string, off: number, full: string) =>
            `${dative(RATE_DENOM[den]!, full, off)}${n} ಕಿಲೋಮೀಟರ್`,
    );
    s = rewrite(s, MI_RATE_RE, (_m, n: string, off: number, full: string) =>
        `${dative("ಗಂಟೆಗೆ", full, off)}${n} ಮೈಲಿ`);

    // 8) VULGAR FRACTIONS
    s = rewrite(s, /(?<=\d)\s?([¼½¾])/gu, (_m, f: string) => ` ${VULGAR[f]!}`);

    // 9) The SHARED symbol tier: percent, currency, units, exponent. UNITS BEFORE DECIMALS (step 11) —
    //    the tier matches a unit only when a NUMBER is adjacent, and rewriting 3.5 to "3 ದಶಾಂಶ 5" first
    //    would destroy that adjacency. AFTER de-grouping so that "3,850 km²" and "$ 1,000" are each one
    //    number, and after the rate rule so the Kannada-script rate is already gone.
    s = SYMBOLS(s);

    // 10) TIMES BEFORE the decimal step: a bare-number rule must not claim 11:30, and the corpus writes
    //     the spaced range "10:00-11:00 pm" as well as 8:30, 06:30 and the sports times 2:11.60 /
    //     1:09.02 / 4:41.30.
    //     (a) :00 minutes are DROPPED, not read — "11:00(UTC +1)ಕ್ಕೆ" was giving "ಹನ್ನೊಂದು ಸೊನ್ನೆ".
    //     (b) every remaining digit-colon-digit becomes a SPACE: `:` is clause punctuation in this
    //         engine (kannada.jsonc maps it to ","), so it was inserting a pause inside 9:30 and 07:19.
    //     NO ಗಂಟೆ is added. The noun is already in the text where it belongs ("ಸ್ಥಳೀಯ ಸಮಯ 11:00"), and
    //     adding one would duplicate it — the same call Tamil and Telugu made on the same evidence.
    s = rewrite(s, /(?<![\d:])([01]?\d|2[0-3]):\s?00(?![\d:.])/gu, "$1");
    s = rewrite(s, /(?<=\d):\s?(?=\d)/gu, " ");

    // 11) DECIMALS
    s = rewrite(s,
        /(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu,
        (_m, int: string, frac: string) => `${int} ${DECIMAL_WORD} ${[...frac].join(" ")}`,
    );

    // 12) DEGREES
    s = rewrite(s, /(\S)\+\s?(?=\d)/gu, "$1 ಪ್ಲಸ್ ");
    s = rewrite(s, /(^|\s)\+\s?(?=\d)/gu, "$1ಪ್ಲಸ್ ");

    s = rewrite(s, /(\d)\s?°\s?/gu, "$1 ಡಿಗ್ರಿ ");

    // THE RELATIONAL AND DIVISION SIGNS
    s = postposedSign(s, "<", "ಗಿಂತ ಕಡಿಮೆ");
    s = postposedSign(s, ">", "ಗಿಂತ ಹೆಚ್ಚು");
    s = rewrite(s, /\s?=\s?/gu, " ಸಮ ");
    s = rewrite(s, /\s?÷\s?/gu, " ಭಾಗಾಕಾರ ");

    return s;
}

/** Exposed for tests: the corrected cardinal/ordinal readings the engine now composes. */
export { numberToWords, ordinalToWords, ordinalStem };
