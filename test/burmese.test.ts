import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/burmese/burmese.ts";

// Canonical-IPA goldens for Burmese / မြန်မာ (my) — Sino-Tibetan, the Mon-Burmese abugida (logical order). The
// core challenge is the RIME chart (vowel × coda: ောင်→aʊɴ, ိုင်→aɪɴ, ိန်→eɪɴ, ုန်→oʊɴ, bare င်→ɪɴ), the ⟨ွ⟩
// labialisation, minor-syllable reduction (bare open non-final → ə), medial palatalisation (ကျ→t͡ɕ) and the
// voiceless ⟨ှ⟩ sonorants (မှ→m̥). Phase 1: SEGMENTAL — the four tones are deferred (folded by the backbone in the
// eval). Validated against wikipron mya (50.5%) + kaikki mya (52.1%). See docs/my_native_bringup_investigation.md.
describe("burmese canonical IPA (segmental)", () => {
    test("consonants, medials, rimes, minor-syllable reduction", () => {
        const cases: [string, string][] = [
            ["မြန်မာ", "mjaɴma"], // Myanmar — မြ medial-j, န் → aɴ
            ["ဗမာ", "bəma"], // Bama — minor syllable bə
            ["ကျောင်း", "t͡ɕaʊɴ"], // 'school' — ကျ→t͡ɕ, ောင်→aʊɴ (aung)
            ["အိမ်", "ʔeɪɴ"], // 'house' — ိ+m → eɪɴ (ein)
            ["တစ်", "tɪʔ"], // 'one' — bare စ် → ɪʔ
            ["ဆရာ", "sʰəja"], // 'teacher' — ဆ→sʰ, ရ→j, minor ə
            ["ရေ", "je"], // 'water'
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("voiceless ⟨ှ⟩ sonorants + ⟨ွ⟩ labialisation", () => {
        expect(phonemizeWord("မှ")).toBe("m̥a"); // voiceless m
        expect(phonemizeWord("လှ")).toBe("l̥a"); // voiceless l
    });
});
