/**
 * Igbo text normalization — the symbols a reader voices, rewritten to words before the tokenizer sees them.
 *
 * ⚠ Igbo has no independent referee (wikipron, epitran and kaikki all 404), so readings here rest on corpus
 * evidence and dictionary lookup rather than on a transcription source.
 *
 * Deliberately absent, because no usable word was found and inventing one is worse than silence: DEGREES
 * (neither `dịgrii` nor `selsiọs` occurs at all), MULTIPLICATION (the candidate `mụba` is the verb "to
 * increase", not the operator), and `£` / `€` (the signs occur but the words are ambiguous with the weight
 * unit, or too thin).
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { MANIFEST } from "./manifest.ts";

const SYMBOLS = makeSymbolNormalizer({
    /**
     * ⚠ THE SIGN FOLLOWS THE NUMBER BUT THE WORD PRECEDES IT — the one thing here that assuming English order
     * gets wrong. Written Igbo puts the sign after (`9%`); spoken Igbo puts the word first (`pasent 60`). Same
     * shape as Turkish `yüzde 40`.
     */
    percent: ["pasent"],
    percentPrefix: true,
    /** The word FOLLOWS the number here (`nde naira`, "million naira"), which is the tier's default. */
    currency: { "₦": ["naira"], $: ["dollar"] },
    /** `na` — the ordinary Igbo connective, and the same word the number compositor uses to join parts. */
    ampersand: "na",
});

/** The thousands separator is a COMMA and the decimal separator a PERIOD — the Nigerian/English convention. */
const GROUPED = /(\d),(\d{3})(?!\d)/gu;
/** A decimal period. Voiced as `ntụkpọ` — see rule 4. */
const DECIMAL = /(\d)\.(\d+)/gu;
/** A digit-flanked dash. See rule 2 for why this is a RANGE and never a minus. */
const RANGE = /(\d)\s*[-–—]\s*(?=\d)/gu;

/** Normalize Igbo text: symbols the reader voices become words, before `igbo.ts`'s TOKEN ever sees them. */
export function normalizeIgbo(text: string): string {
    let s = text;

    // 1. De-group thousands FIRST: a grouping comma left in place makes the number two numbers with a pause
    //    between them (`1,500` → *otu , naɾɪ ise*, "one, five hundred").
    //    ⚠ EXACTLY THREE FOLLOWING DIGITS, so a decimal comma cannot be eaten. Applied repeatedly for numbers
    //    with several groups (1,234,567).
    while (GROUPED.test(s)) {
        GROUPED.lastIndex = 0;
        s = s.replace(GROUPED, "$1$2");
    }

    // 2. ⚠ A DIGIT-FLANKED DASH IN IGBO IS A RANGE, NOT A MINUS — overwhelmingly year-year (`1967-1970`) or
    //    page-page (`peeji 90-120`). A minus rule here would read every date range as arithmetic, which is why
    //    nl, mr, ta and yue all record their minus as an ACCEPTED silence. `ruo` is "to, until".
    s = s.replace(RANGE, "$1 ruo ");

    // 3. The shared symbol tier.
    s = SYMBOLS(s);

    // 4. The decimal separator, LAST — the order is load-bearing. Run before the tier, this splits `8.3%` into
    //    `8 3%` and the percent word lands BETWEEN the halves (*asatɔ pasent atɔ*, "eight percent three"); the
    //    tier's number pattern spans `8.3`, so it must see the number whole.
    //
    //    ⚠ Leaving it alone is not neutral either: `igbo.ts`'s TOKEN treats `.` as clause punctuation, so `2.5`
    //    reads *abʊɔ . ise* — a sentence break inside a number.
    //
    //    `ntụkpọ` comes from a dictionary, not the corpus, which contains no instance of it (the near-miss
    //    `ntụpọ` means a SPOT). Shipped UNTONED, matching the register of every other word here and the fact
    //    that `igbo.ts` reads tone only when written.
    //
    //    The FRACTION stays digit-by-digit after the word: `3.14159` is "three point one four one five nine".
    s = s.replace(
        DECIMAL,
        (_m, whole: string, frac: string) => `${whole} ${MANIFEST.numbers.decimalWord} ${[...frac].join(" ")}`,
    );

    // A sentence-final period is untouched: DECIMAL requires a digit on BOTH sides.
    return s;
}
