import { describe, expect, test } from "vitest";

import { ROMAN_POLICY } from "../src/languages/uzbek/romanOrdinals.ts";
import { phonemizeWord } from "../src/languages/uzbek/uzbek.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Uzbek / oʻzbekcha (uz) — Turkic, modern LATIN orthography. Uzbek is the Turkic
// outlier that LOST vowel harmony (Persian/Tajik contact), so the g2p is a flat scan with fixed letter values.
// Signature: the vowel split ⟨o⟩→[ɒ] vs ⟨oʻ⟩→[o]; digraphs sh/ch/ng + the comma-letters oʻ/gʻ; the separate
// tutuq belgisi (ʼ) → glottal [ʔ]. Validated at 91.3% vs wikipron uzb_latn + 87.1% vs kaikki (folded). See
// docs/investigations/uz_native_bringup_investigation.md.
describe("Uzbek canonical IPA", () => {
    test("the vowel split ⟨o⟩→[ɒ] vs ⟨oʻ⟩→[o] (the signature)", () => {
        expect(phonemizeWord("Oʻzbekiston")).toBe("ozbekistˈɒn"); // oʻ→o, o→ɒ in one word
        expect(phonemizeWord("Toshkent")).toBe("tɒʃkˈent"); // o→ɒ, sh→ʃ
    });

    test("the comma-letters gʻ→ʁ, oʻ→o and the digraphs sh/ch/ng", () => {
        expect(phonemizeWord("gʻalaba")).toBe("ʁalabˈa"); // gʻ → ʁ (voiced uvular)
        expect(phonemizeWord("qishloq")).toBe("qiʃlˈɒq"); // sh→ʃ, q, o→ɒ
        expect(phonemizeWord("rang")).toBe("rˈaŋ"); // ng → ŋ
        expect(phonemizeWord("toʻngʻiz")).toBe("tonʁˈiz"); // n+gʻ must NOT be parsed as ng+ʻ (→ ton-ʁ, not toŋ-ʔ)
        expect(phonemizeWord("chiroyli")).toBe("t͡ʃirɒjlˈi"); // ch→t͡ʃ, y→j, o→ɒ
    });

    test("tutuq belgisi (ʼ) → glottal [ʔ], distinct from the comma-letters", () => {
        expect(phonemizeWord("sanʼat")).toBe("sanʔˈat"); // 'art' — apostrophe not after o/g → glottal
    });

    test("numbers compose (Turkic decimal — no fusion)", () => {
        expect(getPhonemizer("uz").text("11").trim()).toBe("ˈon bˈir"); // oʻn bir
        expect(getPhonemizer("uz").text("25").trim()).toBe("jiɡirmˈa bˈeʃ"); // yigirma besh
        expect(getPhonemizer("uz").text("1984").trim()).toBe("mˈiŋ toqqˈiz jˈuz saksˈɒn tˈort"); // ming toʻqqiz yuz sakson toʻrt
    });
});

// Roman-numeral ORDINAL policy (src/languages/uzbek/romanOrdinals.ts). The orthography's ordinal rule —
// cardinal + -nchi / -inchi, hyphenated after an Arabic numeral but "Rim raqamlaridan keyin chiziqcha
// yozilmaydi" — makes a Roman numeral the ordinal writing, so XIX asr is *oʻn toʻqqizinchi asr*; the spelled
// century is attested for the round value ("Yigirmanchi asr"). Uzbek lost vowel harmony, so ONE suffix shape.
describe("Uzbek roman-numeral ordinals", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal?.(n);

    test("one suffix shape: -nchi after a vowel, -inchi after a consonant", () => {
        expect(ord(1)).toBe("birinchi");
        expect(ord(4)).toBe("toʻrtinchi"); // ʻ (U+02BB) is not a vowel → consonant-final
        expect(ord(6)).toBe("oltinchi"); // vowel-final → -nchi
        expect(ord(19)).toBe("oʻn toʻqqizinchi");
        expect(ord(20)).toBe("yigirmanchi"); // the attested spelled century
        expect(ord(40)).toBe("qirqinchi");
        expect(ord(50)).toBe("ellikinchi");
        expect(ord(63)).toBe("oltmish uchinchi"); // past 50 — anniversary / congress range
        expect(ord(100)).toBe("yuzinchi");
        expect(ord(101)).toBeUndefined(); // out of range → the caller falls back to the cardinal
    });

    test("context matches the agglutinated century forms (unanchored)", () => {
        for (const w of ["asr", "asrda", "asrning", "asrlar", "asrga", "yuzyillik", "mingyillik", "sinf"])
            expect(ROMAN_POLICY.ordinalAfter?.test(w)).toBe(true);
        expect(ROMAN_POLICY.ordinalAfter?.test("aslida")).toBe(false);
    });

    test("the ordinal reading phonemizes in context", () => {
        expect(getPhonemizer("uz").text("oʻn toʻqqizinchi asr").trim()).toBe("ˈon toqqizint͡ʃˈi ˈasr");
        expect(getPhonemizer("uz").text("ellikinchi yubiley").trim()).toBe("ellikint͡ʃˈi jubilˈej");
    });

    test("a bare roman numeral still reads as a CARDINAL", () => {
        expect(getPhonemizer("uz").text("xix").trim()).toBe("ˈon toqqˈiz"); // oʻn toʻqqiz, not …toʻqqizinchi
    });
});
