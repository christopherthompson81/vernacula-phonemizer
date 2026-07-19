import { describe, expect, test } from "vitest";

// The goldens exercise the RULE engine (phonemizeWordRules); the shipped phonemizeWord is dict-first (exceptions
// lexicon → rules), tested separately below.
import { phonemizeWord, phonemizeWordRules as phonemize } from "../src/languages/khmer/khmer.ts";

// Canonical-IPA goldens for Khmer / ភាសាខ្មែរ (km) — Austroasiatic (Mon-Khmer), the Khmer abugida, non-tonal.
// PHASE 2 (in active development): a proper unit-based SESQUISYLLABIC syllabifier per Huffman (1970) —
// governance (series set by the last preceding dominant stop/spirant, tracked across the word), presyllable
// reduction, coda assignment, and the nasal-superscript medial-cluster split. These goldens pin the two-series
// core PLUS one word per structural rule that matches the wikipron referee. Deferred long tail: Pali
// doubled-consonant loanwords, special digraphs (ហ្វ→f), bantaq vowel-shortening, independent vowels.
// See docs/investigations/km_native_bringup_investigation.md.
describe("Khmer canonical IPA — two-series sesquisyllabic core (Phase 2)", () => {
    test("THE two-series contrast: the same vowel sign ⟨ា⟩ reads by the governing series", () => {
        expect(phonemize("កា")).toBe("kaː"); // ក a-series → aː (matches wikipron)
        expect(phonemize("គា")).toBe("kiə"); // គ o-series → iə (same sign ា, different reading)
        expect(phonemize("ចា")).toBe("caː"); // ច a-series
        expect(phonemize("ជា")).toBe("ciə"); // ជ o-series
    });

    test("whole words matching the wikipron referee (base governs the series in a coeng cluster)", () => {
        expect(phonemize("ខ្មែរ")).toBe("kʰmae"); // "Khmer" — ខ (a-series) governs ែ → ae; final ⟨រ⟩ silent
        expect(phonemize("ភាសា")).toBe("pʰiəsaː"); // "language" — ភ (o) → iə, ស (a) → aː
        expect(phonemize("ស្រុក")).toBe("srok"); // "country" — ស (a) governs ុ → o + coda k
    });

    test("governance: the vowel series is set by the last preceding dominant (stop/spirant), across the word", () => {
        expect(phonemize("ផ្ទះ")).toBe("pʰteəh"); // both dominant → the SUBSCRIPT ទ (o-series) governs ះ → eəh
        expect(phonemize("ចេតនា")).toBe("ceːtnaː"); // passive ន harmonises to a-series from the preceding ត → naː (not niə)
    });

    test("sesquisyllabic structure: presyllable reduction, coda assignment, nasal medial-cluster split", () => {
        expect(phonemize("កករ")).toBe("kɑkɑː"); // presyllable kɑ (short) + stressed kɑː (long, ⟨រ⟩ silent)
        expect(phonemize("កណ្ដាល")).toBe("kɑnɗaːl"); // presyllable kɑ + main nɗaːl (ɗ governs ា; ⟨ល⟩ coda)
        expect(phonemize("តម្រង")).toBe("tɑmrɑːŋ"); // nasal ⟨ម⟩ closes syllable 1, subscript ⟨រ⟩ opens syllable 2
    });

    test("inherent-vowel length: plain coda LONG, silent-subscript/bantaq coda SHORT (Huffman IX.A)", () => {
        expect(phonemize("កង")).toBe("kɑːŋ"); // plain coda → long ɑː
        expect(phonemize("គង")).toBe("kɔːŋ"); // 2nd-series plain coda → long ɔː
        expect(phonemize("ចន្ទ")).toBe("cɑn"); // silent final subscript ⟨្ទ⟩ → short
        expect(phonemize("រដ្ឋ")).toBe("ruət"); // 2nd-series silent-subscript → short uə
        expect(phonemize("កាត់")).toBe("kat"); // bantaq shortens ⟨ា⟩ aː → a
    });

    test("multi-char vowels: base sign + ⟨ះ⟩ (-h) / ⟨ំ⟩ (-m)", () => {
        expect(phonemize("កោះ")).toBe("kɑh"); // ⟨ោះ⟩ a-series → ɑh
        expect(phonemize("ចុះ")).toBe("coh"); // ⟨ុះ⟩ a-series → oh
        expect(phonemize("ជុំ")).toBe("cum"); // ⟨ុំ⟩ o-series → um
    });
});

// The SHIPPED phonemizeWord consults the exceptions lexicon (km-lexicon.tsv) dict-first for the Huffman-lexical
// words the rules cannot predict (internal doubling, Pali vowels), then falls back to the rule engine.
describe("Khmer — shipped phonemizeWord (exceptions lexicon dict-first)", () => {
    test("a lexicon word overrides the (wrong) rule output", () => {
        expect(phonemizeWord("កញ្ចក់")).toBe("kɑɲcɑʔ"); // lexicon: rule alone drops the doubled ច (→ kɑɲ)
        expect(phonemize("កញ្ចក់")).not.toBe("kɑɲcɑʔ"); // proof the rule path differs
    });

    test("an OOV word falls through to the rule engine (dict == rule)", () => {
        expect(phonemizeWord("ស្រុក")).toBe(phonemize("ស្រុក")); // not in the lexicon → rules
    });
});
