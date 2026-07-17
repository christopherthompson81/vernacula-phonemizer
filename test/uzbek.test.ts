import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/uzbek/uzbek.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Uzbek / oʻzbekcha (uz) — Turkic, modern LATIN orthography. Uzbek is the Turkic
// outlier that LOST vowel harmony (Persian/Tajik contact), so the g2p is a flat scan with fixed letter values.
// Signature: the vowel split ⟨o⟩→[ɒ] vs ⟨oʻ⟩→[o]; digraphs sh/ch/ng + the comma-letters oʻ/gʻ; the separate
// tutuq belgisi (ʼ) → glottal [ʔ]. Validated at 91.3% vs wikipron uzb_latn + 87.1% vs kaikki (folded). See
// docs/uz_native_bringup_investigation.md.
describe("Uzbek canonical IPA", () => {
    test("the vowel split ⟨o⟩→[ɒ] vs ⟨oʻ⟩→[o] (the signature)", () => {
        expect(phonemizeWord("Oʻzbekiston")).toBe("ozbekistˈɒn"); // oʻ→o, o→ɒ in one word
        expect(phonemizeWord("Toshkent")).toBe("tɒʃkˈent"); // o→ɒ, sh→ʃ
    });

    test("the comma-letters gʻ→ʁ, oʻ→o and the digraphs sh/ch/ng", () => {
        expect(phonemizeWord("gʻalaba")).toBe("ʁalabˈa"); // gʻ → ʁ (voiced uvular)
        expect(phonemizeWord("qishloq")).toBe("qiʃlˈɒq"); // sh→ʃ, q, o→ɒ
        expect(phonemizeWord("rang")).toBe("rˈaŋ"); // ng → ŋ
        expect(phonemizeWord("chiroyli")).toBe("t͡ʃirɒjlˈi"); // ch→t͡ʃ, y→j, o→ɒ
    });

    test("tutuq belgisi (ʼ) → glottal [ʔ], distinct from the comma-letters", () => {
        expect(phonemizeWord("sanʼat")).toBe("sanʔˈat"); // 'art' — apostrophe not after o/g → glottal
    });

    test("numbers compose (Turkic decimal — no fusion)", () => {
        expect(getPhonemizer("uz").text("11").trim()).toBe("ˈon bˈir"); // oʻn bir
        expect(getPhonemizer("uz").text("25").trim()).toBe("jiɡirmˈa bˈeʃ"); // yigirma besh
        expect(getPhonemizer("uz").text("1984").trim()).toBe("mˈiŋ toqqˈiz jˈuz saksˈɒn tˈort"); // ming toʻqqiz yuz sakson toʻrt
    });
});
