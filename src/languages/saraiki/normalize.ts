/**
 * Saraiki (skr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/skr.jsonc` — skr.wikipedia dump, 120,763 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `digit-run` 39,600 · `year` 39,503 · `ranges` 4,630 ·
 * `decimals` 1,401 · `grouped` 875 · `signs` 556 · `clock` 387 · `signed-number` 126 · `percent` 86 ·
 * `ampersand` 87 · `arithmetic` 69 · `currency` 56 · `degrees` 50 · `rate` 31 · `era-marker` 7 ·
 * **`units` 4**.
 *
 * ⚠ THAT LAST NUMBER IS THE FIRST FINDING. Aragonese, treated one round earlier, has `units` 12,366 in
 * 255,887 segments; Saraiki has FOUR in 120,763, because this corpus writes its units out as words —
 * `ملی میٹر`, `کلومیٹر`, `مربع کلومیٹر`, `فٹ`, `میل`, `کلوگرام`, `فی گھنٹہ`. No unit table is declared
 * here, and the empty cell is the argument rather than an oversight.
 *
 * ⚠ THE SEAM ALREADY EXISTED AND WAS ALREADY LABELLED (trap 16). `punjabi.ts` builds this language too and
 * gates its own normalizer off for it, with the reason written down: that pass emits PUNJABI words. And
 * `foldNativeDigits` runs BEFORE the normalizer in the same factory, so all three of this corpus's digit
 * sets are already ASCII by the time these patterns see them — every rule below is written against `\d`.
 *
 * ⚠ THREE DIGIT SETS, AND THE ARABIC COMMA DOES TWO JOBS. The artifact's own header records that an
 * ASCII-only selector would miss 2,257 of 39,600 digit-runs; reading them shows two alternative sets, not
 * one — Extended Arabic-Indic U+06F0–F9 (`۴/۱۵۰`, `۵.۵فٹ`, `۳۳۸ سیکٹر`) and Arabic-Indic U+0660–69
 * (`١٠ اپریل ١٩٣٢`, `٢٥ دسمبر ١٩٩١ء`, `٤٢ فیصد`). ⚠ And `،` U+060C BOTH GROUPS AND SEPARATES:
 *
 *     GROUPS      `714،000 اضافہ` · `12،000 بارہ ہزار کلوگرام`  ← the second GLOSSES ITSELF, "twelve thousand"
 *     SEPARATES   `(جنوری 4، 1643ء)` · `10، 12، 14، 2000، 2006` · `1954 ، 1925 تے 1928`
 *
 * The codepoint settles nothing; the THREE-DIGIT TEST settles everything, and it is the same test the
 * ASCII comma needs (`476,291`, `3,384,569`, `20,000`, `27,873`). ⚠ THE ARABIC DECIMAL U+066B IS ABSENT —
 * zero instances, as is U+066C. The decimal is the ASCII DOT (`52.66 فیصد`, `44.7°`, `2.43`, `27.24 فٹ`).
 *
 * ⚠ THE COLON IS NEVER A CLOCK, IN FOUR DIFFERENT WAYS. Fifteen colon-between-digit segments and not one
 * is a time of day: six are a WIKIPEDIA TALK-PAGE SIGNATURE (`(talk) 15:30, 29 September 2020 (UTC)`), two
 * are MARATHON TIMES (`2:49:16`, `2:44:06`), one a SWIMMING TIME (`5:34.64`), two DRAWING SCALES
 * ("مناسب Scale ( مثلاً 1:100 یا 1:50 )") and one a UNIX TIMESTAMP (`02:48:05.4775807 UTC`). Faroese had
 * two of these senses, Aragonese three; this has four and zero clocks. ⚠ AND THE WORDS CONFIRM IT —
 * `وجے` ×59 on the wiki is the TAMIL ACTOR VIJAY and `بجے` ×29 never appears in this artifact at all.
 *
 * ⚠ THE SOURCING PASS PRODUCED FIVE FULA-SHAPED RESULTS IN ONE BATCH — words that score well and are wrong
 * for the slot: `منفی` ×36 is a LITERARY "negative" (منفی کردار, a villain in folk tales), `ضرب` ×45 is
 * `ضرب المثل` "proverb", `ہزار` ×41 is mostly the politician MIR HAZAR KHAN, `سیلسیس` ×19 is ANDERS
 * CELSIUS and a film title, and `وجے` is the actor above. ⚠ AND THE RETAINED CORPUS THEN OVERTURNED ONE OF
 * THEM: "سطح سمندر توں بلندی **منفی 28 میٹر (-92 فٹ)** ہے" writes the SAME measurement once with the word
 * and once with the sign — the slot attestation the wiki batch could not show. So `منفی` ships and
 * `سیلسیس` does not; the scale word here is `سینٹی گریڈ`, which the corpus writes beside the sign
 * (`44.7° سینٹی گریڈ`) and beside the degree word (`28 ڈگری سینٹی گریڈ`).
 *
 * ⚠ `اعشاریہ` IS THE DECIMAL POINT AND THE CHECK NEARLY FAILED. Five of its six wiki examples are the
 * DECIMAL SYSTEM (اعشاریہ اشارے, اعشاریہ نشان, اعشاریہ دے نمبراں دا نظام); the sixth is the slot, and it
 * glosses itself — "چین دی کل آبادی **ہک اعشاریہ ترئے ارب** یعنی ہک ارب تریہہ کروڑ", one point three
 * billion spelled out and then restated in crores.
 *
 * ⚠ `×` HAS THREE SENSES AND NO MAJORITY — scientific notation (`2.43 × 10⁻¹²`), a physics law
 * (`قوت = کمیت × تکون (F = ma)`) and CUBE DIMENSIONS (`9×9×9، 11×11×11 تے 17×17×17 مکعب`), with paper
 * dimensions written using an ASCII ⟨x⟩ on top (`A4; 297x210 mm`, `۳x۳ ہتھ`). Refused and registered; the
 * ⟨x⟩ instances are why `۳x۳` reads *tin eks tin* today. `=` likewise: two formulas, two angle
 * assignments and one LEXICAL GLOSS ("انواء = نوء دی جمع ہے").
 *
 * SOURCING — every word emitted is an skr.wikipedia TOKEN attestation whose examples were read; see
 * `tools/corpus/attest/skr.jsonc`.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { tr } from "../../core/provenance.ts";

/**
 * The shared SYMBOL tier. ⚠ THE PERCENT ARM IS THE WHOLE REASON THIS TIER IS DECLARED, and it is a trap-16
 * result: this corpus writes the percentage FOUR different ways and the tier already handles all four.
 *
 *     ASCII, postposed   `15%` · `61.1%` · `2.5%` · `3.8%` · `100%` · `92%` · `23 %`
 *     ARABIC ٪ U+066A    `18٪` · `3٪` · `٨٥٪`                    — `PCT` already includes U+066A
 *     ⚠ PREPOSED         `پاکستان دے کل رقبے دا %6دے قریب`        — `pctPreRe` already matches it
 *     ⚠ REDUNDANT        `وادی سندھ کی 90 % فیصد` · `2%تے 3%فیصد` — `PCT_AFTER` already declines it
 *
 * Hand-writing any of those would have duplicated machinery that was already in the shared file.
 * `فیصد` ×150, and the corpus uses it as a bare word constantly ("سرائیکی 40فیصد، پنجابی 18 فیصد").
 *
 * ⚠ AND `US$` IS DECLARED AHEAD OF `$` — trap 64, recurring one round after it was written, in a different
 * script. The tier declines a currency mark a letter runs into, and this corpus writes `≈US$200 ملین`,
 * `≈US$180`, `<US$20 ملین`, `<US$200 ملین`. Left to the bare `$` key they read as bare numbers.
 *
 * `ڈالر` ×53 · `روپے` ×127 · `یورو` ×22 · `پاؤنڈ` ×63 · `ملین` ×61 · `بلین` ×36 · `تے` ×541.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["فیصد"],
    currency: {
        "US$": ["ڈالر"], "$": ["ڈالر"], "€": ["یورو"], "£": ["پاؤنڈ"], "₨": ["روپے"],
    },
    // ⚠ NO `units` KEY. `units` is FOUR corpus-wide (see the header) — this language spells its measures
    // out, and a table here would be a rule with nothing to match plus a set of one-letter keys waiting to
    // claim something else (traps 28/46).
    ampersand: "تے",
    magnitudes: ["ملین", "بلین"],
});

/** Normalize one Saraiki input string. Pure text→text. Steps are ORDER-DEPENDENT.
 *
 *  ⚠ The input has ALREADY been through `foldNativeDigits` — see the header — so every pattern here is
 *  written against ASCII digits even though the corpus writes three sets. */
export function normalizeSaraiki(input: string): string {
    let s = input;

    // 0) ⚠ ZERO-WIDTH JOINERS BETWEEN A FIGURE AND ITS SIGN. `zero-width` is 115 corpus-wide, and one of
    //    them is load-bearing: "\u0645\u0633\u0644\u0645\u0627\u0646\u0627\u06ba \u062f\u06cc \u0668\u0665\u066a \u0627\u06a9\u062b\u0631\u06cc\u062a" writes U+200D and U+200C BETWEEN the digits and the
    //    percent sign, so the tier — which allows a space and nothing else there — never saw a percentage
    //    at all. ⚠ THE RULE IS NARROW ON PURPOSE: ZWNJ is meaningful Perso-Arabic orthography INSIDE a
    //    word, and only a joiner sitting between a DIGIT and a SIGN can be certain to carry no meaning.
    s = tr(s, /(?<=\d)[\u200c\u200d]+(?=[%\u066a\u00b0\u066b])/gu, "");  // ZWNJ, ZWJ

    // 1) THE SHARED SYMBOL TIER FIRST, exactly as the Punjabi sibling does it and for the same reason: the
    //    tier's own numeral pattern reads `2,500` and `2.3` as ONE token, and steps 2 and 5 below split
    //    precisely those, so running them first would strand every sign on half a numeral.
    s = SYMBOLS(s);

    // 2) DE-GROUPING, ⚠ ON BOTH COMMAS AND BY THE SAME TEST. The ASCII comma and the Arabic `،` U+060C are
    //    each doing two jobs in this corpus (see the header), so the codepoint decides nothing and EXACTLY
    //    THREE DIGITS AFTER THE MARK decides everything.
    //    ⚠ THE WHOLE NUMBER IS MATCHED AT ONCE, not one join per pass (trap 63), and the trailing guard
    //    rejects a DIGIT and nothing else, or every clause-final figure is declined (trap 58).
    s = tr(s, /(?<!\d)(?<![\d][.,،])([1-9]\d{0,2})((?:[,،]\s?\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/[,،\s]/gu, ""));

    // 3) DEGREES. `ڈگری` ×55 is the corpus's own word in exactly this slot ("28 ڈگری سینٹی گریڈ توں 42
    //    ڈگری سینٹی گریڈ", "طول البلد … جیہڑا 0 ڈگری سݙیندے"), and `سینٹی گریڈ` ×38/×36 is the scale —
    //    ⚠ NOT `سیلسیس`, which scores ×19 and is ANDERS CELSIUS plus the film title "100 ڈگری سیلسیس".
    //    ⚠ AND THE BARE BRANCH IS DELIBERATELY LEFT TO RUN INTO A FOLLOWING WORD: `44.7° سینٹی گریڈ`
    //    becomes "44.7 ڈگری سینٹی گریڈ", which is what the corpus writes elsewhere, and `60° درجہ دار قوس`
    //    becomes "60 ڈگری درجہ دار قوس" — *a sixty-degree graded arc*, which is what it means.
    s = tr(s, /(\d)\s?°\s?C(?![\p{L}\p{M}])/gui, "$1 ڈگری سینٹی گریڈ");
    s = tr(s, /(\d)\s?°\s?F(?![\p{L}\p{M}])/gui, "$1 ڈگری فارن ہائیٹ");
    s = tr(s, /(\d)\s?°/gu, "$1 ڈگری ");

    // 4) THE MINUS SIGN, before the range rule spends the hyphen. ⚠ THE WORD IS SOURCED FROM THE RETAINED
    //    CORPUS RATHER THAN THE WIKI BATCH, which is the round's sharpest sourcing result: `منفی` ×36 on
    //    the wiki is a LITERARY "negative" in every example (منفی کردار, a villain in folk tales), and the
    //    slot attestation is this artifact's own self-gloss — "سطح سمندر توں بلندی منفی 28 میٹر (-92 فٹ)",
    //    the same elevation written once with the word and once with the sign.
    //    ⚠ THE `(?<!\d)` GUARD IS LOAD-BEARING: this corpus writes NEGATIVE EXPONENTS inline as
    //    `10−50 cm4 s photon−1`, and a rule reaching those would read a cross-section as a subtraction.
    s = tr(s, /(^|(?<!\d)[\s(])[-−–]\s?(\d)/gu, "$1منفی $2");

    // 5) RANGES. The dash was dropped and the endpoints fused — `1682–1744`, `1704–1749`, `1850–1950`,
    //    `39-45`, `1961-62`, `1950ء–1986ء`. ⚠ THE YEAR MARKER MAY SIT BETWEEN THE FIGURE AND THE DASH,
    //    which is a shape no Latin-script round produced: `ء` is orthography, not a digit, so a rule
    //    anchored on `\d` alone misses every dated span in the language.
    //    ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE, and ⚠ nothing may be required after the
    //    second number (trap 58); an adjacent slash means a citation (`213-276/828-889`), not a span.
    s = tr(s, /([\dء])\s?[–—]\s?(?=\d)/gu, "$1, ");
    s = tr(s, /(?<![\d.,\-\/])(\d+)\s?-\s?(\d+)(?![\d\/])(?!\s?-\s?\d)/gu, "$1, $2");

    // 6) DECIMALS, LAST — because this step SPLITS the numeral, and every rule above wants it whole.
    //    ⚠ `اعشاریہ` ×18 and five of its six wiki examples are the decimal SYSTEM rather than the point;
    //    the sixth is the slot and glosses itself ("ہک اعشاریہ ترئے ارب یعنی ہک ارب تریہہ کروڑ"). The
    //    fractional part is read DIGIT BY DIGIT, which is what a reader does and what keeps `52.66` from
    //    becoming *fifty-two point sixty-six*.
    s = tr(s, /(\d)\.(\d+)(?!\d)/gu,
        (_m, head: string, frac: string) => `${head} اعشاریہ ${[...frac].join(" ")}`);

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
