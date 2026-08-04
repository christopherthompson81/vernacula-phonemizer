/**
 * Burmese (my) TEXT NORMALIZATION (#562) — the pre-tokenizer pass that rewrites everything the Burmese
 * g2p cannot already read into Burmese-script words the existing pipeline speaks. Pure text→text, no IPA.
 * Runs inside burmese.ts's `text()`, before the tokenizer.
 *
 * ★ THE FIRST LANGUAGE NORMALIZED WITHOUT A FLEURS CORPUS (#585). Burmese has no FLEURS transcripts, so
 * the evidence here is a MINED corpus: 454,821 paragraphs extracted from the my.wikipedia dump, from which
 * tools/normalization/mine.ts selected a hard-set covering all 24 pattern cells
 * (tools/corpus/mined/my.jsonc). Every count below is measured over those paragraphs, and — the part that
 * matters — every WORD emitted by a rule below is attested IN THAT SAME CORPUS rather than looked up
 * abstractly. The corpus is both the test set and the dictionary, which is what makes this route viable
 * for the ~89 other languages with no FLEURS data.
 *
 * MEASURED OVER THE MINED CORPUS (454,821 paragraphs):
 *   decimals   N.N        9106      comma-grouped  N,NNN     4957
 *   percent    N%         4730      fractions      N/N       3093
 *   clock      HH:MM       975      degrees        N°         418
 *   currency   $N          222      Latin units    N km        45
 *
 * WORD ORDER IS THE THING TO GET RIGHT, and the corpus settles each case:
 *   · PERCENT FOLLOWS the number — `၉၈ ရာခိုင်နှုန်း`. Postposed 2426 : preposed 97.
 *   · A FRACTION IS DENOMINATOR-FIRST — `၃/၄` is spoken `၄ ပုံ ၃ ပုံ` ("four parts, three parts"),
 *     213 instances of the `N ပုံ N ပုံ` shape. Emitting it numerator-first would be backwards.
 *   · A NEGATIVE IS A WORD, NOT A SIGN — `အနုတ် ၉၃ ဒီဂရီ`, the word BEFORE the number.
 *
 * ⚠ TWO NEGATIVE RESULTS, recorded so nobody adds these rules later:
 *
 *   1. NO BARE-SIGN NEGATIVE RULE. The miner's `negative` cell flagged 1934 hits and the DROP scan
 *      reported `minus ×10`, which looks like a missing rule. It is not. Reading the actual contexts: a
 *      hyphen before digits is a compound or a date (`ဒီ-၂၀`, `-၂၈ နိုဝင်ဘာ`), and U+2212 — 3259
 *      occurrences, MORE than the hyphen — is overwhelmingly a list bullet (`၎င်းတို့မှာ −`). Burmese
 *      writes a real negative as the word အနုတ်. So the sign is never a minus here, and a rule keying on
 *      it would corrupt dates and bullets. The DROP:minus finding is the drop test conflating the
 *      negative and range senses of one character, which is the same ambiguity that earned `negative` its
 *      own cell in the miner.
 *
 *   2. `°` IS NOT ACCOMPANIED BY ITS WORD. A first sample suggested `၅၉° ဒီဂရီ` — the sign plus the word
 *      — which would make a rule that expands `°` double it. Counting properly: 735 `°` in the corpus, of
 *      which just 3 are followed by ဒီဂရီ and 168 are `°C`/`°F`. The sign stands alone and must be read.
 *      Sampling four instances and generalising would have been wrong.
 *
 * ORDERING CONSTRAINTS, each of which is a bug that happened:
 *   · DE-GROUPING IS FIRST. `,` is in burmese.jsonc's clausePunctuation, so `၅၀,၀၀၀` reached the output
 *     as "fifty , thousand" — a comma PAUSE splitting one numeral into two.
 *   · THE CLOCK BEFORE THE DECIMAL, and both before anything that reads a bare number.
 *   · DEGREES BEFORE the Latin-fallback path, or the C of `၃၅°C` is read as the English letter name
 *     [sˈiː] — which is exactly what it did.
 */

/** Burmese digits ၀-၉ plus ASCII; the corpus mixes both, and every rule must accept either. */
const D = "0-9၀-၉";
/** One digit, optionally quantified. `d()` is a bare class so the caller can append its own quantifier. */
const d = (n?: number): string => `[${D}]${n === undefined ? "" : `{${n}}`}`;

/**
 * Unit abbreviations → their Burmese words, all attested in the corpus with a preceding number:
 * ကီလိုမီတာ 1867, မီတာ 1861, စင်တီမီတာ 330, ဂရမ် 137, ကီလိုဂရမ် 131. Longest first, so `km` is not
 * matched as `m` with a stray k left behind.
 */
const UNITS: [RegExp, string][] = [
    [/km/giu, "ကီလိုမီတာ"],
    [/kg/giu, "ကီလိုဂရမ်"],
    [/cm/giu, "စင်တီမီတာ"],
    [/mm/giu, "မီလီမီတာ"],
    [/\bm\b/giu, "မီတာ"],
    [/\bg\b/giu, "ဂရမ်"],
];

/** Currency signs → the Burmese word, postposed like the percent word. ဒေါ်လာ 2791, ကျပ် 3290,
 *  ယူရို 378, ယန်း 4005 — all attested after a number in the corpus. */
const CURRENCY: Record<string, string> = {
    "$": "ဒေါ်လာ",
    "€": "ယူရို",
    "£": "ပေါင်",
    "¥": "ယန်း",
    "₹": "ရူပီး",
};

export function normalizeBurmese(input: string): string {
    let t = input;

    // 1) ZERO-WIDTH marks. 11,343 in the corpus — Burmese uses ZWSP as a line-break hint inside words, so
    //    it lands in the middle of a token and splits it for the segmenter. Removed outright.
    t = t.replace(/[​-‍⁠﻿]/gu, "");

    // 2) COMMA-GROUPED THOUSANDS (4957), FIRST — before the comma can be read as a clause pause and cut
    //    the numeral in half. Applied repeatedly for numbers with several groups (၁,၂၃၄,၅၆၇).
    let prev: string;
    do {
        prev = t;
        t = t.replace(new RegExp(`(${d()})[,٬](${d(3)})(?!${d()})`, "gu"), "$1$2");
    } while (t !== prev);

    // 3) CLOCK (975), before any rule that reads a bare number and before the decimal rule — Burmese
    //    writes the clock with a colon, and the colon was reaching the output as nothing at all, so
    //    `၁၄:၃၀` read as two unrelated numerals. Attested shape: `N နာရီ M မိနစ်` (နာရီ 2457, မိနစ် 1216).
    t = t.replace(new RegExp(`(${d()}{1,2}):(${d(2)})(?!${d()})`, "gu"), "$1 နာရီ $2 မိနစ်");

    // 4) DECIMALS (9106), after de-grouping so a grouped numeral keeps its tail, and after the clock so a
    //    time is never read as a decimal. The point was reaching clausePunctuation and becoming a SENTENCE
    //    BREAK, so `၈၆.၄` read as "၈၆" then a full stop then "၄". The fractional part is spoken
    //    DIGIT BY DIGIT, so each digit is spaced out for the tokenizer to take one at a time.
    t = t.replace(new RegExp(`(${d()}+)\\.(${d()}+)`, "gu"), (_m, whole: string, frac: string) =>
        `${whole} ဒသမ ${[...frac].join(" ")}`);

    // 5) PERCENT (4730). Postposed — see the header.
    t = t.replace(new RegExp(`(${d()}+)\\s*[%％]`, "gu"), "$1 ရာခိုင်နှုန်း");

    // 6) DEGREES (418), BEFORE the Latin fallback can read the scale letter as an English letter name.
    //    Case-insensitive on the letter; the bare sign is read too, because the corpus shows it standing
    //    alone (see negative result 2 in the header). ℃/℉ are single characters and never decompose.
    t = t.replace(/℃/gu, "°C").replace(/℉/gu, "°F");
    t = t.replace(new RegExp(`(${d()})\\s*°\\s*C(?![\\p{L}])`, "giu"), "$1 ဒီဂရီ စင်တီဂရိတ်");
    t = t.replace(new RegExp(`(${d()})\\s*°\\s*F(?![\\p{L}])`, "giu"), "$1 ဒီဂရီ ဖာရင်ဟိုက်");
    t = t.replace(new RegExp(`(${d()})\\s*°`, "gu"), "$1 ဒီဂရီ");

    // 7) CURRENCY (222 for `$` alone). The sign PRECEDES the amount in writing and the word FOLLOWS it in
    //    speech, the same inversion English has.
    //     The sign must be escaped SELECTIVELY: under the `u` flag an identity escape is only legal on a
    //     syntax character, so a blanket `\\${sign}` produces the invalid pattern `\€` and the engine
    //     throws on every input — including plain words, since the rule is built before it is used.
    for (const [sign, word] of Object.entries(CURRENCY))
        t = t.replace(new RegExp(`${sign.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*(${d()}+)`, "gu"), `$1 ${word}`);

    // 8) FRACTIONS (3093) — DENOMINATOR FIRST, which is the whole point (see the header). Guarded on both
    //    sides being bare digit runs so a date written with slashes is not caught.
    t = t.replace(new RegExp(`(?<!${d()})(${d()}+)\\s*/\\s*(${d()}+)(?!${d()})`, "gu"), "$2 ပုံ $1 ပုံ");

    // 9) RANGES. A dash between two numerals is spoken `မှ … အထိ` (609 instances of that shape). This runs
    //    AFTER the clock and the decimal so it cannot claim their separators, and it deliberately does NOT
    //    treat a leading dash as a negative — negative result 1 in the header.
    //
    //    ⚠ THE CHAIN GUARD IS LOAD-BEARING. A numeric date is written D-M-Y with the same character —
    //    `၂၀-၁-၂၀၂၄`, 945 in the corpus against 6033 genuine two-number pairs — so without the guard the
    //    rule read "၂၀ မှ ၁ အထိ", i.e. "the 20th to the 1st", inside a date that already carried its own
    //    မှ … ထိ. Caught by the representative sample, not by the hard-set: the hard-set proves a rule
    //    fires, and only ordinary text shows what it breaks. This was the ONE regression in 40 sample
    //    utterances and it would have shipped without that tier.
    //    The guard is a dash on EITHER SIDE of the pair: in `၂၀-၁-၂၀၂၄` the middle `၁` is preceded by a
    //    dash and the last group is followed by none, so requiring both neighbours to be dash-free rejects
    //    every link of a chain while accepting a lone pair. The trailing `အထိ` check stops the rule
    //    doubling a range the text already spells out in words. The `(?!digit)` after the second group
    //    is not redundant: without it the engine BACKTRACKS to a shorter second number to satisfy the
    //    trailing guard, and `၁၂ - ၁၃ အထိ` came out as `၁၂ မှ ၁ အထိ၃ အထိ` — a digit spliced in half.
    const DASH = "[-‐-―−]";
    t = t.replace(
        new RegExp(`(?<!${DASH}\\s*)(${d()}+)\\s*${DASH}\\s*(${d()}+)(?!${d()})(?!\\s*(?:${DASH}|အထိ|ထိ))`, "gu"),
        "$1 မှ $2 အထိ",
    );

    // 10) SQUARED / CUBED UNITS, BEFORE the plain unit rule in step 11 — otherwise `km²` has its `km`
    //     consumed first and the bare exponent is left stranded with nothing to attach to. The exponent
    //     was being dropped outright: `၃၈၅၀ km²` read as plain "kilometre", losing the area entirely.
    //     ⚠ THE MODIFIER PRECEDES THE UNIT in Burmese — စတုရန်းကီလိုမီတာ, 1859 instances against 3 the
    //     other way round. Emitting it postposed like the percent word would have been backwards, and no
    //     probe would have shown it; only the corpus count settles the order. (စတုရန်း 2138, ကုဗ 156.)
    const EXP: [string, string][] = [["²", "စတုရန်း"], ["³", "ကုဗ"]];
    for (const [sup, modifier] of EXP)
        for (const [re, word] of UNITS)
            t = t.replace(new RegExp(`(${d()})\\s*(?:${re.source})\\s*${sup}`, "gu"), `$1 ${modifier}${word}`);

    // 11) LATIN UNIT ABBREVIATIONS after a number (45). Only when a digit precedes, so ordinary embedded
    //     English is left to the Latin fallback.
    for (const [re, word] of UNITS)
        t = t.replace(new RegExp(`(${d()})\\s*(?:${re.source})(?![\\p{L}])`, "gu"), `$1 ${word}`);

    // 12) RELATIONAL AND ARITHMETIC SIGNS. `=` was left unhandled at first on the grounds that the
    //     corpus's instances are GLOSSES (`gêeo = Earth`, `မိုင်း = ကြီးမား`) where a reader does not say
    //     "equals". That reasoning was wrong: the sign was being DROPPED, so the two sides ran together
    //     with no separation at all, and a slightly formal reading is strictly better than an inaudible
    //     one. Attested: ညီမျှ 1110, ထက်ကြီး 103, ထက်ငယ် 43.
    //
    //     `+` BETWEEN TWO WORDS IS LEFT ALONE, and that is not the same call. The corpus's remaining two
    //     instances are compound joiners — `အချိန်+ရပ်ဝန်းထု` (spacetime), `ရပ်ဝန်း+အချိန်` — where the
    //     sign marks a compound rather than an operation, and the words are simply spoken adjacent. So
    //     the plus rule below requires DIGITS on both sides — which is where arithmetic normally is, so
    //     the restriction costs nothing. The distinction from `=` is real: a gloss sign separates a label
    //     from its expansion and needs to be audible, a compound joiner does not.
    const RELATIONAL: [RegExp, string][] = [
        [/[=≈]/gu, " ညီမျှ "],
        [/</gu, " ထက်ငယ် "],
        [/>/gu, " ထက်ကြီး "],
        [/×/gu, " မြှောက် "],
        [/÷/gu, " စား "],
    ];
    t = t.replace(new RegExp(`(${d()})\\s*\\+\\s*(${d()})`, "gu"), "$1 အပေါင်း $2");
    //     ⚠ AND A `+` WITH A DIGIT ONLY AFTER IT, which the both-sides guard above was too tight to reach.
    //     The comment above is right that a LETTER-flanked `+` is a compound joiner and stays silent, but it
    //     drew the line at "digits on both sides", and that also excluded the two instances where the sign is
    //     genuinely a word:
    //       `အာဆီယံ +၃`  — ASEAN **Plus Three**, where the plus is part of the organisation's NAME
    //       `(+⅔)`        — a positivity marker on a fraction (now `(+2/3)` after the vulgar-fraction fold)
    //     A digit after the sign is the discriminator, and it separates these cleanly from the compounds,
    //     every one of which has a letter on both sides (`အချိန်+ရပ်ဝန်းထု`, `ရပ်ဝန်း+အချိန်`).
    //     Still NOT matched, and deliberately: the ETYMOLOGY plus between parenthesised glosses
    //     (`(gêeo = Earth) + (graphein = to write)`), where what follows is a bracket rather than a digit.
    //     ⚠ That one has its own attested reading and it is NOT အပေါင်း — the artifact glosses the symbol in
    //     its own text, `နိ+ ဝါန =နိ နှင့် ဝါန` ("ni+vāna = ni AND vāna"), so an etymological `+` is နှင့်.
    //     Left unimplemented rather than guessed at: three instances, all inside a bracket-gloss shape narrow
    //     enough that a rule for it would be fitted to this article rather than to the language.
    t = t.replace(new RegExp(`(?<![${D}])\\+\\s*(?=${d()})`, "gu"), "အပေါင်း ");
    for (const [re, word] of RELATIONAL) t = t.replace(re, word);
    t = t.replace(/[ \t]{2,}/gu, " ");

    // 13) AMPERSAND → နှင့် ("and"), 2403 in the corpus. It was dropped outright, so `A&B` read as two
    //     unrelated letters. The word itself is the ordinary conjunction (နှင့် 134,052).
    t = t.replace(/\s*[&＆]\s*/gu, " နှင့် ");

    // 11) DOTTED INITIALISMS (`U.S.`, 1511 in the corpus). The periods are abbreviation dots, not sentence
    //     ends, and each was becoming a clause pause — `U.S.` read as "yu . es .", two spurious breaks in
    //     the middle of a phrase. The letters themselves are left to the Latin fallback; only the dots are
    //     consumed.
    t = t.replace(/(?<![\p{L}\p{M}])(?:\p{L}\.){2,}/gu, (run) => run.replace(/\./gu, ""));

    return t;
}
