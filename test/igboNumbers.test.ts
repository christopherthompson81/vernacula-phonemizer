/**
 * Igbo cardinal numbers — the compositor that stopped digits being read in English.
 *
 * ⚠ A LANGUAGE WITH NO `numbers.ts` HANDS EVERY DIGIT RUN TO ITS `foreign` FALLBACK, which the registry wires
 * to the ENGLISH phonemizer — so `1945` reads *wˈʌn θˈaᶷzənd nˈaᶦn hˈʌndɹəd fˈɔːɹt̬i fˈaᶦv*, fluent English
 * inside Igbo speech. A dropped symbol loses information; this asserts the WRONG LANGUAGE, confidently.
 *
 * The expectations below are corpus-attested phrases, not invented ones: `iri na otu` has 2,056 hits in a
 * 558,991-line ig.wikipedia dump, `iri abụọ` 7,814. Igbo has NO independent referee (wikipron, epitran and kaikki
 * are all 404 for it), so the corpus IS the evidence — see igbo.jsonc for every count.
 */
import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { numberToWords } from "../src/languages/igbo/numbers.ts";

/** English number words are unmistakable in IPA — the failure this file exists to prevent. */
const ENGLISH = /θˈa|hˈʌndɹ|twˈɛn|fˈɪfti|wˈʌn|nˈaᶦn|fˈaᶦv|fˈɔːɹ/u;

describe("igbo cardinal numbers", () => {
    test("⚠ no digit reads as English any more", () => {
        for (const s of ["0", "7", "1945", "20", "100", "1000000", "Afọ 1960"])
            expect(ENGLISH.test(String(phonemize(s, "ig"))), s).toBe(false);
    });

    test("the corpus-attested forms, exactly", () => {
        expect(numberToWords(11)).toBe("iri na otu");        // 2,056 corpus hits
        expect(numberToWords(12)).toBe("iri na abụọ");       // 2,613
        expect(numberToWords(20)).toBe("iri abụọ");          // 7,814
        expect(numberToWords(30)).toBe("iri atọ");           // 3,094
        expect(numberToWords(90)).toBe("iri itoolu");        // 774
        expect(numberToWords(873)).toBe("narị asatọ na iri asaa na atọ");   // from the corpus's own large number
    });

    test("⚠ MAGNITUDE FIRST, and the multiplier-1 form is irregular", () => {
        // Counting both orders settled this — iri abụọ 7,814 : abụọ iri 82, and 275:1 for puku. But the
        // multiplier-1 form inverts: `otu narị`, never `narị otu` (otu narị 1,347, otu puku 1,256, otu nde 479).
        expect(numberToWords(200)).toBe("narị abụọ");
        expect(numberToWords(100)).toBe("otu narị");
        expect(numberToWords(1000)).toBe("otu puku");
        expect(numberToWords(2_000_000)).toBe("nde abụọ");
    });

    test("a large number matches the structure the corpus writes out", () => {
        // The dump contains "otu nde, puku narị anọ na otu, narị asatọ na iri asaa na atọ" = 1,401,873. We join
        // the magnitude groups with `na` where the corpus writes a comma — a comma is not spoken.
        expect(numberToWords(1_401_873))
            .toBe("otu nde na puku narị anọ na otu na narị asatọ na iri asaa na atọ");
    });

    test("⚠ out-of-range and non-integer input reads DIGIT BY DIGIT in Igbo, never in English", () => {
        // The floor that guarantees no digit escapes to the foreign path. Same fallback chichewa uses above its
        // own ceiling. An unidiomatic Igbo reading of a huge number beats a confident English one.
        const huge = numberToWords(10 ** 13);
        expect(huge).toContain("otu");
        expect(ENGLISH.test(String(phonemize("10000000000000", "ig")))).toBe(false);
        expect(numberToWords(Number.NaN)).not.toBe("");
    });

    test("zero", () => {
        // `efu` is thinly sourced and polysemous — mostly "free"/"empty" — but does appear in numeric slots
        // (`efu - 2`, a scoreline). Recorded in igbo.jsonc; little rests on it since digits rarely render as zero.
        expect(numberToWords(0)).toBe("efu");
    });
});
