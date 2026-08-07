import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/cherokee/cherokee.ts";
import { numberToWords } from "../src/languages/cherokee/numbers.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Cherokee / ᏣᎳᎩ (chr) — Iroquoian, the Cherokee syllabary. AUTHORED from
// Montgomery-Anderson, *A Reference Grammar of Oklahoma Cherokee*. ⚠ The syllabary is a SHALLOW PHONEMIC
// SKELETON — it marks no tone, length, aspiration, glottal stop or intrusive-h — so these goldens are the
// SEGMENTAL melody only (obstruents phonemically VOICELESS: aspiration-not-voicing).
// Referees: wikipron chr_cher_broad + kaikki.
describe("Cherokee (ᏣᎳᎩ) canonical IPA", () => {
    test("core words", () => {
        expect(phonemizeWord("ᏣᎳᎩ")).toBe("t͡salaki"); // 'Cherokee' — Ꮳtsa Ꮃla Ꭹgi; ⟨ts⟩=[t͡s], g-series=[k]
        expect(phonemizeWord("ᎠᎹ")).toBe("ama"); // 'water'
        expect(phonemizeWord("ᎠᏍᎦᏯ")).toBe("askaja"); // 'man' — bare Ꮝ=/s/, Ꭶga=[k], Ꮿya=[j]
        expect(phonemizeWord("ᎦᏬᏂᎯᏍᏗ")).toBe("kawonihisti"); // 'speech' — Ꮧdi=[t] (unaspirated)
        expect(phonemizeWord("ᎤᏔᎾ")).toBe("utʰana"); // 'big' — Ꮤta = the ASPIRATED split-cell [tʰ]
    });

    test("the 6th vowel ⟨v⟩ → [ə̃] (nasal mid-central) + MV", () => {
        expect(phonemizeWord("ᎬᎾ")).toBe("kə̃na"); // 'turkey' — Ꭼgv = k + ⟨v⟩[ə̃]
        expect(phonemizeWord("Ᏽ")).toBe("mə̃"); // CHEROKEE LETTER MV (U+13F5, added post-grammar)
    });

    test("aspiration split-cells + labialised velar + lateral affricate", () => {
        expect(phonemizeWord("Ꭷ")).toBe("kʰa"); // Ꭷ = /kha/ [kʰa] (vs Ꭶ ga = [ka])
        expect(phonemizeWord("Ꮖ")).toBe("kʷa"); // ⟨qua⟩ = labialised velar [kʷ]
        expect(phonemizeWord("Ꮬ")).toBe("t͡ɬa"); // ⟨dla⟩ = lateral affricate [t͡ɬ]
        expect(phonemizeWord("Ꮝ")).toBe("s"); // the bare Ꮝ = /s/ (the only non-CV character)
    });

    test("Cherokee Supplement lowercase folds onto the main block", () => {
        expect(phonemizeWord("ꭰꮉ")).toBe("ama"); // U+AB70.. → U+13A0.. via toUpperCase
    });

    test("registry wiring", () => {
        expect(getPhonemizer("chr").text("ᏣᎳᎩ").trim()).toBe("t͡salaki");
    });
});

// ---------------------------------------------------------------------------------------------------------
// Cardinal numbers, in the SYLLABARY (the engine reads no other script). DECIMAL; the tens CLIP before a
// unit (ᏔᎵᏍᎪᎯ 20 → ᏔᎵᏍᎪ ᏌᏊ 21) and the hundreds suffix ᏥᏆ to the TENS word. Every form 1–100 below is
// copied from the Cherokee Nation Language Department poster "Numbers 1 – 100 written in the Cherokee
// syllabary" (language.cherokee.org/posters/syllabary-and-numbers/) and cross-checked against
// Montgomery-Anderson pp. 517–519 (ex. 52–55, after Pulte & Feeling 1975:228–229). 200–1000 come from
// Wiktionary/Omniglot; ≥ 10⁶ is a deliberate digit-by-digit fallback. See numbers.ts for the disclosures.
describe("Cherokee numbers", () => {
    for (const [n, expected] of [
        [0, "ᏃᏘ"],                      // ⟨noti⟩, a borrowing from English "nought" (Wiktionary)
        [1, "ᏌᏊ"],
        [7, "ᎦᎵᏉᎩ"],
        [8, "ᏣᏁᎳ"],                     // ⟨chaneela⟩ per the poster + the grammar (not ᏧᏁᎳ)
        [10, "ᏍᎪᎯ"],
        [11, "ᏌᏚ"],                     // the suppletive teens, not derivable from the units
        [15, "ᏍᎩᎦᏚ"],
        [19, "ᏐᏁᎳᏚ"],
        [20, "ᏔᎵᏍᎪᎯ"],
        [21, "ᏔᎵᏍᎪ ᏌᏊ"],                // the CLIPPED tens word: ᏔᎵᏍᎪᎯ → ᏔᎵᏍᎪ
        [42, "ᏅᎩᏍᎪ ᏔᎵ"],
        [99, "ᏐᏁᎳᏍᎪ ᏐᏁᎳ"],
        [100, "ᏍᎪᎯᏥᏆ"],                 // ⟨skohitskwa⟩ = ᏍᎪᎯ + ᏥᏆ
        [101, "ᏍᎪᎯᏥᏆ ᏌᏊ"],
        [200, "ᏔᎵᏍᎪᎯᏥᏆ"],               // the hundred word is the TENS word for N×10 + ᏥᏆ
        [555, "ᎯᏍᎩᏍᎪᎯᏥᏆ ᎯᏍᎩᏍᎪ ᎯᏍᎩ"],
        [999, "ᏐᏁᎳᏍᎪᎯᏥᏆ ᏐᏁᎳᏍᎪ ᏐᏁᎳ"],
        [1000, "ᎢᏯᎦᏴᎵ"],                // bare ⟨iyagayvli⟩
        [1001, "ᎢᏯᎦᏴᎵ ᏌᏊ"],
        [12345, "ᏔᎵᏚ ᎢᏯᎦᏴᎵ ᏦᏍᎪᎯᏥᏆ ᏅᎩᏍᎪ ᎯᏍᎩ"], // the thousands count is the teen ᏔᎵᏚ '12'
    ] as const) {
        test(`${n} → ${expected}`, () => expect(numberToWords(n)).toBe(expected));
    }

    test("no gaps or sentinels across 0..20000", () => {
        for (let n = 0; n <= 20000; n++) expect(numberToWords(n), `n=${n}`).not.toMatch(/undefined|NaN|[0-9]/);
    });

    // No modern million word is trusted (the 1828 Cherokee Phoenix has ᎠᎦᏴᎵᏯ but calls it "not universally
    // known"), so 10⁶ and above read digit-by-digit — deliberately, not as a bug.
    test("above the attested range → digit-by-digit", () => {
        expect(numberToWords(1000000)).toBe("ᏌᏊ ᏃᏘ ᏃᏘ ᏃᏘ ᏃᏘ ᏃᏘ ᏃᏘ");
    });

    test("end-to-end: the numeral is phonemized, not passed through as digits", () => {
        expect(phonemize("21", "chr")).toBe("tʰalisko sakʷu");
        expect(phonemize("100", "chr")).toBe("skohit͡sikʷa");
    });
});
