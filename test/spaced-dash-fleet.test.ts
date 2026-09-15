/**
 * A SPACE-GUARDED DASH IS A PARENTHETICAL BREAK, in every language rather than in one.
 *
 * Reported against English, then measured across the fleet: of the 188 languages that mark a comma as
 * a pause at all, 179 DROPPED a space-guarded dash outright — the same six characters wrong in 179
 * files, which is the case for fixing the class rather than the language (the argument
 * `core/separatorHygiene.ts` makes for itself).
 *
 * ⚠ THE GUARDS ARE WHAT MAKE A SHARED RULE SAFE, and each was derived by rendering all 36,495 golden
 * rows before and after and keeping every row whose difference was NOT simply the inserted comma.
 * This file pins them, because a later loosening would be invisible in any single language's tests.
 */
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";

const PAUSE = /[,.、，]/u;

describe("a space-guarded dash pauses in every language", () => {
    // A representative spread: Latin, Cyrillic, Arabic, Devanagari, CJK, and a tone language.
    for (const lang of ["de", "fr", "es", "ru", "uk", "ar", "hi", "bn", "ja", "cmn", "sw", "vi", "tr", "pl"])
        test(`${lang} marks the break`, () => {
            expect(PAUSE.test(phonemize("aba - ebe", lang))).toBe(true);
        });

    // ⚠ A MINUS AND A SPAN BOTH NEED A NUMBER ON THE RIGHT, and seventeen languages read one. The
    // rule refuses a digit there, which is what leaves those readings to the language that has them.
    test("a digit on the right is left to the language", () => {
        expect(phonemize("aba - 28.7", "cs")).toContain("mˈiːnus");
        expect(phonemize("aba - 28.7", "sk")).toContain("mˈiːnus");
        expect(phonemize("aba - 28.7", "la")).toContain("ˈmɪnʊs");
    });

    // ⚠ A LANGUAGE THAT READS THE DASH AS A WORD OPTS OUT ENTIRELY — the pause would take the word
    // away. Oromo says *hanga*, English says "to" between calendar names.
    test("a language with its own reading keeps it", () => {
        expect(phonemize("jaarraa 10ffaa - 11ffaa", "om")).toContain("hˈanɡa");
        expect(phonemize("May – June 2025", "en")).toContain("tʰuː");
    });

    // ⚠ WHERE A PAUSE ALREADY EXISTS THERE IS NOTHING TO ADD, on either side. The bibliographic
    // `2004. – 215 s.` downgraded a SENTENCE break to a clause break in 47 golden rows.
    test("a dash beside an existing pause mark is not claimed", () => {
        const withStop = phonemize("aba. - ebe", "de");
        expect(withStop).toContain(".");
        expect(withStop.split(",").length).toBe(1);
    });

    // ⚠ A LIST MARKER OPENING A LINE HAS NO WORD BEFORE IT.
    test("a list marker is not a parenthetical", () => {
        expect(PAUSE.test(phonemize("erste zeile\n- zweite zeile", "de").replace(/\./gu, ""))).toBe(false);
    });
});
