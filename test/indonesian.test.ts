import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/indonesian/indonesian.ts";

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

    test("numbers (regular, compositional) + text", () => {
        expect(phonemize("21", "id")).toBe("dˈua pˈuluh sˈatu"); // dua puluh satu
        expect(phonemize("saya makan.", "id")).toContain("mˈakan");
    });
});
