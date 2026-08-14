import { describe, expect, test } from "vitest";

import { phonemizeWord, createFinnish } from "../src/languages/finnish/finnish.ts";
import { ordinal } from "../src/languages/finnish/normalize.ts";
import { phonemize } from "../src/index.ts";

// Finnish (fi) — Uralic (Finnic), Latin, one of the most PHONEMICALLY TRANSPARENT orthographies in the world. Greedy
// longest-match g2p over the grapheme table (8 vowels, ⟨a⟩=ɑ back; long-vowel + 18 diphthong digraphs) + three code
// rules: gemination (Cː), ⟨ng⟩→ŋː, ⟨nk⟩→ŋk. Referee: wikipron fin_latn_broad (human); the residual is
// loanwords and foreign names, which the transparent rules cannot be expected to reach.
describe("Finnish canonical IPA — greedy g2p (Standard Finnish)", () => {
    test("back ⟨a⟩=ɑ, vowel length, ⟨v⟩=ʋ", () => {
        expect(phonemizeWord("talo")).toBe("tɑlo"); // house — back a
        expect(phonemizeWord("maa")).toBe("mɑː"); // land — doubling = length
        expect(phonemizeWord("pää")).toBe("pæː"); // head — ää → æː
        expect(phonemizeWord("vesi")).toBe("ʋesi"); // water — v → ʋ (approximant)
    });

    test("consonant gemination → Cː", () => {
        expect(phonemizeWord("kukka")).toBe("kukːɑ"); // flower
        expect(phonemizeWord("tullut")).toBe("tulːut"); // come (past ptcp)
        expect(phonemizeWord("mummo")).toBe("mumːo"); // grandma
    });

    test("velar nasal: ⟨ng⟩→ŋː (long), ⟨nk⟩→ŋk", () => {
        expect(phonemizeWord("kengät")).toBe("keŋːæt"); // shoes — ng → ŋː
        expect(phonemizeWord("rengas")).toBe("reŋːɑs"); // ring/tyre
        expect(phonemizeWord("sänky")).toBe("sæŋky"); // bed — n → ŋ before k
        expect(phonemizeWord("kaupunki")).toBe("kɑu̯puŋki"); // town — diphthong + nk
    });

    test("diphthongs mark the 2nd vowel non-syllabic (V̯)", () => {
        expect(phonemizeWord("pöytä")).toBe("pøy̯tæ"); // table — öy
        expect(phonemizeWord("auto")).toBe("ɑu̯to"); // car — au
        expect(phonemizeWord("tie")).toBe("tie̯"); // road — opening diphthong ie
        expect(phonemizeWord("työ")).toBe("tyø̯"); // work — yö
        expect(phonemizeWord("vuosi")).toBe("ʋuo̯si"); // year — uo
        expect(phonemizeWord("Suomi")).toBe("suo̯mi"); // Finland
    });

    test("cardinal numbers (agglutinated below 1000; tuhat joined, miljoona separate)", () => {
        const fi = createFinnish();
        expect(fi.text("0").trim()).toBe("nolːɑ");
        expect(fi.text("7").trim()).toBe("sei̯tsemæn");
        expect(fi.text("11").trim()).toBe("yksitoi̯stɑ");
        expect(fi.text("234").trim()).toBe("kɑksisɑtɑːkolmekymːentæneljæ");
        expect(fi.text("1234").trim()).toBe("tuhɑt kɑksisɑtɑːkolmekymːentæneljæ");
        expect(fi.text("2000000").trim()).toBe("kɑksi miljoːnɑː");
        // >9 digits: read the raw string digit-by-digit (no float precision loss / exponential leak)
        expect(fi.text("10000000000").trim()).toBe("yksi nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ");
    });

    test("text: words + clause punctuation", () => {
        expect(createFinnish().text("Talo on iso.")).toBe("tɑlo on iso .");
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// TEXT NORMALIZATION (src/languages/finnish/normalize.ts). Counts in the comments are from
// tools/corpus/mined/fi.jsonc; see that file's header for the tabulations each rule rests on.
//
// ⚠ THESE PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (trap 13). The corpus's ordinals are days
// of the month plus 101./126./150., so the sub-ten table and the tens are the only branches it exercises;
// the teens, the tens-plus-unit and the HUNDREDS branch are pinned on cases it does not contain.
describe("Finnish normalization — ordinals", () => {
    test("ordinal(): all four branches, including the one the corpus never writes", () => {
        expect(ordinal(1)).toBe("ensimmäinen"); // table: the standalone form
        expect(ordinal(3)).toBe("kolmas");
        expect(ordinal(10)).toBe("kymmenes");
        expect(ordinal(11)).toBe("yhdestoista"); // teens use the COMBINING unit (yhdes-, not ensimmäinen)
        expect(ordinal(12)).toBe("kahdestoista");
        expect(ordinal(20)).toBe("kahdeskymmenes"); // round tens
        expect(ordinal(21)).toBe("kahdeskymmenesensimmäinen"); // tens + FINAL unit
        expect(ordinal(22)).toBe("kahdeskymmenestoinen"); // …and 2 changes shape between the two slots
        expect(ordinal(100)).toBe("sadas"); // hundreds — NOT in the corpus
        expect(ordinal(126)).toBe("sadaskahdeskymmeneskuudes");
        expect(ordinal(200)).toBe("kahdessadas");
        expect(ordinal(0)).toBeUndefined(); // out of range → the digits keep their period
        expect(ordinal(1000)).toBeUndefined();
    });

    test("bare `N.` is claimed before a month or a lowercase word", () => {
        const fi = createFinnish();
        expect(fi.text("13. toukokuuta 1931")).toContain("kolmɑstoi̯stɑ tou̯kokuːtɑ");
        expect(fi.text("18. herttuatar")).toContain("kɑhdeksɑstoi̯stɑ hertːuɑtɑr");
        // the ordinal RANGE keeps both ordinals; only the connective is refused (see the header)
        expect(fi.text("20.–24. toukokuuta")).toContain("kɑhdeskymːenes kɑhdeskymːenesneljæs");
        // the nominative colon ordinal
        expect(fi.text("33:s")).toContain("kolmɑskymːeneskolmɑs");
    });

    // ⚠ THE INVARIANT THIS FILE EXISTS TO PROTECT (trap 4): a sentence-final period is NOT an ordinal
    // marker. 159 of the corpus's 333 `N.` contexts are followed by a capital and 38 are segment-final.
    test("a sentence period is never eaten", () => {
        const fi = createFinnish();
        expect(fi.text("vuonna 1978. Jakokoski on kylä")).toContain("kɑhdeksɑn . jɑkokoski");
        expect(fi.text("Sega Model 3.").trimEnd().endsWith(".")).toBe(true);
        expect(fi.text("noin 2100 eaa. Urissa asui")).toContain("ɑlkuɑ . urisːɑ");
    });
});

describe("Finnish normalization — numbers, symbols and units", () => {
    test("space grouping, the decimal comma, and the unit that follows it", () => {
        const fi = createFinnish();
        expect(fi.text("1 786")).toContain("tuhɑt sei̯tsemænsɑtɑːkɑhdeksɑŋkymːentækuːsi");
        expect(fi.text("50,7 %")).toContain("pilkːu sei̯tsemæn prosentːiɑ");
        // ⚠ THE COUPLING: the decimal rule keeps DIGITS, so the shared tier still sees `6 cm`. Wording
        // the operand here would silently drop every unit after a decimal.
        expect(fi.text("13,6 cm")).toContain("pilkːu kuːsi sentːimetriæ");
    });

    // ⚠ trap 56: ⟨cm⟩ and ⟨km⟩ both reached the g2p as the cluster /km/ — a plausible reading, not a
    // visible leak, and no leak class could see it. They must now differ.
    test("cm and km are no longer the same reading", () => {
        const fi = createFinnish();
        expect(fi.text("5 cm")).not.toBe(fi.text("5 km"));
        expect(fi.text("5 km")).toContain("kilometriæ");
    });

    test("rate keys compose the inessive denominator; the exponent compounds", () => {
        const fi = createFinnish();
        expect(fi.text("120 km/h")).toContain("kilometriæ tunːisːɑ");
        expect(fi.text("3 m/s")).toContain("metriæ sekunːisːɑ");
        expect(fi.text("76 km²")).toContain("neliøkilometriæ");
        expect(fi.text("259 km2")).toContain("neliøkilometriæ"); // the ASCII form too
    });

    // ⚠ trap 46: the one-letter `m` key is only safe because this language never spends the decimal POINT
    // (Finnish decimals use a comma), so the tier's NOT_VERSION guard still has a dot to reject.
    test("a dotted designation is not a quantity", () => {
        expect(createFinnish().text("802.11m")).not.toContain("metriæ");
    });

    test("degrees, the narrow minus, currency and the ampersand", () => {
        const fi = createFinnish();
        expect(fi.text("14–30 °C")).toContain("ɑstetːɑ");
        expect(fi.text("−2 °C")).toContain("miːnus");
        expect(fi.text("+33,2 °C")).toContain("plus");
        // ⚠ the minus arm requires a degree word after it, so a RANGE can never reach it (trap 24)
        expect(fi.text("1994–1997")).not.toContain("miːnus");
        expect(fi.text("100 $ barrelilta")).toContain("dolːɑriɑ");
        expect(fi.text("Robinson & Cook")).toContain("jɑ");
    });

    test("clock is gated on the marker word, which is what keeps the sports time out", () => {
        const fi = createFinnish();
        expect(fi.text("kello 21.01")).toContain("kɑksikymːentæy̯ksi nolːɑ yksi");
        expect(fi.text("kello 10.00")).toContain("kymːenen nolːɑ nolːɑ");
        expect(fi.text("ajalla 9.29,43")).not.toContain("yhdeksæn kɑksikymːentæy̯hdeksæn"); // NOT a clock
    });
});

describe("Finnish normalization — initialisms and abbreviations", () => {
    test("letter names, and the colon suffix glued to the last one", () => {
        const fi = createFinnish();
        expect(fi.text("CIA:n")).toContain("seː iː ɑːn");
        expect(fi.text("BKT:sta")).toContain("beː koː teːstɑ");
        expect(fi.text("YK:n")).toContain("yː koːn");
        expect(fi.text("MM-kilpailuissa")).toContain("æm æm"); // was ONE geminate /mː/
    });

    // LEXICAL, and the referee is the source in both directions: it records USA as `u s ɑ` (a word) and
    // EU as `eː uː` (spelled). A phonotactic test cannot derive either.
    test("a readable acronym stays a word unless the language spells it", () => {
        const fi = createFinnish();
        expect(fi.text("USA")).toBe("usɑ");
        expect(fi.text("EU:n")).toContain("eː uːn");
    });

    // ⚠ ORDERING, THROUGH THE REAL PHONEMIZER (trap 16): fi is not in `ROMAN_NATIVE`, so `registry.ts`
    // turns Roman numerals into digits BEFORE `text()`. `XV` is chosen because its letters would be
    // spelled out if the initialism pass ran first.
    test("Roman numerals reach the number path, not the initialism pass", () => {
        // through `phonemize`, not `engine.text()` — the Roman pass wraps the ENGINE in registry.ts
        expect(phonemize("XV", "fi")).toBe("ʋiːsitoi̯stɑ");
        // A REGNAL numeral is deliberately NOT claimed: by the time this file runs the Roman pass has
        // made it a digit, so nothing distinguishes `Filipp II` from any other name-plus-number, and the
        // genitive it takes is the refused colon class. It reads as a cardinal with no spurious pause.
        expect(phonemize("Filipp II:n", "fi")).toBe("filipː kɑksi n");
    });

    test("abbreviations, and the digit guards that separate them from units", () => {
        const fi = createFinnish();
        expect(fi.text("s. 21. helmikuuta 1966")).toContain("syntynyt");
        expect(fi.text("944 mm. Sateet")).toContain("milːimetriæ"); // the UNIT, not `muun muassa`
        expect(fi.text("Siellä on mm. eräs")).toContain("muːn muɑsːɑ");
        // `n.` must not fire on a case suffix that ends a sentence — `Volvo 850:n.`
        expect(fi.text("korvasi Volvo 850:n. Rinnakkaismallina")).not.toContain("noi̯n");
        expect(fi.text("(engl. Algic languages)")).toContain("eŋːlɑnːiksi ɑlɡik");
    });

    // The apostrophe is a case joint after a CONSONANT and a vowel-hiatus mark after a vowel; gluing the
    // second would invent a long vowel.
    test("the apostrophe genitive glues, the hiatus mark does not", () => {
        const fi = createFinnish();
        expect(fi.text("Perrault’n")).toBe("perːɑu̯ltn");
        expect(fi.text("raa'asti")).toBe("rɑː ɑsti");
    });
});
