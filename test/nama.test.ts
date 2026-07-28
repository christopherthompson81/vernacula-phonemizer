import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/nama/nama.ts";

// Canonical-IPA goldens for Nama / Khoekhoe (naq) — Khoekhoegowab, a Khoe-Kwadi language; the fleet's FIRST CLICK
// language. The hallmark is the four click TYPES ⟨ǀ⟩ (dental), ⟨ǁ⟩ (lateral), ⟨ǂ⟩ (palatal), ⟨ǃ⟩ (alveolar) × the
// ACCOMPANIMENTS: bare→[ᵑ̊_ˀ] (glottalised nasal), ⟨g⟩→[ᵏ_] (tenuis), ⟨kh⟩→[ᵏ_ʰ] (aspirated), ⟨h⟩→[ᵑ̊_ʰ], ⟨n⟩→[ᵑ_]
// (voiced nasal). Referee: English Wiktionary "Khoekhoe terms with IPA pronunciation". See docs/investigations/naq_native_bringup_investigation.md.
describe("Nama (Khoekhoe) canonical IPA", () => {
    test("★ THE CLICK SYSTEM — the dental ⟨ǀ⟩ series × 5 accompaniments", () => {
        expect(phonemizeWord("ǀ")).toBe("ᵑ̊ǀˀ"); // BARE click → the glottalised nasal click
        expect(phonemizeWord("ǀg")).toBe("ᵏǀ"); // ⟨g⟩ → tenuis [ᵏǀ]
        expect(phonemizeWord("ǀkh")).toBe("ᵏǀʰ"); // ⟨kh⟩ → aspirated [ᵏǀʰ]
        expect(phonemizeWord("ǀh")).toBe("ᵑ̊ǀʰ"); // ⟨h⟩ → aspirated nasal [ᵑ̊ǀʰ]
        expect(phonemizeWord("ǀn")).toBe("ᵑǀ"); // ⟨n⟩ → voiced nasal [ᵑǀ]
    });

    test("★ the four click PLACES (bare = glottalised nasal at each place)", () => {
        expect(phonemizeWord("ǀ")).toBe("ᵑ̊ǀˀ"); // dental
        expect(phonemizeWord("ǁ")).toBe("ᵑ̊ǁˀ"); // lateral
        expect(phonemizeWord("ǂ")).toBe("ᵑ̊ǂˀ"); // palatal
        expect(phonemizeWord("ǃ")).toBe("ᵑ̊ǃˀ"); // alveolar
    });

    test("clicks in real words + ⟨kh⟩, ⟨g⟩→[x], final ⟨-b⟩→[p], long vowels", () => {
        expect(phonemizeWord("ǀgama")).toBe("ᵏǀama"); // ⟨ǀg⟩ tenuis click in a word
        expect(phonemizeWord("ǂkhoab")).toBe("ᵏǂʰoap"); // ⟨ǂkh⟩ aspirated; final ⟨-b⟩→[p]
        expect(phonemizeWord("ǃkhās")).toBe("ᵏǃʰaːs"); // ⟨ǃkh⟩; macron ⟨ā⟩ → long [aː]
        expect(phonemizeWord("kharob")).toBe("kʰarop"); // ⟨kh⟩→[kʰ]; final ⟨-b⟩→[p]
        expect(phonemizeWord("Khoekhoegowab")).toBe("kʰoekʰoexowap"); // ⟨g⟩ (not after a click) → [x]; ⟨w⟩→[w]
    });

    test("nasalized (circumflex) vowels + doubled-vowel length", () => {
        expect(phonemizeWord("ǂgâ")).toBe("ᵏǂã"); // 'enter' — ⟨â⟩ → nasalized [ã] (phonemic in Nama)
        expect(phonemizeWord("ǀî")).toBe("ᵑ̊ǀˀĩ"); // bare click + nasal [ĩ]
        expect(phonemizeWord("khoraab")).toBe("kʰoraːp"); // doubled ⟨aa⟩ → long [aː]; final ⟨-b⟩→[p]
    });
});
