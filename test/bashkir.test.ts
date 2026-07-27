import { describe, expect, test } from "vitest";

import { phonemizeWord, phonemizeWordNative, isRussianLoan } from "../src/languages/bashkir/bashkir.ts";

// Canonical-IPA goldens for Bashkir (ba) — Башҡорт теле, Kipchak Turkic (sibling of Tatar), CYRILLIC. Signatures:
// the INTERDENTAL fricatives ⟨ҫ⟩→[θ], ⟨ҙ⟩→[ð] (Bashkir's hallmark); the WRITTEN uvulars ⟨ҡ⟩→[q], ⟨ғ⟩→[ʁ] (no harmony
// inference — unlike Tatar); the Bashkir VOWEL SHIFT ⟨о⟩→[ʊ], ⟨ө⟩→[ʏ], ⟨ы⟩→[ɯ], ⟨е⟩→[ɪ]; dark ⟨л⟩→[ɫ] (back harmony);
// ⟨у ү⟩→[w] after a vowel. ★ Real Bashkir text is loan-heavy → a detected RUSSIAN LOAN (vowel-harmony violation) is
// routed to the Russian g2p. Referee: kaikki Bashkir (REFEREE-LIMITED by Russian loans). See docs/investigations/ba_native_bringup_investigation.md.
describe("Bashkir (Башҡорт теле) canonical IPA", () => {
    test("the INTERDENTAL hallmark ⟨ҫ⟩→θ, ⟨ҙ⟩→ð + written uvulars ⟨ҡ ғ⟩", () => {
        expect(phonemizeWordNative("аҫыл")).toBe("ɑˈθɯɫ"); // 'noble' — ⟨ҫ⟩→[θ] interdental
        expect(phonemizeWordNative("ҙур")).toBe("ˈðuɾ"); // 'big' — ⟨ҙ⟩→[ð] interdental
        expect(phonemizeWordNative("башҡорт")).toBe("bɑʂˈqʊɾt"); // 'Bashkir' — ⟨ҡ⟩→[q], ⟨ш⟩→ʂ, ⟨о⟩→ʊ
        expect(phonemizeWordNative("ҡыҙыл")).toBe("qɯˈðɯɫ"); // 'red' — ⟨ҡ⟩→[q], ⟨ҙ⟩→[ð], dark ⟨л⟩→[ɫ]
    });

    test("the Bashkir vowel shift + ⟨у⟩ glide", () => {
        expect(phonemizeWordNative("көн")).toBe("ˈkʏn"); // 'day' — ⟨ө⟩→[ʏ]
        expect(phonemizeWordNative("балыҡ")).toBe("bɑˈɫɯq"); // 'fish' — ⟨ы⟩→[ɯ], dark ⟨л⟩
        expect(phonemizeWordNative("һыу")).toBe("ˈhɯw"); // 'water' — ⟨һ⟩→h, ⟨ы⟩→ɯ, ⟨у⟩ after a vowel → [w]
        expect(phonemizeWordNative("йәшел")).toBe("jæˈʂɪl"); // 'green' — ⟨ә⟩→æ, ⟨е⟩→[ɪ]
    });

    test("Russian-loan detection routes to the Russian g2p (a reality of Bashkir text)", () => {
        expect(isRussianLoan("республика")).toBe(true); // mixes back + front vowels, no Bashkir letter → loan
        expect(isRussianLoan("Украина")).toBe(true);
        expect(isRussianLoan("башҡорт")).toBe(false); // has ⟨ҡ⟩ → native
        expect(isRussianLoan("балыҡ")).toBe(false); // all-back harmony → native
        expect(phonemizeWord("республика")).toContain("rʲ"); // routed to Russian → palatalization the native scan can't make
    });
});
