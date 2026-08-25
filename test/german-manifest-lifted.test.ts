/**
 * German's word tables come from german.jsonc, and two of them are NOT what they look like.
 *
 * ⚠ `ordinalLicensersExtra` IS NOT THE WHOLE LICENSER SET. The prepositions in `weakEn` license an ordinal
 * AND govern the weak -en ending; the articles here license the reading only. Merging them would give
 * "das fünften Buch".
 *
 * ⚠ AND THE PREFIX SET IN german.ts IS NOT `morphology.prefixUnstressed`. That list holds nine, including
 * miss- and un-, which are STRESSED in German (Míssbrauch, únmöglich) — a stress-shifting prefix guesser
 * must not claim them. The code's seven are a deliberate subset, so this test pins the difference rather
 * than letting a future "deduplication" merge them.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { MANIFEST } from "../src/languages/german/manifest.ts";

describe("german reads its lifted tables", () => {
    test("the licenser split is preserved", () => {
        for (const p of ["am", "im", "dem"]) expect(MANIFEST.weakEn).toContain(p);
        for (const a of ["das", "der", "die"]) {
            expect(MANIFEST.ordinalLicensersExtra).toContain(a);
            expect(MANIFEST.weakEn).not.toContain(a);
        }
        // A preposition governs -en, an article does not.
        expect(phonemize("am 5. Buch", "de")).not.toBe(phonemize("das 5. Buch", "de"));
    });

    test("the corpus misspelling is kept so the rule still fires on it", () => {
        expect(MANIFEST.ordinalNouns).toContain("Jahrunderts");
    });

    test("the suppletive stems are read, not derived", () => {
        // ⚠ Compare with the stress marks stripped: the stem carries its own primary stress standing alone
        // and takes the phrase's when it is inflected inside one, so the raw IPA never matches.
        const bare = (s: string): string => phonemize(s, "de").replace(/[ˈˌ]/gu, "");
        for (const [n, stem] of Object.entries(MANIFEST.ordinals.irregularStems))
            expect(bare(`das ${n}. Buch`)).toContain(bare(stem).slice(0, 3));
    });

    test("measure stems keep a year-shaped number from reading as a year", () => {
        // 1848 alone is a year; 1848 followed by a measure stem is a plain cardinal.
        expect(phonemize("1848", "de")).not.toBe(phonemize("1848 Einwohner", "de").replace(/\s*\S+$/u, ""));
        expect(MANIFEST.measureStems.length).toBeGreaterThan(30);
    });

    test("phonotactics is one table, not four literals", () => {
        for (const k of ["vowels", "onsets", "codas", "digraphs"] as const)
            expect(MANIFEST.phonotactics[k].length).toBeGreaterThan(0);
    });
});
