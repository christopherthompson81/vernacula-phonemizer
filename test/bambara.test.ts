import { describe, expect, test } from "vitest";

import { createBambara, phonemizeWord as raw } from "../src/languages/bambara/bambara.ts";
import { numberToWords } from "../src/languages/bambara/numbers.ts";

// The g2p emits combining marks (nasal ã = a + U+0303) to match the referee; normalise NFC for stable literals.
const phonemizeWord = (w: string) => raw(w).normalize("NFC");

// Canonical-IPA goldens for Bambara / Bamanankan (bm) — Mande (Manding), Latin orthography. Hand-adjudicated
// against kaikki Bambara (Wiktionary, narrow). The greedy g2p + nasalisation scores 86.5% folded vs the referee
// (tools/referee-eval, 74 words) — the folds strip TONE (2-level H/L + downstep) and vowel LENGTH, both lexical
// and absent from the standard orthography. These goldens pin the segmental + nasalisation backbone. Tone,
// length are deferred (numbers are composed in numbers.ts); N'Ko is a second script, folded to Latin.
describe("Bambara canonical IPA — greedy g2p + nasalisation", () => {
    test("affricates and sibilant: ⟨c⟩→t͡ʃ, ⟨j⟩→d͡ʒ, ⟨sh⟩→ʃ", () => {
        expect(phonemizeWord("cɔnkɔ")).toBe("t͡ʃɔ̃kɔ".normalize("NFC")); // ⟨c⟩ → t͡ʃ (+ nasal ɔ̃)
        expect(phonemizeWord("jan")).toBe("d͡ʒã".normalize("NFC")); // ⟨j⟩ → d͡ʒ (+ nasal ã)
        expect(phonemizeWord("shinye")).toBe("ʃiɲe".normalize("NFC")); // ⟨sh⟩ → ʃ, ⟨ny⟩ → ɲ
    });

    test("NASALISATION: a syllable-final ⟨n⟩ nasalises the preceding vowel; an onset ⟨n⟩ stays [n]", () => {
        expect(phonemizeWord("ban")).toBe("bã".normalize("NFC")); // word-final n → nasal ã (n dropped)
        expect(phonemizeWord("dɔn")).toBe("dɔ̃".normalize("NFC")); // → dɔ̃
        expect(phonemizeWord("kunun")).toBe("kunũ".normalize("NFC")); // ku.nun → the ONSET n stays [n], only the final n nasalises
        expect(phonemizeWord("na")).toBe("na".normalize("NFC")); // onset n before a vowel → [n]
        expect(phonemizeWord("kalan")).toBe("kalã".normalize("NFC")); // → kalã
    });

    test("palatal ⟨ny⟩/⟨ɲ⟩ → ɲ; word-initial prenasal keeps the nasal", () => {
        expect(phonemizeWord("nya")).toBe("ɲa".normalize("NFC")); // ⟨ny⟩ → ɲ
        expect(phonemizeWord("mburu")).toBe("mburu".normalize("NFC")); // word-initial ⟨mb⟩ prenasal → m + b
        expect(phonemizeWord("sanga")).toBe("sãɡa".normalize("NFC")); // medial: ⟨n⟩ nasalises a, ⟨g⟩ stays ɡ
    });

    test("oral vowels + a common word", () => {
        expect(phonemizeWord("ala")).toBe("ala".normalize("NFC")); // "God"
        expect(phonemizeWord("kelen")).toBe("kelẽ".normalize("NFC")); // "one" — final n → nasal ẽ
    });

    test("N'Ko (ߒߞߏ) front-end — transliterates to Latin, IDENTICAL IPA (the vowel-naming trap + nasal mark)", () => {
        expect(phonemizeWord("ߒߞߏ")).toBe("ŋko".normalize("NFC")); // N + KA + OO(=/o/); the standalone N → ŋ before k
        expect(phonemizeWord("ߘߋߣ")).toBe("dẽ".normalize("NFC")); // da + EE(=/e/) + na → nasal ẽ ("child")
        expect(phonemizeWord("ߖߐ߲")).toBe("d͡ʒɔ̃".normalize("NFC")); // ja + O(=/ɔ/) + NASALIZATION MARK → d͡ʒɔ̃
        expect(phonemizeWord("ߓߊ߲")).toBe("bã".normalize("NFC")); // ba + a + NASALIZATION MARK → nasal ã
        expect(phonemizeWord("ߓߊ߲")).toBe(phonemizeWord("ban")); // N'Ko ≡ the Latin spelling
    });

    // NUMBERS — DECIMAL (Bambara is NOT quinary: 6–9 are opaque stems). Bespoke because 10 tan / 20 mugan are
    // lexical while 30–90 are solid bi- derivations, and every magnitude noun takes a FOLLOWING multiplier —
    // except 100, which is the bare kɛmɛ. Slots join with ni 'and'. Sources: Omniglot "Numbers in Bambara",
    // languagesandnumbers.com bam (the 1234 worked example), kasahorow (fu 'zero').
    // See src/languages/bambara/numbers.ts.
    test("numbers: units, lexical tan/mugan, bi- tens, ni compounds", () => {
        expect(numberToWords(7)).toBe("wolonwula");
        expect(numberToWords(10)).toBe("tan");
        expect(numberToWords(11)).toBe("tan ni kelen");
        expect(numberToWords(20)).toBe("mugan"); // lexical, not *bifila
        expect(numberToWords(21)).toBe("mugan ni kelen");
        expect(numberToWords(42)).toBe("binaani ni fila"); // bi- + unit, written solid
        expect(numberToWords(99)).toBe("bikɔnɔntɔn ni kɔnɔntɔn");
    });

    test("numbers: kɛmɛ hundreds (bare at 100), waga thousands, milyɔn millions", () => {
        expect(numberToWords(100)).toBe("kɛmɛ"); // the multiplier is omitted for exactly 100
        expect(numberToWords(101)).toBe("kɛmɛ ni kelen");
        expect(numberToWords(555)).toBe("kɛmɛ duuru ni biduuru ni duuru");
        expect(numberToWords(1000)).toBe("waga kelen"); // the thousand DOES keep its multiplier
        expect(numberToWords(12345)).toBe("waga tan ni fila ni kɛmɛ saba ni binaani ni duuru");
        expect(numberToWords(1_000_000)).toBe("milyɔn kelen");
        expect(numberToWords(2_000_000)).toBe("milyɔn fila");
    });

    test("numbers: both registered scripts — N'Ko digits (߀–߉) ≡ ASCII", () => {
        const bm = createBambara();
        expect(bm.text("21").normalize("NFC")).toBe("muɡã ni kelẽ".normalize("NFC")); // nasalisation applies to the numerals too
        expect(bm.text("߂߁")).toBe(bm.text("21")); // N'Ko digits fold to ASCII → identical IPA
    });
});
