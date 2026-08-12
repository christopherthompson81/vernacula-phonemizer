import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord, phonemizeArabic, phonemizeRoman } from "../src/languages/balochi/balochi.ts";

// Canonical-IPA goldens for Balochi / بلوچی (bal) — Southern Balochi, CROSS-SCRIPT (Arabic + Roman). Authored from
// Jahani & Korn (2009) + Korn (2005a); the cross-script lexicon is corroborated by ASJP Southern-Balochi (an
// INDEPENDENT transcriber) on the overlapping core vocabulary. The Balochi Arabic abjad under-encodes vowels
// (short /a i u/ unwritten + ⟨و⟩/⟨ی⟩ conflate uː/oː, iː/eː); the cross-script lexicon recovers the full vowels the
// abjad loses, and the Roman orthography is phonemic.
describe("Balochi (Southern) — cross-script canonical IPA", () => {
    test("cross-script LEXICON recovers the vowels the abjad loses (Arabic input → full IPA)", () => {
        expect(phonemizeWord("خاموش")).toBe("xaːmoːʃ"); // "quiet" — abjad skeleton was xaːmuːʃ (و→uː); lexicon restores oː
        expect(phonemizeWord("گریب")).toBe("ɡariːb"); // "poor" — skeleton ɡriːb; lexicon restores the short a
        expect(phonemizeWord("روچ")).toBe("roːt͡ʃ"); // "day" — skeleton ruːt͡ʃ; lexicon restores oː
        expect(phonemizeWord("ڈاکٹر")).toBe("ɖaːkʈar"); // "doctor" — retroflex ɖ ʈ; short a restored
    });

    test("Roman orthography is phonemic → full IPA directly (matres/macrons)", () => {
        expect(phonemizeWord("balōč")).toBe("baloːt͡ʃ"); // ō→oː, č→t͡ʃ (Korn)
        expect(phonemizeWord("gwāt")).toBe("ɡwaːt̪"); // "wind" — dental t̪
        expect(phonemizeWord("dast")).toBe("d̪ast̪"); // "hand" — dental d̪ t̪ (ASJP-corroborated)
        expect(phonemizeRoman("ḍākṭar")).toBe("ɖaːkʈar"); // retroflex ḍ→ɖ, ṭ→ʈ
    });

    test("the SIGNATURE retroflex ٹ→ʈ, ڈ→ɖ vs dental ت→t̪, د→d̪ (via the shared inventory)", () => {
        expect(phonemizeWord("چار")).toBe("t͡ʃaːr"); // "four" — چ→t͡ʃ (lexicon)
        expect(phonemizeRoman("čār")).toBe("t͡ʃaːr");
        expect(phonemizeArabic("کتاب")).toBe("kt̪aːb"); // the raw Arabic SKELETON (OOV path): dental t̪, short i unwritten
    });

    test("Arabic OOV falls back to the defective skeleton (an honest unverifiable tail)", () => {
        expect(phonemizeArabic("بلوچستان")).toBe("bluːt͡ʃst̪aːn"); // not in lexicon → skeleton (short vowels gone)
    });
});

/**
 * TEXT NORMALIZATION (`src/languages/balochi/normalize.ts`). Asserted through `phonemize` rather than on the
 * normalizer directly, because half of what these rules do is decided by layers on either side of them — the
 * registry's native-digit fold above, the tokenizer's script routing and the cross-script lexicon below.
 *
 * ⚠ PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (trap 13). The variant fold has four branches — a
 * word the lexicon already knows, a word the lexicon knows once its harakat are stripped, a word the lexicon
 * knows once it is respelled in the Pakistan alphabet, and a word the lexicon knows in none of those forms
 * and is left in its own orthography for the manifest — and the corpus exercises the first three heavily and
 * the fourth constantly. One case from each is below, and the fourth branch's case is deliberately a word
 * the corpus does NOT contain.
 */
describe("Balochi text normalization", () => {
    test("ݔ U+0754 is the Balochi Standard ē — the letter that used to vanish AND split its word", () => {
        // Before this layer: "wɖ n" / "ʃ r" — U+0754 is outside the old token class, so it was deleted and
        // the word fragmented in two. ×506 in 149 of the corpus's 383 paragraphs.
        expect(phonemize("وڈݔن", "bal")).toBe("wɖeːn");
        expect(phonemize("بازݔن", "bal")).toBe("baːzeːn");
        // The LEXICON branch: نݔمگ respelled نیمگ is a headword, so the reading gains the short vowel the
        // abjad cannot write (neːmaɡ, not the skeleton neːmɡ).
        expect(phonemize("نݔمگ", "bal")).toBe("neːmaɡ");
    });

    test("ۏ U+06CF is ō, and the lexicon-first fold recovers the vowels around it", () => {
        expect(phonemize("بلۏچ", "bal")).toBe("baloːt͡ʃ"); // lexicon بلوچ → balōč
        expect(phonemize("رۏچ", "bal")).toBe("roːt͡ʃ"); // lexicon روچ → rōč
        expect(phonemize("کۏہ", "bal")).toBe("koːh"); // ہ→ه as well, then the lexicon کوه → kōh
        // ⚠ THE FOURTH BRANCH, on the corpus's own `جۏڈݔنگ` — a word no lexicon entry can reach, in EITHER
        // spelling, and which carries both new letters at once. They still read as oː and eː rather than
        // being folded down to و/ی and read as uː/iː. This is the case the manifest entries exist for, and
        // it is the branch the corpus exercises most.
        expect(phonemize("جۏڈݔنگ", "bal")).toBe("d͡ʒoːɖeːnɡ");
        expect(phonemize("تۏک", "bal")).toBe("t̪oːk");
    });

    test("the exact-value folds: ګ ك ي ؤ ہ ډ ټ ړ", () => {
        expect(phonemize("ګون", "bal")).toBe("ɡwan"); // ګ→گ, then the lexicon
        expect(phonemize("كتاب", "bal")).toBe("kit̪aːb"); // ARABIC kaf → ک, then the lexicon
        expect(phonemize("جوړ", "bal")).toBe("d͡ʒuːɽ"); // the Pashto retroflex ړ → ڑ, same value ɽ
    });

    test("Arabic presentation forms no longer read as the EMPTY STRING", () => {
        expect(phonemize("ﻫﻨﺪ", "bal")).toBe("hnd̪"); // was ""
        expect(phonemize("ﺳﺎﻝ", "bal")).toBe("saːl");
    });

    test("digit de-grouping — the tail used to read as ZERO", () => {
        expect(phonemize("12,000", "bal")).toBe("d̪uwaːzd̪ah hazaːr"); // was "d̪uwaːzd̪ah , sifr"
        expect(phonemize("۶۵۲،۸۶۰", "bal")).toBe("ʃiʃ lakku pand͡ʒaːhu d̪oː hazaːru haʃt̪ sad̪u ʃast̪");
        // ⚠ THE GUARD THAT KEEPS A YEAR LIST OUT, and the corpus contains one: four Solar Hijri years
        // separated by commas. A 4-digit head cannot open a match, so the pauses between them survive.
        expect(phonemize("۱۳۲۷،۱۳۳۷", "bal")).toContain(",");
    });

    test("the decimal point stops being a clause pause; a comma decimal is NOT claimed", () => {
        expect(phonemize("2.5", "bal")).toBe("d̪oː pant͡ʃ"); // was "d̪oː . pant͡ʃ"
        // Southern Balochi writes 3 grouped commas and ZERO comma decimals, so this pause is correct.
        expect(phonemize("12,5", "bal")).toContain(",");
    });

    test("the Hijri and BC era abbreviations, including the tatweel form the corpus writes", () => {
        // Both expansions are the corpus's own words, glossing its own abbreviation in the same wiki.
        expect(phonemize("1355ھ. ق.", "bal")).toContain("hd͡ʒriː kmriː");
        expect(phonemize("1373ﻫـ .ﻕ.", "bal")).toContain("hd͡ʒriː kmriː"); // presentation forms + U+0640
        expect(phonemize("11,000 ق م", "bal")).toContain("piːʃ t͡ʃh miːlaːd̪");
        // ⚠ THE DIGIT ANCHOR IS WHAT KEEPS قم, THE IRANIAN CITY, OUT — ×10 in the Western corpus and never
        // digit-adjacent. Without it the era rule would read a place name as "before Christ".
        expect(phonemize("شارستان قم", "bal")).not.toContain("miːlaːd̪");
    });
});
