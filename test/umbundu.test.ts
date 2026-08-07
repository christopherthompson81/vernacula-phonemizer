import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/umbundu/umbundu.ts";
import { numberToWords } from "../src/languages/umbundu/numbers.ts";

// Canonical-IPA goldens for Umbundu (umb) — Bantu (R11, Angola), Latin orthography. Authored from
// Schadeberg (1982) "Nasalization in UMbundu" (the primary R11 phonology, Table 1 inventory) + the orthography —
// REFEREE-SCARCE (no wikipron/kaikki/epitran/Wiktionary-IPA), ASJP Umbundu-3 corroborated. This gold is a MEANINGFUL
// correctness anchor (Umbundu is a distinct, documented language, not a clone — the Igbo/Naija no-referee
// pattern). ⚠ It is also the ONLY evidence: single-source, with no machine referee to fall back on.
// Signatures: VOICED obstruents ONLY prenasalised (⟨mb nd nj ng⟩→ᵐb ⁿd ᶮd͡ʒ ᵑɡ), ⟨c⟩→t͡ʃ (palatal
// obstruent, not [ʃ]), ⟨v⟩→v, ⟨ñ⟩/⟨ny⟩→ɲ, ⟨ng'⟩→ŋ, ⟨l⟩→l (no native /r/). Tone (H/L+downstep) unwritten → stripped,
// deferred.
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

// CARDINAL NUMBERS (umb). The compositor emits the CITATION / COUNTING series (mosi, vali, tatu, kwãla, tãlo …):
// 1–5 are adjectival and take class concord, so a bare integer — with no noun to agree with — must use the
// counting shape. 6–9 (epandu, epandu vali, ecelãla, ecea) are QUINARY-BASED NOUNS and never inflect, which is
// why they are identical in every multiplier slot. Sources + the extrapolations are cited in umbundu.jsonc
// "numbers" (Camacho, "Números em Umbundo", 2013 + Omniglot "Numbers in Umbundu").
describe("Umbundu cardinal numbers — citation series, quinary 6–9, la/l' connective", () => {
    test("units: the quinary residue in 6–9", () => {
        expect(numberToWords(5)).toBe("tãlo");
        expect(numberToWords(6)).toBe("epandu");
        expect(numberToWords(7)).toBe("epandu vali");
        expect(numberToWords(9)).toBe("ecea");
    });
    test("teens use 'la', elided to l'' before a vowel (attested)", () => {
        expect(numberToWords(11)).toBe("ekwi la mosi");
        expect(numberToWords(13)).toBe("ekwi la vitatu"); // the post-'la' series is irregular: 3 takes vi-
        expect(numberToWords(16)).toBe("ekwi l'epandu"); // elision
    });
    test("tens take the cl.6 a- series, hundreds the cl.8 vi- series (two DIFFERENT tables)", () => {
        expect(numberToWords(20)).toBe("akwi avali");
        expect(numberToWords(21)).toBe("akwi avali la mosi");
        expect(numberToWords(60)).toBe("akwi epandu"); // 6 never inflects
        expect(numberToWords(100)).toBe("ocita");
        expect(numberToWords(200)).toBe("ovita vivali");
        expect(numberToWords(555)).toBe("ovita vitãlo l'akwi atãlo la vitãlo");
    });
    test("thousands + millions; 10⁹ is a THOUSAND MILLION (no attested word for it)", () => {
        expect(numberToWords(1000)).toBe("ohulukãyi");
        expect(numberToWords(2000)).toBe("ohulukãyi vivali");
        expect(numberToWords(1000000)).toBe("ohulua");
        expect(numberToWords(1000000000)).toBe("ohulua ohulukãyi");
    });
    test("end-to-end through the g2p", () => {
        expect(phonemize("21", "umb").trim()).toBe("akwi avali la mosi");
        expect(phonemize("16", "umb").trim()).toBe("ekwi lepaⁿdu"); // the elided l'' glues into one word
        expect(phonemize("200", "umb").trim()).toBe("ovita vivali");
    });
});
