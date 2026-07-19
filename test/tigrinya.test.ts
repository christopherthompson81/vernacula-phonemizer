import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/tigrinya/tigrinya.ts";

// Canonical-IPA goldens for Tigrinya / ትግርኛ (ti) — North Ethiosemitic, the Ge'ez/Fidäl syllabary. Read by the
// SHARED Ge'ez engine (core/geez.ts, same as Amharic): flat fidel→CV lookup + epenthetic 6th-order ɨ deletion.
// Hand-adjudicated against kaikki tir (human) + epitran tir-Ethi. The SPLIT FROM AMHARIC is the preserved Semitic
// gutturals: ⟨ሐ ኀ⟩→ħ, ⟨ዐ⟩→ʕ (pharyngeals Amharic merged to h/ʔ), ⟨አ⟩→ʔ. Gemination is UNWRITTEN → single (the
// referee marks tː, folded). See docs/investigations/ti_native_bringup_investigation.md.
describe("Tigrinya canonical IPA — Ge'ez syllabary + preserved gutturals", () => {
    test("the PHARYNGEALS — ⟨ሐ⟩→ħ, ⟨ዐ⟩→ʕ (the split from Amharic)", () => {
        expect(phonemizeWord("ሓደ")).toBe("ħadə"); // "one" — ሓ (4th order) → ħa
        expect(phonemizeWord("ዓሰርተ")).toBe("ʕasəɾtə"); // "ten" — ዓ → ʕa; ɾ tap; epenthetic ɨ deleted
        expect(phonemizeWord("ዕርዲ")).toBe("ʕɨɾdi"); // ዕ → ʕɨ (6th-order kept, breaks the cluster); ɾ tap
        expect(phonemizeWord("ትሽዓተ")).toBe("tɨʃʕatə"); // "nine" — medial ʕ
    });

    test("glottal ⟨አ⟩→ʔ, ejectives ⟨ቀ⟩→kʼ ⟨ጠ⟩→tʼ", () => {
        expect(phonemizeWord("አፍ")).toBe("ʔəf"); // ⟨አ⟩ → ʔə (glottal onset + central guttural-1st vowel, unlike Amharic)
        expect(phonemizeWord("ዕጣን")).toBe("ʕɨtʼan"); // ጠ → tʼ (ejective), ዕ → ʕɨ
        expect(phonemizeWord("ቃፍላይ")).toBe("kʼaflaj"); // ቃ → kʼa (velar ejective — the human referee's value)
    });

    test("units 1–10 (attested in the kaikki referee); epenthetic ɨ + gemination unwritten", () => {
        expect(phonemizeWord("ክልተ")).toBe("kɨltə"); // "two" — kɨl·tə (medial ɨ kept: k_lt illegal), single t
        expect(phonemizeWord("ሰለስተ")).toBe("sələstə"); // "three"
        expect(phonemizeWord("ሓሙሽተ")).toBe("ħamuʃtə"); // "five" — ħa·mu·ʃ·tə (referee ħamːuʃtɐ, gemination unwritten)
    });
});
