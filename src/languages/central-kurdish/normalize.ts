/**
 * Central Kurdish / Sorani (ckb) TEXT NORMALIZATION (#562) — the pre-tokenizer pass that rewrites
 * everything the Kurdish g2p cannot already read into Kurdish words the existing pipeline speaks. Pure
 * text→text, no IPA. Runs inside central-kurdish.ts's `text()`, before the tokenizer.
 *
 * MEASURED OVER THE FLEURS ckb_iq CORPUS, column 3 (the ORIGINAL cased text):
 *   ARABIC-INDIC DIGITS ٠-٩  2036   ← the majority digit system, and it read as NOTHING
 *   ASCII digits             1705      decimal point N.N   47      ranges N–N   34
 *   comma-grouped N,NNN        31      colon clock HH:MM   25      percent N %   5
 *
 * ★ THE HEADLINE: THE LANGUAGE'S OWN DIGITS PRODUCED AN EMPTY STRING. `٢٠٢٤` phonemized to `""`, and so
 * did `١٠٠٠٠`. The cause is the tokenizer's letter class, `[ؠ-ۿ]` = U+0620–U+06FF, which CONTAINS the
 * Arabic-Indic digits U+0660–U+0669 — so a digit run was claimed by the LETTER branch and the word
 * phonemizer had nothing to say about it. The `(\d+)` branch could never see them. This is the same shape
 * as the Burmese defect where a raw block range swallowed that script's own sentence terminators, and it
 * is worse here because the swallowed characters are the MAJORITY digit system: 2036 against 1705 ASCII.
 *
 * Folding to ASCII first is the fix, using the shared `foldNativeDigits` (core/unicode.ts) rather than a
 * local table — twelve languages already do this, and the block-base arithmetic there covers the
 * Extended Arabic-Indic range ۰-۹ too, which this corpus does not use but neighbouring orthographies do.
 *
 * ⚠ KURDISH USES THE ENGLISH NUMERIC CONVENTIONS, which is the opposite of the three European languages
 * treated immediately before it. The comma is the THOUSANDS separator (31 instances: `30,000`) and the
 * period is the DECIMAL point (47: `2.4`, `5.0`). Danish, Romanian and Bulgarian are all the other way
 * round, and Norwegian is too. Reading `30,000` as a decimal — which the previous four languages' rule
 * would do — turns thirty thousand into "thirty point zero zero zero".
 *
 * ⚠ `802.11` is here as well, in its fourth consecutive language. The decimal rule is written to accept
 * one or two fractional digits, so the Wi-Fi standard's `.11` is claimed as a decimal — which is
 * harmless, since it is spoken as a number either way — while the three-digit `,000` grouping is not.
 *
 * ORDERING:
 *   · THE DIGIT FOLD IS FIRST. Every rule below counts digits, and none of them would match a native one.
 *   · DE-GROUPING before the decimal rule, or `30,000` is read as a fraction.
 */
import { foldNativeDigits } from "../../core/unicode.ts";

/** Relational and operator signs, read in every position — a dropped sign is inaudible. All probed
 *  through the g2p; `خاڵ` (point) is attested 56 times, `پلە` (degree) 90. */
const RELATIONAL: [RegExp, string][] = [
    [/±/gu, " کۆ و لێدەرکراو "],
    [/=/gu, " یەکسانە بە "],
    [/</gu, " کەمتر لە "],
    [/>/gu, " زیاتر لە "],
    [/×/gu, " لە "],
    [/÷/gu, " دابەش بە "],
];

/** Currency sign → the Kurdish word. `دۆلار` is attested 27 times, `یۆرۆ` once. */
const CURRENCY: Readonly<Record<string, string>> = {
    "$": "دۆلار", "€": "یۆرۆ", "£": "پاوەند", "¥": "یەن",
};

export function normalizeCentralKurdish(input: string): string {
    // 1) FOLD THE NATIVE DIGITS FIRST — see the header. Without this every rule below is blind to 2036 of
    //    the corpus's 3741 digits, and the engine reads them as an empty string.
    let t = foldNativeDigits(input);

    // 2) COMMA-GROUPED THOUSANDS (31), before the decimal rule. Kurdish follows the ENGLISH convention,
    //    so the comma is a GROUPING mark here and reading it as a decimal would turn `30,000` into
    //    "thirty point zero zero zero".
    let prev: string;
    do {
        prev = t;
        t = t.replace(/(\d)[,،](\d{3})(?!\d)/gu, "$1$2");
    } while (t !== prev);

    // 3) DECIMAL POINT (47) — again the English convention. The period is clause punctuation, so `2.4`
    //    read as "two" + a SENTENCE BREAK + "four". Fractional part spoken digit by digit.
    t = t.replace(/(\d+)\.(\d+)/gu, (_m, whole: string, frac: string) =>
        `${whole} خاڵ ${[...frac].join(" ")}`);

    // 4) CLOCK, COLON FORM (25). The colon was reaching clausePunctuation as a COMMA PAUSE, so `11:00`
    //    read as "یانزە , سفر".
    t = t.replace(/(\d{1,2}):(\d{2})(?!\d)/gu, "$1 $2");

    // 5) PERCENT (5) → `لە سەدا` ("out of a hundred"), the construction the corpus writes out (11).
    //    Kurdish PREPOSES it, unlike every other language in this sequence: `لە سەدا ٢٥`, not `٢٥ لە سەدا`.
    //    BOTH PLACEMENTS of the sign are claimed. The corpus writes `٨٨%` five times and `%٨٨` once —
    //    the sign-first form is the Arabic-script convention and a rule anchored only on the digit-first
    //    shape leaves it silent. The READING is preposed either way.
    t = t.replace(/(\d+)\s*%/gu, "لە سەدا $1");
    t = t.replace(/%\s*(\d+)/gu, "لە سەدا $1");

    // 6) DEGREES. `پلە` is the word (90 in the corpus); the scale letter would otherwise reach the Latin
    //    fallback and be read as an English letter name.
    t = t.replace(/℃/gu, "°C").replace(/℉/gu, "°F");
    t = t.replace(/(\d)\s*°\s*C(?!\p{L})/giu, "$1 پلەی سەلیزی");
    t = t.replace(/(\d)\s*°\s*F(?!\p{L})/giu, "$1 پلەی فەهرەنهایت");
    t = t.replace(/(\d)\s*°/gu, "$1 پلە");

    // 7) RANGES (34). Spoken `بۆ` ("to"), which is an ordinary word in the corpus (2057).
    t = t.replace(/(?<![-–—])(\d+)\s*[-–—]\s*(\d+)(?!\d)(?!\s*[-–—]\s*\d)/gu, "$1 بۆ $2");

    // 8) CURRENCY, both placements — the corpus writes none, but a phonemizer is handed arbitrary text.
    for (const [sign, word] of Object.entries(CURRENCY)) {
        const esc = sign.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        t = t.replace(new RegExp(`${esc}\\s*(\\d+)`, "gu"), `$1 ${word}`);
        t = t.replace(new RegExp(`(\\d+)\\s*${esc}`, "gu"), `$1 ${word}`);
    }

    // 9) SIGNED NUMBERS — a sign PREFIXED to a number, `UTC+1` (2 instances). The boundary here must
    //    admit a LETTER before the sign, unlike the European languages where that shape is a hyphenated
    //    compound: a timezone offset is written directly against its abbreviation.
    //    The replacement carries a LEADING space: the sign sits directly against the abbreviation
    //    (`UTC+1`), so without it the word fuses on as `UTCکۆ`. The trailing collapse tidies the double.
    t = t.replace(/(?<![\d])([-−+])(\d+)/gu, (_m, sign: string, n: string) =>
        ` ${sign === "+" ? "کۆ" : "کەم"} ${n}`);

    // 10) ARITHMETIC AND RELATIONAL SIGNS — infix between digits is where arithmetic lives; the relational
    //    signs are read in every position, because a dropped sign is inaudible.
    t = t.replace(/(\d)\s*\+\s*(\d)/gu, "$1 کۆ $2");
    for (const [re, word] of RELATIONAL) t = t.replace(re, word);

    // 11) AMPERSAND → و ("and"), which is the commonest word in the corpus (32,622).
    t = t.replace(/\s*[&＆]\s*/gu, " و ");

    // The insertions above pad with spaces so a sign never fuses with its neighbours; collapse the runs.
    return t.replace(/[ \t]{2,}/gu, " ");
}
