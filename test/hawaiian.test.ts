import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/hawaiian/hawaiian.ts";
import { getPhonemizer } from "../src/registry.ts";
import { normalizeHawaiian } from "../src/languages/hawaiian/normalize.ts";
import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Hawaiian / ʻŌlelo Hawaiʻi (haw) — Austronesian (Eastern Polynesian, sibling of Māori).
// One of the SIMPLEST phonologies in the world: 5 vowels + the macron (kahakō) = length, 8 consonants + the ʻokina
// ⟨ʻ⟩→[ʔ], loan-letter adaptation (t→k, s→k, r→l, …). Referee: wikipron haw_latn_broad (human) — the only
// residual is alphabet letter-name rows.
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

// ── TEXT NORMALIZATION (src/languages/hawaiian/normalize.ts) ────────────────────────────────────────
// The argument for every case is in the normalizer's own header.
describe("Hawaiian text normalization", () => {
    test("⚠ the coordinate is glossed against its own notation — and the compass letters are ʻĀ and K", () => {
        expect(normalizeHawaiian("ma 28\u00b025\u2032\u02bb\u0100, 178\u00b020\u2032K"))
            .toBe("ma 28 k\u0113kel\u0113 25 minuke \u02bb\u0101kau, 178 k\u0113kel\u0113 20 minuke komohana");
        // ⚠ `H` is NOT claimed — it would be ambiguous between hema (south) and hikina (east)
        expect(normalizeHawaiian("28\u00b012\u2032H")).toBe("28 k\u0113kel\u0113 12 minuke H");
    });

    test("⚠ the degree sign has a confusable: U+00B0 and U+02DA RING ABOVE", () => {
        expect(normalizeHawaiian("25\u00b0")).toBe("25 k\u0113kel\u0113 ");
        expect(normalizeHawaiian("38.4\u02daF")).toBe("38 4 k\u0113kel\u0113 F");
    });

    test("the separators: the comma groups, the dot decimates — and groups once", () => {
        expect(normalizeHawaiian("435,036")).toBe("435036");
        expect(normalizeHawaiian("3,849,674")).toBe("3849674");
        expect(normalizeHawaiian("19.95")).toBe("19 95"); // no decimal word is sourceable — neutralised
        // ⚠ one German figure quoted inside a Hawaiian sentence groups with a DOT
        expect(normalizeHawaiian("357.600")).toBe("357600");
        // ⚠ …and the guard declines an IP address: a decimal has exactly ONE dot
        expect(normalizeHawaiian("18.55.6.215")).toBe("18.55.6.215");
    });

    test("⚠ the scripture colon is a DIFFERENT CODEPOINT from the clock", () => {
        // U+02D0 MODIFIER LETTER TRIANGULAR COLON — a Bible reference, untouched
        expect(normalizeHawaiian("\u02bbOihana Kahuna 8\u02d010")).toBe("\u02bbOihana Kahuna 8\u02d010");
        // ASCII colon — a clock, spent
        expect(normalizeHawaiian("ka hola 12:18")).toBe("ka hola 12 18");
        expect(normalizeHawaiian("mai ka hola 12:00 awakea")).toBe("mai ka hola 12 00 awakea");
    });

    test("the whole pipeline: the corpus's OWN unit abbreviations, and the `o ka` rate", () => {
        // ⚠ `klm` is kilomika and `kp` is kapuaʻi — neither is the SI abbreviation
        expect(phonemize("3,200 klm", "haw").trim()).toContain("kilomika");
        expect(phonemize("13,796 kp", "haw").trim()).toContain("kapua\u0294i");
        // ⚠ `kuea` FOLLOWS the unit, unlike the Turkic rounds either side of this one
        expect(phonemize("4,028 km\u00b2", "haw").trim()).toContain("kilomika kuea");
        // the rate connective is the corpus's own two-word phrase
        expect(phonemize("118 km/h", "haw").trim()).toContain("kilomika o ka hola");
        expect(phonemize("20% o n\u0101 k\u0101naka", "haw").trim()).toContain("pa\u02d0ke\u02d0neka");
    });
});
