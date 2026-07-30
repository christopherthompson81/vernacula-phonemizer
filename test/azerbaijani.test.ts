import { describe, expect, test } from "vitest";

import { phonemizeWord, createAzerbaijani } from "../src/languages/azerbaijani/azerbaijani.ts";
import { ROMAN_POLICY } from "../src/languages/azerbaijani/romanOrdinals.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Azerbaijani / Azərbaycan dili (az) — North Azerbaijani, Turkic (Oghuz), Latin. A
// cleanroom rule g2p sharing the Turkish engine shape (vowel harmony already spelled; k/g palatalize before front
// vowels; dark/clear l; geminate stops; final-syllable stress). Azerbaijani-specific: the extra vowel ə→[æ],
// a→[ɑ], ö→[œ]; q→[ɡ] (final→x); x→[x], ğ→[ɣ]. Validated ~81.6% vs wikipron aze narrow + 66.4% vs epitran.
// See docs/investigations/az_native_bringup_investigation.md.
describe("Azerbaijani canonical IPA", () => {
    test("vowels a→ɑ, ə→æ, ö→œ, ü→y", () => {
        expect(phonemizeWord("salam")).toBe("sɑɫˈɑm"); // a → ɑ, dark-l
        expect(phonemizeWord("əl")).toBe("ˈæl"); // ə → æ
        expect(phonemizeWord("dörd")).toBe("dˈœɾd"); // ö → œ
        expect(phonemizeWord("gözəl")).toBe("ɟœzˈæl"); // ö→œ, ə→æ, g→ɟ
    });

    test("k/g palatalize before a front vowel; q → ɡ (final → x)", () => {
        expect(phonemizeWord("kitab")).toBe("citˈɑb"); // k → c before front i
        expect(phonemizeWord("kənd")).toBe("cˈænd"); // k → c before front ə
        expect(phonemizeWord("gəlmək")).toBe("ɟælmˈæc"); // g → ɟ, final k → c (front)
        expect(phonemizeWord("qapı")).toBe("ɡɑpˈɯ"); // q → ɡ
        expect(phonemizeWord("oxumaq")).toBe("oxumˈɑx"); // final q → x (devoicing)
        expect(phonemizeWord("balıq")).toBe("bɑɫˈɯx"); // final q → x
    });

    test("x → x (velar fricative); ğ → ɣ; geminate stops", () => {
        expect(phonemizeWord("yaxşı")).toBe("jɑxʃˈɯ"); // x → x
        expect(phonemizeWord("dağ")).toBe("dˈɑɣ"); // ğ → ɣ
        expect(phonemizeWord("oğul")).toBe("oɣˈuɫ"); // ğ → ɣ, dark-l coda
        expect(phonemizeWord("səkkiz")).toBe("sæcːˈiz"); // kk → cː (geminate + palatalization)
    });

    test("c → d͡ʒ, ç → t͡ʃ", () => {
        expect(phonemizeWord("çörək")).toBe("t͡ʃœɾˈæc"); // ç → t͡ʃ, final k → c
    });

    test("numbers (final stress; bir dropped before yüz/min)", () => {
        const d = createAzerbaijani();
        expect(d.text("21").trim()).toBe("ijiɾmˈi bˈiɾ"); // iyirmi bir
        expect(d.text("100").trim()).toBe("jˈyz"); // yüz (not bir yüz)
        expect(d.text("1985").trim()).toBe("mˈin doɡːˈuz jˈyz sæcsˈæn bˈeʃ"); // min doqquz yüz səksən beş
    });

    test("dotted-I tokenization: capital İ→i, capital I→ı (not dropped)", () => {
        const d = createAzerbaijani();
        expect(d.text("İki").trim()).toBe("icˈi"); // İ must NOT be dropped by the tokenizer
        expect(d.text("salam İki").trim()).toBe("sɑɫˈɑm icˈi");
        expect(d.text("Irəli").trim()).toBe("ɯɾælˈi"); // capital dotless I → ı
    });
});

// Roman-numeral ORDINAL policy (src/languages/azerbaijani/romanOrdinals.ts). az.wikipedia "Sıra sayı" gives a
// Roman numeral as one of the three ways to WRITE an ordinal ("Roma rəqəmlərindən sonra heç bir şəkilçi
// işlədilmir", with XX əsr / IX sinif as its examples), so XIX əsr is *on doqquzuncu əsr*. Suffixing rule over
// the language's own cardinals with four-way harmony; no gender, so no agreement limitation.
describe("Azerbaijani roman-numeral ordinals", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal?.(n);

    test("four-way harmony of the ordinal suffix; only the last element takes it", () => {
        expect(ord(1)).toBe("birinci");
        expect(ord(2)).toBe("ikinci"); // vowel-final stem → no linking vowel
        expect(ord(4)).toBe("dördüncü"); // ö → ü class
        expect(ord(9)).toBe("doqquzuncu"); // u class
        expect(ord(19)).toBe("on doqquzuncu");
        expect(ord(40)).toBe("qırxıncı"); // ı class
        expect(ord(50)).toBe("əllinci");
        expect(ord(63)).toBe("altmış üçüncü"); // past 50 — anniversary / congress range
        expect(ord(80)).toBe("səksəninci"); // ə → i class
        expect(ord(90)).toBe("doxsanıncı"); // a → ı class
        expect(ord(100)).toBe("yüzüncü");
        expect(ord(101)).toBeUndefined(); // out of range → the caller falls back to the cardinal
    });

    test("context matches the agglutinated century forms (unanchored)", () => {
        for (const w of ["əsr", "əsrdə", "əsrin", "əsri", "əsrlər", "yüzillik", "minillik", "ildönümü", "sinif"])
            expect(ROMAN_POLICY.ordinalAfter?.test(w)).toBe(true);
        expect(ROMAN_POLICY.ordinalAfter?.test("əsas")).toBe(false);
    });

    test("the ordinal reading phonemizes in context", () => {
        expect(getPhonemizer("az").text("on doqquzuncu əsr").trim()).toBe("ˈon doɡːuzund͡ʒˈu ˈæsɾ");
        expect(getPhonemizer("az").text("əllinci ildönüm").trim()).toBe("ællind͡ʒˈi ildœnˈym");
    });

    test("a bare roman numeral still reads as a CARDINAL", () => {
        expect(getPhonemizer("az").text("xix").trim()).toBe("ˈon doɡːˈuz"); // on doqquz, not on doqquzuncu
    });
});
