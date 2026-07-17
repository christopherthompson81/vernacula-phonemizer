import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/swahili/swahili.ts";

// Canonical-IPA goldens for Swahili / Kiswahili (sw) — Bantu, highly phonemic Latin orthography, no tone, regular
// penultimate stress. Validated against wikipron swa (93.5%) + kaikki swa (97.8%), both human. The distinctive
// segments: IMPLOSIVE voiced stops (ɓ ɗ ʄ ɠ), PRENASALIZED stops (ᵐb ⁿd ⁿd͡ʒ ᵑɡ), ⟨ng'⟩→ŋ vs ⟨ng⟩→ᵑɡ, syllabic
// nasals (m̩ n̩), long vowels from ⟨aa⟩ etc., Cʷ labialization. See docs/investigations/sw_native_bringup_investigation.md.
describe("swahili canonical IPA", () => {
    test("implosives, prenasalized stops, syllabic nasals", () => {
        const cases: [string, string][] = [
            ["baba", "ɓˈɑɓɑ"], // implosive b→ɓ
            ["dada", "ɗˈɑɗɑ"], // implosive d→ɗ
            ["jambo", "ʄˈɑᵐbɔ"], // implosive ʄ + prenasal ᵐb
            ["ngoma", "ᵑɡˈɔmɑ"], // prenasal ᵑɡ
            ["simba", "sˈiᵐbɑ"],
            ["ndege", "ⁿdˈɛɠɛ"], // prenasal ⁿd + implosive ɠ
            ["njia", "ⁿd͡ʒˈiɑ"], // prenasal ⁿd͡ʒ
            ["mtu", "ˈm̩tu"], // syllabic m̩ (nasal before a non-homorganic consonant)
            ["nchi", "ˈn̩t͡ʃi"], // syllabic n̩
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("ng' (velar nasal) vs ng (prenasalized), long vowels, labialization", () => {
        expect(phonemizeWord("ng'ombe")).toBe("ŋˈɔᵐbɛ"); // ⟨ng'⟩ → ŋ
        expect(phonemizeWord("ngoma")).toBe("ᵑɡˈɔmɑ"); // ⟨ng⟩ → ᵑɡ
        expect(phonemizeWord("kuu")).toBe("kˈuː"); // ⟨uu⟩ → long uː
        expect(phonemizeWord("mwezi")).toBe("mʷˈɛzi"); // ⟨mw⟩ → labialized mʷ
        expect(phonemizeWord("kweli")).toBe("kʷˈɛli"); // ⟨kw⟩ → kʷ
        expect(phonemizeWord("chakula")).toBe("t͡ʃɑkˈulɑ"); // ⟨ch⟩ → t͡ʃ
        expect(phonemizeWord("habari")).toBe("hɑɓˈɑɾi"); // ⟨r⟩ → tap ɾ
    });

    test("numbers (standard, joined by na)", () => {
        expect(phonemize("11", "sw")).toBe("kˈumi nˈɑ mˈɔʄɑ"); // kumi na moja
        expect(phonemize("21", "sw")).toBe("iʃiɾˈini nˈɑ mˈɔʄɑ"); // ishirini na moja
        expect(phonemize("100", "sw")).toBe("mˈiɑ mˈɔʄɑ"); // mia moja
        expect(phonemize("1000", "sw")).toBe("ˈɛlfu mˈɔʄɑ"); // elfu moja
    });

    test("running text: penultimate stress", () => {
        expect(phonemize("Watoto wanacheza.", "sw")).toContain(
            "wɑtˈɔtɔ wɑnɑt͡ʃˈɛzɑ",
        );
    });
});
