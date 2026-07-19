import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/khmer/khmer.ts";

// Canonical-IPA goldens for Khmer / ភាសាខ្មែរ (km) — Austroasiatic (Mon-Khmer), the Khmer abugida, non-tonal.
// PHASE 1 (in active development): the DEFINING two-consonant-series system is derived from wikipron and working
// for simple CV/CVC/cluster syllables. The sesquisyllabic structure (minor syllables, coeng onset-vs-coda,
// series-conversion diacritics, independent vowels, multi-char vowels) is the deferred follow-up. These goldens
// pin the two-series core + a few whole words that match the wikipron referee. See docs/investigations/km_native_bringup_investigation.md.
describe("Khmer canonical IPA — two-series core (Phase 1)", () => {
    test("THE two-series contrast: the same vowel sign ⟨ា⟩ reads by the base consonant's series", () => {
        expect(phonemizeWord("កា")).toBe("kaː"); // ក a-series → aː (matches wikipron)
        expect(phonemizeWord("គា")).toBe("kiə"); // គ o-series → iə (same sign ា, different reading)
        expect(phonemizeWord("ចា")).toBe("caː"); // ច a-series
        expect(phonemizeWord("ជា")).toBe("ciə"); // ជ o-series
    });

    test("whole words matching the wikipron referee (base governs the series in a coeng cluster)", () => {
        expect(phonemizeWord("ខ្មែរ")).toBe("kʰmae"); // "Khmer" — ខ (a-series) governs ែ → ae; final ⟨រ⟩ silent
        expect(phonemizeWord("ភាសា")).toBe("pʰiəsaː"); // "language" — ភ (o) → iə, ស (a) → aː
        expect(phonemizeWord("ស្រុក")).toBe("srok"); // "country" — ស (a) governs ុ → o + coda k
    });
});
