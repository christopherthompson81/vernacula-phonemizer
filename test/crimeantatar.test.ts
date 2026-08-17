import { describe, expect, test } from "vitest";

import { phonemizeWord, createCrimeanTatar } from "../src/languages/crimeantatar/crimeantatar.ts";
import { normalizeCrimeanTatar } from "../src/languages/crimeantatar/normalize.ts";
import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Crimean Tatar (crh) — qırımtatar tili, Kipchak+Oghuz Turkic, the Turkish-based LATIN
// alphabet. Signatures: the WRITTEN uvular ⟨q⟩→[q] / ⟨ğ⟩→[ɣ] (vs velar ⟨k g⟩), the front/back harmony vowels
// ⟨a o u ı⟩→[ɑ o u ɯ] vs ⟨e ö ü i⟩→[e ø y i], ⟨c⟩→[d͡ʒ] / ⟨ç⟩→[t͡ʃ] / ⟨ş⟩→[ʃ] / ⟨ñ⟩→[ŋ], gemination, and final stress.
// Referee: English Wiktionary (thin, ~18 pairs).
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

// ── TEXT NORMALIZATION (src/languages/crimeantatar/normalize.ts) ────────────────────────────────────
// The argument for every case is in the normalizer's own header.
describe("Crimean Tatar text normalization", () => {
    test("⚠ every dash does two jobs — POSITION decides, not the codepoint", () => {
        // a DIGIT before the dash makes it a range; a non-digit before makes it a minus
        expect(normalizeCrimeanTatar("1891 – 1938")).toBe("1891, 1938");
        expect(normalizeCrimeanTatar("600—700 biñge")).toBe("600, 700 biñge");
        expect(normalizeCrimeanTatar("520-590 mm")).toBe("520, 590 millimetr");
        expect(normalizeCrimeanTatar("arareti –1,8°C")).toBe("arareti minus 1 8 derece");
        expect(normalizeCrimeanTatar("arareti -6 °C")).toBe("arareti minus 6 derece");
    });

    test("⚠ ranges run BEFORE signs here — the endpoints are themselves signed", () => {
        // the fleet order (signs first) loses the span the moment `+4` stops being a bare figure
        expect(normalizeCrimeanTatar("+3 – +4°C")).toBe("+3, +4 derece");
        expect(normalizeCrimeanTatar("+22 – +28°C")).toBe("+22, +28 derece");
    });

    test("the separators: the SPACE groups, and the comma and the dot each group once", () => {
        expect(normalizeCrimeanTatar("14 125 adadan")).toBe("14125 adadan");
        expect(normalizeCrimeanTatar("30 300 000")).toBe("30300000");
        expect(normalizeCrimeanTatar("36,000 senesine")).toBe("36000 senesine");
        expect(normalizeCrimeanTatar("38.765")).toBe("38765");
        // …and decimate everywhere else — neutralised, since no decimal word is sourceable
        expect(normalizeCrimeanTatar("1,5 million")).toBe("1 5 million");
        expect(normalizeCrimeanTatar("5.9")).toBe("5 9");
    });

    test("⚠ the percent and degree signs both carry a Turkic case suffix", () => {
        expect(normalizeCrimeanTatar("0,7%-ine")).toBe("0 7 faizine");
        expect(normalizeCrimeanTatar("69 %")).toBe("69 faiz");
        expect(normalizeCrimeanTatar("+23 °C-den +26 °C-ge qadar")).toBe("+23 dereceden +26 derecege qadar");
        // ⚠ the scale letter may be CYRILLIC — U+0421, not U+0043
        expect(normalizeCrimeanTatar("+24\u00b0\u0421")).toBe("+24 derece");
    });

    test("the era marker, and ⚠ the coordinate abbreviation that must not double its own head noun", () => {
        expect(normalizeCrimeanTatar("m.e. 753 senesi")).toBe("milâttan evel 753 senesi");
        expect(normalizeCrimeanTatar("46\u00b0 ş.e.")).toBe("46 derece şimaliy enlik");
        // the corpus writes the head noun itself right after the abbreviation — emit only the adjective
        expect(normalizeCrimeanTatar("46\u00b0 ş.e. enlikleri")).toBe("46 derece şimaliy enlikleri");
        expect(normalizeCrimeanTatar("36\u00b0 ş.b. boyluqları")).toBe("36 derece şarqiy boyluqları");
        expect(normalizeCrimeanTatar("6\u00b0 ğ.b. ve")).toBe("6 derece ğarbiy boyluq ve");
    });

    test("the whole pipeline", () => {
        // ⚠ `biñ` sits between the figure and the unit — declared as a magnitude so the tier can bridge it
        expect(phonemize("d\u00f6rt bi\u00f1 metr", "crh").trim()).toContain("\u02c8metr");
        expect(phonemize("10 bi\u00f1 kvadrat km-ge", "crh").trim()).toContain("kilo\u02c8metr");
        expect(phonemize("$ 1 580", "crh").trim()).toContain("do\u02c8l\u02d0\u0251r");
        // …and `=` is markup here, eleven times out of eleven: no equation word is emitted
        expect(normalizeCrimeanTatar("PlotArea = left:50")).toBe("PlotArea = left:50");
    });
});
