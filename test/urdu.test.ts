import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/urdu/urdu.ts";

// Canonical-IPA goldens for Urdu (ur) — Perso-Arabic abjad, Hindi phoneme inventory. The g2p produces the
// consonant + LONG-vowel skeleton (aspiration via ھ, retroflex ٹ ڈ ڑ, dental t̪ d̪, long vowels ا/و/ی/ے,
// nasal place assimilation) with a default [ə] for the omitted SHORT vowels — full short-vowel restoration is
// the deferred subsystem (🟠). These goldens are long-vowel-dominant words where the skeleton IS the answer.
// See docs/investigations/ur_native_bringup_investigation.md.
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
        expect(phonemizeWord("انگور")).toBe("əŋɡˈuːɾ"); // angūr: n→ŋ before ɡ; و→uː from the coverage lexicon (انگُور)
        expect(phonemizeWord("انبار")).toBe("ˈəmbɑːɾ"); // ambar: n→m before b
    });

    test("text: words + Urdu full-stop (۔) pause", () => {
        expect(phonemize("میرا نام", "ur")).toContain("nɑːm");
    });

    // COVERAGE layer (lexicon-ipa.tsv): an undiacritized skeleton we've mined is returned as canonical IPA directly,
    // short-circuiting the g2p's default schwa. Miss → default-ə core; caller-supplied harakat → respected.
    test("IPA coverage lexicon restores mined short/long vowels", () => {
        expect(phonemizeWord("آبرو")).toBe("ɑːbɾˈuː"); // ābrū: و→uː from the lexicon, not default oː
        expect(phonemizeWord("آبرُو")).toBe("ɑːbɾˈuː"); // caller-supplied damma is respected (not clobbered)
    });

    // MAJHŪL long-vowel quality — the distinction harakat CANNOT encode (no diacritic for ی=iː~eː or و=oː~uː);
    // the IPA lexicon carries it from the cross-script Hindi gold (Devanagari writes ई/ए, ऊ/ओ). The g2p default
    // would give iː/oː for every ی/و.
    test("IPA lexicon resolves majhūl long-vowel quality (beyond harakat)", () => {
        expect(phonemizeWord("نکیل")).toBe("nəkˈeːl"); // nakel: ی→eː (default would be iː)
        expect(phonemizeWord("کھجور")).toBe("kʰəd͡ʒˈuːɾ"); // khajūr: و→uː (default would be oː)
    });
});
