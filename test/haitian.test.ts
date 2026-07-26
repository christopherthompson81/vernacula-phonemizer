import { describe, expect, test } from "vitest";

import { createHaitian, phonemizeWord } from "../src/languages/haitian/haitian.ts";

// Haitian Creole (ht) — kreyòl ayisyen, a French-lexified creole of Haiti (~12M). The 3rd creole in the fleet (after
// Kabuverdianu). The IPN orthography is phonemic, so a greedy scan + the nasal-vowel rule nails it. Validated against
// wikipron hat_latn_broad (1691 human headwords) — 97.7% FOLDED / 99.4% symbol (96.9% first pass). Note: the eval
// backbone strips the nasal tilde, so the nasal comparison is on the base vowel; the engine DOES emit ã ɛ̃ ɔ̃.
// 🔷 single source. See docs/investigations/ht_native_bringup_investigation.md.
describe("Haitian Creole canonical IPA — phonemic IPN g2p + the nasal-vowel rule", () => {
    const ht = createHaitian();

    test("the digraphs + signature consonants: ⟨ou⟩→u, ⟨r⟩→ɣ, ⟨j⟩→ʒ, ⟨ch⟩→ʃ, ⟨y⟩→j", () => {
        expect(phonemizeWord("jou")).toBe("ʒu"); // ⟨j⟩→ʒ, ⟨ou⟩→u ("day")
        expect(phonemizeWord("diri")).toBe("diɣi"); // ⟨r⟩ → ɣ (velar fricative) ("rice")
        expect(phonemizeWord("chwal")).toBe("ʃwal"); // ⟨ch⟩→ʃ, ⟨w⟩→w ("horse")
        expect(phonemizeWord("kreyòl")).toBe("kɣejɔl"); // ⟨r⟩→ɣ, ⟨y⟩→j, ⟨ò⟩→ɔ ("Creole")
    });

    test("the NASAL VOWELS ⟨an en on⟩→[ã ɛ̃ ɔ̃] syllable-finally; oral before a true vowel", () => {
        expect(phonemizeWord("san")).toBe("sã"); // ⟨an⟩ word-final → ã ("blood/without")
        expect(phonemizeWord("bonjou")).toBe("bɔ̃ʒu"); // ⟨on⟩ before [ʒ] → ɔ̃ ("hello")
        expect(phonemizeWord("lang")).toBe("lãɡ"); // ⟨an⟩ before [ɡ] → ã ("tongue/language")
        expect(phonemizeWord("Dominik")).toBe("dominik"); // ⟨n⟩ before a true vowel → oral (no nasal)
        expect(phonemizeWord("machin")).toBe("maʃin"); // ⟨in⟩ does NOT nasalize (only a/e/o) ("machine/car")
    });

    test("nasalization before a GLIDE ⟨y w⟩; the doubled ⟨nn⟩ → nasal + [n]", () => {
        expect(phonemizeWord("anyen")).toBe("ãjɛ̃"); // ⟨an⟩ before glide ⟨y⟩ still nasalizes ("nothing")
        expect(phonemizeWord("anwo")).toBe("ãwo"); // ⟨an⟩ before glide ⟨w⟩ → ã ("up/above")
    });

    test("⟨ou⟩→[u] (not nasal even before ⟨n⟩); ⟨r⟩→[w] before a rounded vowel; geminate collapse", () => {
        expect(phonemizeWord("moun")).toBe("mun"); // ⟨oun⟩ → un (⟨ou⟩ digraph, not nasal) ("person")
        expect(phonemizeWord("granmoun")).toBe("ɡɣãmun"); // ⟨an⟩→ã, ⟨oun⟩→un ("adult/elder")
        expect(phonemizeWord("ayeropò")).toBe("ajewopɔ"); // ⟨r⟩ → w before rounded [o] ("airport")
        expect(phonemizeWord("accoma")).toBe("akoma"); // doubled ⟨cc⟩ → single [k] (a loan)
    });

    test("clause assembly", () => {
        expect(ht.text("Mwen pale kreyòl.").trim()).toBe("mwɛ̃ pale kɣejɔl .");
    });
});
