import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/urdu/urdu.ts";

// Canonical-IPA goldens for Urdu (ur) — Perso-Arabic abjad, Hindi phoneme inventory. The g2p produces the
// consonant + LONG-vowel skeleton (aspiration via ھ, retroflex ٹ ڈ ڑ, dental t̪ d̪, long vowels ا/و/ی/ے,
// nasal place assimilation) with a default [ə] for the omitted SHORT vowels — full short-vowel restoration is
// the deferred subsystem (🟠). These goldens are long-vowel-dominant words where the skeleton IS the answer.
// See docs/ur_native_bringup_investigation.md.
describe("urdu canonical IPA", () => {
    test("consonant + long-vowel skeleton (aspiration, retroflex, long vowels)", () => {
        const cases: [string, string][] = [
            ["آباد", "ɑːbɑːd̪"], // abad: ا→ɑː, د dental
            ["پانی", "pɑːnˈiː"], // pani: long ɑː + iː
            ["ہاتھ", "ɦɑːt̪ʰ"], // hath: aspirated t̪ʰ via ھ
            ["بھائی", "bʱɑːˈiː"], // bhai: breathy bʱ, hamza-seat ئ→iː
            ["آواز", "ɑːʋɑːz"], // awaz: و as glide ʋ after ɑː
            ["نام", "nɑːm"], // nam
            ["آئینہ", "ɑːˈiːnɑ"], // aina: final ہ → [ɑ] vowel
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("nasal place assimilation (n→ŋ before velar, n→m before labial)", () => {
        expect(phonemizeWord("انگور")).toBe("əŋɡˈoːɾ"); // angur: n→ŋ before ɡ
        expect(phonemizeWord("انبار")).toBe("ˈəmbɑːɾ"); // ambar: n→m before b
    });

    test("text: words + Urdu full-stop (۔) pause", () => {
        expect(phonemize("میرا نام", "ur")).toContain("nɑːm");
    });
});
