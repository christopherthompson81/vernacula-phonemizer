import { describe, expect, test } from "vitest";

import { phonemizeWord, createKarakalpak } from "../src/languages/karakalpak/karakalpak.ts";

// Canonical-IPA goldens for Karakalpak (kaa) — qaraqalpaq tili, Kipchak Turkic (close to Kazakh), the 2016 LATIN
// alphabet. Signatures: the WRITTEN uvular series ⟨q⟩→[q] / ⟨x⟩→[χ] / ⟨ǵ⟩→[ʁ] (vs velar ⟨k g⟩ / ⟨h⟩), the acute FRONT
// vowels ⟨á ó ú⟩→[æ ø y] (vs back ⟨a o u⟩), the dotless ⟨ı⟩→[ɯ], ⟨ń⟩→[ŋ], ⟨j⟩→[ʒ], and word-final stress.
// Referee: English Wiktionary (thin, ~11 pairs). See docs/investigations/kaa_native_bringup_investigation.md.
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

    test("text() tokenizes both capital ⟨I⟩ (dotless) and ⟨İ⟩ (dotted)", () => {
        const kaa = createKarakalpak();
        // ⟨İ⟩ (U+0130) is the Karakalpak capital of ⟨i⟩ — it must survive tokenization (not drop the /i/).
        expect(kaa.text("İshan")).toBe("iˈʃɑn"); // dotted capital → [i]
        expect(kaa.text("Ishan")).toBe("ɯˈʃɑn"); // dotless capital → [ɯ]
    });
});
