import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/lulesami/lulesami.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Lule Sami / julevsámegiella (smj) — Uralic (Saami branch), the 1983 Latin
// orthography. AUTHORED from Ylikoski, "Lule Saami". A TRANSPARENT SEGMENTAL scan; the complex morphophonology
// (consonant gradation, epenthetic vowels, labial harmony, unwritten length) is the deferred residual. The
// hallmark is the North-Saami-style VOICELESS ⟨b d g⟩→[p t k] (aspiration-not-voicing), ASJP-confirmed.
// First-syllable stress. See docs/investigations/smj_native_bringup_investigation.md.
describe("Lule Sami (julevsámegiella) canonical IPA", () => {
    test("★ the voiceless ⟨b d g⟩ → [p t k] trap + medial ⟨p t k⟩ stay PLAIN", () => {
        expect(phonemizeWord("bena")).toBe("ˈpenɑ"); // 'dog' — ⟨b⟩→[p] (grammar /peːnə/), NOT [b]; ⟨a⟩→[ɑ]
        expect(phonemizeWord("giella")).toBe("ˈkielːɑ"); // 'language' — ⟨g⟩→[k], ⟨ie⟩ diphthong, ⟨ll⟩→geminate
        expect(phonemizeWord("guokta")).toBe("ˈkuoktɑ"); // 'two' — ⟨g⟩→[k]; medial ⟨k t⟩ are PLAIN (not [kʰ tʰ])
        expect(phonemizeWord("tállá")).toBe("ˈtʰɑːlːɑː"); // WORD-INITIAL ⟨t⟩ = the aspirated loan stop [tʰ]
    });

    test("digraphs + diphthongs + geminates", () => {
        expect(phonemizeWord("tjoarvve")).toBe("ˈt͡ʃoɑrvːe"); // 'horn' — ⟨tj⟩→[t͡ʃ], ⟨oa⟩→[oɑ], ⟨vv⟩→[vː]
        expect(phonemizeWord("njunnje")).toBe("ˈɲuɲːe"); // 'nose' — ⟨nj⟩→[ɲ], ⟨nnj⟩→[ɲː]
        expect(phonemizeWord("biellje")).toBe("ˈpieʎːe"); // 'ear' — ⟨b⟩→[p], ⟨ie⟩, ⟨llj⟩→[ʎː] (ASJP realization of /lj/)
    });

    test("the digraph inventory + the ⟨á⟩ length contrast", () => {
        expect(phonemizeWord("sj")).toBe("ˈʃ"); // ⟨sj⟩→[ʃ]
        expect(phonemizeWord("tj")).toBe("ˈt͡ʃ"); // ⟨tj⟩→[t͡ʃ]
        expect(phonemizeWord("dtj")).toBe("ˈd͡ʒ"); // ⟨dtj⟩→[d͡ʒ] (the voiced affricate)
        expect(phonemizeWord("ddj")).toBe("ˈɟː"); // ⟨ddj⟩→[ɟː] (the geminate-only palatal stop)
        expect(phonemizeWord("á")).toBe("ˈɑː"); // ⟨á⟩ = the one written vowel-length contrast /ɑː/
    });

    test("registry wiring", () => {
        expect(getPhonemizer("smj").text("bena").trim()).toBe("ˈpenɑ");
    });
});
