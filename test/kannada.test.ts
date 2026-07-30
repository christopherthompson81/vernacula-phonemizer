import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/kannada/kannada.ts";

// Canonical-IPA goldens for Kannada (kn) — a Dravidian Brahmic abugida read by the generic engine, mirroring
// Telugu: NO inherent-vowel deletion (every akshara pronounced, inherent /a/). Dravidian short/long e·o, dental
// t̪/d̪ vs retroflex ʈ/ɖ, ಳ→ɭ, ಷ→ʂ, geminate→length, final anusvara ಂ→[m], first-syllable stress. Validated
// against wikipron kan (97.4%) + kaikki kan (96.8%), both human. See docs/investigations/kn_native_bringup_investigation.md.
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

    test("numbers (Kannada spellings; Indic grouping)", () => {
        expect(phonemize("5", "kn")).toBe("ˈaid̪u"); // aidu
        expect(phonemize("10", "kn")).toBe("hˈat̪ːu"); // hattu
        // A bare hundred is ನೂರು alone — *ondu nūru was the shared composer prefixing "one"
        // unconditionally, which the Telugu run measured across the Indic languages (#562).
        expect(phonemize("100", "kn")).toBe("nˈuːɾu"); // nūru
        expect(phonemize("21", "kn")).toBe("ˈipːat̪ːu ˈõn̪d̪u"); // ippattu ondu — TENS first, was "one twenty"
    });

    test("Kannada digits", () => {
        expect(phonemize("೧೦೦", "kn")).toBe("nˈuːɾu"); // 100
    });
});
