import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/khmer/khmer.ts";

// Canonical-IPA goldens for Khmer / ភាសាខ្មែរ (km) — Austroasiatic (Mon-Khmer), the Khmer abugida, non-tonal.
// PHASE 2 (in active development): a proper unit-based SESQUISYLLABIC syllabifier per Huffman (1970) —
// governance (series set by the last preceding dominant stop/spirant, tracked across the word), presyllable
// reduction, coda assignment, and the nasal-superscript medial-cluster split. These goldens pin the two-series
// core PLUS one word per structural rule that matches the wikipron referee. Deferred long tail: Pali
// doubled-consonant loanwords, special digraphs (ហ្វ→f), bantaq vowel-shortening, independent vowels.
// See docs/investigations/km_native_bringup_investigation.md.
describe("Khmer canonical IPA — two-series sesquisyllabic core (Phase 2)", () => {
    test("THE two-series contrast: the same vowel sign ⟨ា⟩ reads by the governing series", () => {
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

    test("governance: the vowel series is set by the last preceding dominant (stop/spirant), across the word", () => {
        expect(phonemizeWord("ផ្ទះ")).toBe("pʰteəh"); // both dominant → the SUBSCRIPT ទ (o-series) governs ះ → eəh
        expect(phonemizeWord("ចេតនា")).toBe("ceːtnaː"); // passive ន harmonises to a-series from the preceding ត → naː (not niə)
    });

    test("sesquisyllabic structure: presyllable reduction, coda assignment, nasal medial-cluster split", () => {
        expect(phonemizeWord("កករ")).toBe("kɑkɑː"); // presyllable kɑ (short) + stressed kɑː (long, ⟨រ⟩ silent)
        expect(phonemizeWord("កណ្ដាល")).toBe("kɑnɗaːl"); // presyllable kɑ + main nɗaːl (ɗ governs ា; ⟨ល⟩ coda)
        expect(phonemizeWord("តម្រង")).toBe("tɑmrɑːŋ"); // nasal ⟨ម⟩ closes syllable 1, subscript ⟨រ⟩ opens syllable 2
    });

    test("inherent-vowel length: plain coda LONG, silent-subscript/bantaq coda SHORT (Huffman IX.A)", () => {
        expect(phonemizeWord("កង")).toBe("kɑːŋ"); // plain coda → long ɑː
        expect(phonemizeWord("គង")).toBe("kɔːŋ"); // 2nd-series plain coda → long ɔː
        expect(phonemizeWord("ចន្ទ")).toBe("cɑn"); // silent final subscript ⟨្ទ⟩ → short
        expect(phonemizeWord("រដ្ឋ")).toBe("ruət"); // 2nd-series silent-subscript → short uə
        expect(phonemizeWord("កាត់")).toBe("kat"); // bantaq shortens ⟨ា⟩ aː → a
    });

    test("multi-char vowels: base sign + ⟨ះ⟩ (-h) / ⟨ំ⟩ (-m)", () => {
        expect(phonemizeWord("កោះ")).toBe("kɑh"); // ⟨ោះ⟩ a-series → ɑh
        expect(phonemizeWord("ចុះ")).toBe("coh"); // ⟨ុះ⟩ a-series → oh
        expect(phonemizeWord("ជុំ")).toBe("cum"); // ⟨ុំ⟩ o-series → um
    });
});
