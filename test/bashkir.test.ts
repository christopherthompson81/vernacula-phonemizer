import { describe, expect, test } from "vitest";

import { phonemizeWord, phonemizeWordNative, isRussianLoan } from "../src/languages/bashkir/bashkir.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Bashkir (ba) — Башҡорт теле, Kipchak Turkic (sibling of Tatar), CYRILLIC. Signatures:
// the INTERDENTAL fricatives ⟨ҫ⟩→[θ], ⟨ҙ⟩→[ð] (Bashkir's hallmark); the WRITTEN uvulars ⟨ҡ⟩→[q], ⟨ғ⟩→[ʁ] (no harmony
// inference — unlike Tatar); the Bashkir VOWEL SHIFT ⟨о⟩→[ʊ], ⟨ө⟩→[ø], ⟨ы⟩→[ɯ], ⟨е⟩→[ɪ]; dark ⟨л⟩→[ɫ] (back harmony);
// ⟨у ү⟩→[w] after a vowel. Real Bashkir text is loan-heavy → a detected RUSSIAN LOAN (vowel-harmony violation) is
// routed to the Russian g2p. Referee: kaikki Bashkir (REFEREE-LIMITED by Russian loans).
describe("Bashkir (Башҡорт теле) canonical IPA", () => {
    test("the INTERDENTAL hallmark ⟨ҫ⟩→θ, ⟨ҙ⟩→ð + written uvulars ⟨ҡ ғ⟩", () => {
        expect(phonemizeWordNative("аҫыл")).toBe("ɑˈθɯɫ"); // 'noble' — ⟨ҫ⟩→[θ] interdental
        expect(phonemizeWordNative("ҙур")).toBe("ˈðuɾ"); // 'big' — ⟨ҙ⟩→[ð] interdental
        expect(phonemizeWordNative("башҡорт")).toBe("bɑʃˈqʊɾt"); // 'Bashkir' — ⟨ҡ⟩→[q], ⟨ш⟩→ʃ, ⟨о⟩→ʊ
        expect(phonemizeWordNative("ҡыҙыл")).toBe("qɯˈðɯɫ"); // 'red' — ⟨ҡ⟩→[q], ⟨ҙ⟩→[ð], dark ⟨л⟩→[ɫ]
    });

    test("the Bashkir vowel shift + ⟨у⟩ glide", () => {
        expect(phonemizeWordNative("көн")).toBe("ˈkøn"); // 'day' — ⟨ө⟩→[ø]
        expect(phonemizeWordNative("балыҡ")).toBe("bɑˈɫɯq"); // 'fish' — ⟨ы⟩→[ɯ], dark ⟨л⟩
        expect(phonemizeWordNative("һыу")).toBe("ˈhɯw"); // 'water' — ⟨һ⟩→h, ⟨ы⟩→ɯ, ⟨у⟩ after a vowel → [w]
        expect(phonemizeWordNative("йәшел")).toBe("jæˈʃɪl"); // 'green' — ⟨ә⟩→æ, ⟨е⟩→[ɪ]
        expect(phonemizeWordNative("биш")).toBe("ˈbiʃ"); // 'five' — a word ending in ⟨и⟩→[i] still gets stress
        expect(phonemizeWordNative("үҙ")).toBe("ˈyð"); // 'self' — ⟨ү⟩→[y] onset counts as a vowel for stress
    });

    test("NUMBERS — Turkic decimal; Bashkir's own lexemes, NOT Tatar's", () => {
        const ba = getPhonemizer("ba");
        // Data + provenance: src/languages/bashkir/numbers.ts (Wiktionary Module:number list/data/ba + Omniglot).
        expect(ba.text("7").trim()).toBe("jɪˈtɪ"); // ете — Bashkir ⟨ете⟩, not Tatar ⟨җиде⟩
        expect(ba.text("11").trim()).toBe("ˈun ˈbɪɾ"); // ун бер — TWO words in Bashkir (Tatar fuses: унбер)
        expect(ba.text("25").trim()).toBe("jɪɡɪɾˈmɪ ˈbiʃ"); // егерме биш — the 21-99 compound
        expect(ba.text("100").trim()).toBe("ˈjøð"); // йөҙ — the ⟨ҙ⟩ interdental hallmark inside a numeral
        expect(ba.text("555").trim()).toBe("ˈbiʃ ˈjøð ilˈlɪ ˈbiʃ"); // биш йөҙ илле биш
        expect(ba.text("1984").trim()).toBe("ˈmɪŋ tuˈʁɯð ˈjøð hikˈhæn ˈdyɾt"); // мең туғыҙ йөҙ һикһән дүрт — ⟨һикһән⟩ 80, not Tatar ⟨сиксән⟩
        expect(ba.text("12345").trim()).toBe("ˈun iˈkɪ ˈmɪŋ ˈøs ˈjøð ˈqɯɾq ˈbiʃ"); // ун ике мең өс йөҙ ҡырҡ биш
        expect(ba.text("1000000").trim()).toBe("ˈbɪɾ miɫɫiˈʊn"); // бер миллион
    });

    test("Russian-loan detection routes to the Russian g2p (a reality of Bashkir text)", () => {
        expect(isRussianLoan("республика")).toBe(true); // back ⟨у а⟩ + front ⟨е⟩, no Bashkir letter → loan
        expect(isRussianLoan("Европа")).toBe(true); // front ⟨е⟩ + back ⟨о⟩ → loan
        expect(isRussianLoan("тарих")).toBe(false); // back ⟨а⟩ + NEUTRAL ⟨и⟩ (Arabic loan, read native) → NOT flagged
        expect(isRussianLoan("башҡорт")).toBe(false); // has ⟨ҡ⟩ → native
        expect(isRussianLoan("балыҡ")).toBe(false); // all-back harmony → native
        expect(phonemizeWord("республика")).toContain("rʲ"); // routed to Russian → palatalization the native scan can't make
    });
});
