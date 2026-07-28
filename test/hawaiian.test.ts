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
