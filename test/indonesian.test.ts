import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import {
    phonemizeWord,
    phonemizeWordRules,
} from "../src/languages/indonesian/indonesian.ts";

// Canonical-IPA goldens for Indonesian (id) — shallow near-phonemic Latin orthography, rule-based G2P.
// Digraphs ng→ŋ, ny→ɲ, sy→ʃ, kh→x; c→t͡ʃ, j→d͡ʒ; ⟨e⟩→schwa [ə] by default (the pepet); tense vowels (the
// closed-syllable lax allophones are folded in the eval, not emitted); syllable-final ⟨k⟩ → glottal stop [ʔ];
// penultimate stress (shifts off a schwa nucleus). See docs/id_native_bringup_investigation.md.
describe("indonesian canonical IPA", () => {
    test("digraphs, c/j, ⟨e⟩→schwa, final-k glottal stop", () => {
        const cases: [string, string][] = [
            ["makan", "mˈakan"], // penult stress
            ["dengan", "dəŋˈan"], // ng→ŋ, ⟨e⟩→ə, schwa penult shifts stress to final
            ["kecil", "kət͡ʃˈil"], // c→t͡ʃ, tense i (lax folded in eval)
            ["banyak", "bˈaɲaʔ"], // ny→ɲ, final k→ʔ
            ["tidak", "tˈidaʔ"], // final k→ʔ
            ["belajar", "bəlˈad͡ʒar"], // j→d͡ʒ
            ["sekolah", "səkˈolah"], // ⟨e⟩→ə
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("acronyms spelled letter-by-letter", () => {
        expect(phonemizeWord("DPK")).toBe("depeka"); // de-pe-ka
        expect(phonemizeWord("AKP")).toBe("akape"); // a-ka-pe
    });

    test("⟨e⟩ taling lexicon (cross-source consensus) overrides the pepet default", () => {
        // Latin ⟨e⟩ conflates pepet /ə/ (rule default) and taling /e/~/ɛ/ (lexical). The shipped path pins the
        // taling quality where wikipron ∩ kaikki agree; phonemizeWordRules keeps the pepet default.
        expect(phonemizeWord("absen")).toBe("ˈabsen"); // taling /e/
        expect(phonemizeWordRules("absen")).toBe("ˈabsən"); // rule default (pepet)
        expect(phonemizeWord("ablepsia")).toBe("ablɛpsˈia"); // taling /ɛ/ preserved
        expect(phonemizeWord("abonemen")).toBe("abonəmˈɛn"); // mixed: pepet then taling
        // Genuine pepet words stay pepet (not over-pinned):
        expect(phonemizeWord("sekolah")).toBe("səkˈolah");
        // Number words bypass the lexicon (their ⟨e⟩ is pepet):
        expect(phonemize("6", "id")).toBe("ənˈam");
    });

    test("numbers (regular, compositional) + text", () => {
        expect(phonemize("21", "id")).toBe("dˈua pˈuluh sˈatu"); // dua puluh satu
        expect(phonemize("saya makan.", "id")).toContain("mˈakan");
    });
});
