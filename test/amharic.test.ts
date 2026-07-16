import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/amharic/amharic.ts";

// Canonical-IPA goldens for Amharic / አማርኛ (am) — Ethiopian Semitic, the Ge'ez/Fidäl SYLLABARY-abugida: each
// codepoint is a whole CV syllable (vowel baked into the glyph), so the g2p is a flat fidel→CV lookup (not a
// Brahmic matra/virama engine). Guttural 1st-order → [a] (ሀ→ha), ejectives kʼ tʼ t͡ʃʼ pʼ t͡sʼ. Two features are
// UNWRITTEN: GEMINATION (folded vs the referee) and the 6th-order [ɨ] (epenthetic — kept only as the word's first
// vowel, else deleted: ሁለት→hulət). Validated against wikipron amh (80.1%) + kaikki amh (78.3%), both human.
describe("amharic canonical IPA", () => {
    test("fidel syllabary, gutturals, ejectives, 6th-order ɨ deletion", () => {
        const cases: [string, string][] = [
            ["ሰላም", "səlam"], // hello — 1st-order lə, 4th-order la
            ["ኢትዮጵያ", "itjopʼja"], // Ethiopia — ejective pʼ, glides, ɨ deleted
            ["አዲስ", "adis"], // new (Addis)
            ["አበባ", "abəba"], // flower (Ababa)
            ["ውሃ", "wɨha"], // water — word-initial ɨ kept
            ["ቤት", "bet"], // house — 5th-order e
            ["ሁለት", "hulət"], // two — final 6th-order ɨ deleted
            ["ልጅ", "lɨd͡ʒ"], // child — ɨ kept, final ɨ deleted (ጅ → d͡ʒ, affricate = one C)
            ["መጽሐፍ", "mət͡sʼhaf"], // book — ejective t͡sʼ, guttural ሐ→ha
            ["ቀን", "kʼən"], // day — ejective kʼ
            // Epenthetic-ɨ phonotactics: kept to break an illegal cluster, deleted where the cluster is legal.
            ["አምስት", "amɨst"], // 'five' — ɨ KEPT: deleting → word-final 'mst', an illegal ≥3 complex coda
            ["አምስተኛ", "amstəɲa"], // 'fifth' — same letters but MEDIAL (before ə) → the cluster resyllabifies, ɨ deleted
            ["እግር", "ɨɡɨɾ"], // 'foot' — word-initial ɨ kept; medial ɨ kept before ɾ (stop + ɾ illegal)
            ["አሥራራት", "asɾaɾat"], // ɨ deleted — a fricative + ɾ (sɾ) is a legal cluster
            ["አርመንኛ", "aɾmənɨɲa"], // ɨ kept before ɲ (nasal + nasal illegal); aɾm/mən legal
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("numbers (Amharic; decimal)", () => {
        expect(phonemize("2", "am")).toBe("hulət"); // hulätt
        expect(phonemize("10", "am")).toBe("asɾ"); // assɨr
        expect(phonemize("100", "am")).toBe("məto"); // mäto
    });
});
