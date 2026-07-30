import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/hawaiian/hawaiian.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Hawaiian / ʻŌlelo Hawaiʻi (haw) — Austronesian (Eastern Polynesian, sibling of Māori).
// One of the SIMPLEST phonologies in the world: 5 vowels + the macron (kahakō) = length, 8 consonants + the ʻokina
// ⟨ʻ⟩→[ʔ], loan-letter adaptation (t→k, s→k, r→l, …). Validated 98.9% folded / 99.8% symbol vs wikipron
// haw_latn_broad (human, 2152; the only residual is alphabet letter-name rows). See docs/investigations/haw_native_bringup_investigation.md.
describe("Hawaiian (ʻŌlelo Hawaiʻi) canonical IPA", () => {
    test("the ʻokina ⟨ʻ⟩→[ʔ] + the macron (kahakō) = length", () => {
        expect(phonemizeWord("Hawaiʻi")).toBe("hawaiʔi"); // the ʻokina → glottal stop [ʔ]
        expect(phonemizeWord("kāne")).toBe("kaːne"); // macron ⟨ā⟩ → long [aː] (man)
        expect(phonemizeWord("ʻāina")).toBe("ʔaːina"); // ʻokina + macron (land)
        expect(phonemizeWord("Kalaniʻōpuʻu")).toBe("kalaniʔoːpuʔu"); // two ʻokina + a macron
    });

    test("the 8 native consonants + 5 vowels (near-1:1)", () => {
        expect(phonemizeWord("aloha")).toBe("aloha"); // love/greeting
        expect(phonemizeWord("mahalo")).toBe("mahalo"); // thanks
        expect(phonemizeWord("pōhaku")).toBe("poːhaku"); // ⟨ō⟩ → [oː] (stone)
        expect(phonemizeWord("keiki")).toBe("keiki"); // child
    });

    test("loan-letter adaptation (t→k, g→k, r→l, b→p, d→k)", () => {
        expect(phonemizeWord("Aigupita")).toBe("aikupika"); // Egypt: ⟨t⟩→[k], ⟨g⟩→[k]
        expect(phonemizeWord("Doreka")).toBe("koleka"); // ⟨d⟩→[k], ⟨r⟩→[l]
    });

    test("registry wiring", () => {
        expect(getPhonemizer("haw").text("aloha").trim()).toBe("aloha");
    });
});

// Hawaiian cardinal numbers (numbers.ts): the ʻe-prefixed standalone units vs. the bare stems inside a compound, the
// kana- tens, and the additive connective kūmā fused into ONE word (iwakāluakūmālima 25). The powers of ten are
// English loans (haneli, kaukani, miliona, biliona) and take the multiplier hoʻokahi for 1. Note the numerals are
// written with the ʻOKINA (U+02BB) and the KAHAKŌ, both phonemic here — [ʔ] and vowel length. Sources cited in
// hawaiian.jsonc + numbers.ts.
describe("Hawaiian cardinal numbers", () => {
    const haw = getPhonemizer("haw");
    const say = (n: number): string => haw.text(String(n)).trim();

    test("units (ʻe- prefix → the ʻokina is a real consonant) and the kana- tens", () => {
        expect(say(0)).toBe("ʔole"); // ʻole
        expect(say(5)).toBe("ʔelima"); // ʻelima
        expect(say(20)).toBe("iwakaːlua"); // iwakālua (irregular; macron = length)
        expect(say(40)).toBe("kanahaː"); // kanahā = kana- + hā
    });

    test("11-99: tens + kūmā + bare stem, fused into one word", () => {
        expect(say(11)).toBe("ʔumikuːmaːkahi"); // ʻumikūmākahi
        expect(say(25)).toBe("iwakaːluakuːmaːlima"); // iwakāluakūmālima
        expect(say(99)).toBe("kanaiwakuːmaːiwa"); // kanaiwakūmāiwa
    });

    test("hundreds / thousands / millions — juxtaposed, no kūmā after haneli", () => {
        expect(say(100)).toBe("hoʔokahi haneli"); // hoʻokahi haneli
        expect(say(101)).toBe("hoʔokahi haneli ʔekahi"); // hoʻokahi haneli ʻekahi
        expect(say(555)).toBe("ʔelima haneli kanalimakuːmaːlima"); // ʻelima haneli kanalimakūmālima
        expect(say(1000)).toBe("hoʔokahi kaukani"); // hoʻokahi kaukani
        expect(say(1000000)).toBe("hoʔokahi miliona"); // hoʻokahi miliona
        expect(say(1000000000)).toBe("hoʔokahi piliona"); // biliona — the loan ⟨b⟩ adapts to [p]
    });
});
