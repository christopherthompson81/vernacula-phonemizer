import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/guarani/guarani.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Paraguayan Guaraní (gn) — Avañe'ẽ, Tupian (the fleet's first), co-official in Paraguay.
// Signature: the 12-vowel system (⟨y⟩→[ɨ] + six NASAL vowels ⟨ã ẽ ĩ õ ũ ỹ⟩), the PRENASALIZED voiced stops
// ⟨mb nd⟩→[ᵐb ⁿd] (⟨ng⟩ is always [ŋ]), the glottal ⟨'⟩ (puso)→[ʔ], ⟨ch⟩→[ʃ], ⟨j⟩→[d͡ʒ], ⟨g⟩→[ɰ] / ⟨gu⟩→[w],
// ⟨ñ⟩→[ɲ]; glide formation (prevocalic i→j, u→w); default final-syllable (oxytone) stress. Validated at 95.2%
// symbol (75.6% folded, dragged by partly-lexical nasal harmony) vs wikipron gug_latn_broad. See
// docs/investigations/gn_native_bringup_investigation.md.
describe("Guaraní (Avañe'ẽ) canonical IPA", () => {
    test("12 vowels: ⟨y⟩→ɨ + nasal vowels; the glottal ⟨'⟩ (puso)", () => {
        expect(phonemizeWord("y")).toBe("ˈɨ"); // 'water' — ⟨y⟩ is the high central vowel [ɨ]
        expect(phonemizeWord("avañe'ẽ")).toBe("aʋaɲeˈʔẽ"); // 'Guaraní language' — ñ→ɲ, ⟨'⟩→ʔ, nasal ẽ
        expect(phonemizeWord("mba'e")).toBe("ᵐbaˈʔe"); // 'thing' — prenasalized ⟨mb⟩ + puso
        expect(phonemizeWord("tetã")).toBe("teˈtã"); // 'country' — nasal vowel ã
    });

    test("prenasalized stops, ⟨ch⟩, ⟨ñ⟩; ⟨ng⟩ is a plain velar nasal", () => {
        expect(phonemizeWord("ñande")).toBe("ɲaˈⁿde"); // 'our (incl.)' — ñ→ɲ, prenasalized ⟨nd⟩
        expect(phonemizeWord("che")).toBe("ˈʃe"); // 'I/my' — ⟨ch⟩→ʃ
        expect(phonemizeWord("kuñatãi")).toBe("kuɲaˈtãi"); // 'young woman' — nasal ã attracts stress
    });

    test("⟨g⟩/⟨gu⟩ and ⟨j⟩; glide formation", () => {
        expect(phonemizeWord("guata")).toBe("waˈta"); // 'to walk' — ⟨gu⟩ before a back vowel → [w]
        expect(phonemizeWord("jagua")).toBe("d͡ʒaˈwa"); // 'dog' — ⟨j⟩→d͡ʒ, ⟨gu⟩→w
        expect(phonemizeWord("Paraguay")).toBe("paɾawaˈɨ"); // ⟨gu⟩→w, final ⟨y⟩→ɨ
    });

    test("acute accent overrides the default oxytone stress", () => {
        expect(phonemizeWord("mbo'ehára")).toBe("ᵐboʔeˈhaɾa"); // 'teacher' — á accent → stress on ⟨há⟩ (not final)
    });

    test("stress precedes a C+glide onset; the puso curly apostrophe is the glottal stop", () => {
        expect(phonemizeWord("kuéra")).toBe("ˈkweɾa"); // plural — ⟨ku⟩→[kw] is one onset, stress before the whole cluster
        expect(phonemizeWord("guyra")).toBe("ɰɨˈɾa"); // 'bird' — ⟨gu⟩ before the central ⟨y⟩ → [ɰ]
        expect(phonemizeWord("avañe’ẽ")).toBe("aʋaɲeˈʔẽ"); // curly apostrophe ’ (U+2019) → the glottal [ʔ], same as U+0027
    });

    // ═══ CARDINAL NUMBERS — the 20th-century NEOLOGISM system (Decoud Larrosa; Estigarribia 2020 §3.4.3).
    // ★ PROMINENT CAVEAT: Estigarribia calls this system "purely of academic use" — colloquial Paraguayan
    // Guaraní uses SPANISH numerals beyond irundy '4'. We still implement the neologisms because they are the
    // only numerals attested IN GUARANÍ ORTHOGRAPHY (written Guaraní otherwise just prints Arabic digits), so a
    // Spanish-loan path would mean inventing respellings. See src/languages/guarani/numbers.ts for the full
    // argument and sources. This reads as the written/academic register, by design.
    test("★ cardinals: native 1–4, then the po/pa neologisms (apheresis + fusion)", () => {
        const gn = getPhonemizer("gn");
        expect(gn.text("0").trim()).toBe("ᵐbaʔeˈʋe"); // mba'eve 'nothing'
        expect(gn.text("4").trim()).toBe("iɾuˈⁿdɨ"); // irundy — the last PRE-CONTACT numeral
        expect(gn.text("6").trim()).toBe("poteˈĩ"); // poteĩ = po 'hand' + teĩ (apheresised peteĩ)
        expect(gn.text("11").trim()).toBe("pateˈĩ"); // pateĩ = pa + teĩ, FUSED
        expect(gn.text("13").trim()).toBe("paʔaˈpɨ"); // pa'apy = pa + 'apy (apheresised mbohapy)
        expect(gn.text("21").trim()).toBe("moˈkõipa peteˈĩ"); // mokõipa peteĩ — tens FUSED, then a SPACE
    });

    test("cardinals: the scale words are MULTIPLICATIVE, and the multiplier ONE is dropped", () => {
        const gn = getPhonemizer("gn");
        expect(gn.text("100").trim()).toBe("ˈsa"); // sa (< rasa) — never *peteĩsa
        expect(gn.text("101").trim()).toBe("ˈsa peteˈĩ"); // sa peteĩ
        expect(gn.text("234").trim()).toBe("moˈkõisa ᵐbohapɨˈpa iɾuˈⁿdɨ"); // mokõisa mbohapypa irundy
        expect(gn.text("1000").trim()).toBe("ˈsu"); // su (< guasu)
        expect(gn.text("10000").trim()).toBe("paˈsu"); // pasu = pa × su, the same rule as Estigarribia's pasua
        expect(gn.text("1000000").trim()).toBe("ˈswa"); // sua
        expect(gn.text("10000000").trim()).toBe("paˈswa"); // pasua = pa × sua — straight from the grammar's table
    });
});
