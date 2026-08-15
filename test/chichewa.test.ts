import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/chichewa/numbers.ts";

// Chichewa / Chinyanja (nya) cardinal numbers — Bantu (N31), Latin orthography, composed as TEXT and then run
// through the greedy g2p (so ⟨l/r⟩→ɽ, ⟨nd⟩→ⁿd, ⟨ch⟩→t͡ʃ, ⟨kh⟩→kʰ all show up in the expected IPA).
//
// Sources: Omniglot "Numbers in Chichewa" for the tens (60 = makumi asanu ndi limodzi); Wiktionary for the
// magnitude nouns and their classes (zana cl.5 / mazana cl.6 = hundred; chikwi cl.7 / zikwi cl.8 = thousand).
//
// ⚠ THE TENS MULTIPLIER AND A TRAILING UNIT TAKE DIFFERENT CONCORDS, and collapsing them to one series is
// SILENT: the multiplier needs the CLASS-6 concord of makumi (limodzi, awiri, atatu, anayi) while a trailing
// unit keeps its class-8/10 citation form (chimodzi, ziwiri, …). Use one series for BOTH slots and each of
// 60/70/80/90 composes to exactly the same string as 51/52/53/54 — nothing is dropped or malformed, two
// different numbers simply read the same. The loop below pins those four pairs apart.
// See src/languages/chichewa/numbers.ts.
describe("Chichewa numbers", () => {
    test("units — 6–9 are '5 and N' (class-8/10 citation form)", () => {
        expect(numberToWords(1)).toBe("chimodzi");
        expect(numberToWords(6)).toBe("zisanu ndi chimodzi");
        expect(numberToWords(9)).toBe("zisanu ndi zinayi");
        expect(phonemize("1", "nya")).toBe("t͡ʃimod͡zi");
        expect(phonemize("6", "nya")).toBe("zisanu ⁿdi t͡ʃimod͡zi");
    });

    test("ten and the 21–99 compounds", () => {
        expect(numberToWords(10)).toBe("khumi");
        expect(numberToWords(11)).toBe("khumi ndi chimodzi");
        expect(numberToWords(21)).toBe("makumi awiri ndi chimodzi");
        expect(numberToWords(42)).toBe("makumi anayi ndi ziwiri");
        expect(phonemize("42", "nya")).toBe("makumi anaji ⁿdi ziwiɽi");
    });

    test("the tens above 50 are 'five tens and N tens' — and do NOT collide with 51–54", () => {
        expect(numberToWords(50)).toBe("makumi asanu");
        expect(numberToWords(60)).toBe("makumi asanu ndi limodzi"); // class-6 limodzi = ANOTHER ten
        expect(numberToWords(70)).toBe("makumi asanu ndi awiri");
        expect(numberToWords(80)).toBe("makumi asanu ndi atatu");
        expect(numberToWords(90)).toBe("makumi asanu ndi anayi");
        // the class-8/10 unit series is what keeps 51–54 distinct from 60–90
        expect(numberToWords(51)).toBe("makumi asanu ndi chimodzi");
        expect(numberToWords(52)).toBe("makumi asanu ndi ziwiri");
        expect(numberToWords(61)).toBe("makumi asanu ndi limodzi ndi chimodzi");
        for (const [tens, unit] of [
            [60, 51],
            [70, 52],
            [80, 53],
            [90, 54],
        ] as const)
            expect(numberToWords(tens)).not.toBe(numberToWords(unit));
    });

    test("hundreds — zana (cl.5) vs mazana (cl.6) + class-6 multiplier", () => {
        expect(numberToWords(100)).toBe("zana");
        expect(numberToWords(200)).toBe("mazana awiri");
        expect(numberToWords(555)).toBe("mazana asanu ndi makumi asanu ndi zisanu");
        expect(phonemize("200", "nya")).toBe("mazana awiɽi");
    });

    test("thousands — chikwi (cl.7) vs zikwi (cl.8), whose multiplier IS the zi- series", () => {
        expect(numberToWords(1000)).toBe("chikwi");
        expect(numberToWords(2000)).toBe("zikwi ziwiri");
        expect(numberToWords(12345)).toBe("zikwi khumi ndi ziwiri ndi mazana atatu ndi makumi anayi ndi zisanu");
        expect(phonemize("1000", "nya")).toBe("t͡ʃikwi");
    });

    // ⚠ THIS GOLDEN CHANGED, and the change is the point. It used to pin 1000000 → "chimodzi ziro ×6" under the
    // comment "Chichewa has no well-attested native million". That was true of a NATIVE word and false of the
    // language: ny.wikipedia writes miliyoni 31× / 6 articles and biliyoni 13× / 6, and Malawi24's Chichewa desk
    // writes both off-wiki. The old expectation was a sourcing gap pinned as if it were a fact.
    test("millions and billions — the loan magnitudes, and the concord that reaches inside the multiplier", () => {
        expect(numberToWords(1000000)).toBe("miliyoni imodzi"); // class-9 singular concord, attested ×2
        expect(numberToWords(2000000)).toBe("mamiliyoni awiri"); // attested verbatim
        expect(numberToWords(9000000)).toBe("mamiliyoni asanu ndi anayi"); // attested verbatim — the a- series
        // …in BOTH slots of the compound. `units` here would give *mamiliyoni zisanu ndi zinayi. That is the whole
        // reason below100/below1000 take a series parameter, and it is measured, not inferred.
        expect(numberToWords(12000000)).toBe("mamiliyoni khumi ndi awiri");
        expect(numberToWords(1000000000)).toBe("biliyoni imodzi"); // COMPOSED: noun attested, concord attested
        expect(numberToWords(4700000000)).toBe("mabiliyoni anayi ndi mamiliyoni mazana asanu ndi awiri");
        expect(numberToWords(1600000)).toBe("miliyoni imodzi ndi zikwi mazana asanu ndi limodzi");
        expect(numberToWords(0)).toBe("ziro");
    });

    // The ceiling is a SOURCING boundary, not a numeric one: no trillion word is attested under any of six
    // spellings, so 10¹² and up keep the digit-by-digit fallback rather than get a coined magnitude.
    test("≥10¹² still falls back to digit-by-digit — no trillion word is attested", () => {
        expect(numberToWords(1e12)).toBe("chimodzi " + "ziro ".repeat(12).trim()); // 13 digits
        expect(numberToWords(999999999999)).toMatch(/^mabiliyoni /); // the last composed number
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// TEXT NORMALIZATION — src/languages/chichewa/normalize.ts + the shared symbol tier in chichewa.ts.
//
// ⚠ THESE PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (playbook trap 13). Chichewa's corpus writes
// only `°C` and only a SOUTH coordinate, only `mm` glued and only a comma-grouped thousand — so `°F`, the
// other compass points, the `:00` clock and the period/space groupings are pinned here precisely because
// nothing in the corpus would exercise them.
//
// ⚠ AND EACH GUARD IS PINNED FROM BOTH SIDES. A rule that fires is half the evidence; the assertions that
// something must NOT fire (the bible verse, the sports time, the football score, the locative `m'`, the ISBN)
// are the half that a corpus diff cannot supply, because those shapes read identically before and after.
import { normalizeChichewa } from "../src/languages/chichewa/normalize.ts";

describe("Chichewa normalization", () => {
    test("thousands de-grouping — comma, period AND space, all three attested", () => {
        // Chichewa Wikipedia writes all three, and the engine read the separators as PUNCTUATION:
        // `1,600,000` was *chimodzi , mazana asanu ndi limodzi , ziro* and `2.289.780` was three sentences.
        expect(normalizeChichewa("1,600,000")).toBe("1600000");
        expect(normalizeChichewa("14,591")).toBe("14591");
        expect(normalizeChichewa("2.289.780")).toBe("2289780");
        expect(normalizeChichewa("30 890 000")).toBe("30890000");
        // ⚠ A SINGLE THREE-DIGIT GROUP IS STILL A GROUPING, measured 33/33 with no counter-example: this
        // corpus contains no three-place decimal at all, and `35.592 km²` is an AREA in square kilometres.
        expect(normalizeChichewa("1.234")).toBe("1234");
        // ⚠ THE HEAD MUST START 1–9, or the space arm eats the corpus's own ISBN.
        expect(normalizeChichewa("ISBN 0 620 17697 0")).toBe("ISBN 0 620 17697 0");
    });

    test("decimals — both separators, and a 4-digit tail is a DATE and not a decimal", () => {
        expect(normalizeChichewa("66.7")).toBe("66 7");   // the fractional digits, one at a time
        expect(normalizeChichewa("104.0")).toBe("104 0");
        expect(normalizeChichewa("12,5")).toBe("12 5");   // comma decimals occur too (`9,5 trillion`)
        // No separator WORD is emitted: none is attested in any source, and espeak ships no Chichewa.
        // A date comma has a four-digit tail and is claimed by neither the decimal nor the grouping arm.
        expect(normalizeChichewa("Novembala 26,2008")).toBe("Novembala 26,2008");
    });

    test("the clock is identified by its MARKER, not by its shape", () => {
        // 12 true clocks in the corpus all carry a day-part word, an a.m./p.m. marker or a timezone.
        expect(normalizeChichewa("1:30 mmawa")).toBe("1 koloko ndi mphindi 30 mmawa"); // day-part RE-EMITTED
        expect(normalizeChichewa("6:23 p.m.")).toBe("6 koloko ndi mphindi 23 masana");
        expect(normalizeChichewa("11:30 AM.")).toBe("11 koloko ndi mphindi 30 m'mawa");
        expect(normalizeChichewa("18:30 BST")).toBe("18 koloko ndi mphindi 30 BST");
        // `:00` emits the hour ALONE — the manifest's zero word is *ziro*, and "21 koloko ziro" is nothing.
        expect(normalizeChichewa("21:00 UTC")).toBe("21 koloko UTC");
        // ⚠ AND THE FIVE THAT MUST NOT FIRE. A two-digit minute field alone would claim every one of them:
        // four are BIBLE VERSES and one is a race time, and not one carries a marker.
        expect(normalizeChichewa("Machitidwe 5:37")).toBe("Machitidwe 5:37");
        expect(normalizeChichewa("Marko 14:2")).toBe("Marko 14:2");
        expect(normalizeChichewa("mphindi 64:51")).toBe("mphindi 64:51");
        expect(normalizeChichewa("2:07:06")).toBe("2:07:06"); // a marathon split — a third field
    });

    test("degrees — the scale letter is CLAIMED but no scale name is invented", () => {
        // `°C` read as [k] and `°F` as [f] before, because Chichewa has no ⟨c⟩ grapheme at all.
        expect(normalizeChichewa("40 °C")).toBe("madigiri 40");
        expect(normalizeChichewa("30°F")).toBe("madigiri 30");  // ⚠ unattested here; pinned anyway
        expect(normalizeChichewa("25 ° S")).toBe("madigiri 25 kumwera");
        expect(normalizeChichewa("35°W")).toBe("madigiri 35 kumadzulo"); // the compass branch the corpus lacks
        expect(normalizeChichewa("30 °")).toBe("madigiri 30");
        // ⚠ SAID ONCE. The corpus writes the noun AFTER the signs, which a before-only guard would miss.
        expect(normalizeChichewa("10 ° C 20 ° C madigiri")).toBe("10 20 madigiri");
    });

    test("the bare `m` key — the word is sourced, the KEY needs an apostrophe guard", () => {
        // `mamita` is attested 16× in 11 articles; what keeps it out of the shared tier is the locative `m'`,
        // which the tier's `(?![\p{L}\p{M}])` guard lets through. 6 locatives against 3 genuine metres.
        expect(normalizeChichewa("107 m")).toBe("mamita 107");
        expect(normalizeChichewa("10,000 m")).toBe("mamita 10000");
        expect(normalizeChichewa("105 m'ma")).toBe("105 m'ma"); // the locative, untouched
    });

    test("ranges are ASCENDING ONLY, and a hyphen CHAIN is never a range", () => {
        expect(normalizeChichewa("2004-2009")).toBe("2004 mpaka 2009");
        expect(normalizeChichewa("3-1")).toBe("3-1");                    // a football score
        expect(normalizeChichewa("2014-15")).toBe("2014-15");            // a season
        expect(normalizeChichewa("1642 - 20 March")).toBe("1642 - 20 March"); // birth–death, second operand a DAY
        expect(normalizeChichewa("2-3-5")).toBe("2-3-5");                // a football formation
    });

    // ⚠ THE CLAUSE-FINAL BRANCH, PINNED SEPARATELY (trap 13). A sentence period is not part of a number, and
    // while the trailing guard rejected one, every range that ENDED A CLAUSE was declined and came back as
    // two juxtaposed cardinals. The `,` goes with it — Chichewa writes the decimal POINT (step 10) and step 4
    // has already de-grouped `30-40,000` — and the ASCENDING-ONLY test above, not the comma, is what keeps
    // the seasons and scores out.
    test("a range that ENDS A CLAUSE, or precedes a comma, is still a range", () => {
        expect(normalizeChichewa("19-23.")).toBe("19 mpaka 23.");
        expect(normalizeChichewa("2003-2004.")).toBe("2003 mpaka 2004.");
        expect(normalizeChichewa("my 1994-1996,")).toBe("my 1994 mpaka 1996,");
        expect(normalizeChichewa("2018-19,")).toBe("2018-19,"); // still a season, not a span
    });

    test("ampersand, HTML entities and dotted capital runs", () => {
        expect(normalizeChichewa("Europu & Asia")).toBe("Europu ndi Asia");
        expect(normalizeChichewa("T&T Clark")).toBe("T ndi T Clark");   // spaced, or the two fuse into one token
        expect(normalizeChichewa("a &nbsp; b")).toBe("a b");            // ⚠ the entity is NOT a conjunction
        expect(normalizeChichewa("&amp;")).toBe("ndi");
        expect(normalizeChichewa("U.S. Census")).toBe("US Census");     // interior dots were sentence breaks
        expect(normalizeChichewa("B.C.E")).toBe("BCE.");                // the trailing bare capital joins
        expect(normalizeChichewa("U.S.")).toBe("US.");                  // ⚠ a visible sentence end KEEPS its dot
    });

    test("the English ordinal suffix is stripped — Chichewa writes its own ordinals as words", () => {
        expect(normalizeChichewa("20th")).toBe("20");
        expect(normalizeChichewa("3RD")).toBe("3"); // case-insensitive (trap 7)
    });

    test("the pass never emits a doubled or edge space (the SLOT-GAP class)", () => {
        for (const s of ["a & b", "40 °C ndi 25 ° S", " 1,000 ", "U.S. Census"])
            expect(normalizeChichewa(s)).not.toMatch(/^\s|\s$|\s\s/u);
    });
});

// The shared symbol tier, exercised through the real phonemizer — these words are DATA in chichewa.ts and
// only the full path shows that the tier ran before normalize.ts and that both orders came out right.
describe("Chichewa symbol tier", () => {
    test("percent is POSTPOSED and currency is PREFIXED — the corpus decides each separately", () => {
        expect(phonemize("25 %", "nya")).toBe("makumi awiɽi ⁿdi zisanu peɽeseⁿti");
        expect(phonemize("$5", "nya")).toBe("maɗoɽa zisanu");
        // ⚠ THE MAGNITUDE STAYS WITH THE NUMBER because `magnitudes` is deliberately NOT declared: Chichewa
        // writes NOUN + NUMBER + MAGNITUDE (`matani 1.3 miliyoni`), 36 instances and no counter-example.
        expect(phonemize("$ 350 miliyoni", "nya")).toBe("maɗoɽa mazana atatu ⁿdi makumi asanu miɽijoni");
        // ⚠ THE EURO IS DELIBERATELY UNREAD — `yuro` is 1 hit in 1 machine-translated article. See
        // defects.ts ACCEPTED_SILENT. Pinned so that a guessed euro word cannot land unnoticed.
        expect(phonemize("€ 100 miliyoni", "nya")).toBe("zana miɽijoni");
    });

    test("units are PREFIXED, and the exponent word precedes its noun", () => {
        expect(phonemize("253 km", "nya")).toBe("makiɽomita mazana awiɽi ⁿdi makumi asanu ⁿdi zitatu");
        // ⚠ THE ⟨cm⟩ CATASTROPHE. Chichewa has no ⟨c⟩ grapheme, so `latinPhone` gave [k] and the abbreviation
        // for CENTImetre was pronounced as the abbreviation for KILOmetre — a factor of 100,000, and no gate
        // names it because a silent unit and a wrong unit look the same from outside.
        expect(phonemize("150cm", "nya")).toBe("seⁿtimita zana ⁿdi makumi asanu");
        expect(phonemize("1200 mm", "nya")).toBe("miɽimita t͡ʃikwi ⁿdi mazana awiɽi");
        expect(phonemize("50 mi", "nya")).toBe("maiɽosi makumi asanu");
        expect(phonemize("5 km²", "nya")).toBe("sikweja makiɽomita zisanu");
        // ⚠ NO CORPUS INSTANCE — `km/h` is ×0 here, so this is robustness rather than a measured repair, and
        // it is pinned because the whole construction (`kilomita pa ola`) comes from ONE wiki sentence.
        expect(phonemize("480 km/h", "nya")).toBe("makiɽomita mazana anaji ⁿdi makumi asanu ⁿdi atatu pa oɽa");
    });

    // ⚠ THE MASS/VOLUME/AREA HALF OF THE SAME DEFECT AS ⟨cm⟩ ABOVE — pronounceable letter runs, no ASCII
    // surviving, nothing vanishing. The artifact's own `25.5 g (0,60 mpaka 0,90 oz)` read *…zisanu ɡ*.
    // ⚠ ny.wikipedia has ZERO token hits for every one of these words, so the evidence is outside it: the
    // Chichewa Chalero New Testament, a Malawian agricultural-extension corpus, MBC news and a Malawian
    // newspaper. `gramu`'s only wiki hit is INSTAGRAM.
    test("units that MIS-READ rather than leak — ⟨kg⟩ ⟨g⟩ ⟨l⟩ ⟨ha⟩, sourced off the wiki", () => {
        expect(phonemize("10 kg", "nya")).toBe("makiɽoɡaɽamu kʰumi");   // "makilogalamu 32", John 19:39
        expect(phonemize("10 ha", "nya")).toBe("mahekitaɽa kʰumi");     // "pa mahekitala 240", MBC news
        expect(phonemize("10 l", "nya")).toBe("maɽita kʰumi");          // "malita 100", John 2:6
        expect(phonemize("10 L", "nya")).toBe("maɽita kʰumi");
        // ⚠ magalamu RESTS ON ONE SENTENCE ("Ikani magalamu 15 pa phando") and is pinned as such, so that
        // a later pass finds the thinness recorded rather than rediscovers it.
        expect(phonemize("10 g", "nya")).toBe("maɡaɽamu kʰumi");
        // ⚠ PREFIXED, like every other unit here — and that is the order all four sourced sentences use.
        expect(phonemize("240 ha", "nya")).toBe("mahekitaɽa mazana awiɽi ⁿdi makumi anaji");
    });
});
