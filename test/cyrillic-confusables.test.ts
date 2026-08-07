/**
 * LATIN LOOK-ALIKES INSIDE CYRILLIC WORDS — the mirror of latin-confusables.test.ts.
 *
 * ⚠ THE FAILURE IS NOT A DROPPED CHARACTER, which is why no existing gate could see it. A Latin letter inside a
 * Cyrillic word falls outside the engine's token class, so the word SPLITS and the stray letter is handed to the
 * foreign reader as an ENGLISH LETTER NAME. Macedonian's own normalizer emitted `Фаренхаjт` with a Latin ⟨j⟩ for
 * Cyrillic ⟨ј⟩ U+0458, and `90 °F` read *fˈarɛnxa d͡ʒˈeᶦ t* — "Farenkha JAY t". Nothing vanished and no raw
 * character survived, so the leak and DROP checks were both silent, and the golden pinned the broken output.
 *
 * ⟨ј⟩ and ⟨і⟩ are the two that bite in practice: they exist only in some Cyrillic alphabets (Macedonian,
 * Serbian, Ukrainian, Belarusian), so a keyboard set for Russian cannot type them and the Latin key is right
 * beside the intended letter.
 */
import { describe, expect, test } from "vitest";
import { foldCyrillicConfusables, foldLatinConfusables } from "../src/core/unicode.ts";
import { phonemize } from "../src/index.ts";

describe("foldCyrillicConfusables", () => {
    test("a Latin look-alike wedged inside a Cyrillic word is folded", () => {
        expect(foldCyrillicConfusables("Фаренхаjт")).toBe("Фаренхајт"); // Latin j → Cyrillic ј
        expect(foldCyrillicConfusables("Украiна")).toBe("Украіна"); // Latin i → Cyrillic і
        expect(foldCyrillicConfusables("слoво")).toBe("слово"); // Latin o → Cyrillic о
    });

    test("⚠ A GENUINE LATIN WORD IS NEVER TOUCHED — a Cyrillic MAJORITY is the whole guard", () => {
        // The gate is per-word and counts scripts, so an embedded Latin word never qualifies however it is
        // hosted. This is what lets the fold be fleet-wide rather than per-engine.
        expect(foldCyrillicConfusables("Ова е hello")).toBe("Ова е hello");
        expect(foldCyrillicConfusables("Оваhello")).toBe("Оваhello");
        for (const s of ["plain ascii", "Владимир", "日本語", ""])
            expect(foldCyrillicConfusables(s)).toBe(s);
    });

    test("⚠ the two folds must not fight — the direction is settled before any character is rewritten", () => {
        // With flank guards on both sides they do fight: in `сeрiя` the Latin `e` gives the Cyrillic `р` a Latin
        // left-flank, so a Latin-first pass rewrites it to `p`, making the word MORE Latin and unrepairable.
        expect(foldLatinConfusables(foldCyrillicConfusables("сeрiя"))).toBe("серія");
        // …and the Latin direction still wins for a Latin-majority word, including at a word edge.
        expect(foldLatinConfusables(foldCyrillicConfusables("Rуssian"))).toBe("Ryssian");
        expect(foldLatinConfusables(foldCyrillicConfusables("prоp"))).toBe("prop");
        expect(foldLatinConfusables(foldCyrillicConfusables("Straβe"))).toBe("Straße");
    });

    test("an exact tie DECLINES rather than guessing", () => {
        // `рaсa` is 2 Cyrillic and 2 Latin. No tie-break is safe — favouring Cyrillic would rewrite the
        // two-letter Latin `оk` — so with no majority the word is left to the established Latin default.
        expect(foldCyrillicConfusables("рaсa")).toBe("рaсa");
    });

    test("the embedded-Latin-run routing still works — the fold must not eat a foreign word", () => {
        expect(phonemize("hello век", "ru")).toContain("həl");
        expect(phonemize("Vladimir Владимир Putin", "en")).toContain("vɫɐdʲ");
    });

    test("the Macedonian degree word reads as one word either way", () => {
        expect(phonemize("Фаренхаjт", "mk").trim()).toBe(phonemize("Фаренхајт", "mk").trim());
        expect(phonemize("90 °F", "mk").trim()).toContain("fˈarɛnxajt");
    });
});
