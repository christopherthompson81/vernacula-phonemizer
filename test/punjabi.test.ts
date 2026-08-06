import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/punjabi/punjabi.ts";

// Canonical-IPA goldens for Punjabi (pa), Gurmukhi script — a Brahmic abugida via the generic engine, plus
// Punjabi's signature TONOGENESIS: the historical voiced-aspirate letters ਘ ਝ ਢ ਧ ਭ de-aspirate and shift tone
// (voiceless + low tone ˨˩ word-initially, voiced + high-falling ˥˩ post-vocalically); addak ੱ geminates the
// following consonant (→ length ː); retroflex ʈ ɖ ɳ ɽ vs dental t̪ d̪.
describe("punjabi canonical IPA", () => {
    test("tonogenesis (voiced-aspirate de-aspiration + tone)", () => {
        expect(phonemizeWord("ਘੋੜਾ")).toBe("kˈoː˨˩ɽaː"); // ghoṛā 'horse': word-initial gh→k + low tone
        expect(phonemizeWord("ਭਾਰਤ")).toBe("pˈaː˨˩ɾət̪"); // bhārat: bh→p + low tone
        expect(phonemizeWord("ਕੰਘਾ")).toBe("kˈə̃˥˩ŋɡaː"); // kaṅghā 'comb': medial gh→ɡ + high-falling tone
        expect(phonemizeWord("ਸਿੰਘ")).toBe("sˈɪ̃˥˩ŋɡ"); // siṅgh 'Singh': medial gh→ɡ + high tone
        expect(phonemizeWord("ਦੁੱਧ")).toBe("d̪ˈʊ˥˩d̪ː"); // duddh 'milk': addak + dh→d̪ + high tone
    });

    test("abugida core: retroflex/dental, addak gemination, nasal", () => {
        expect(phonemizeWord("ਵੱਡਾ")).toBe("ʋˈəɖːaː"); // vaḍḍā 'big': addak → retroflex geminate ɖː
        expect(phonemizeWord("ਪਾਣੀ")).toBe("pˈaːɳiː"); // pāṇī 'water': retroflex ɳ
        expect(phonemizeWord("ਪੰਜਾਬੀ")).toBe("pˈə̃ɲd͡ʒaːbiː"); // panjābī: tippi → homorganic ɲ before d͡ʒ
    });

    test("text: word run + Gurmukhi danda", () => {
        expect(phonemize("ਪੰਜਾਬੀ ਬੋਲੀ।", "pa")).toContain("d͡ʒaːbiː");
    });
});

// Shahmukhi (Perso-Arabic) is the SECOND script Punjabi is written in (Pakistan). The abjad front-end
// (shahmukhi.ts) feeds the SAME shared Punjabi phonology, so a Shahmukhi spelling with its vowels written yields
// the SAME canonical IPA as the Gurmukhi one — one phonology, two scripts. The abjad omits most short vowels, so
// undiacritized text falls back to the default schwa (the shared restoration gap, as for Urdu).
describe("punjabi Shahmukhi front-end", () => {
    test("script parity: same IPA as Gurmukhi (tonogenesis + retroflex + gemination carry through)", () => {
        expect(phonemizeWord("گھوڑا")).toBe("kˈoː˨˩ɽaː"); // ghoṛā: bh-init de-aspirate → k + low tone
        expect(phonemizeWord("بھارت")).toBe("pˈaː˨˩ɾət̪"); // bhārat: bh→p + low tone
        expect(phonemizeWord("پاݨی")).toBe("pˈaːɳiː"); // pāṇī: Punjabi-specific ݨ → retroflex ɳ
        expect(phonemizeWord("وڈّا")).toBe("ʋˈəɖːaː"); // vaḍḍā: word-initial و glide + shadda → geminate ɖː
        expect(phonemizeWord("یار")).toBe("jˈaːɾ"); // yār: word-initial ی → glide j
    });

    test("homorganic nasal: generic ن assimilates before velar/palatal (abjad has no tippi)", () => {
        // Assert the ASSIMILATION property (ن→ŋ before velar گ), not the exact short vowel — that only surfaces
        // when the schwa between ن and گ is deleted, which the coverage lexicon / an explicit sukun supplies.
        // vowel-agnostic on purpose: the mined vowel for this word (سُنگھی, ʊ) is a noisy referee artifact.
        expect(phonemizeWord("سنگھی")).toContain("ŋɡ"); // saṅghī: نگ → ŋɡ + medial gh high tone
        // panjābī: نج → ɲd͡ʒ. Covered by the CROSS-SCRIPT lexicon (پنجابی ⇄ ਪੰਜਾਬੀ) → the richer Gurmukhi-sourced
        // form pˈə̃ɲd͡ʒaːbiː (with the nasal ə̃ the abjad drops); assert the assimilation property, not exact stress.
        expect(phonemizeWord("پنجابی")).toContain("ɲd͡ʒ");
    });

    test("text: Shahmukhi word run + Urdu punctuation", () => {
        expect(phonemize("پنجابی بولی۔", "pa")).toBe("pəɲd͡ʒˈaːbiː bˈoːliː");
    });
});

// #562 TEXT NORMALIZATION. Counts in the comments are measured over the pa_in FLEURS corpus (1,589 unique
// utterances); "before" is what the engine produced at 6621b5a. See src/languages/punjabi/normalize.ts.
describe("punjabi text normalization", () => {
    test("fused 21-59 cardinals (compound map) — the corpus's largest defect, ×143", () => {
        // 21 was [ˈɪkː ʋˈiːɦ], "one twenty": core/numbers.ts's unit-then-tens fallback. Punjabi's 21-99 are
        // single words, sourced from pa.wikipron-pan-broad.tsv (see punjabi.jsonc).
        expect(phonemize("21", "pa")).toBe("ˈɪkːiː"); // ਇੱਕੀ
        expect(phonemize("36", "pa")).toBe("t͡ʃʰˈət̪ːiː"); // ਛੱਤੀ
        expect(phonemize("56", "pa")).toBe("t͡ʃʰəpˈə̃ɲd͡ʒaː"); // ਛਪੰਜਾ
        expect(phonemize("1947", "pa")).toContain("sˈə̃n̪t̪aːɭiː"); // …ਸੰਤਾਲ਼ੀ, was "…ਸੱਤ ਚਾਲੀ"
        expect(phonemize("76", "pa")).toBe("t͡ʃʰˈɪɦət̪ːəɾ"); // ਛਿਹੱਤਰ, was "ਛੇ ਸੱਤਰ" (six seventy)
        expect(phonemize("69", "pa")).toBe("ˈʊɳɦət̪ːəɾ"); // ਉਣ੍ਹੱਤਰ
        expect(phonemize("61", "pa")).toBe("ɪkˈaːɦəʈʰ");
        expect(phonemize("71", "pa")).toBe("ˈɪkɦət̪ːəɾ");
        // 85 and 96 are deliberately LEFT OUT (no spelling reaches two witnesses; 96's only Wiktionary
        // title is malformed). They keep the two-word fallback; pinned so a future source shows up here.
        expect(phonemize("96", "pa")).toBe("t͡ʃʰˈeː nˈəbːeː");
        expect(phonemize("100", "pa")).toBe("ˈɪkː sˈɔː");
        expect(phonemize("1000", "pa")).toBe("ˈɪkː ɦəzˈaːɾ");
    });

    test("digit de-grouping ×35 — the comma was a phrase break AND truncated the numeral", () => {
        expect(phonemize("1,000", "pa")).toBe("ˈɪkː ɦəzˈaːɾ"); // was [ˈɪkː , sˈɪfəɾ] — "one, zero"
        expect(phonemize("2,500", "pa")).toBe("d̪ˈoː ɦəzˈaːɾ pˈə̃ɲd͡ʒ sˈɔː");
        expect(phonemize("5,000,000", "pa")).toBe("pə̃ɲd͡ʒˈaːɦ lˈəkʰː"); // 50 lakh, the Indic grouping
        expect(phonemize("1,00,000", "pa")).toBe("ˈɪkː lˈəkʰː"); // Indian 2-2-3 grouping too
        // A list separator is NOT grouping: the final 3-digit group is required and a space breaks the match.
        expect(phonemize("1990, 1991", "pa")).toContain(",");
    });

    test("percent and currency through the shared symbol tier", () => {
        expect(phonemize("80%", "pa")).toBe("ˈəsːiː pɾət̪ˈiːʃət̪"); // ਪ੍ਰਤੀਸ਼ਤ; the sign was DROPPED
        expect(phonemize("$5", "pa")).toBe("pˈə̃ɲd͡ʒ ɖˈaːləɾ"); // ਡਾਲਰ, postposed as the corpus writes it
    });

    test("clock ×9 — the colon was a comma pause, and :00 read as ਸਿਫ਼ਰ", () => {
        expect(phonemize("11:20 ਵਜੇ", "pa")).toBe("ɡɪˈaːɾã ʋˈiːɦ ʋˈəd͡ʒeː");
        expect(phonemize("10:00 ਵਜੇ", "pa")).toBe("d̪ˈəs ʋˈəd͡ʒeː"); // minutes drop out, not "ten zero"
        // A ratio is not a time: the corpus writes 3:2 and 2:2, and the 2-digit minute guard rejects both.
        expect(phonemize("3:2", "pa")).toContain(","); // still a pause, i.e. untouched by the clock rule
    });

    test("ordinal suffix ×24 joins to the cardinal instead of becoming its own word", () => {
        expect(phonemize("15ਵੀਂ", "pa")).toBe("pˈə̃n̪d̪əɾãʋĩ"); // was [pˈə̃n̪d̪əɾã ʋˈĩ] — two words
        expect(phonemize("18 ਵੀਂ", "pa")).toBe("əʈʰaːɾˈãʋĩ"); // a space may intervene in the corpus
        // THE TRAILING BOUNDARY: a following letter means this is an ordinary word, not a suffix.
        expect(phonemize("10 ਵਾਪਸ", "pa")).toBe("d̪ˈəs ʋˈaːpəs");
    });

    test("Gurmukhi unit abbreviations, era marker, degree and ਡਾ.", () => {
        expect(phonemize("83 ਕਿਮੀ", "pa")).toContain("kɪloːmˈiːʈəɾ"); // was read as the word [kˈɪmiː]
        expect(phonemize("6 ਸੈ.ਮੀ", "pa")).toContain("sɛ̃ʈiːmˈiːʈəɾ"); // the interior dot was a phrase break
        expect(phonemize("35 ਮਿਮੀ", "pa")).toContain("mɪliːmˈiːʈəɾ");
        expect(phonemize("1000 ਈ.ਪੂ. ਵਿੱਚ", "pa")).toContain("ˈiːsaː pˈuːɾəʋ"); // corpus's own expansion
        expect(phonemize("35°", "pa")).toBe("pˈɛ̃t̪iː ɖˈɪɡɾiː"); // the sign was dropped
        expect(phonemize("ਡਾ. ਸਿੰਘ", "pa")).toContain("ɖˈaːkʈəɾ");
        // ਸੈਮੀ and ਗ੍ਰਾ are NOT unit keys — every corpus occurrence is ਸੈਮੀਫਾਈਨਲ / ਫ਼ੋਟੋਗ੍ਰਾਫ਼ੀ, and
        // requiring a preceding digit is what keeps them out (playbook trap #2, live in this corpus).
        expect(phonemize("ਸੈਮੀਫਾਈਨਲ", "pa")).not.toContain("ʈiːmˈiːʈəɾ");
    });

    test("decimals ×13: the dot is neutralised, not spoken", () => {
        expect(phonemize("2.3", "pa")).toBe("d̪ˈoː t̪ˈɪ̃n");
        expect(phonemize("2.3 ਅਰਬ ਡਾਲਰ", "pa")).not.toContain(".");
    });

    // `ਵਰਗ ਕਿਲੋਮੀਟਰ` ×4 and `ਘਣ ਮੀਟਰ` ×1, word-first. Bare ਵਰਗ is ×12 and its first instance is
    // `ਉੱਚ ਵਰਗ` — "upper CLASS" — so only the collocation attests the unit sense.
    test("the squared/cubed measure word", () => {
        expect(phonemize("783,562 km²", "pa")).toContain("ʋˈəɾəɡ kɪloːmˈiːʈəɾ");
        expect(phonemize("120 m³", "pa")).toContain("kˈə˨˩ɳ mˈiːʈəɾ");
    });
});
