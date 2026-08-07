import { describe, expect, test } from "vitest";

import { createEwe, phonemizeWord } from "../src/languages/ewe/ewe.ts";
import { numberToWords } from "../src/languages/ewe/numbers.ts";

// Canonical-IPA goldens for Ewe (ee) — Eʋegbe, a Gbe language (Niger-Congo, Kwa), the Latin-based African alphabet.
// Signatures: labial-velars ⟨gb kp⟩→[ɡ͡b k͡p], the bilabial ⟨ƒ⟩→[ɸ]/⟨ʋ⟩→[β] (vs labiodental f/v), affricates ⟨dz ts⟩,
// ⟨ny⟩→[ɲ], ⟨x⟩→[x]; written nasalization (tilde kept); TONELESS (tone unmarked in the orthography). The two non-obvious
// allophonies (per Jalloh's grammar): ⟨w⟩→[w] before a rounded vowel but [ɰ] before an unrounded one, and ⟨r⟩→[l] in an
// onset cluster (after a consonant) but [r] elsewhere. ⚠ Referee: kaikki Ewe, 249 human pairs — it agrees
// completely, which is a statement about how shallow the orthography is, not a quality margin.
describe("Ewe (Eʋegbe) canonical IPA", () => {
    test("labial-velars, bilabials, affricates, ⟨ny⟩", () => {
        expect(phonemizeWord("Eʋegbe")).toBe("eβeɡ͡be"); // the language name — ⟨ʋ⟩→[β], ⟨gb⟩→[ɡ͡b]
        expect(phonemizeWord("agbe")).toBe("aɡ͡be"); // 'life' — labial-velar ⟨gb⟩
        expect(phonemizeWord("atsiaƒu")).toBe("at͡siaɸu"); // 'sea' — ⟨ts⟩→[t͡s], bilabial ⟨ƒ⟩→[ɸ]
        expect(phonemizeWord("nyɔnu")).toBe("ɲɔnu"); // 'woman' — ⟨ny⟩→[ɲ]
    });

    test("⟨w⟩ rounding allophony ([w]/[ɰ]) and ⟨x⟩, ⟨ɣ⟩", () => {
        expect(phonemizeWord("wɔ")).toBe("wɔ"); // ⟨w⟩ before a ROUNDED vowel → [w]
        expect(phonemizeWord("Xawa")).toBe("xaɰa"); // ⟨x⟩→[x]; ⟨w⟩ before UNROUNDED [a] → [ɰ]
        expect(phonemizeWord("ɣ")).toBe("ɰ"); // ⟨ɣ⟩ → the velar approximant [ɰ]
    });

    test("⟨r⟩→[l] in a cluster; written nasalization; ⟨kp⟩; ⟨ŋ⟩", () => {
        expect(phonemizeWord("adre")).toBe("adle"); // 'seven' — ⟨r⟩ after a consonant → [l]
        expect(phonemizeWord("agbalẽ")).toBe("aɡ͡balẽ"); // 'book' — nasalized ⟨ẽ⟩ kept
        expect(phonemizeWord("fukpekpe")).toBe("fuk͡pek͡pe"); // ⟨kp⟩ labial-velar
        expect(phonemizeWord("ŋusẽ")).toBe("ŋusẽ"); // 'strength' — ⟨ŋ⟩→[ŋ], nasal ⟨ẽ⟩
    });

    test("text() tokenizes NFC precomposed vowels + uppercase Ɖ (public-API path)", () => {
        const ee = createEwe();
        expect(ee.text("agbalẽ".normalize("NFC"))).toBe("aɡ͡balẽ"); // NFC nasal ⟨ẽ⟩ not dropped by the tokenizer
        expect(ee.text("Ɖekawo")).toBe("ɖekawo"); // uppercase ⟨Ɖ⟩ tokenized
    });

    // NUMBERS — DECIMAL, but with PREFIXING morphology no data-only composer can express: the teens are wui- +
    // unit stem and the round tens are bla- + unit stem (bla- is a multiplicative TEN prefix, so blaeve 20 is
    // 'ten×two' and blaene 40 is 'ten×four' — NOT a base-20 series), 21–99 link with vɔ 'plus', and the
    // magnitude nouns alafa/akpe/miliɔn take a FOLLOWING multiplier with kple 'and' between slots. Sources:
    // Omniglot "Numbers in Ewe" + desmotsetdeslangues.eklablog.com/ewe. See src/languages/ewe/numbers.ts.
    test("numbers: units, wui- teens, bla- tens, vɔ compounds", () => {
        expect(numberToWords(7)).toBe("adre");
        expect(numberToWords(10)).toBe("ewo");
        expect(numberToWords(11)).toBe("wuiɖeke"); // wui- + the unit stem
        expect(numberToWords(20)).toBe("blaeve"); // bla- (×10) + eve → 10×2
        expect(numberToWords(21)).toBe("blaeve vɔ ɖeka"); // TENS vɔ UNIT
        expect(numberToWords(42)).toBe("blaene vɔ eve");
        expect(numberToWords(99)).toBe("blaasieke vɔ asieke");
    });

    test("numbers: alafa hundreds, akpe thousands, miliɔn millions (multiplier FOLLOWS, kple joins)", () => {
        expect(numberToWords(100)).toBe("alafa ɖeka");
        expect(numberToWords(101)).toBe("alafa ɖeka kple ɖeka");
        expect(numberToWords(555)).toBe("alafa atɔ̃ kple blaatɔ̃ vɔ atɔ̃");
        expect(numberToWords(1000)).toBe("akpe ɖeka");
        expect(numberToWords(12345)).toBe("akpe wuieve kple alafa etɔ̃ kple blaene vɔ atɔ̃");
        expect(numberToWords(1_000_000)).toBe("miliɔn ɖeka");
        expect(numberToWords(2_000_000)).toBe("miliɔn eve");
    });

    test("numbers: end-to-end through the scan (text path)", () => {
        expect(createEwe().text("20")).toBe("blaeve");
        expect(createEwe().text("1000")).toBe("ak͡pe ɖeka"); // ⟨kp⟩ → the labial-velar k͡p
    });
});
