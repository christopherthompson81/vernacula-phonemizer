import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/kannada/kannada.ts";
import { numberToWords, ordinalToWords } from "../src/languages/kannada/numbers.ts";
import { normalizeKannada } from "../src/languages/kannada/normalize.ts";

// Canonical-IPA goldens for Kannada (kn) — a Dravidian Brahmic abugida read by the generic engine, mirroring
// Telugu: NO inherent-vowel deletion (every akshara pronounced, inherent /a/). Dravidian short/long e·o, dental
// t̪/d̪ vs retroflex ʈ/ɖ, ಳ→ɭ, ಷ→ʂ, geminate→length, final anusvara ಂ→[m], first-syllable stress. Validated
// against wikipron kan (97.4%) + kaikki kan (96.8%), both human.
describe("kannada canonical IPA", () => {
    test("consonants, vowels, gemination, retroflex, anusvara", () => {
        const cases: [string, string][] = [
            ["ಕನ್ನಡ", "kˈanːaɖa"], // Kannada — ನ್ನ geminate → nː, ಡ → ɖ
            ["ನಮಸ್ಕಾರ", "nˈamaskaːɾa"], // namaskāra
            ["ಬೆಂಗಳೂರು", "bˈẽŋɡaɭuːɾu"], // Bengaluru — anusvara → ŋ, ಳ → ɭ
            ["ಮನೆ", "mˈane"], // house
            ["ನೀರು", "nˈiːɾu"], // water — long iː
            ["ಹಳ್ಳಿ", "hˈaɭːi"], // village — ಳ್ಳ → geminate ɭː
            ["ಅಕ್ಕ", "ˈakːa"], // elder sister — geminate kː
            ["ಪುಸ್ತಕ", "pˈust̪aka"], // book — dental t̪
            ["ಊಟ", "ˈuːʈa"], // meal — retroflex ʈ
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    /**
     * NUMBERS — the largest defect this language had, and it was NOT in the normalization layer.
     * Kannada fuses 21-99 into one word, has suppletive round hundreds and takes combining magnitude
     * forms before a remainder; the shared `indicNumberWords` composer expresses none of the last two,
     * so 561 corpus numerals read in a shape no speaker uses. Kannada now composes its own
     * (src/languages/kannada/numbers.ts).
     */
    test("cardinals: fused 21-99, suppletive hundreds, combining magnitudes", () => {
        const cases: [number, string][] = [
            [5, "ಐದು"],
            [15, "ಹದಿನೈದು"],
            [20, "ಇಪ್ಪತ್ತು"],
            [21, "ಇಪ್ಪತ್ತೊಂದು"], // FUSED — the shared fallback emitted "ಇಪ್ಪತ್ತು ಒಂದು", two words
            [24, "ಇಪ್ಪತ್ತನಾಲ್ಕು"], // consonant-initial unit keeps the linking -a
            [93, "ತೊಂಬತ್ತಮೂರು"],
            [99, "ತೊಂಬತ್ತೊಂಬತ್ತು"],
            [100, "ನೂರು"], // bare — never *ಒಂದು ನೂರು
            [150, "ನೂರಾ ಐವತ್ತು"], // COMBINING ನೂರಾ, not the bare ನೂರು
            [200, "ಇನ್ನೂರು"], // SUPPLETIVE — was "ಎರಡು ನೂರು"
            [300, "ಮುನ್ನೂರು"],
            [400, "ನಾಲ್ಕು ನೂರು"],
            [500, "ಐನೂರು"],
            [900, "ಒಂಬೈನೂರು"],
            [1000, "ಸಾವಿರ"],
            [1976, "ಸಾವಿರದ ಒಂಬೈನೂರಾ ಎಪ್ಪತ್ತಾರು"], // was ಸಾವಿರ ಒಂಬತ್ತು ನೂರು ಎಪ್ಪತ್ತು ಆರು
            [2010, "ಎರಡು ಸಾವಿರದ ಹತ್ತು"],
            [783562, "ಏಳು ಲಕ್ಷದ ಎಂಬತ್ತಮೂರು ಸಾವಿರದ ಐನೂರಾ ಅರವತ್ತೆರಡು"],
        ];
        for (const [n, exp] of cases) expect(numberToWords(n)).toBe(exp);
        // …and through the whole pipeline, IPA derived by the same G2P.
        expect(phonemize("21", "kn")).toBe("ˈipːat̪ːõn̪d̪u");
        expect(phonemize("100", "kn")).toBe("nˈuːɾu");
    });

    test("Kannada digits (×1 in the corpus, a genuine numeral)", () => {
        expect(phonemize("೧೦೦", "kn")).toBe("nˈuːɾu"); // 100
        expect(phonemize("೪", "kn")).toBe(phonemize("4", "kn"));
    });
});

/**
 * TEXT NORMALIZATION. Counts in the header of src/languages/kannada/normalize.ts; every rule
 * below is measured against the kn_in FLEURS corpus (1,811 unique utterances, column 3).
 */
describe("kannada text normalization", () => {
    test("zero-width joiners are stripped, rejoining a word the tokenizer had split", () => {
        // ZWNJ ×922 + ZWJ ×139 + ZWSP ×6 — the largest raw count in the corpus. All sit after a virama,
        // so removing them leaves the identical akshara sequence. Before this, ಪಾಯಿಂಟ್‌ಗಳಿಂದ tokenized
        // as TWO words and carried TWO primary stresses.
        expect(phonemize("ಪಾಯಿಂಟ್‌ಗಳಿಂದ", "kn")).toBe("pˈaːjĩɳʈɡaɭĩn̪d̪a"); // ⚠ ZWNJ U+200C after ್
        expect(normalizeKannada("ಡಾಲರ್‍‌ಗಳ")).toBe("ಡಾಲರ್ಗಳ"); // ⚠ ZWJ U+200D *then* ZWNJ U+200C — both invisible
    });

    test("digit de-grouping runs before punctuation is read", () => {
        // ×42. The grouping comma was clause punctuation: 1,000 read as "ಒಂದು <pause> ಸೊನ್ನೆ".
        expect(normalizeKannada("1,000")).toBe("1000");
        expect(phonemize("1,000", "kn")).toBe("sˈaːʋiɾa");
        expect(phonemize("100,000", "kn")).not.toContain(",");
    });

    test("ordinals fuse ನೇ / ನೆಯ onto the last cardinal word", () => {
        // ×39, written both welded (16ನೇ) and spaced (15 ನೇ). Emitted apart, ನೇ reached the g2p as a
        // stray stressed [nˈeː]. The -ು → ∅ rule is the one this corpus itself writes for thirteen
        // different cardinals (ಎರಡನೇ, ಮೂರನೇ, ಹತ್ತನೇ, ಇಪ್ಪತ್ತನೇ …).
        expect(ordinalToWords(15)).toBe("ಹದಿನೈದನೇ");
        expect(ordinalToWords(20)).toBe("ಇಪ್ಪತ್ತನೇ");
        expect(ordinalToWords(247)).toBe("ಇನ್ನೂರಾ ನಲವತ್ತೇಳನೇ");
        expect(normalizeKannada("15 ನೇ ಶತಮಾನ")).toBe("ಹದಿನೈದನೇ ಶತಮಾನ");
        expect(normalizeKannada("60ನೆಯದು")).toBe("ಅರವತ್ತನೆಯದು"); // + the nominaliser ದು
        expect(normalizeKannada("1,000 ನೇ")).toBe("ಸಾವಿರನೇ"); // after de-grouping, hence the ordering
    });

    test("era markers and dotted abbreviations lose their interior dot", () => {
        // The dot is clause punctuation here, so ಕಿ.ಮೀ read as [kˈi . mˈiː] — two clauses.
        expect(normalizeKannada("ಕ್ರಿ.ಪೂ. 356")).toBe("ಕ್ರಿಸ್ತ ಪೂರ್ವ 356");
        expect(normalizeKannada("ಕ್ರಿ.ಪೂದಲ್ಲಿ")).toBe("ಕ್ರಿಸ್ತ ಪೂರ್ವದಲ್ಲಿ"); // the clitic rides along
        expect(normalizeKannada("ಕ್ರಿ.ಶ. 1000")).toBe("ಕ್ರಿಸ್ತ ಶಕ 1000");
        expect(normalizeKannada("20 ಕಿ.ಮೀ")).toBe("20 ಕಿಲೋಮೀಟರ್");
        expect(normalizeKannada("120 ಕಿ.ಮೀಯಲ್ಲಿ")).toBe("120 ಕಿಮೀಯಲ್ಲಿ"); // clitic ⇒ dot only, no expansion
        expect(normalizeKannada("ಯು.ಎಸ್ ಅಧ್ಯಕ್ಷ")).toBe("ಯು ಎಸ್ ಅಧ್ಯಕ್ಷ");
        expect(normalizeKannada("5 ಮಿ.ಮೀ")).toBe("5 ಮಿಮೀ"); // NOT expanded — ಮಿಲಿಮೀಟರ್ is unsourceable
    });

    test("percent, currency, exponent and the dative rate prefix", () => {
        expect(normalizeKannada("80% ರಷ್ಟು")).toBe("80 ಪ್ರತಿಶತ ರಷ್ಟು");
        expect(normalizeKannada("$5")).toBe("5 ಡಾಲರ್");
        expect(normalizeKannada("US$ 14.7 ಬಿಲಿಯನ್")).toBe("14 ದಶಾಂಶ 7 ಬಿಲಿಯನ್ ಡಾಲರ್");
        expect(normalizeKannada("3,850 km²")).toBe("3850 ಚದರ ಕಿಲೋಮೀಟರ್"); // ಚದರ PREFIXES the noun
        // The rate is a PREFIX in the dative (ಗಂಟೆಗೆ), not the shared postposed "A per B".
        expect(normalizeKannada("70ಕಿ.ಮಿ/ಗಂ")).toBe("ಗಂಟೆಗೆ 70 ಕಿಲೋಮೀಟರ್");
        expect(normalizeKannada("40 ಮೈ/ಗಂ")).toBe("ಗಂಟೆಗೆ 40 ಮೈಲಿ");
        // …and it is NOT emitted twice when the text already carries it (the duplicated-الساعة shape).
        expect(normalizeKannada("ಗಂಟೆಗೆ 165 ಕಿಮಿ/ಗಂ")).toBe("ಗಂಟೆಗೆ 165 ಕಿಲೋಮೀಟರ್");
    });

    test("times, decimals, fractions and degrees", () => {
        expect(normalizeKannada("11:00")).toBe("11"); // :00 dropped, not read as ಸೊನ್ನೆ
        expect(normalizeKannada("9:30")).toBe("9 30"); // the colon was inserting a pause
        expect(normalizeKannada("802.11")).toBe("802 ದಶಾಂಶ 1 1"); // was a full stop mid-number
        expect(normalizeKannada("29¾ ಇಂಚು")).toBe("29 ಮುಕ್ಕಾಲು ಇಂಚು"); // was dropped outright
        expect(normalizeKannada("35°W")).toBe("35 ಡಿಗ್ರಿ W");
    });

    // `120-160 ಘನ ಮೀಟರ್‍‌ನಷ್ಟು ಇಂಧನ` (⚠ ZWJ+ZWNJ after ್), word-first beside ಚದರ. `m` had to be declared for it to have a
    // head noun (ಮೀಟರ್ ×10; digit-adjacent bare `m` is ×0, so the one-letter-key hazard is checked).
    test("the bare metre and the cubed measure word", () => {
        expect(phonemize("5 m", "kn")).toContain("mˈiːʈaɾ");
        expect(phonemize("120 m³", "kn")).toContain("ɡʱˈana mˈiːʈaɾ");
        expect(phonemize("802.11m", "kn")).toContain("ˈɛm");
    });
});
