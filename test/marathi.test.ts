import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/marathi/marathi.ts";

// Canonical-IPA goldens for Marathi (mr) — Devanagari; REUSES the Hindi abugida engine with a Marathi data file.
// Marathi-specific facts: ळ→retroflex lateral ɭ, ष→retroflex ʂ (Hindi merges to ʃ), च/ज→DENTAL affricate
// [t͡s d͡z] before a back/central vowel (चार→t͡saːɾ), ऐ→[əi] / औ→[əu] diphthongs (दैव→d̪əiʋ), ऋ/ृ→[ɾu].
// See docs/mr_native_bringup_investigation.md.
describe("marathi canonical IPA", () => {
    test("Marathi-specific segments (ळ, ष, dental affricate, diphthongs)", () => {
        const cases: [string, string][] = [
            ["चार", "t͡sˈaːɾ"], // 'four': च → dental t͡s before ā
            ["जन", "d͡zˈən"], // 'people': ज → dental d͡z
            ["कमळ", "kˈəməɭ"], // 'lotus': ळ → retroflex lateral ɭ
            ["शाळा", "ʃˈaːɭaː"], // 'school': ळ
            ["षटकोन", "ʂəʈkˈoːn"], // 'hexagon': ष → retroflex ʂ
            ["दैव", "d̪ˈəiʋ"], // 'fate': ऐ → diphthong əi (not Hindi ɛː)
            ["मराठी", "məɾˈaːʈʰiː"], // 'Marathi': retroflex ʈʰ
            ["घर", "ɡʱˈəɾ"], // 'house': breathy ɡʱ + schwa deletion
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("text: word run + Devanagari danda", () => {
        expect(phonemize("मराठी भाषा.", "mr")).toContain("məɾˈaːʈʰiː");
    });
});
