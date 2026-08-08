import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

import { phonemizeWord, createAbkhaz } from "../src/languages/abkhaz/abkhaz.ts";

// Canonical-IPA goldens for Abkhaz (ab) — аҧсуа бызшәа, a Northwest Caucasian language with one of
// the world's largest consonant inventories and just 2 vowels (⟨а⟩→[a], ⟨ы⟩→[ə]). The Cyrillic writes consonants with
// base letters + MODIFIER letters: ⟨ь⟩ palatalizes, ⟨ә⟩ labializes, ⟨'⟩ pharyngealizes. Three-way voiced/aspirated/
// ejective stops. Referee: wikipron abk_cyrl broad + kaikki.
describe("Abkhaz (аҧсуа бызшәа) canonical IPA", () => {
    test("the THREE-WAY stop/affricate series (voiced / aspirated / ejective)", () => {
        expect(phonemizeWord("акы")).toBe("akʼə"); // ⟨к⟩→[kʼ] EJECTIVE; ⟨ы⟩→[ə]
        expect(phonemizeWord("аӡын")).toBe("ad͡zən"); // ⟨ӡ⟩→[d͡z] voiced affricate
        expect(phonemizeWord("аҵла")).toBe("at͡sʼla"); // ⟨ҵ⟩→[t͡sʼ] ejective affricate
        expect(phonemizeWord("аҷкәын")).toBe("at͡ʃʼkʼʷən"); // ⟨ҷ⟩→[t͡ʃʼ], ⟨кә⟩→[kʼʷ] labialized ejective
        expect(phonemizeWord("аҳ")).toBe("aħ"); // ⟨ҳ⟩→[ħ] pharyngeal
    });

    test("the MODIFIERS — ⟨ь⟩ palatal, ⟨ә⟩ labial, ⟨'⟩ pharyngeal", () => {
        expect(phonemizeWord("аҟәа")).toBe("aqʼʷa"); // 'Sukhum' — ⟨ҟә⟩→[qʼʷ] labialized uvular ejective
        expect(phonemizeWord("ажәабжь")).toBe("aʒʷabʒ"); // ⟨жә⟩→[ʒʷ], ⟨жь⟩→[ʒ]
        expect(phonemizeWord("ахәыҷ")).toBe("aχʷət͡ʃʼ"); // ⟨хә⟩→[χʷ]
        expect(phonemizeWord("аҭаацәа")).toBe("atʰaat͡ɕʷʰa"); // ⟨ҭ⟩→[tʰ], ⟨цә⟩→[t͡ɕʷʰ]
    });

    test("the endonym + base letters", () => {
        expect(phonemizeWord("аҧсуа")).toBe("apʰswa"); // 'Abkhaz' — ⟨ҧ⟩→[pʰ] aspirated
        expect(phonemizeWord("бызшәа")).toBe("bəzʃʷa"); // 'language' — ⟨шә⟩→[ʃʷ]
    });

    test("palatalized dorsals (dorsal + ʲ) + the ⟨у⟩/⟨и⟩ glide rule", () => {
        expect(phonemizeWord("зегьы")).toBe("zeɡʲə"); // ⟨гь⟩→[ɡʲ] (VOICED dorsal+ʲ, not the voiceless palatal [c])
        expect(phonemizeWord("аи")).toBe("aj"); // ⟨и⟩ next to a vowel → the glide [j]
        expect(phonemizeWord("иҭабуп")).toBe("itʰabupʼ"); // ⟨у⟩ between consonants → syllabic [u] (not the glide [w])
        expect(phonemizeWord("х’а")).toBe("χˤa"); // the CURLY apostrophe ’ still pharyngealizes ⟨х⟩→[χˤ]
    });

    // VIGESIMAL cardinal numbers (numbers.ts). 20–99 is score·20 + a 1–19 remainder, the score in its -и
    // connective form (ҩажәа → ҩажәи); the same -и marks a non-final hundred (шәкы → шәи акы). Thousands are FUSED
    // for a multiplier of 1–10 and for exactly 100; any other multiplier takes the separate word нызқь. The
    // NON-HUMAN / abstract class series is the bare-numeral citation form.
    test("cardinal numbers are VIGESIMAL: score·20 + remainder with the -и connective", () => {
        const ab = createAbkhaz();
        expect(ab.text("7").trim()).toBe("bəʒba"); // быжьба
        expect(ab.text("20").trim()).toBe("ɥaʒʷa"); // ҩажәа — the bare score
        expect(ab.text("21").trim()).toBe("ɥaʒʷi akʼə"); // ҩажәи акы = 20 + 1
        expect(ab.text("30").trim()).toBe("ɥaʒʷi ʒʷaba"); // ҩажәи жәаба = 20 + 10 (no "thirty" word)
        expect(ab.text("45").trim()).toBe("ɥənɥaʒʷi χʷba"); // ҩынҩажәи хәба = 2×20 + 5
        expect(ab.text("50").trim()).toBe("ɥənɥaʒʷi ʒʷaba"); // ҩынҩажәи жәаба = 2×20 + 10
        expect(ab.text("67").trim()).toBe("χənɥaʒʷi bəʒba"); // хынҩажәи быжьба = 3×20 + 7
        expect(ab.text("89").trim()).toBe("pʰʃənɥaʒʷi ʒʷba"); // ԥшьынҩажәи жәба = 4×20 + 9
        expect(ab.text("99").trim()).toBe("pʰʃənɥaʒʷi zejʒʷ"); // ԥшьынҩажәи зеижә = 4×20 + 19 (a TEEN attaches too)
    });

    test("cardinal numbers: hundreds with the -и connective, FUSED thousands, millions", () => {
        const ab = createAbkhaz();
        expect(ab.text("100").trim()).toBe("ʃʷkʼə"); // шәкы
        expect(ab.text("101").trim()).toBe("ʃʷi akʼə"); // шәи акы — the hundred takes -и before a remainder
        expect(ab.text("999").trim()).toBe("ʒʷʃʷi pʰʃənɥaʒʷi zejʒʷ"); // жәшәи ԥшьынҩажәи зеижә
        expect(ab.text("1000").trim()).toBe("zkʰʲə"); // зқьы
        expect(ab.text("1001").trim()).toBe("zkʰʲə akʼə"); // зқьы акы — the thousand does NOT take -и
        expect(ab.text("2000").trim()).toBe("ɥnəzkʰʲ"); // ҩнызқь — FUSED multiplier+нызқь
        expect(ab.text("100000").trim()).toBe("ʃʷnəzkʰʲ"); // шәнызқь — likewise fused
        expect(ab.text("12345").trim()).toBe("ʒʷaɥa nəzkʰʲ χəʃʷi ɥənɥaʒʷi χʷba"); // жәаҩа нызқь хышәи ҩынҩажәи хәба
        expect(ab.text("1000000").trim()).toBe("milljon"); // миллион (Russian loan)
        expect(ab.text("1000000000").trim()).toBe("milljard"); // миллиард
    });
    // ── TEXT NORMALIZATION ─────────────────────────────────────────────────────────────────────────────
    // Counts are over tools/corpus/mined/ab.jsonc (an ab.wikipedia dump). Each rule answers a MEASURED
    // defect, listed in normalize.ts's header — this is the playbook's step 2, pinned.
    test("normalization: the decimal comma is not a clause pause", () => {
        const ab = createAbkhaz();
        // ×120, the commonest numeric form after bare digit runs. It reached clause punctuation and became
        // a sentence break INSIDE a number: 11,3 → "ʒʷejza , χpʰa".
        // ⚠ NO DECIMAL-POINT WORD IS SOURCEABLE for ab (sources.ts: no espeak — it does not ship Abkhaz —
        // and no manifest word), so the fraction is read DIGIT BY DIGIT with no invented connective.
        expect(ab.text("11,3 км").trim()).toBe("ʒʷejza χpʰa kʼm");
        expect(ab.text("0,723").trim()).toBe("anolʲ bəʒba ɥba χpʰa");
    });

    test("normalization: a grouped numeral is ONE number", () => {
        const ab = createAbkhaz();
        // ×13. The group split and the second half read as the WORD zero: 125 000 → "…χʷba anolʲ".
        expect(ab.text("125 000 ҩык").trim()).toBe("ʃʷi ɥaʒʷi χʷba nəzkʰʲ ɥəkʼ");
    });

    test("normalization: a range takes its attested connectives", () => {
        const ab = createAbkhaz();
        // ×71. Both words are the corpus's own, in this exact frame: инаркны ×25 "from", рҟынӡа ×25 "to".
        expect(ab.text("10-11 ашә.").trim()).toBe("ʒʷaba inarkʼnə ʒʷejza rqʼənd͡za aʃʷəʂəkʷʰsa");
    });

    test("normalization: ⟨N-тәи⟩ is the ordinal, а + cardinal + тәи", () => {
        const ab = createAbkhaz();
        // ×36 over 12 distinct values. The suffix used to become a separate word: 6-тәи → "fba tʷʼi".
        expect(ab.text("6-тәи").trim()).toBe("afbatʷʼi"); // corpus spells афбатәи
        expect(ab.text("19-тәи").trim()).toBe("azejʒʷtʷʼi");
        expect(ab.text("1-тәи").trim()).toBe("akʼtʷʼi"); // ⚠ suppletive актәи, not *акытәи from акы
    });

    test("normalization: the year and century abbreviations expand", () => {
        const ab = createAbkhaz();
        // ×125. ⟨ш.⟩ read as a bare letter and its dot as a full stop mid-date. The expansions are the
        // corpus's own spellings (шықәса ×35 inflected, ашәышықәса ×16).
        expect(ab.text("1452ш.").trim()).toBe("zkʰʲə pʰʃəʃʷi ɥənɥaʒʷi ʒʷaɥa ʂəkʷʰsa");
        expect(ab.text("1908-1915 шш.").trim()).toContain("ʂəkʷʰsakʷʰa");
    });

    test("normalization: what it must NOT touch", () => {
        const ab = createAbkhaz();
        // ⚠ ROMAN NUMERALS ARE A REGISTRY-LEVEL SEAM, not an engine one: registry.ts wraps text() with
        // normalizeRomans, so this must be probed through phonemize() — createAbkhaz().text() never sees
        // the conversion and drops the Latin run instead. Pinned because the normalizer must not disturb
        // the input the wrapper hands it.
        expect(phonemize("XX ашәышықәса", "ab").trim()).toBe("ɥaʒʷa aʃʷəʂəkʷʰsa");
        // A hyphenated WORD is not a range: the guard requires digits on both sides.
        expect(ab.text("аԥсуа-аурыс").trim()).not.toContain("inarkʼnə");
    });

});
