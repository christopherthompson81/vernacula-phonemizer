import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/cherokee/cherokee.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Cherokee / ᏣᎳᎩ (chr) — Iroquoian (the fleet's FIRST), the Cherokee syllabary.
// AUTHORED from Montgomery-Anderson, *A Reference Grammar of Oklahoma*. The syllabary is a SHALLOW PHONEMIC
// SKELETON — it marks no tone, length, aspiration, glottal stop or intrusive-h — so these goldens are the
// SEGMENTAL melody (obstruents phonemically VOICELESS: aspiration-not-voicing). Both referees (wikipron
// chr_cher_broad + kaikki) corroborate at ~91% folded / ~97% symbol. See
// docs/investigations/chr_native_bringup_investigation.md.
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
