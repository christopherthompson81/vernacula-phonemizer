import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Hindi (Devanagari abugida). Values captured from the native engine.
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

    test("numbers (Indian grouping + decimal + percent + rupee)", () => {
        expect(phonemize("२०२४", "hi")).toBe("d̪ˈoː ɦəzˈaːɾ t͡ʃɔːbˈiːs");
        expect(phonemize("१२.५", "hi")).toBe("bˈaːɾəɦ d̪əʃˈəmləʋ pˈaː̃t͡ʃ");
        expect(phonemize("५०%", "hi")).toBe("pət͡ʃˈaːs pɾˈət̪ɪʃət̪");
        // ₹ is READ, not stripped — and consistently for both digit systems. `stripSymbols: "₹"` in
        // hindi.jsonc predates the shared currency tier gaining ₹; the tier now claims the sign first, so
        // the strip is unreachable. Before the registry folded native digits, `₹500` already read
        // "रुपये" while `₹५००` did not, because the currency regex is ASCII-anchored — the two digit
        // systems disagreed and this test asserted the accidental half. Dropping a currency sign is the
        // defect, so the reading is the correct resolution.
        expect(phonemize("₹५००", "hi")).toBe("pˈaː̃t͡ʃ sˈɔː ɾˈʊpjeː");
        expect(phonemize("₹500", "hi")).toBe(phonemize("₹५००", "hi")); // both digit systems agree
    });

    test("clause punctuation → inline pause marks", () => {
        expect(phonemize("भारत। नमस्ते।", "hi")).toBe("bʱˈaːɾət̪ . nəmˈəst̪eː .");
    });
});

// TEXT NORMALIZATION (hindi/normalize.ts). Most tiers need no Hindi-specific work and are untouched:
// lakh/crore, both comma-grouping conventions, decimals, %, currency, the danda, and Latin-run delegation
// to English.
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

    test("fractions and the plus sign", () => {
        expect(phonemize("1/2", "hi")).toBe("ˈaːd̪ʱaː");
        expect(phonemize("1/3", "hi")).toBe("ˈeːk t̪ɪɦˈaːiː");
        expect(phonemize("1/5", "hi")).toBe("ˈeːk bˈəʈaː pˈaː̃t͡ʃ"); // the ordinary spoken "n बटा m"
        // The plus was `धन` here until the corpus's own AUDIO was consulted: both hi_in speakers of the
        // `यूटीसी + 1` sentence say प्लस. धन is what the sign is CALLED in a maths article, not what is read
        // in the slot — a correctly-sourced word from the wrong register.
        // Both hi speakers of `+ 30° C` omit the sign, but for a TTS target that is a REFEREE signal and not
        // a licence to delete a character the author explicitly wrote, so it is still voiced. The omission
        // does explain why it is harmless either way: omitting a plus is lossless (`+30°` and `30°` are the
        // same temperature) whereas omitting a minus INVERTS — which is why 7b's inversion argument belongs
        // to the minus alone and must not be recycled for the plus.
        expect(phonemize("+3 डिग्री", "hi")).toBe("plˈəs t̪ˈiːn ɖˈɪɡɾiː");
        expect(phonemize("यूटीसी + 1", "hi")).toBe("juːʈˈiːsiː plˈəs ˈeːk"); // the word, per two speakers
    });

    // The minus WAS deliberately not claimed, and the refusal was right about the rule it refused:
    // measured over hi_in, the fleet's `(^|[\s(])[-−–](\d)` shape has one false positive and no true ones.
    // A narrower rule escapes the objection — the sign is unambiguous when it opens the string or a bracket,
    // or when a degree/percent word follows — and the corpus's own `+ 30° C` proves the signed temperature is
    // an attested shape here, which is the one where dropping the sign inverts the meaning.
    test("the minus is claimed only where it cannot be a designation", () => {
        expect(phonemize("-5", "hi")).toBe("ɾˈɪɳ pˈaː̃t͡ʃ"); // ऋण पाँच
        expect(phonemize("-5 डिग्री", "hi")).toBe("ɾˈɪɳ pˈaː̃t͡ʃ ɖˈɪɡɾiː");
        expect(phonemize("तापमान -5 °C है।", "hi"))
            .toBe("t̪aːpmˈaːn ɾˈɪɳ pˈaː̃t͡ʃ ɖˈɪɡɾiː sˈeːlsɪjəs ɦˈɛː ."); // the inverting case
        expect(phonemize("(-3)", "hi")).toBe("ɾˈɪɳ t̪ˈiːn");
        // …and the two designations the refusal was protecting are still untouched. `फ़ॉर्मूला-1` is the one
        // the SCAN misreported too: the character before its hyphen is a matra, so `(?<!\p{L})` let it pass.
        expect(phonemize("चंद्रयान -1", "hi")).toBe("t͡ʃə̃n̪d̪ɾəjˈaːn ˈeːk");
        expect(phonemize("फ़ॉर्मूला-1 चैंपियनशिप", "hi")).toBe("fˈɔːɾmuːlaː ˈeːk t͡ʃˈɛː̃mpɪjənʃɪp");
        expect(phonemize("25-30 साल", "hi")).toBe("pət͡ʃːˈiːs t̪ˈiːs sˈaːl"); // a range
        expect(phonemize("आस-पास", "hi")).toBe("ˈaːs pˈaːs"); // a compound
    });

    // Found by the Wikipedia gap-fill — coordinates are absent from FLEURS entirely, and the two
    // sentences that carry them leaked THREE marks: `´` (U+00B4) and `'` as the minutes mark, and `º`
    // (U+00BA MASCULINE ORDINAL INDICATOR) standing in for the degree sign — the same substitution the
    // Italian run found in `dell'11º`.
    test("coordinates: the minutes mark and the U+00BA degree sign", () => {
        expect(phonemize("२८°२१´", "hi")).toBe("əʈʈʰaːˈiːs ɖˈɪɡɾiː ɪkːˈiːs mˈɪnəʈ");
        expect(phonemize("३०º ०५'", "hi")).toBe("t̪ˈiːs ɖˈɪɡɾiː pˈaː̃t͡ʃ mˈɪnəʈ");
        expect(phonemize("२८°२१´३०″", "hi")).toBe("əʈʈʰaːˈiːs ɖˈɪɡɾiː ɪkːˈiːs mˈɪnəʈ t̪ˈiːs seːkˈə̃ɳɖ");
        expect(phonemize("७९º", "hi")).toBe("ʊnˈaːsiː ɖˈɪɡɾiː"); // the bare U+00BA
        expect(phonemize("20 °C", "hi")).toBe("bˈiːs ɖˈɪɡɾiː sˈeːlsɪjəs"); // …and °C is unchanged
        // ℃ / ℉ are SINGLE code points, so the `°`+letter rules could not reach them and `20℃` read as bare
        // "twenty" — the whole unit gone. Found while reviewing this change; cmn and en had the same gap.
        expect(phonemize("20℃", "hi")).toBe("bˈiːs ɖˈɪɡɾiː sˈeːlsɪjəs");
        expect(phonemize("20℉", "hi")).toBe("bˈiːs ɖˈɪɡɾiː faːɾˈeːnɦaːɪʈ");
    });

    // The real negative the gap-fill found, in a domain FLEURS has none of.
    test("a real negative from the hybrid artifact reads", () => {
        expect(phonemize("ट्राइटन की सतह पर औसत तापमान -२३५.२° सेंटीग्रेड है।", "hi"))
            .toContain("ɾˈɪɳ d̪ˈoː sˈɔː pɛː̃n̪t̪ˈiːs d̪əʃˈəmləʋ d̪ˈoː ɖˈɪɡɾiː"); // ऋण २३५.२ डिग्री
        // …and the dash-as-SEPARATOR the same fill found, which must NOT become a sign. This is why the
        // percent arm was removed from the rule: "Koch (31,381 – 98.53% Hindu)" is a census figure.
        expect(phonemize("कोच (३१,३८१ -९८.५३% हिंदू)", "hi")).not.toContain("ɾˈɪɳ");
    });

    test("the remaining signs, with Hindi's postpositional comparatives", () => {
        expect(phonemize("x = y", "hi")).toBe("ˈɛks bəɾˈaːbəɾ wˈaᶦ"); // बराबर
        expect(phonemize("6 × 6", "hi")).toBe("t͡ʃʰˈəɦ ɡˈʊɳaː t͡ʃʰˈəɦ"); // गुणा
        expect(phonemize("6 ÷ 3", "hi")).toBe("t͡ʃʰˈəɦ bʱˈaːɡ t̪ˈiːn"); // भाग
        expect(phonemize("±5", "hi")).toBe("d̪ʱˈən ɾˈɪɳ pˈaː̃t͡ʃ"); // the धन/ऋण pair
        // THE COMPARATIVE REORDERS: Hindi states it postpositionally, so `5 < 6` is "5, 6 से कम" — the
        // western order would have been fluent nonsense. Corpus: "+ 30° C से अधिक तापमान".
        expect(phonemize("5 < 6", "hi")).toBe("pˈaː̃t͡ʃ t͡ʃʰˈəɦ sˈeː kˈəm");
        expect(phonemize("6 > 5", "hi")).toBe("t͡ʃʰˈəɦ pˈaː̃t͡ʃ sˈeː ˈəd̪ʱɪk");
        // The ampersand: English inside a Latin run, और otherwise.
        expect(phonemize("AT&T", "hi")).toBe("ˈæt ˈənd tʰˈiː");
        expect(phonemize("राम & श्याम", "hi")).toBe("ɾˈaːm ˈɔːɾ ʃjˈaːm");
        // The exponent's measure word precedes the unit, with a space. Corpus: "19,500 वर्ग किलोमीटर".
        expect(phonemize("50 km²", "hi")).toBe("pət͡ʃˈaːs ʋˈəɾɡ kɪloːmˈiːʈəɾ");
    });
});

/** the ordinal suffix must not match the START of an ordinary word. */
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

    // मीटर ×8, and digit-adjacent bare `m` is ×0 in this corpus. `घन` was already declared but
    // unreachable: without a head noun in `units` the exponent branch cannot fire, so `120 m³` read as the
    // bare letter name *ˈɛm* while `120 km³` read correctly.
    test("the bare metre makes the cube word reachable", () => {
        expect(phonemize("5 m", "hi")).toContain("mˈiːʈəɾ");
        expect(phonemize("120 m³", "hi")).toContain("ɡʱˈən mˈiːʈəɾ");
        expect(phonemize("802.11m", "hi")).toContain("ˈɛm"); // a dotted designation is not a quantity
    });

    // ⚠ MIS-READING, NOT LEAKING (tools/normalization/misread.ts). `10 ha` read *d̪ˈəs hˈɑː* and `10 l`
    // *d̪ˈəs ˈɛɫ* — the ENGLISH LETTER NAME, out of a Devanagari engine, with no ASCII surviving and
    // nothing vanishing, so no leak class or differential DROP test in the tree could see it.
    test("units that MIS-READ rather than leak — ⟨g⟩ ⟨l⟩ ⟨L⟩ ⟨ha⟩", () => {
        // लीटर — the litre article names BOTH symbols: "इसके दो आधिकारिक चिह्न (ℓ) और (L) हैं".
        expect(phonemize("10 l", "hi")).toBe("d̪ˈəs lˈiːʈəɾ");
        expect(phonemize("10 L", "hi")).toBe("d̪ˈəs lˈiːʈəɾ");
        // ⚠ हेक्टेयर, NOT हेक्टर — the latter probes HIGHER (56/12) and is HECTOR, the Trojan prince.
        expect(phonemize("10 ha", "hi")).toBe("d̪ˈəs ɦˈeːkʈeːjəɾ");
        // ग्राम is a homograph — most of its wiki tokens are ग्राम पंचायत, "village council" — which is
        // harmless in this slot, since the key emits the word only after a number.
        expect(phonemize("10 g", "hi")).toBe("d̪ˈəs ɡɾˈaːm");
    });

    test("⚠ accented Latin stays ONE word for the foreign reader (17 languages)", () => {
        // `[A-Za-z]+` ended the token at a diacritic, so the letter carrying it became an unclaimed gap read as
        // an English LETTER NAME and the rest of the word started over: `São Paulo` read *ˈɛs ˈə ˈoᶷ pʰˈɔːloᶷ* —
        // "ES ə O Paulo". Invisible to every gate: no digit or raw mark survives and nothing VANISHES, so it is a
        // WRONG-WORD defect neither the leak classes nor the differential DROP test can reach.
        // This group already means FOREIGN (its match goes to the injected reader), so widening it is the whole
        // fix — unlike Indonesian, whose Latin group is its NATIVE word group and needed a routing decision too.
        for (const lang of ["hi", "mr", "ne", "gu", "pa", "or"])
            expect(phonemize("São Paulo", lang), lang).toBe(phonemize("São Paulo", "en"));
        // Reaches every language composing `makeNativeHindi`, plus pa and or which carry their own tokenizer.
        expect(phonemize("शहर São Paulo में", "hi")).toContain("sˈaᶷ pʰˈɔːloᶷ");
        // ASCII Latin still spells as an initialism, and the native path is untouched.
        expect(phonemize("शहर GPS में", "hi")).toContain("d͡ʒˈiː pʰˈiː ˈɛs");
        expect(phonemize("शहर में", "hi")).toBe("ʃˈɛɦɛɾ mˈeː̃");
    });
});

/**
 * ⚠ ज्ञ IS NOT ITS PARTS. Composed literally the ligature is ज (d͡ʒ) + halant + ञ (ɲ) → `d͡ʒɲ`, which
 * is not how Modern Standard Hindi says it. It is /ɡj/ — gyaan, vigyaan, vaigyaanik, gyaat.
 *
 * 73 of 73 FLEURS hi_in rows containing ज्ञ were wrong. The recognizer settled it: for ज्ञात we wrote
 * `d͡ʒɲˈaːt̪` and the audio came back `ɡ i a t`.
 *
 * ⚠ SCOPED TO HINDI ON PURPOSE. Marathi reads the SAME ligature as `dnya`, so this cannot move to the
 * shared Devanagari layer — the mr expectations below are the guard on that.
 */
describe("the ज्ञ ligature reads /ɡj/, not its component letters", () => {
    test("every shape it takes in the corpus", async () => {
        expect(await phonemize("ज्ञान", "hi")).toBe("ɡjˈaːn");
        expect(await phonemize("विज्ञान", "hi")).toBe("ʋɪɡjˈaːn");
        expect(await phonemize("वैज्ञानिक", "hi")).toBe("ʋˈɛːɡjaːnɪk");
        expect(await phonemize("ज्ञात", "hi")).toBe("ɡjˈaːt̪");
        expect(await phonemize("अज्ञात", "hi")).toBe("əɡjˈaːt̪");
        // word-final, where the schwa has already gone
        expect(await phonemize("विशेषज्ञ", "hi")).toBe("ʋɪʃeːʃˈəɡj");
        expect(await phonemize("गणितज्ञ", "hi")).toBe("ɡəɳɪt̪ˈəɡj");
    });

    test("a plain ज is untouched", async () => {
        expect(await phonemize("जान", "hi")).toBe("d͡ʒˈaːn");
        expect(await phonemize("जाना", "hi")).toBe("d͡ʒˈaːnaː");
    });

    test("⚠ Marathi says dnya and must NOT inherit this", async () => {
        expect(await phonemize("ज्ञान", "mr")).not.toContain("ɡj");
        expect(await phonemize("विज्ञान", "mr")).not.toContain("ɡj");
    });
});
