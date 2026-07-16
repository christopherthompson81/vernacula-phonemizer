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

    test("word-final schwa: retained after a cluster/geminate, deleted after a single consonant", () => {
        // Marathi keeps the word-final inherent schwa to avoid a final consonant cluster (unlike Hindi, which
        // deletes both) — retainFinalAfterCluster. Affricates count as ONE consonant; a geminate is heavy.
        const cases: [string, string][] = [
            ["शब्द", "ʃˈəbd̪ə"], // ब्द conjunct → schwa retained (the canonical literature example, Wikipedia "Schwa deletion in Indo-Aryan languages")
            ["अंक", "ˈə̃ŋkə"], // ŋk cluster → schwa retained
            ["महत्त्व", "məɦˈət̪ːʋə"], // त्त्व cluster → retained
            ["अन्न", "ˈənːə"], // न्न geminate → retained
            ["बुद्ध", "bˈʊd̪ʱːə"], // द्ध geminate → retained
            ["घर", "ɡʱˈəɾ"], // single ɾ → deleted
            ["आज", "ˈaːd͡z"], // final affricate d͡z is ONE consonant → deleted
            ["नाच", "nˈaːt͡s"], // final affricate t͡s → deleted
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("text: word run + Devanagari danda", () => {
        expect(phonemize("मराठी भाषा.", "mr")).toContain("məɾˈaːʈʰiː");
    });
});
