import { describe, expect, test } from "vitest";

import { phonemizeWord, createKarakalpak } from "../src/languages/karakalpak/karakalpak.ts";

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
