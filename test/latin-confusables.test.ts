/**
 * GREEK / CYRILLIC LOOK-ALIKES INSIDE LATIN WORDS (#586).
 *
 * Found by a fix that regressed: bounding Afrikaans' tokenizer to Latin script (so embedded foreign script
 * could reach the router instead of being claimed and dropped) broke two words, because af_za writes
 * `proteϊen` and `ruϊnes` with U+03CA GREEK IOTA WITH DIALYTIKA standing in for Latin `ï`. The over-claiming
 * tokenizer had been absorbing a homoglyph, so the correct narrowing exposed the defect it had masked.
 */
import { describe, expect, test } from "vitest";
import { foldLatinConfusables } from "../src/core/unicode.ts";
import { phonemize } from "../src/index.ts";

describe("foldLatinConfusables", () => {
    test("a look-alike wedged inside a Latin word is folded", () => {
        expect(foldLatinConfusables("prote\u03CAen")).toBe("prote\u00EFen");
        expect(foldLatinConfusables("ru\u03CAnes")).toBe("ru\u00EFnes");
        // Cyrillic homoglyphs too — the table is the closed confusable set, not just the hits that occur.
        expect(foldLatinConfusables("R\u0443ssian")).toBe("Ryssian");
        expect(foldLatinConfusables("l\u0430tin")).toBe("latin");
    });

    test("⚠ A GENUINE GREEK OR CYRILLIC WORD IS NEVER TOUCHED — the Latin flank is the whole guard", () => {
        // This is what lets the fold be fleet-wide where foldNativeDigits had to stay per-engine: a real
        // Greek/Cyrillic word has no Latin neighbours, so it cannot match however it is hosted.
        for (const s of ["\u0395\u03BB\u03BB\u03AC\u03B4\u03B1", "\u0412\u043B\u0430\u0434\u0438\u043C\u0438\u0440", "\u03BF\u03BC\u03BF\u03C1\u03C6\u03B1", "\u0441\u043B\u043E\u0432\u043E"])
            expect(foldLatinConfusables(s)).toBe(s);
        // A look-alike at a word EDGE has no Latin flank on one side and is left alone rather than guessed at.
        expect(foldLatinConfusables("\u03BFmega")).toBe("\u03BFmega");
    });

    test("clean text is returned unchanged", () => {
        for (const s of ["prote\u00EFen", "plain ascii", "\u65E5\u672C\u8A9E", ""])
            expect(foldLatinConfusables(s)).toBe(s);
    });

    test("the corpus noise now reads as the intended Latin word", () => {
        expect(phonemize("prote\u03CAen", "af")).toBe(phonemize("prote\u00EFen", "af"));
        expect(phonemize("ru\u03CAnes", "af")).toBe(phonemize("ru\u00EFnes", "af"));
    });
});
