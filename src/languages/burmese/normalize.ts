/**
 * Burmese (my) text normalization — the pre-tokenizer pass that rewrites everything the Burmese g2p cannot
 * already read into Burmese-script words the pipeline speaks. Pure text→text, no IPA. Runs inside
 * burmese.ts's `text()`, before the tokenizer.
 *
 * ⚠ WORD ORDER IS THE THING TO GET RIGHT, and it differs per construction:
 *   · PERCENT FOLLOWS the number — `၉၈ ရာခိုင်နှုန်း`.
 *   · A FRACTION IS DENOMINATOR-FIRST — `၃/၄` is spoken `၄ ပုံ ၃ ပုံ` ("four parts, three parts"). Emitting
 *     it numerator-first would be backwards.
 *   · A SQUARED/CUBED MODIFIER PRECEDES its unit — စတုရန်းကီလိုမီတာ. Postposing it like the percent word
 *     would be backwards, and no probe shows this; only the corpus count settles it.
 *   · A NEGATIVE IS A WORD, NOT A SIGN — `အနုတ် ၉၃ ဒီဂရီ`, the word BEFORE the number.
 *
 * ⚠ TWO NEGATIVE RESULTS, recorded so nobody adds these rules later:
 *
 *   1. NO BARE-SIGN NEGATIVE RULE, however much the drop scan asks for one. A hyphen before digits is a
 *      compound or a date (`ဒီ-၂၀`, `-၂၈ နိုဝင်ဘာ`), and U+2212 — commoner than the hyphen — is
 *      overwhelmingly a LIST BULLET (`၎င်းတို့မှာ −`). Burmese writes a real negative as the word အနုတ်, so
 *      the sign is never a minus here and a rule keying on it would corrupt dates and bullets.
 *
 *   2. `°` IS NOT ACCOMPANIED BY ITS WORD, so expanding the sign does not double it. A small sample suggests
 *      `၅၉° ဒီဂရီ` — sign plus word — but counted properly that shape is a handful against hundreds where the
 *      sign stands alone and must be read. Sampling four instances and generalising would have been wrong.
 *
 * ORDERING CONSTRAINTS, each of which is a bug that happened:
 *   · DE-GROUPING IS FIRST. `,` is in burmese.jsonc's clausePunctuation, so `၅၀,၀၀၀` reached the output as
 *     "fifty , thousand" — a comma PAUSE splitting one numeral into two.
 *   · THE CLOCK BEFORE THE DECIMAL, and both before anything that reads a bare number.
 *   · DEGREES BEFORE the Latin-fallback path, or the C of `၃၅°C` is read as the English letter name [sˈiː].
 */

/** Burmese digits ၀-၉ plus ASCII; the corpus mixes both, and every rule must accept either. */
const D = "0-9၀-၉";
/** One digit, optionally quantified. `d()` is a bare class so the caller can append its own quantifier. */
const d = (n?: number): string => `[${D}]${n === undefined ? "" : `{${n}}`}`;

/**
 * Unit abbreviations → their Burmese words. ⚠ Longest first, so `km` is not matched as `m` with a stray `k`
 * left behind. The bare `m`/`g` rows can use `\b` because the abbreviation is ASCII and its Burmese
 * neighbours are not word characters, so a boundary really is found there.
 */
const UNITS: [RegExp, string][] = [
    [/km/giu, "ကီလိုမီတာ"],
    [/kg/giu, "ကီလိုဂရမ်"],
    [/cm/giu, "စင်တီမီတာ"],
    [/mm/giu, "မီလီမီတာ"],
    [/\bm\b/giu, "မီတာ"],
    [/\bg\b/giu, "ဂရမ်"],
];

/** Currency signs → the Burmese word, postposed like the percent word. */
const CURRENCY: Record<string, string> = {
    "$": "ဒေါ်လာ",
    "€": "ယူရို",
    "£": "ပေါင်",
    "¥": "ယန်း",
    "₹": "ရူပီး",
};

export function normalizeBurmese(input: string): string {
    let t = input;

    // 1) ZERO-WIDTH marks. ⚠ Burmese uses ZWSP as a line-break hint INSIDE words, so it lands in the middle
    //    of a token and splits it for the segmenter. Removed outright.
    t = t.replace(/[​-‍⁠﻿]/gu, "");

    // 2) COMMA-GROUPED THOUSANDS, FIRST — before the comma can be read as a clause pause and cut the numeral
    //    in half. Applied repeatedly for numbers with several groups (၁,၂၃၄,၅၆၇).
    let prev: string;
    do {
        prev = t;
        t = t.replace(new RegExp(`(${d()})[,٬](${d(3)})(?!${d()})`, "gu"), "$1$2");
    } while (t !== prev);

    // 3) CLOCK, before any rule that reads a bare number and before the decimal rule. The colon reaches the
    //    output as nothing at all, so `၁၄:၃၀` reads as two unrelated numerals.
    t = t.replace(new RegExp(`(${d()}{1,2}):(${d(2)})(?!${d()})`, "gu"), "$1 နာရီ $2 မိနစ်");

    // 4) DECIMALS, after de-grouping so a grouped numeral keeps its tail, and after the clock so a time is
    //    never read as a decimal. The point reaches clausePunctuation and becomes a SENTENCE BREAK, so `၈၆.၄`
    //    reads as "၈၆", a full stop, then "၄". ⚠ The fractional part is spoken DIGIT BY DIGIT, so each digit
    //    is spaced out for the tokenizer to take one at a time.
    t = t.replace(new RegExp(`(${d()}+)\\.(${d()}+)`, "gu"), (_m, whole: string, frac: string) =>
        `${whole} ဒသမ ${[...frac].join(" ")}`);

    // 5) PERCENT. Postposed — see the header.
    t = t.replace(new RegExp(`(${d()}+)\\s*[%％]`, "gu"), "$1 ရာခိုင်နှုန်း");

    // 6) DEGREES, BEFORE the Latin fallback can read the scale letter as an English letter name.
    //    Case-insensitive on the letter; the bare sign is read too (negative result 2 in the header).
    //    ⚠ ℃/℉ are SINGLE characters and never decompose, so they are folded first.
    t = t.replace(/℃/gu, "°C").replace(/℉/gu, "°F");
    t = t.replace(new RegExp(`(${d()})\\s*°\\s*C(?![\\p{L}])`, "giu"), "$1 ဒီဂရီ စင်တီဂရိတ်");
    t = t.replace(new RegExp(`(${d()})\\s*°\\s*F(?![\\p{L}])`, "giu"), "$1 ဒီဂရီ ဖာရင်ဟိုက်");
    t = t.replace(new RegExp(`(${d()})\\s*°`, "gu"), "$1 ဒီဂရီ");

    // 7) CURRENCY. The sign PRECEDES the amount in writing and the word FOLLOWS it in speech, the same
    //    inversion English has.
    //    ⚠ THE SIGN MUST BE ESCAPED SELECTIVELY: under the `u` flag an identity escape is only legal on a
    //    syntax character, so a blanket `\\${sign}` produces the invalid pattern `\€` and the engine throws
    //    on every input — including plain words, since the rule is built before it is used.
    for (const [sign, word] of Object.entries(CURRENCY))
        t = t.replace(new RegExp(`${sign.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*(${d()}+)`, "gu"), `$1 ${word}`);

    // 8) FRACTIONS — DENOMINATOR FIRST, which is the whole point (see the header). Guarded on both sides
    //    being bare digit runs so a date written with slashes is not caught.
    t = t.replace(new RegExp(`(?<!${d()})(${d()}+)\\s*/\\s*(${d()}+)(?!${d()})`, "gu"), "$2 ပုံ $1 ပုံ");

    // 9) RANGES. A dash between two numerals is spoken `မှ … အထိ`. Runs AFTER the clock and the decimal so it
    //    cannot claim their separators, and it deliberately does NOT treat a leading dash as a negative —
    //    negative result 1 in the header.
    //
    //    ⚠ THE CHAIN GUARD IS LOAD-BEARING. A numeric date is written D-M-Y with the same character
    //    (`၂၀-၁-၂၀၂၄`), so without it the rule reads "၂၀ မှ ၁ အထိ" — "the 20th to the 1st" — inside a date
    //    that already carries its own မှ … ထိ. The guard is a dash on EITHER SIDE of the pair: in a chain the
    //    middle group is preceded by a dash and the last is followed by none, so requiring both neighbours to
    //    be dash-free rejects every link while accepting a lone pair.
    //    ⚠ The trailing `(?!digit)` is NOT redundant: without it the engine BACKTRACKS to a shorter second
    //    number to satisfy the `အထိ` guard, and `၁၂ - ၁၃ အထိ` comes out `၁၂ မှ ၁ အထိ၃ အထိ` — a digit spliced
    //    in half.
    const DASH = "[-‐-―−]";
    t = t.replace(
        new RegExp(`(?<!${DASH}\\s*)(${d()}+)\\s*${DASH}\\s*(${d()}+)(?!${d()})(?!\\s*(?:${DASH}|အထိ|ထိ))`, "gu"),
        "$1 မှ $2 အထိ",
    );

    // 10) SQUARED / CUBED UNITS, ⚠ BEFORE the plain unit rule in step 11 — otherwise `km²` has its `km`
    //     consumed first and the bare exponent is stranded with nothing to attach to, so `၃၈၅၀ km²` reads as
    //     plain "kilometre" and the area is lost. The modifier PRECEDES the unit; see the header.
    const EXP: [string, string][] = [["²", "စတုရန်း"], ["³", "ကုဗ"]];
    for (const [sup, modifier] of EXP)
        for (const [re, word] of UNITS)
            t = t.replace(new RegExp(`(${d()})\\s*(?:${re.source})\\s*${sup}`, "gu"), `$1 ${modifier}${word}`);

    // 11) LATIN UNIT ABBREVIATIONS after a number. Only when a digit precedes, so ordinary embedded English
    //     is left to the Latin fallback.
    for (const [re, word] of UNITS)
        t = t.replace(new RegExp(`(${d()})\\s*(?:${re.source})(?![\\p{L}])`, "gu"), `$1 ${word}`);

    // 12) RELATIONAL AND ARITHMETIC SIGNS.
    //     ⚠ `=` IS READ EVEN IN A GLOSS (`gêeo = Earth`, `မိုင်း = ကြီးမား`). Left unread the sign is DROPPED,
    //     so the two sides run together with no separation at all, and a slightly formal reading beats an
    //     inaudible one.
    //     ⚠ `+` BETWEEN TWO WORDS IS LEFT ALONE, and that is NOT the same call. Those are compound joiners —
    //     `အချိန်+ရပ်ဝန်းထု` (spacetime) — where the sign marks a compound rather than an operation and the
    //     words are simply spoken adjacent. A gloss sign separates a label from its expansion and must be
    //     audible; a compound joiner need not be.
    const RELATIONAL: [RegExp, string][] = [
        [/[=≈]/gu, " ညီမျှ "],
        [/</gu, " ထက်ငယ် "],
        [/>/gu, " ထက်ကြီး "],
    // ⚠ ASCII `x` TOO, not only `×`: `NxN` forms outnumber `×` roughly 85 to 20 across the corpora, and the
    // bare `x` was reaching the phoneme stream as its own LETTER NAME. Digit-bounded, so it cannot claim a letter.
        [/×|(?<=\p{Nd})[ \t]?x[ \t]?(?=\p{Nd})/gu, " မြှောက် "],
        [/÷/gu, " စား "],
    ];
    t = t.replace(new RegExp(`(${d()})\\s*\\+\\s*(${d()})`, "gu"), "$1 အပေါင်း $2");
    //     ⚠ A LEADING `+` WITH A DIGIT AFTER IT IS ALSO A WORD, which a both-sides guard is too tight to
    //     reach: `အာဆီယံ +၃` is ASEAN **Plus Three**, where the plus is part of the organisation's NAME, and
    //     `(+2/3)` is a positivity marker. A digit AFTER the sign is the discriminator, and it separates these
    //     cleanly from the compounds, every one of which has a letter on both sides.
    //     ⚠ STILL NOT MATCHED, deliberately: the ETYMOLOGY plus between parenthesised glosses
    //     (`(gêeo = Earth) + (graphein = to write)`), where what follows is a bracket rather than a digit.
    //     That one has its own reading and it is NOT အပေါင်း — Burmese glosses the symbol as နှင့် ("and") in
    //     exactly that frame. Left unimplemented rather than guessed at, because a rule narrow enough to catch
    //     the bracket-gloss shape would be fitted to one article rather than to the language.
    t = t.replace(new RegExp(`(?<![${D}])\\+\\s*(?=${d()})`, "gu"), "အပေါင်း ");
    for (const [re, word] of RELATIONAL) t = t.replace(re, word);
    t = t.replace(/[ \t]{2,}/gu, " ");

    // 13) AMPERSAND → နှင့် ("and"), the ordinary conjunction. Dropped outright, `A&B` reads as two unrelated
    //     letters.
    t = t.replace(/\s*[&＆]\s*/gu, " နှင့် ");

    // 14) DOTTED INITIALISMS (`U.S.`). The periods are abbreviation dots, not sentence ends, and each becomes
    //     a clause pause — `U.S.` reads as "yu . es .", two spurious breaks in the middle of a phrase. The
    //     letters themselves are left to the Latin fallback; only the dots are consumed.
    t = t.replace(/(?<![\p{L}\p{M}])(?:\p{L}\.){2,}/gu, (run) => run.replace(/\./gu, ""));

    return t;
}
