import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/akan/akan.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Akan / Akan kasa (ak) — a Kwa (Niger-Congo) language of Ghana, the fleet's FIRST Kwa
// language. Shallow, well-standardised Latin orthography (Asante/Akuapem Twi + Fante). The signature is the
// consonant DIGRAPH system: a palatal series ⟨ky gy hy ny⟩ → t͡ɕ d͡ʑ ɕ ɲ and a LABIALISED series ⟨tw dw kw gw hw
// nw⟩ → t͡ɕʷ d͡ʑʷ kʷ ɡʷ ɕʷ ŋʷ, plus Glide Formation (round vowel before another vowel → w, boa→bwa; Paster 2010) and
// coda-nasal place assimilation (nkran→ŋkran). TONE (H/L) and ATR allophony are unwritten in the orthography →
// deferred. Authored from Dolphyne (1988) / Paster (2010); anchored on the kaikki Akan human readings (16/22, the
// misses being documented glide-formation vs citation, or deferred ATR). See docs/investigations/ak_native_bringup_investigation.md.
describe("Akan (Twi) canonical IPA", () => {
    test("palatal digraph series ⟨ky gy hy ny⟩", () => {
        expect(phonemizeWord("kyerɛ")).toBe("t͡ɕɪrɛ"); // ky → t͡ɕ; ⟨e⟩ → [ɪ] via ATR harmony (−ATR word, has ɛ)
        expect(phonemizeWord("gyina")).toBe("d͡ʑina"); // gy → d͡ʑ ("stand")
        expect(phonemizeWord("ɔhyɛ")).toBe("ɔɕɛ"); // hy → ɕ
        expect(phonemizeWord("nyansa")).toBe("ɲansa"); // ny → ɲ ("wisdom")
    });

    test("labialised digraph series ⟨tw dw kw hw⟩ — the signature Akan labial-palatalisation", () => {
        expect(phonemizeWord("twi")).toBe("t͡ɕʷi"); // the language's own name
        expect(phonemizeWord("dwom")).toBe("d͡ʑʷom"); // dw → d͡ʑʷ ("song")
        expect(phonemizeWord("kwan")).toBe("kʷan"); // kw → kʷ ("road/way")
        expect(phonemizeWord("hwɛ")).toBe("ɕʷɛ"); // hw → ɕʷ ("look")
        expect(phonemizeWord("akwaaba")).toBe("akʷaaba"); // "welcome"
    });

    test("Glide Formation — round vowel before another vowel → w (Paster 2010)", () => {
        expect(phonemizeWord("boa")).toBe("bwa"); // /boa/ → [bwa] ("help")
    });

    test("coda-nasal place assimilation + basics", () => {
        expect(phonemizeWord("nkran")).toBe("ŋkran"); // n → ŋ before k (Accra)
        expect(phonemizeWord("asɛm")).toBe("asɛm"); // ("matter/word")
        expect(phonemizeWord("ɔkɔtɔ")).toBe("ɔkɔtɔ"); // ("crab")
    });

    test("ATR harmony resolves ⟨e⟩/⟨o⟩ (the unwritten [+ATR]/[−ATR] merger)", () => {
        expect(phonemizeWord("bisa")).toBe("bisa"); // +ATR (has i) — ⟨a⟩ neutral
        expect(phonemizeWord("ɔkɔtɔ")).toBe("ɔkɔtɔ"); // −ATR (ɔ), no ambiguous mid
        expect(phonemizeWord("obue")).toBe("obwe"); // +ATR (has u) → ⟨o⟩→o, ⟨e⟩→e, + glide formation
    });

    test("numbers — Twi cardinals through the g2p", () => {
        const ak = getPhonemizer("ak");
        expect(ak.text("12").trim()).toBe("du mmienu"); // du + mmienu
        expect(ak.text("21").trim()).toBe("adwonu baako"); // aduonu (→ glide adwonu) + baako
        expect(ak.text("100").trim()).toBe("ɔha");
    });

    test("full text via the registry", () => {
        expect(getPhonemizer("ak").text("Akwaaba, wo ho te sɛn?")).toBeTruthy();
    });
});
