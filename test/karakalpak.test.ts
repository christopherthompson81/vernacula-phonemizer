import { describe, expect, test } from "vitest";

import { phonemizeWord, createKarakalpak } from "../src/languages/karakalpak/karakalpak.ts";
import { normalizeKarakalpak } from "../src/languages/karakalpak/normalize.ts";
import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Karakalpak (kaa) — qaraqalpaq tili, Kipchak Turkic (close to Kazakh), the 2016 LATIN
// alphabet. Signatures: the WRITTEN uvular series ⟨q⟩→[q] / ⟨x⟩→[χ] / ⟨ǵ⟩→[ʁ] (vs velar ⟨k g⟩ / ⟨h⟩), the acute FRONT
// vowels ⟨á ó ú⟩→[æ ø y] (vs back ⟨a o u⟩), the dotless ⟨ı⟩→[ɯ], ⟨ń⟩→[ŋ], ⟨j⟩→[ʒ], and word-final stress.
// Referee: English Wiktionary (thin, ~11 pairs).
describe("Karakalpak (qaraqalpaq tili) canonical IPA", () => {
    test("the WRITTEN uvular series ⟨q x ǵ⟩ + final stress", () => {
        expect(phonemizeWord("qaraqalpaq")).toBe("qɑrɑqɑlˈpɑq"); // the endonym — ⟨q⟩→[q] uvular throughout, ⟨a⟩→[ɑ]
        expect(phonemizeWord("xalıq")).toBe("χɑˈlɯq"); // 'people' — ⟨x⟩→[χ] uvular, dotless ⟨ı⟩→[ɯ]
        expect(phonemizeWord("ǵárezsizlik")).toBe("ʁærezsizˈlik"); // ⟨ǵ⟩→[ʁ] uvular voiced, ⟨á⟩→[æ]
        expect(phonemizeWord("basqa")).toBe("bɑsˈqɑ"); // ⟨q⟩→[q]; final stress backs up one onset consonant
    });

    test("the acute FRONT vowels ⟨á ó ú⟩ vs back ⟨a o u⟩; ⟨ı⟩→ɯ", () => {
        expect(phonemizeWord("ásir")).toBe("æˈsir"); // ⟨á⟩→[æ]
        expect(phonemizeWord("sózlik")).toBe("søzˈlik"); // ⟨ó⟩→[ø]
        expect(phonemizeWord("úsh")).toBe("ˈyʃ"); // ⟨ú⟩→[y], ⟨sh⟩→[ʃ]
        expect(phonemizeWord("juldız")).toBe("ʒulˈdɯz"); // ⟨j⟩→[ʒ], dotless ⟨ı⟩→[ɯ]
    });

    test("⟨ń⟩→ŋ, ⟨w⟩→w, and the Turkish-style dotless-I casing", () => {
        expect(phonemizeWord("máńgi")).toBe("mæŋˈɡi"); // ⟨ń⟩→[ŋ]
        expect(phonemizeWord("suw")).toBe("ˈsuw"); // ⟨w⟩→[w]
        expect(phonemizeWord("Ishan")).toBe("ɯˈʃɑn"); // capital dotless ⟨I⟩→[ɯ] (NOT dotted [i]) — Turkish-I casing
        expect(phonemizeWord("ISHAN")).toBe("ɯˈʃɑn"); // all-caps too
    });

    test("NUMBERS — Turkic decimal in the 2016 Latin orthography", () => {
        const kaa = createKarakalpak();
        // Data + provenance: src/languages/karakalpak/numbers.ts (Karakalpak Wikipedia "Sanlıq" + Omniglot).
        expect(kaa.text("7").trim()).toBe("ʒeˈti"); // jeti — the Kipchak j- Nogai has lost
        expect(kaa.text("11").trim()).toBe("ˈon ˈbir"); // on bir — teens are two words
        expect(kaa.text("25").trim()).toBe("ʒiɡirˈmɑ ˈbes"); // jigirma bes — ⟨jigirma⟩ 20, not Nogai's contracted йырма
        expect(kaa.text("100").trim()).toBe("ˈʒyz"); // júz — the multiplier "bir" is dropped
        expect(kaa.text("555").trim()).toBe("ˈbes ˈʒyz eˈliw ˈbes"); // bes júz eliw bes — ⟨eliw⟩ 50 (the -w form, cf. Kazakh елу)
        expect(kaa.text("1984").trim()).toBe("ˈmɯŋ toˈʁɯz ˈʒyz sekˈsen ˈtørt"); // mıń toǵız júz seksen tórt
        expect(kaa.text("12345").trim()).toBe("ˈon eˈki ˈmɯŋ ˈyʃ ˈʒyz ˈqɯrq ˈbes"); // on eki mıń úsh júz qırq bes
        expect(kaa.text("1000000").trim()).toBe("ˈbir milliˈon"); // bir million
    });

    test("text() tokenizes both capital ⟨I⟩ (dotless) and ⟨İ⟩ (dotted)", () => {
        const kaa = createKarakalpak();
        // ⟨İ⟩ (U+0130) is the Karakalpak capital of ⟨i⟩ — it must survive tokenization (not drop the /i/).
        expect(kaa.text("İshan")).toBe("iˈʃɑn"); // dotted capital → [i]
        expect(kaa.text("Ishan")).toBe("ɯˈʃɑn"); // dotless capital → [ɯ]
    });
});

// ── TEXT NORMALIZATION (src/languages/karakalpak/normalize.ts) ──────────────────────────────────────
// The argument for every case is in the normalizer's own header.
describe("Karakalpak text normalization", () => {
    test("⚠ the EM-DASH is a COPULA, not a minus — and one clause carries both marks", () => {
        // thirty "is" clauses in the retained text; widening the sign class to `—` would negate them all
        expect(normalizeKarakalpak("Ortasha jas — 31,3")).toBe("Ortasha jas — 31 3");
        expect(normalizeKarakalpak("Temirjollardıń uzınlıǵı — 3,9 mıń km")).toBe("Temirjollardıń uzınlıǵı — 3 9 mıń kilometr");
        expect(normalizeKarakalpak("temperaturası — 2 °C den -3 °C ge shekem"))
            .toBe("temperaturası — 2 gradus den minus 3 gradus ge shekem");
    });

    test("the comma groups AND decimates, and so does the dot", () => {
        expect(normalizeKarakalpak("19,605,052")).toBe("19605052");
        expect(normalizeKarakalpak("1,500 km")).toBe("1500 kilometr");
        expect(normalizeKarakalpak("18,7")).toBe("18 7"); // no decimal word is sourceable — neutralised
        expect(normalizeKarakalpak("1.65")).toBe("1 65");
        // ⚠ exactly ONE dot in the run is what tells a decimal from an IP address or a dotted date
        expect(normalizeKarakalpak("198.51.100.0")).toBe("198.51.100.0");
        expect(normalizeKarakalpak("26.02.1994-j.")).toBe("26.02.1994 jıl");
    });

    test("⚠ the percent sign takes a case suffix, attached or detached", () => {
        expect(normalizeKarakalpak("96%in")).toBe("96 procentin");
        expect(normalizeKarakalpak("50% ten 80% ke")).toBe("50 procentten 80 procentke");
        expect(normalizeKarakalpak("14% i jasaydı")).toBe("14 procenti jasaydı");
    });

    test("⚠ `+` is the name of a programming language — the DIGIT lookahead separates the senses", () => {
        expect(normalizeKarakalpak("C++ tilin")).toBe("C++ tilin");
        expect(normalizeKarakalpak("C++11 (14882:2011)")).toBe("C++11 (14882:2011)");
        expect(normalizeKarakalpak("(+40+45 °C)")).toBe("(plyus 40 plyus 45 gradus)");
        // …and the paired arm is gated on a following degree, or a 6-to-90 mm span reads as an addition
        expect(normalizeKarakalpak("diametri 6+90 mm")).toBe("diametri 6+90 millimetr");
    });

    test("⚠ the corpus glosses its own degree sign, and the scale letter may be CYRILLIC", () => {
        // ⚠ without the degree sign the paired arm correctly does NOT fire — the gate is `°`/`gradus`
        // immediately after the digits, and a Cyrillic scale letter in between is not that.
        expect(normalizeKarakalpak("+15+20\u0421 gradus")).toBe("plyus 15+20\u0421 gradus");
        expect(normalizeKarakalpak("+15+20\u00b0\u0421 gradus")).toBe("plyus 15 plyus 20 gradus");
        expect(normalizeKarakalpak("4,4\u00b0C")).toBe("4 4 gradus");
        expect(normalizeKarakalpak("(-32-38 \u00b0C)")).toBe("(minus 32 minus 38 gradus)");
    });

    test("the era marker, the magnitude abbreviations, and the two-token square measures", () => {
        expect(normalizeKarakalpak("b.e.sh. 776-jılı")).toBe("biziń eramızǵa shekem 776-jılı");
        expect(normalizeKarakalpak("21 mln. jılı")).toBe("21 million jılı");
        expect(normalizeKarakalpak("23,3 mlrd. kvt/saat")).toBe("23 3 milliard kilovatt saat");
        // ⚠ these run BEFORE the tier, or it rewrites the `m` of `8 m.kv.` and strands `.kv.`
        expect(normalizeKarakalpak("8 m.kv. maydan")).toBe("8 kvadrat metr maydan");
        expect(normalizeKarakalpak("23,2 adam/1 km kv")).toBe("23 2 adam/1 kvadrat kilometr");
        expect(normalizeKarakalpak("Suyıqlanıw t-rası 323°")).toBe("Suyıqlanıw temperaturası 323 gradus ");
    });

    test("the clock, and the hour bound that declines a standard number", () => {
        expect(normalizeKarakalpak("saat 8:00 de")).toBe("saat 8 00 de");
        expect(normalizeKarakalpak("saat 12:13:05 de")).toBe("saat 12 13 05 de");
        expect(normalizeKarakalpak("ISO/IEC 14882:2024")).toBe("ISO/IEC 14882:2024");
    });

    test("the whole pipeline", () => {
        expect(phonemize("$100,000 investiciyası", "kaa").trim())
            .toBe("\u02c8\u0292yz \u02c8m\u026f\u014b dol\u02c8l\u0251r investikij\u0251\u02c8s\u026f");
        expect(phonemize("150 mm ge shekem", "kaa").trim()).toContain("milli\u02c8metr");
    });
});
