import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/maithili/maithili.ts";

// Canonical-IPA goldens for Maithili / मैथिली (mai) — Eastern Indo-Aryan (Bihari group), Devanagari. Reuses the
// Hindi engine with the Maithili divergences: SHORT e/o (incl. the dedicated short-e/short-o letters ऎ/ऒ), the
// diphthongs ऐ→[əɪ] / औ→[əʊ], inherent /ə/. Maithili's signature — a cluster schwa Hindi deletes → Maithili
// reduces to ULTRASHORT [ᵊ] — is a narrow detail (folded in the eval). single-source: only referee is
// wikipron mai_deva narrow (167, human).
describe("Maithili canonical IPA", () => {
    test("short e/o — incl. the dedicated ऎ (U+090E) / ऒ (U+0912) letters", () => {
        expect(phonemizeWord("एकरा")).toBe("ˈekɾaː"); // ए short e (Hindi would be eː)
        expect(phonemizeWord("ऎकरा")).toBe("ˈekɾaː"); // ऎ = the Maithili short-e letter (was dropped before the fix)
    });

    test("diphthongs ऐ→[əɪ], औ→[əʊ] (wikipron-confirmed)", () => {
        expect(phonemizeWord("बैसब")).toBe("bˈəɪsəb"); // ऐ → əɪ (exact match to wikipron)
        expect(phonemizeWord("दौड़ब")).toBe("d̪ˈəʊɽəb"); // औ → əʊ
    });

    test("shared Indo-Aryan core (Hindi-identical where Maithili does not diverge)", () => {
        expect(phonemizeWord("मीत")).toBe("mˈiːt̪"); // 'friend'
        expect(phonemizeWord("पुस्तक")).toBe("pˈʊst̪ək"); // 'book'
        expect(phonemizeWord("गाछ")).toBe("ɡˈaːt͡ʃʰ"); // 'tree' (a characteristic Eastern-IA word; च = t͡ʃ, referee t͡ɕ)
    });
});
