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
    // ⚠ `mg` AND `ug` ARE DIGIT-GUARDED AND THAT IS WHAT MAKES THEM SAFE — `Mg` is also how Burmese writes
    // the honorific မောင် (*Maung*) in Latin script, `Mg Mg` for Maung Maung, and it is the element symbol
    // for magnesium besides. Neither ever follows a digit, and step 11 requires one immediately before the
    // abbreviation, so the key claims the dose and declines the name. Both nouns are attested on
    // my.wikipedia in exactly the measurement slot (tools/corpus/attest/my.jsonc): မီလီဂရမ် 57 tokens / 14
    // articles (`ဗီတာမင် စီ ၅၀ မီလီဂရမ်ခန့်ပါဝင်သည်` — "contains about 50 mg of vitamin C"), မိုက်ခရိုဂရမ်
    // 7 / 3 (`ဗီတာမင်ကေ (Vitamin K) ၂.၂ မိုက်ခရိုဂရမ်`), ကီလိုဂရမ် 31 / 13 with a definitional article.
    // `µg` (U+00B5) as well as ASCII `ug`: the corpus writes the ASCII spelling, the sign is the standard one.
    [/mg/giu, "မီလီဂရမ်"],
    [/[uµμ]g/giu, "မိုက်ခရိုဂရမ်"],
    [/\bm\b/giu, "မီတာ"],
    [/\bg\b/giu, "ဂရမ်"],
];

/**
 * A RATE — `၃၀ mg/kg`, a mass-per-mass drug dose.
 *
 * ⚠ **THE DENOMINATOR PHRASE COMES FIRST IN BURMESE, AND THE ATTESTATION IS WHAT SETTLES IT** rather than
 * the English word order. `တစ်…လျှင်` ("per one …") is a PREPOSED adverbial in every corpus instance read
 * (tools/corpus/attest/my.jsonc): `ကတိုးသည် တစ်ကီလိုဂရမ်လျှင် ဒေါ်လာ ၄၅၀၀၀ တန်လေသည်` ("civet is worth
 * 45 000 dollars per kilogram"), `သစ်မွှေးတစ်ကီလိုဂရမ်လျှင် အမေရိကန်ဒေါ်လာ ၈၀၀မှ ၁၀,၀၀၀ကျော်`,
 * `မြန်မာနိုင်ငံ၌ တစ်နာရီလျှင် ၇၅ မိုင်တိုက်ခတ်သော လေမုန်တိုင်း` ("winds of 75 miles per hour"), and
 * `စက်နာရီက တစ်ရက်လျှင် ၂၄ နာရီ ရှိသည်` ("a clock has 24 hours per day"). Four denominators — kilogram,
 * hour, day — all in the rate slot, all with the quantity FOLLOWING. Emitting `၃၀ မီလီဂရမ် တစ်ကီလိုဂရမ်လျှင်`
 * would be the English order in Burmese words, and nothing in the corpus writes it.
 *
 * ⚠ IT RUNS EARLY, BEFORE THE DECIMAL AND RANGE RULES, because it MOVES the numeral: `0.75 mg/kg` and
 * `10-15 mg/kg` must still be one intact token when the rule captures them, and once relocated they are read
 * by the very same later rules in their new position (`၀ ဒသမ ၇ ၅`, `၁၀ မှ ၁၅ အထိ`). Written to run after the
 * unit rules instead, the decimal rule has already split the operand and the rate has nothing to carry.
 */
const RATE_DENOMINATORS: [RegExp, string][] = [
    [/kg/iu, "ကီလိုဂရမ်"],
    [/h(?:rs?)?/iu, "နာရီ"],
    [/d(?:ay)?/iu, "ရက်"],
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

    // 2b) RATES — `၃၀ mg/kg`, the drug-dose shape. ⚠ HERE, before the clock, the decimal and the range rules,
    //     because this rule MOVES the numeral and every one of those three needs it intact to match; see
    //     `RATE_DENOMINATORS` for the word order and its attestation. After de-grouping, though, so a grouped
    //     figure arrives whole.
    for (const [nre, nword] of UNITS)
        for (const [dre, dword] of RATE_DENOMINATORS)
            t = t.replace(
                new RegExp(
                    `(${d()}+(?:[.,]${d()}+)?(?:\\s*[-‐-―−]\\s*${d()}+(?:[.,]${d()}+)?)?)`
                        + `\\s*(?:${nre.source})\\s*/\\s*(?:${dre.source})(?![\\p{L}${D}])`,
                    "giu",
                ),
                `တစ်${dword}လျှင် $1 ${nword}`,
            );

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
    //
    //    ⚠ AND A MANTISSA IS NOT A SPAN EITHER, WHICH IS HOW THIS RULE WAS COSTING A UNIT ITS READING. The
    //    proton-mass line writes `1.67262192369(51)×10 −27 kg`; the exponent's sign is U+2212 and U+2212 is
    //    in `DASH`, so the rule read "10 to 27" — and worse, the `အထိ` it inserted then stood BETWEEN the
    //    number and `kg`, so step 11's digit-then-unit adjacency failed and a declared unit leaked into the
    //    IPA as raw ASCII. A `×` (or an ASCII `x`, which step 12 treats as the same sign) before the left
    //    operand is the discriminator: scientific notation is the only thing in this corpus that writes one.
    //    ⚠ The negative exponent itself is still SILENT, and deliberately — negative result 1 in the header
    //    holds, Burmese writes a real negative as the word အနုတ်. What this guard buys is the kilogram.
    const DASH = "[-‐-―−]";
    t = t.replace(
        new RegExp(
            // ⚠ `(?<![${D}])` IS PART OF THE SAME FIX AND NOT A TIDY-UP. Without it the guard slides: rejected
            // at the `1` of `×10`, the engine simply retries one character along and matches `0 −27`, so the
            // range is read anyway and the only visible difference is where the `မှ` lands. A lookbehind that
            // can be stepped past is not a guard. Anchoring the left operand to the START of its digit run is
            // also right on its own terms — half a numeral was never the intended match.
            `(?<!${DASH}\\s*)(?<![${D}])(?<![×xX]\\s{0,2})`
                + `(${d()}+)\\s*${DASH}\\s*(${d()}+)(?!${d()})(?!\\s*(?:${DASH}|အထိ|ထိ))`,
            "gu",
        ),
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
