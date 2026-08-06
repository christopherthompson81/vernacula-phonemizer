import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/luganda/luganda.ts";
import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/luganda/numbers.ts";

// Canonical-IPA goldens for Luganda / Oluganda (lg) — Bantu (Great Lakes, JE15), Latin orthography.
// Phonology grounded in Wikipedia (Luganda) + the epitran lug-Latn map. The greedy g2p + gemination + prenasal
// lengthening scores 99.1% folded vs epitran lug-Latn (tools/referee-eval, 1500 words) — but epitran is itself
// rule-based, so that comparison is partly CIRCULAR (single-source). These goldens pin the segmental backbone.
// Tone (3-way H/L/falling) is lexical + unwritten → deferred.
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

// CARDINAL NUMBERS (lg). The compositor emits the CITATION / COUNTING series (emu, bbiri, ssatu, nnya, ttaano …):
// Luganda 1–5 are adjectival and take class concord (bbiri ~ abiri ~ bibiri ~ bubiri), so a bare integer — which
// has no noun to agree with — must use the counting shape. 6–9 are NOUNS and never inflect. Sources are cited in
// luganda.jsonc "numbers" (Wikivoyage Luganda phrasebook §Numbers + eggsforeducation + Omniglot).
describe("Luganda cardinal numbers — citation series, the 60–90 nouns, mu/na connectives", () => {
    test("units + the teens 'na'/'n'' connective", () => {
        expect(numberToWords(7)).toBe("musanvu");
        expect(numberToWords(10)).toBe("kkumi");
        expect(numberToWords(11)).toBe("kkumi n'emu"); // elision before the vowel-initial emu
        expect(numberToWords(12)).toBe("kkumi na bbiri");
    });
    test("20–50 are multiplicative amakumi + cl.6 a-; 60–90 are SINGLE nouns", () => {
        expect(numberToWords(20)).toBe("amakumi abiri");
        expect(numberToWords(50)).toBe("amakumi ataano");
        expect(numberToWords(60)).toBe("nkaaga"); // NOT amakumi mukaaga
        expect(numberToWords(90)).toBe("kyenda");
        expect(numberToWords(21)).toBe("amakumi abiri mu emu"); // the "mu" component connective
    });
    test("hundreds take their OWN bi- multiplier series (attested compounds)", () => {
        expect(numberToWords(100)).toBe("kikumi");
        expect(numberToWords(122)).toBe("kikumi mu amakumi abiri mu bbiri");
        expect(numberToWords(222)).toBe("bikumi bibiri mu amakumi abiri mu bbiri");
    });
    test("thousands, millions, billions", () => {
        expect(numberToWords(1000)).toBe("lukumi");
        expect(numberToWords(2000)).toBe("nkumi bbiri");
        expect(numberToWords(1000000)).toBe("kakadde kamu");
        expect(numberToWords(1000000000)).toBe("akawumbi kamu");
    });
    test("end-to-end through the g2p (gemination + prenasal lengthening apply to numerals too)", () => {
        expect(phonemize("2", "lg").trim()).toBe("bːiɾi"); // ⟨bb⟩ → bː
        expect(phonemize("60", "lg").trim()).toBe("ᵑkaːɡa"); // vowel lengthened before the prenasal
        expect(phonemize("122", "lg").trim()).toBe("kikumi mu amakumi abiɾi mu bːiɾi");
    });
});
