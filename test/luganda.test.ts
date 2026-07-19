import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/luganda/luganda.ts";

// Canonical-IPA goldens for Luganda / Oluganda (lg) — Bantu (Great Lakes, JE15), Latin orthography.
// Phonology grounded in Wikipedia (Luganda) + the epitran lug-Latn map. The greedy g2p + gemination + prenasal
// lengthening scores 99.1% folded vs epitran lug-Latn (tools/referee-eval, 1500 words) — but epitran is itself
// rule-based, so that comparison is partly CIRCULAR (single-source). These goldens pin the segmental backbone.
// Tone (3-way H/L/falling) is lexical + unwritten → deferred.
// See docs/investigations/lg_native_bringup_investigation.md.
describe("Luganda canonical IPA — greedy g2p + gemination + prenasal lengthening", () => {
    test("PRENASALISED consonants as units + vowel LENGTHENING before them", () => {
        expect(phonemizeWord("nga")).toBe("ᵑɡa"); // ⟨ng⟩ → ᵑɡ
        expect(phonemizeWord("buganda")).toBe("buɡaːⁿda"); // ⟨nd⟩ → ⁿd; the a before it is LENGTHENED
        expect(phonemizeWord("omuntu")).toBe("omuːⁿtu"); // ⟨nt⟩ → ⁿt; u lengthened
        expect(phonemizeWord("enkima")).toBe("eːᵑkima"); // ⟨nk⟩ → ᵑk; e lengthened
    });

    test("⟨ng'⟩ → ŋ (velar nasal, distinct from ⟨ng⟩ → ᵑɡ); ⟨nny⟩ → ɲː", () => {
        expect(phonemizeWord("ng'")).toBe("ŋ"); // velar nasal
        expect(phonemizeWord("nng'")).toBe("ŋː"); // geminate velar nasal
        expect(phonemizeWord("nnyo")).toBe("ɲːo"); // ⟨nny⟩ → ɲː
    });

    test("GEMINATION (doubled → Cː) and prenasal + LABIALISATION (⟨ndw⟩ → ⁿdʷ)", () => {
        expect(phonemizeWord("bbiri")).toBe("bːiɾi"); // "two" — ⟨bb⟩ → bː; ⟨r⟩ → ɾ
        expect(phonemizeWord("kitto")).toBe("kitːo"); // ⟨tt⟩ → tː
        expect(phonemizeWord("ndwadde")).toBe("ⁿdʷadːe"); // ⟨nd⟩ + ⟨w⟩ → ⁿdʷ (prenasal keeps the labialisation)
        expect(phonemizeWord("mwana")).toBe("mʷana"); // ⟨mw⟩ → mʷ (labialisation)
    });

    test("common words", () => {
        expect(phonemizeWord("luganda")).toBe("luɡaːⁿda"); // the language name
        expect(phonemizeWord("era")).toBe("eɾa"); // "and" — ⟨r⟩ → ɾ (tap)
    });
});
