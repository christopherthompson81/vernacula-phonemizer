import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/tigrinya/tigrinya.ts";

// Canonical-IPA goldens for Tigrinya / ትግርኛ (ti) — North Ethiosemitic, the Ge'ez/Fidäl syllabary. Read by the
// SHARED Ge'ez engine (core/geez.ts, same as Amharic): flat fidel→CV lookup + epenthetic 6th-order ɨ deletion.
// Hand-adjudicated against kaikki tir (human) + epitran tir-Ethi. The SPLIT FROM AMHARIC is the preserved Semitic
// gutturals: ⟨ሐ ኀ⟩→ħ, ⟨ዐ⟩→ʕ (pharyngeals Amharic merged to h/ʔ), ⟨አ⟩→ʔ. Gemination is UNWRITTEN → single (the
// referee marks tː, folded).
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

    // NUMBERS — gold TEXT from Gaim, "Tigrinya Number Verbalization" (arXiv:2601.03403) Table 1 + §3.1-3.3,
    // read through the fidel g2p. Two bugs fixed here: NUM.tens is keyed by the ROUND value ("20".."90") but the
    // lookup used Math.floor(n/10) → "2".."9" → undefined, so 20-90 came out EMPTY and 21-99 lost their tens
    // word entirely; and nothing above 999 999 was composed at all (ሚልዮን / ቢልዮን were missing).
    test("numbers: units, teens (no internal ን), and the ን conjunction on 21–99", () => {
        expect(phonemize("7", "ti")).toBe("ʃəwʕatə"); // ሸውዓተ
        expect(phonemize("14", "ti")).toBe("ʕasəɾtə ʔaɾbaʕtə"); // ዓሰርተ ኣርባዕተ — a teen is ONE term, no ን
        expect(phonemize("40", "ti")).toBe("ʔaɾbʕa"); // ኣርብዓ — a 1-term chain takes no ን (was EMPTY)
        expect(phonemize("23", "ti")).toBe("ʕɨsɾan sələstən"); // ዕስራን ሰለስተን — both terms suffixed
        expect(phonemize("99", "ti")).toBe("təsʕan tɨʃʕatən"); // ተስዓን ትሽዓተን
    });

    test("numbers: the ሚእቲ / ሚእትን hundred alternation (§3.2) and the scale words", () => {
        expect(phonemize("700", "ti")).toBe("ʃəwʕatə miʔti"); // ሸውዓተ ሚእቲ — standalone hundred, multiplier bare
        expect(phonemize("309", "ti")).toBe("sələstə miʔɨtn tɨʃʕatən"); // ሰለስተ ሚእትን ትሽዓተን — compound allomorph
        expect(phonemize("1000", "ti")).toBe("ʃɨħ"); // ሽሕ — the leading ሓደ is optional and omitted
        expect(phonemize("3007", "ti")).toBe("sələstə ʃɨħn ʃəwʕatən"); // ሰለስተ ሽሕን ሸውዓተን
        expect(phonemize("12345", "ti")).toBe("ʕasəɾtə kɨltə ʃɨħn sələstə miʔɨtn ʔaɾbʕan ħamuʃtən");
        expect(phonemize("25000", "ti")).toBe("ʕɨsɾan ħamuʃtən ʃɨħ"); // ዕስራን ሓሙሽተን ሽሕ — ሽሕ standalone
        expect(phonemize("37000000", "ti")).toBe("səlasan ʃəwʕatən miljon"); // ሰላሳን ሸውዓተን ሚልዮን
        expect(phonemize("1000000000", "ti")).toBe("biljon"); // ቢልዮን
    });
});
