import { describe, expect, test } from "vitest";

import { createHaitian, phonemizeWord } from "../src/languages/haitian/haitian.ts";
import { numberToWords } from "../src/languages/haitian/numbers.ts";

// Haitian Creole (ht) — kreyòl ayisyen, a French-lexified creole of Haiti (~12M). The IPN orthography is
// phonemic, so a greedy scan + the nasal-vowel rule covers it. Referee: wikipron hat_latn_broad (human).
// ⚠ The eval backbone STRIPS the nasal tilde, so the nasal comparison is on the base vowel only — the engine
// does emit ã ɛ̃ ɔ̃, and the referee score says nothing about whether they are right. It is also the only
// referee for ht, so there is no independent second opinion.
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

    // NUMBERS — the FRENCH VIGESIMAL RESIDUE is kept: 70 swasanndis (60+10), 80 katreven (4×20), 90 katrevendis
    // (4×20+10). The Belgian/Swiss decimal ⟨septante/octante/nonante⟩ forms are NOT Haitian. Source: LDC2017S03
    // "Haitian Creole LSP" §8.1–8.2 (citing Valdman et al. 2007). See haitian.jsonc.
    test("numbers: units, the decade stem alternation, hundreds, thousands, millions", () => {
        expect(numberToWords(7)).toBe("sèt");
        expect(numberToWords(16)).toBe("sèz");
        expect(numberToWords(21)).toBe("venteyen"); // the ⟨t⟩ stem + ⟨eyen⟩ (< French et-un)
        expect(numberToWords(22)).toBe("vennde"); // the ⟨nn⟩ stem before units 2–7
        expect(numberToWords(29)).toBe("ventnèf"); // the ⟨t⟩ stem before units 8–9
        expect(numberToWords(31)).toBe("tranteyen");
        expect(numberToWords(555)).toBe("senk san senkannsenk");
        expect(numberToWords(12345)).toBe("douz mil twa san karannsenk");
        expect(numberToWords(1000000)).toBe("en milyon");
        expect(numberToWords(1000000000)).toBe("en milya");
    });

    test("numbers: the vigesimal 70/80/90 band (NOT septante/octante/nonante)", () => {
        expect(numberToWords(70)).toBe("swasanndis"); // 60 + 10
        expect(numberToWords(71)).toBe("swasannonz"); // 60 + 11
        expect(numberToWords(79)).toBe("swasanndiznèf"); // 60 + 19
        expect(numberToWords(80)).toBe("katreven"); // kat × ven = four twenties
        expect(numberToWords(81)).toBe("katrevenen"); // irregular ⟨en⟩, not *katreveneyen
        expect(numberToWords(90)).toBe("katrevendis"); // 4×20 + 10
        expect(numberToWords(91)).toBe("katrevenonz"); // 4×20 + 11
        expect(numberToWords(99)).toBe("katrevendiznèf"); // 4×20 + 19
    });

    test("numbers: ⟨dis⟩ elides before a magnitude noun (LSP 'di mil', 'di milyon')", () => {
        expect(numberToWords(10000)).toBe("di mil");
        expect(numberToWords(100000)).toBe("san mil");
        expect(numberToWords(10000000)).toBe("di milyon");
    });

    test("numbers read through the g2p", () => {
        expect(ht.text("70").trim()).toBe("swasãndis"); // ⟨ann⟩ → nasal vowel + [n]
        expect(ht.text("99").trim()).toBe("katɣevɛ̃diznɛf"); // ⟨r⟩→ɣ, ⟨en⟩→ɛ̃
        expect(ht.text("22").trim()).toBe("vɛ̃nde"); // ⟨enn⟩ → [ɛ̃n] (contrast a bare ⟨en⟩ → [ɛ̃])
    });
});
