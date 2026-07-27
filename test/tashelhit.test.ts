import { describe, expect, test } from "vitest";

import { createTashelhit, phonemizeWord } from "../src/languages/tashelhit/tashelhit.ts";

// Tashelhit / Shilha (shi) — Taclḥit, a Berber (Amazigh) language of SW Morocco (~7–9M). A near-1:1 phonemic
// Berber-Latin → IPA converter: emphatics (dot-below) ḍ→dˤ etc., pharyngeals ḥ→ħ / ɛ→ʕ, uvulars ɣ/x→χ/q, c→ʃ;
// labialisation C+ʷ→Cʷ; gemination (doubling)→Cː. Validated against wikipron shi_latn (97.4% folded / 99.4% symbol)
// + kaikki Tashelhit (97.8%/99.5%) — both Wiktionary → 🔷 single-source-family. See docs/investigations/shi_native_bringup_investigation.md.
describe("Tashelhit (Shilha) canonical IPA — Berber Latin → IPA converter", () => {
    const shi = createTashelhit();

    test("emphatics (pharyngealised, dot-below), pharyngeals, uvulars", () => {
        expect(phonemizeWord("aḍaṛ")).toBe("adˤarˤ"); // ⟨ḍ⟩→dˤ, ⟨ṛ⟩→rˤ ("foot/leg")
        expect(phonemizeWord("Taclḥit")).toBe("taʃlħit"); // ⟨c⟩→ʃ, ⟨ḥ⟩→ħ (the endonym)
        expect(phonemizeWord("amaziɣ")).toBe("amaziɣ"); // ⟨ɣ⟩→ɣ ("Amazigh/Berber")
        expect(phonemizeWord("aɣrum")).toBe("aɣrum"); // ("bread")
    });

    test("gemination (doubling) → a long consonant [Cː], incl. emphatic + labialised geminates", () => {
        expect(phonemizeWord("azz")).toBe("azː"); // ⟨zz⟩ → zː
        expect(phonemizeWord("abaṭṭaḥ")).toBe("abatˤːaħ"); // ⟨ṭṭ⟩ emphatic geminate → tˤː
        expect(phonemizeWord("aggʷrn")).toBe("aɡʷːrn"); // ⟨ggʷ⟩ labialised geminate → ɡʷː
        expect(phonemizeWord("akkʷ")).toBe("akʷː"); // ⟨kkʷ⟩ → kʷː
    });

    test("labialisation C+⟨ʷ⟩ → [Cʷ]; ⟨e⟩→schwa; ⟨y⟩→j", () => {
        expect(phonemizeWord("awal")).toBe("awal"); // ⟨w⟩→w ("word/speech")
        expect(phonemizeWord("tamdint")).toBe("tamdint"); // ("town/city")
    });

    test("clause assembly", () => {
        expect(createTashelhit().text("Taclḥit d awal amaziɣ.").replace(/\s+/g, " ").trim())
            .toBe("taʃlħit d awal amaziɣ ."); // "Tashelhit is an Amazigh language"
    });

    test("the text() path handles NFD input (combining dot-below U+0323 emphatics)", () => {
        // Regression: the tokenizer must NFC-normalize, else combining dot-below shatters the word + drops emphatics.
        const nfd = "aḍaṛ".normalize("NFD");
        expect(createTashelhit().text(nfd).trim()).toBe("adˤarˤ"); // not "ad ar"
    });

    test("Tifinagh (ⵜⵉⴼⵉⵏⴰⵖ) front-end — script auto-detected, IDENTICAL IPA to the Latin path", () => {
        // Neo-Tifinagh (Morocco's official IRCAM script) is a phonemic alphabet → same phonology, same IPA.
        expect(phonemizeWord("ⵜⴰⵛⵍⵃⵉⵜ")).toBe("taʃlħit"); // = Taclḥit (the endonym)
        expect(phonemizeWord("ⴰⴹⴰⵕ")).toBe("adˤarˤ"); // = aḍaṛ (emphatics ⴹ→dˤ, ⵕ→rˤ)
        expect(phonemizeWord("ⴰⵎⴰⵣⵉⵖ")).toBe("amaziɣ"); // = amaziɣ
        expect(phonemizeWord("ⵜⴰⵛⵍⵃⵉⵜ")).toBe(phonemizeWord("Taclḥit")); // Tifinagh ≡ Latin
        expect(createTashelhit().text("ⵜⴰⵛⵍⵃⵉⵜ ⴷ ⴰⵡⴰⵍ").trim()).toBe("taʃlħit d awal"); // mixed clause
    });
});
