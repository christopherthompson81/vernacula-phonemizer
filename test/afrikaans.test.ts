import { describe, expect, test } from "vitest";

import { phonemizeWord, createAfrikaans } from "../src/languages/afrikaans/afrikaans.ts";

// Canonical-IPA goldens for Afrikaans (af) — Indo-European (West Germanic, daughter of Dutch), Latin script,
// Standard Afrikaans, espeak-independent. A greedy digraph-first g2p + the Germanic OPEN/CLOSED-SYLLABLE vowel-length
// rule + word-final obstruent devoicing. Referee: en.wiktionary Afrikaans IPA (2220 words) — 71.2% folded overall
// (86% on short native words, 91% monosyllabic); the full-set residual is stress-conditioned vowel reduction on
// POLYSYLLABLES (no stress model yet) + proper-noun/loan pronunciations (Afrika, Botha, Coetzee — lexical). Folds:
// stress (unwritten) + syllable dots not emitted, r~ɾ one symbol, ʊ~u / ɪ~i / œy~œi centering-diphthong-onset
// notation. Signatures below. DEFERRED: a stress/syllable model, a proper-noun lexicon, numbers, nasalization.
// See docs/investigations/af_afrikaans_bringup_investigation.md.
describe("Afrikaans canonical IPA — greedy g2p + open/closed vowel length (Standard Afrikaans)", () => {
    test("⟨g⟩ = [χ] fricative + word-final obstruent DEVOICING", () => {
        expect(phonemizeWord("dag")).toBe("daχ"); // ⟨g⟩ = velar/uvular fricative [χ], not [ɡ]
        expect(phonemizeWord("agt")).toBe("aχt");
        expect(phonemizeWord("goed")).toBe("χut"); // g→χ; ⟨oe⟩→u; final ⟨d⟩ DEVOICES → t
        expect(phonemizeWord("hond")).toBe("ɦɔnt"); // ⟨h⟩→ɦ; final ⟨d⟩→t
        expect(phonemizeWord("aand")).toBe("ɑːnt"); // ⟨aa⟩→ɑː; final ⟨d⟩→t
    });

    test("open/closed vowel LENGTH + geminate collapse", () => {
        expect(phonemizeWord("kat")).toBe("kat"); // ⟨a⟩ in a CLOSED syllable → short [a]
        expect(phonemizeWord("water")).toBe("vɑːtər"); // ⟨a⟩ in an OPEN syllable → long [ɑː]; ⟨w⟩→v; final -er→ər
        expect(phonemizeWord("appel")).toBe("apəl"); // a DOUBLED consonant is a single phoneme (marks the vowel short)
    });

    test("long mids are CENTERING DIPHTHONGS (ee=iə, oo=uə); ie/oe/ui", () => {
        expect(phonemizeWord("een")).toBe("iən"); // ⟨ee⟩ → centering [iə]
        expect(phonemizeWord("twee")).toBe("tviə"); // ⟨tw⟩→tv; ⟨ee⟩→iə
        expect(phonemizeWord("groot")).toBe("χruət"); // ⟨oo⟩ → centering [uə]
        expect(phonemizeWord("sewe")).toBe("siəvə"); // open ⟨e⟩→iə (stressed); ⟨w⟩→v; final ⟨e⟩→ə
        expect(phonemizeWord("huis")).toBe("ɦœys"); // ⟨ui⟩ → [œy]
        expect(phonemizeWord("bietjie")).toBe("biki"); // ⟨ie⟩→i; the diminutive ⟨tjie⟩→[ki]
    });

    test("⟨y⟩ diphthong + circumflex-long diacritic", () => {
        expect(phonemizeWord("altyd")).toBe("altəit"); // ⟨y⟩ → diphthong [əi]; final ⟨d⟩→t
        expect(phonemizeWord("môre")).toBe("mɔːrə"); // ⟨ô⟩ → long [ɔː]
    });

    test("text: words + clause punctuation (stress + numbers deferred)", () => {
        expect(createAfrikaans().text("Die man loop huis toe.")).toBe("di man luəp ɦœys tu .");
    });
});
