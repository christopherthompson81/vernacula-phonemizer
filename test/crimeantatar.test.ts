import { describe, expect, test } from "vitest";

import { phonemizeWord, createCrimeanTatar } from "../src/languages/crimeantatar/crimeantatar.ts";

// Canonical-IPA goldens for Crimean Tatar (crh) — qırımtatar tili, Kipchak+Oghuz Turkic, the Turkish-based LATIN
// alphabet. Signatures: the WRITTEN uvular ⟨q⟩→[q] / ⟨ğ⟩→[ɣ] (vs velar ⟨k g⟩), the front/back harmony vowels
// ⟨a o u ı⟩→[ɑ o u ɯ] vs ⟨e ö ü i⟩→[e ø y i], ⟨c⟩→[d͡ʒ] / ⟨ç⟩→[t͡ʃ] / ⟨ş⟩→[ʃ] / ⟨ñ⟩→[ŋ], gemination, and final stress.
// Referee: English Wiktionary (thin, ~18 pairs). See docs/investigations/crh_native_bringup_investigation.md.
describe("Crimean Tatar (qırımtatar tili) canonical IPA", () => {
    test("the WRITTEN uvular series ⟨q ğ⟩ + back-vowel harmony + final stress", () => {
        expect(phonemizeWord("Qırım")).toBe("qɯˈrɯm"); // 'Crimea' — ⟨q⟩→[q], dotless ⟨ı⟩→[ɯ], Turkish-I casing on capital Q…I
        expect(phonemizeWord("qara")).toBe("qɑˈrɑ"); // 'black' — ⟨q⟩→[q], ⟨a⟩→[ɑ]
        expect(phonemizeWord("ağa")).toBe("ɑˈɣɑ"); // ⟨ğ⟩→[ɣ] voiced dorsal
        expect(phonemizeWord("balıq")).toBe("bɑˈlɯq"); // ⟨ı⟩→[ɯ], final ⟨q⟩→[q]
    });

    test("front-harmony vowels ⟨ö ü⟩ + the affricates/sibilants ⟨c ç ş ñ⟩", () => {
        expect(phonemizeWord("köy")).toBe("ˈkøj"); // 'village' — ⟨ö⟩→[ø]
        expect(phonemizeWord("süt")).toBe("ˈsyt"); // 'milk' — ⟨ü⟩→[y]
        expect(phonemizeWord("çay")).toBe("ˈt͡ʃɑj"); // ⟨ç⟩→[t͡ʃ]
        expect(phonemizeWord("gece")).toBe("ɡeˈd͡ʒe"); // ⟨c⟩→[d͡ʒ], ⟨g⟩→[ɡ]
        expect(phonemizeWord("añlamaq")).toBe("ɑŋlɑˈmɑq"); // ⟨ñ⟩→[ŋ]
    });

    test("⟨v⟩ → [w] in a post-vocalic coda (the Kipchak offglide), [v] intervocalic/onset", () => {
        expect(phonemizeWord("suv")).toBe("ˈsuw"); // 'water' — coda ⟨v⟩ → [w]
        expect(phonemizeWord("av")).toBe("ˈɑw"); // 'hunt' — coda ⟨v⟩ → [w]
        expect(phonemizeWord("quvetsiz")).toBe("quvetˈsiz"); // intervocalic ⟨v⟩ STAYS [v] (Arabic loan)
        expect(phonemizeWord("vatan")).toBe("vɑˈtɑn"); // onset ⟨v⟩ STAYS [v]
    });

    test("gemination (doubled letter → [Cː]/[Vː]) + the Turkish-I casing", () => {
        expect(phonemizeWord("yollamaq")).toBe("jolːɑˈmɑq"); // ⟨ll⟩→[lː]
        expect(phonemizeWord("şeer")).toBe("ˈʃeːr"); // ⟨ee⟩→[eː]
        expect(phonemizeWord("QIRIM")).toBe("qɯˈrɯm"); // all-caps: dotless ⟨I⟩→[ɯ] (not dotted [i])
        expect(createCrimeanTatar().text("İşançlı")).toContain("i"); // dotted capital ⟨İ⟩ survives tokenization → [i]
    });
});
