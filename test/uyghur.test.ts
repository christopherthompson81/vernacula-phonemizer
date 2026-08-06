import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/uyghur/uyghur.ts";

// Canonical-IPA goldens for Uyghur / ئۇيغۇرچە (ug) — Turkic (Karluk), the Uyghur Arabic alphabet (a FULL phonemic
// alphabet — all 8 vowels written, so no short-vowel restoration). Hand-adjudicated against wikipron uig_arab_broad
// (human, 2673). The greedy letter→IPA g2p + final-stop devoicing scores 98.2% folded vs the referee. Signatures:
// ا→ɑ (back a), ە→ɛ, the hamza ئ→ʔ (glottal onset), ⟨چ ج⟩→t͡ʃ d͡ʒ, ⟨غ⟩→ʁ, ⟨خ⟩→χ, ⟨ق⟩→q, ⟨ف⟩→p (nativised).
describe("Uyghur canonical IPA — greedy letter g2p", () => {
    test("vowels ا→ɑ / ە→ɛ, the hamza ئ→ʔ glottal onset, ⟨غ⟩→ʁ", () => {
        expect(phonemizeWord("ئۇيغۇر")).toBe("ʔujʁur"); // "Uyghur" — ئ→ʔ onset, ۇ→u, ي→j, غ→ʁ
        expect(phonemizeWord("ئالىم")).toBe("ʔɑlim"); // "scholar" — ا→ɑ (back)
        expect(phonemizeWord("مەكتەپ")).toBe("mɛktɛp"); // "school" — ە→ɛ
        expect(phonemizeWord("خەلق")).toBe("χɛlq"); // "people" — خ→χ, ق→q
    });

    test("affricates ⟨چ ج⟩→t͡ʃ d͡ʒ, ڭ→ŋ", () => {
        expect(phonemizeWord("ئۇيغۇرچە")).toBe("ʔujʁurt͡ʃɛ"); // "Uyghur (language)" — چ→t͡ʃ
        expect(phonemizeWord("جۇڭگو")).toBe("d͡ʒuŋɡo"); // "China" — ج→d͡ʒ, ڭ→ŋ
        expect(phonemizeWord("ياخشى")).toBe("jɑχʃi"); // "good" — ش→ʃ
    });

    test("word-final STOP devoicing (b/d/g → p/t/k), but fricatives stay voiced", () => {
        expect(phonemizeWord("كىتاب")).toBe("kitɑp"); // "book" — final ب → p
        expect(phonemizeWord("ئاز")).toBe("ʔɑz"); // "few" — final ز stays z (no fricative devoicing)
        expect(phonemizeWord("ئاغ")).toBe("ʔɑʁ"); // final غ stays ʁ
        expect(phonemizeWord("تىل")).toBe("til"); // "tongue/language"
    });
});
