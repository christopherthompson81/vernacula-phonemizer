import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Hindi (Devanagari abugida). Values captured from the native engine; they are
// byte-identical to the espeak-ng-portable canonical output the engine was lifted from.
describe("hindi canonical IPA", () => {
    test.each([
        ["भारत", "bʱˈaːɾət̪"], // schwa retained medially (VCəCV blocked by final त̪)
        ["नमस्ते", "nəmˈəst̪eː"],
        ["सरकार", "səɾkˈaːɾ"], // final-superheavy stress
        ["चाय", "t͡ʃˈaːj"],
        ["हम", "ɦˈəm"],
        ["बड़ा", "bˈəɽaː"], // nukta ड़ → retroflex flap
        ["झूठ", "d͡ʒʱˈuːʈʰ"], // breathy + retroflex aspirated
        ["अगरबत्ती", "əɡˈəɾbət̪ːiː"], // geminate blocks schwa deletion
        ["कांग्रेस", "kaː̃ŋɡɾˈeːs"], // anusvara → nasal vowel + homorganic ŋ
        ["यहाँ", "jˈəɦaː̃"],
    ])("%s → %s", (input, expected) => {
        expect(phonemize(input, "hi")).toBe(expected);
    });

    test("numbers (Indian grouping + decimal + percent + rupee strip)", () => {
        expect(phonemize("२०२४", "hi")).toBe("d̪ˈoː ɦəzˈaːɾ t͡ʃɔːbˈiːs");
        expect(phonemize("१२.५", "hi")).toBe("bˈaːɾəɦ d̪əʃˈəmləʋ pˈaː̃t͡ʃ");
        expect(phonemize("५०%", "hi")).toBe("pət͡ʃˈaːs pɾˈət̪ɪʃət̪");
        expect(phonemize("₹५००", "hi")).toBe("pˈaː̃t͡ʃ sˈɔː");
    });

    test("clause punctuation → inline pause marks", () => {
        expect(phonemize("भारत। नमस्ते।", "hi")).toBe("bʱˈaːɾət̪ . nəmˈəst̪eː .");
    });
});

// #562 text normalization (hindi/normalize.ts) — the fourth language, and the first outside the Latin
// script. Most tiers were already right and are untouched: lakh/crore, both comma-grouping conventions,
// decimals, %, currency, the danda, and Latin-run delegation to English.
describe("hindi normalization", () => {
    test("ordinal suffixes join the numeral instead of becoming a stray word", () => {
        // The suffix is written attached (16वीं) but was tokenized apart, so it was spoken on its own:
        // [sˈoːləɦ ʋˈiː̃], "sixteen vee". The suffix also CARRIES the agreement, so it is read off the text.
        expect(phonemize("16वीं शताब्दी", "hi")).toBe("soːlˈəɦʋiː̃ ʃət̪ˈaːbd̪iː");
        expect(phonemize("19वीं सदी", "hi")).toBe("ʊnːˈiːsʋiː̃ sˈəd̪iː");
        expect(phonemize("21वाँ दिन", "hi")).toBe("ɪkːˈiːsʋaː̃ d̪ˈɪn"); // masculine suffix
        expect(phonemize("190वें स्थान", "hi")).toBe("ˈeːk sˈɔː nəbːˈeːʋeː̃ st̪ʰˈaːn"); // joins the LAST word
        expect(phonemize("पहला दिन", "hi")).toBe("pˈəɦlaː d̪ˈɪn"); // suppletive, already a word
    });

    test("abbreviations, including the dotless form that dominates the corpus", () => {
        // डॉ is the most frequent abbreviation (×27) and ×22 of those are written WITHOUT the dot, so the
        // dot cannot be required. With the dot it was also leaving a phrase break.
        expect(phonemize("डॉ. शर्मा", "hi")).toBe("ɖˈɔːkʈəɾ ʃˈəɾmaː");
        expect(phonemize("डॉ शर्मा", "hi")).toBe("ɖˈɔːkʈəɾ ʃˈəɾmaː");
        expect(phonemize("प्रो. गुप्ता", "hi")).toBe("pɾoːfˈeːsəɾ ɡˈʊpt̪aː");
        expect(phonemize("356 ई.पू.", "hi")).toBe("t̪ˈiːn sˈɔː t͡ʃʰˈəpːən ˈiːsaː pˈuːɾʋ"); // was two pauses
    });

    test("Devanagari unit abbreviations", () => {
        // The shared symbol tier is keyed on the LATIN abbreviations, which is not what the corpus writes.
        expect(phonemize("5 किमी", "hi")).toBe("pˈaː̃t͡ʃ kɪloːmˈiːʈəɾ"); // was the word [kˈɪmiː]
        expect(phonemize("35 मिमी", "hi")).toBe("pɛː̃n̪t̪ˈiːs mɪliːmˈiːʈəɾ");
        expect(phonemize("120 किमी/घंटा", "hi")).toBe("ˈeːk sˈɔː bˈiːs kɪloːmˈiːʈəɾ pɾˈət̪ɪ ɡʱˈə̃ɳʈaː");
        expect(phonemize("20 °C", "hi")).toBe("bˈiːs ɖˈɪɡɾiː sˈeːlsɪjəs"); // was the letter name
        expect(phonemize("30° c", "hi")).toBe("t̪ˈiːs ɖˈɪɡɾiː sˈeːlsɪjəs"); // lowercase, as the corpus writes it
    });

    test("clock: the colon was a phrase break and :00 read as शून्य", () => {
        expect(phonemize("10:30", "hi")).toBe("d̪ˈəs bˈəd͡ʒkəɾ t̪ˈiːs mˈɪnəʈ");
        expect(phonemize("11:29 बजे", "hi")).toBe("ɡjˈaːɾəɦ bˈəd͡ʒkəɾ ʊnt̪ˈiːs mˈɪnəʈ"); // बजे consumed
        expect(phonemize("11:00 बजे", "hi")).toBe("ɡjˈaːɾəɦ bˈəd͡ʒeː"); // …but kept at :00, which is right
    });

    test("fractions and the plus sign; the minus is deliberately not claimed", () => {
        expect(phonemize("1/2", "hi")).toBe("ˈaːd̪ʱaː");
        expect(phonemize("1/3", "hi")).toBe("ˈeːk t̪ɪɦˈaːiː");
        expect(phonemize("1/5", "hi")).toBe("ˈeːk bˈəʈaː pˈaː̃t͡ʃ"); // the ordinary spoken "n बटा m"
        expect(phonemize("+3 डिग्री", "hi")).toBe("d̪ʱˈən t̪ˈiːn ɖˈɪɡɾiː");
        // The only hyphen-before-digit in the corpus is a spacecraft NAME, and Devanagari also uses a
        // spaced hyphen in compounds, so a minus rule here has false positives and no true ones.
        expect(phonemize("चंद्रयान -1", "hi")).toBe("t͡ʃə̃n̪d̪ɾəjˈaːn ˈeːk");
    });
});

/** #562 — the ordinal suffix must not match the START of an ordinary word. */
describe("Hindi ordinal suffix boundary", () => {
    test("a number before a वा- word stays two words", () => {
        // Was one glued token with a stress lost — dasvāpas. The Marathi run measured 13 live corruptions
        // of this shape (वाजता, वादळे, वाईल्ड) in its own corpus, since it inherits this normalizer.
        expect(phonemize("10 वापस", "hi")).toBe("d̪ˈəs ʋˈaːpəs");
        expect(phonemize("5 वायु", "hi")).toBe("pˈaː̃t͡ʃ ʋˈaːjʊ");
        expect(phonemize("20 वाहन", "hi")).toBe("bˈiːs ʋˈaːɦən");
    });

    test("…and genuine ordinals still compose", () => {
        expect(phonemize("16वीं सदी", "hi")).toBe("soːlˈəɦʋiː̃ sˈəd̪iː");
        expect(phonemize("5वा दिन", "hi")).toBe("pˈaː̃t͡ʃʋaː d̪ˈɪn");
        expect(phonemize("21वें", "hi")).toBe("ɪkːˈiːsʋeː̃");
    });
});
