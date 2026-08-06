import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/urdu/urdu.ts";

// Canonical-IPA goldens for Urdu (ur) — Perso-Arabic abjad, Hindi phoneme inventory. The g2p produces the
// consonant + LONG-vowel skeleton (aspiration via ھ, retroflex ٹ ڈ ڑ, dental t̪ d̪, long vowels ا/و/ی/ے,
// nasal place assimilation) with a default [ə] for the omitted SHORT vowels — full short-vowel restoration is
// the deferred subsystem (🟠). These goldens are long-vowel-dominant words where the skeleton IS the answer.
describe("urdu canonical IPA", () => {
    test("consonant + long-vowel skeleton (aspiration, retroflex, long vowels)", () => {
        const cases: [string, string][] = [
            ["آباد", "ɑːbɑːd̪"], // abad: ا→ɑː, د dental
            ["پانی", "pɑːnˈiː"], // pani: long ɑː + iː
            ["ہاتھ", "ɦɑːt̪ʰ"], // hath: aspirated t̪ʰ via ھ
            ["بھائی", "bʱɑːˈiː"], // bhai: breathy bʱ, hamza-seat ئ→iː
            ["آواز", "ɑːʋɑːz"], // awaz: و as glide ʋ after ɑː
            ["نام", "nɑːm"], // nam
            ["آئینہ", "ɑːˈiːnɑ"], // aina: final ہ → [ɑ] vowel
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("nasal place assimilation (n→ŋ before velar, n→m before labial)", () => {
        expect(phonemizeWord("انگور")).toBe("əŋɡˈuːɾ"); // angūr: n→ŋ before ɡ; و→uː from the coverage lexicon (انگُور)
        expect(phonemizeWord("انبار")).toBe("ˈəmbɑːɾ"); // ambar: n→m before b
    });

    test("text: words + Urdu full-stop (۔) pause", () => {
        expect(phonemize("میرا نام", "ur")).toContain("nɑːm");
    });

    // COVERAGE layer (lexicon-ipa.tsv): an undiacritized skeleton we've mined is returned as canonical IPA directly,
    // short-circuiting the g2p's default schwa. Miss → default-ə core; caller-supplied harakat → respected.
    test("IPA coverage lexicon restores mined short/long vowels", () => {
        expect(phonemizeWord("آبرو")).toBe("ɑːbɾˈuː"); // ābrū: و→uː from the lexicon, not default oː
        expect(phonemizeWord("آبرُو")).toBe("ɑːbɾˈuː"); // caller-supplied damma is respected (not clobbered)
    });

    // MAJHŪL long-vowel quality — the distinction harakat CANNOT encode (no diacritic for ی=iː~eː or و=oː~uː);
    // the IPA lexicon carries it from the cross-script Hindi gold (Devanagari writes ई/ए, ऊ/ओ). The g2p default
    // would give iː/oː for every ی/و.
    test("IPA lexicon resolves majhūl long-vowel quality (beyond harakat)", () => {
        expect(phonemizeWord("نکیل")).toBe("nəkˈeːl"); // nakel: ی→eː (default would be iː)
        expect(phonemizeWord("کھجور")).toBe("kʰəd͡ʒˈuːɾ"); // khajūr: و→uː (default would be oː)
    });
});

// #562 — the tenth language. As with Bengali, the biggest defects were NOT in the normalization layer:
// the numbers data had no fused 21-99 forms, clausePunctuation mapped every mark to a PADDED copy of
// itself, and the number function leaked ASCII digits for any decimal.
describe("urdu normalization", () => {
    test("21-99 are fused words, not unit+tens", () => {
        // 23 of the 72 authored forms are attested across three independent sources (the CLE-speech
        // referee ×20, wikipron ×7, the FLEURS corpus ×4), and the engine reproduces the referee's phone
        // sequence exactly for those it prices (اکیس → ɪkkˈiːs vs ɪ k k iː s).
        expect(phonemize("21", "ur")).toBe("əkˈiːs"); // was "ایک بیس", one-twenty
        expect(phonemize("35", "ur")).toBe("piːnt̪ˈiːs");
        expect(phonemize("1959", "ur")).toBe("ˈeːk ɦzɑːɾ nˈəoː sˈəoː ˈənsəʈʰ"); // was "نو پچاس"
    });

    test("decimals no longer leak ASCII digits", () => {
        // number() returned the raw string for anything that was not a safe INTEGER, so "1.5" reached the
        // IPA verbatim — 19 corpus utterances. The manifest also had no decimal word at all.
        expect(phonemize("1.5 میٹر", "ur")).toBe("ˈeːk əʔʃɑːɾˈiːɦ pɑːnˈət͡ʃ mˈiːʈəɾ"); // اعشاریہ
    });

    test("punctuation is a canonical pause, not a padded copy", () => {
        // clausePunctuation mapped "۔" to " ۔ " — the mark itself, padded — producing a double-space
        // slot-gap on the full stop that ends almost every one of the 2,109 corpus utterances.
        expect(phonemize("یہ جملہ ہے۔ دوسرا، ٹھیک؟", "ur")).toBe("jˈəɦ d͡ʒˈʊmlɑ ɦˈeː . d̪ˈuːsɾɑː , ʈʰˈiːk ?");
    });

    test("ordinal suffixes join the numeral", () => {
        // واں / ویں are written attached OR spaced — both occur — and carry the agreement, so it is read
        // off the text. Previously the suffix was spoken as its own syllable.
        expect(phonemize("15 ویں صدی", "ur")).toBe("pənd̪əɾɦˈoːj sˈəd̪iː"); // spaced, as the corpus writes it
        expect(phonemize("60واں گول", "ur")).toBe("sɑːʈʰʋɑː̃ ɡˈoːl"); // attached
    });

    test("clock, grouping, symbols and units", () => {
        expect(phonemize("11:00", "ur")).toBe("ɡˈiːɑːɾɑ bˈəd͡ʒeː"); // the colon reached the output RAW
        expect(phonemize("1:15", "ur")).toBe("ˈeːk bˈəd͡ʒ kˈəɾ pənˈəd̪ɾɑ mˈɪnəʈ");
        // The ARABIC COMMA doubles as a thousands separator (×20). Between digits it is grouping, not
        // punctuation; left alone it was a clause break and "11،000" read as "eleven … zero".
        expect(phonemize("11،000", "ur")).toBe("ɡˈiːɑːɾɑ ɦzɑːɾ");
        expect(phonemize("یہ، وہ", "ur")).toBe("jˈəɦ , ʋˈəɦ"); // ...while real punctuation is untouched
        // Urdu had no symbol tier at all, so % and every currency sign were dropped.
        expect(phonemize("3%", "ur")).toBe("t̪ˈiːn fˈiːsəd̪");
        expect(phonemize("$ 1", "ur")).toBe("ˈeːk ɖˈɔːləɾ");
        expect(phonemize("5 کلو میٹر", "ur")).toBe("pɑːnˈət͡ʃ kɪloːmˈiːʈəɾ"); // the SPACED spelling
        expect(phonemize("20 °C", "ur")).toBe("bˈiːs ɖˈɪɡɾiː sˈiːnʈiː ɡəɾˈiːɖ");
        expect(phonemize("1/5", "ur")).toBe("ˈeːk bˈəʈɑː pɑ̃ːt͡ʃ");
        expect(phonemize("-5 ڈگری", "ur")).toBe("mˈənfiː pɑːnˈət͡ʃ ɖˈɪɡɾiː");
    });

    test("a word that merely STARTS with an abbreviation-shaped prefix is untouched", () => {
        // A naive scan reports قم ×5, which looks like the BC marker. It is the start of قمری "lunar".
        expect(phonemize("قمری مواد", "ur")).toBe("qˈəmɾiː mʋɑːd̪");
    });

    // #586 — `مربع کلومیٹر` ×9 and `کیوبک میٹر` ×1, both word-FIRST, where Arabic postposes its cognate مربع.
    test("the squared/cubed measure word (#586)", () => {
        expect(phonemize("783562 km²", "ur")).toContain("mʊɾˈəbbɑːʔ kɪloːmˈiːʈəɾ");
        expect(phonemize("120 m³", "ur")).toContain("kjˈoːbək mˈiːʈəɾ");
    });
});
