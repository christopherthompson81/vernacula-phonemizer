import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/umbundu/umbundu.ts";

// Canonical-IPA goldens for Umbundu (umb) — Bantu (R11, Angola), Latin orthography, espeak-independent. Authored from
// Schadeberg (1982) "Nasalization in UMbundu" (the primary R11 phonology, Table 1 inventory) + the orthography —
// REFEREE-SCARCE (no wikipron/kaikki/epitran/Wiktionary-IPA), ASJP Umbundu-3 corroborated. This gold is a MEANINGFUL
// correctness anchor (Umbundu is a distinct, documented language, not a clone — the Igbo/Naija no-referee pattern),
// 🔷 single-source. Signatures: VOICED obstruents ONLY prenasalised (⟨mb nd nj ng⟩→ᵐb ⁿd ᶮd͡ʒ ᵑɡ), ⟨c⟩→t͡ʃ (palatal
// obstruent, not [ʃ]), ⟨v⟩→v, ⟨ñ⟩/⟨ny⟩→ɲ, ⟨ng'⟩→ŋ, ⟨l⟩→l (no native /r/). Tone (H/L+downstep) unwritten → stripped,
// deferred. See docs/investigations/umb_native_bringup_investigation.md.
describe("Umbundu canonical IPA", () => {
    test("Schadeberg (1982) attested verb forms (the b~v/d~l/j~y/g~∅ ~ N alternations)", () => {
        expect(phonemizeWord("mbanja")).toBe("ᵐbaᶮd͡ʒa"); // "I look" (N+v→mb; N+y→nj)
        expect(phonemizeWord("ndanda")).toBe("ⁿdaⁿda"); // "I buy" (N+l→nd)
        expect(phonemizeWord("njeva")).toBe("ᶮd͡ʒeva"); // "I hear" (N+y→nj)
        expect(phonemizeWord("ngenda")).toBe("ᵑɡeⁿda"); // "I go" (N+∅→ng)
        expect(phonemizeWord("cila")).toBe("t͡ʃila"); // "dance!" — ⟨c⟩ palatal obstruent
    });

    test("prenasalised voiced stops (only voiced obstruents in native Umbundu)", () => {
        expect(phonemizeWord("Umbundu")).toBe("uᵐbuⁿdu"); // ⟨mb⟩→ᵐb, ⟨nd⟩→ⁿd
        expect(phonemizeWord("ondalu")).toBe("oⁿdalu"); // fire — ⟨nd⟩→ⁿd
        expect(phonemizeWord("Kalunga")).toBe("kaluᵑɡa"); // ⟨ng⟩→ᵑɡ
        expect(phonemizeWord("onjo")).toBe("oᶮd͡ʒo"); // house — ⟨nj⟩→ᶮd͡ʒ
        expect(phonemizeWord("olombo")).toBe("oloᵐbo"); // ⟨mb⟩→ᵐb
    });

    test("⟨c⟩→t͡ʃ, ⟨v⟩→v, open CV vowels", () => {
        expect(phonemizeWord("ocitumba")).toBe("ot͡ʃituᵐba"); // ⟨c⟩→t͡ʃ + ⟨mb⟩→ᵐb
        expect(phonemizeWord("ovava")).toBe("ovava"); // water — ⟨v⟩→v
        expect(phonemizeWord("omunu")).toBe("omunu"); // person
        expect(phonemizeWord("ekumbi")).toBe("ekuᵐbi"); // sun
    });

    test("nasals ⟨ny⟩/⟨ñ⟩→ɲ, ⟨ng'⟩→ŋ (plain velar nasal, ≠ ⟨ng⟩=ᵑɡ)", () => {
        expect(phonemizeWord("nyama")).toBe("ɲama"); // meat — ⟨ny⟩→ɲ
        expect(phonemizeWord("ng'ombe")).toBe("ŋoᵐbe"); // ⟨ng'⟩→ŋ (cattle)
    });

    test("tone accents stripped (deferred), nasalisation tilde kept", () => {
        expect(phonemizeWord("Kalúnga")).toBe("kaluᵑɡa"); // acute (H tone) stripped
        expect(phonemizeWord("tãi")).toBe("tãi"); // tilde (nasal vowel) kept
    });

    test("sentence: clause punctuation", () => {
        expect(phonemize("Ndapandula calwa.", "umb").trim()).toBe("ⁿdapaⁿdula t͡ʃalwa .");
    });
});
