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

    test("NUMBERS — Turkic decimal, Kipchak lexemes under an Oghuz-shaped tens series", () => {
        const crh = createCrimeanTatar();
        // Data + provenance: src/languages/crimeantatar/numbers.ts (Wiktionary Module:number list/data/crh +
        // Category:Crimean Tatar numerals for biñ/the round hundreds + Omniglot).
        expect(crh.text("7").trim()).toBe("jeˈdi"); // yedi
        expect(crh.text("11").trim()).toBe("ˈon ˈbir"); // on bir
        expect(crh.text("42").trim()).toBe("ˈqɯrq eˈki"); // qırq eki — ⟨eki⟩ 2 (Kipchak), not Turkish iki; uvular ⟨qırq⟩ 40
        expect(crh.text("100").trim()).toBe("ˈjyz"); // yüz — the multiplier "bir" is dropped
        expect(crh.text("555").trim()).toBe("ˈbeʃ ˈjyz eˈlːi ˈbeʃ"); // beş yüz elli beş — ⟨ll⟩ geminates in elli
        expect(crh.text("1984").trim()).toBe("ˈbiŋ doˈquz ˈjyz sekˈsen ˈdørt"); // biñ doquz yüz seksen dört — ⟨biñ⟩ 1000 with the velar nasal
        expect(crh.text("12345").trim()).toBe("ˈon eˈki ˈbiŋ ˈyt͡ʃ ˈjyz ˈqɯrq ˈbeʃ"); // on eki biñ üç yüz qırq beş
        expect(crh.text("1000000").trim()).toBe("ˈbir milːiˈon"); // bir million
    });

    test("gemination (doubled letter → [Cː]/[Vː]) + the Turkish-I casing", () => {
        expect(phonemizeWord("yollamaq")).toBe("jolːɑˈmɑq"); // ⟨ll⟩→[lː]
        expect(phonemizeWord("şeer")).toBe("ˈʃeːr"); // ⟨ee⟩→[eː]
        expect(phonemizeWord("QIRIM")).toBe("qɯˈrɯm"); // all-caps: dotless ⟨I⟩→[ɯ] (not dotted [i])
        expect(createCrimeanTatar().text("İşançlı")).toContain("i"); // dotted capital ⟨İ⟩ survives tokenization → [i]
    });
});
