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
import { foldCyrillicConfusables } from "../src/core/unicode.ts";
import { phonemize } from "../src/index.ts";

describe("foldCyrillicConfusables", () => {
    test("a Latin look-alike wedged inside a Cyrillic word is folded", () => {
        expect(foldCyrillicConfusables("Фаренхаjт")).toBe("Фаренхајт"); // Latin j → Cyrillic ј
        expect(foldCyrillicConfusables("Украiна")).toBe("Украіна"); // Latin i → Cyrillic і
        expect(foldCyrillicConfusables("слoво")).toBe("слово"); // Latin o → Cyrillic о
    });

    test("⚠ A GENUINE LATIN WORD IS NEVER TOUCHED — the Cyrillic flank is the whole guard", () => {
        // A real Latin word embedded in Cyrillic text either is not preceded by a Cyrillic letter (it follows a
        // space) or continues in Latin, and both are declined. This is what lets the fold be fleet-wide.
        expect(foldCyrillicConfusables("Ова е hello")).toBe("Ова е hello");
        expect(foldCyrillicConfusables("Оваhello")).toBe("Оваhello"); // Latin run continues
        for (const s of ["plain ascii", "Владимир", "日本語", ""])
            expect(foldCyrillicConfusables(s)).toBe(s);
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
