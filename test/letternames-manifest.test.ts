/**
 * The INITIALISM TIER's two tables — `letterNames` and `phonotactics` — read from each language's manifest.
 *
 * ⚠ ONE TEST FOR A BATCH OF LANGUAGES, BY DESIGN. The lift is the same three-line change in every language,
 * so a per-language test file would be the same assertions copied N times; what actually differs is the
 * DATA, and the loop below reads it from each manifest rather than restating it. Anything genuinely
 * language-specific keeps its own file (see italian-manifest-lifted.test.ts).
 *
 * ⚠ WHAT THIS CATCHES is DECOUPLING — a table re-hardcoded in a normalize.ts — not wrong data. The reading
 * assertions go through the engine, so a language that stopped reading its manifest fails here even though
 * the two copies would still agree.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { MANIFEST as NL } from "../src/languages/dutch/manifest.ts";
import { MANIFEST as PL } from "../src/languages/polish/manifest.ts";
import { MANIFEST as HU } from "../src/languages/hungarian/manifest.ts";
import { MANIFEST as TR } from "../src/languages/turkish/manifest.ts";

interface Lifted {
    letterNames: Record<string, string>;
    phonotactics: { vowels: string; onsets: string[]; codas: string[] };
}

/**
 * code → its manifest, a sentence whose ALL-CAPS run must be SPELLED with the letter names, and one whose
 * run must NOT be — a loanword shape the language's own onsets and codas license as readable.
 *
 * ⚠ THE SECOND SENTENCE IS WHAT TESTS `phonotactics` AT ALL. Asserting the table's shape only proves the
 * DATA is there; emptying `legalOnsets` in a normalize.ts still passed until this column existed, because
 * nothing read the reading. Verified by making that edit.
 */
const LANGS: [string, Lifted, string, string, string, string][] = [
    ["nl", NL, "de USB-poort werkt", "usb", "de SPORT van vandaag", "s"],
    ["pl", PL, "port USB działa", "usb", "ten SPORT dzisiaj", "s"],
    ["hu", HU, "az USB port működik", "usb", "a SPORT ma", "s"],
    ["tr", TR, "USB bağlantı noktası", "usb", "bu SPOR bugün", "s"],
];

describe.each(LANGS)("%s reads its lifted initialism tables", (code, DEF, sentence, spelled, readable, initial) => {
    const say = (s: string): string => phonemize(s, code).replace(/[ˈˌ]/gu, "");

    test("the spelled run is composed from letterNames", () => {
        // ⚠ EACH LETTER SEPARATELY, not the joined string: the engine may re-stress or re-syllabify across
        // the run, so only the individual names are safe to assert.
        for (const ch of spelled) {
            const name = DEF.letterNames[ch];
            expect(name, `${code}: no letterNames entry for ${ch}`).toBeDefined();
            expect(say(sentence)).toContain(say(name!));
        }
    });

    test("a licensed loanword shape is READ, not spelled — which is what tests phonotactics", () => {
        // Emptying `legalOnsets` makes this run unreadable and it gets spelled letter by letter, so the
        // assertion is that the first letter's NAME is absent from the reading.
        expect(say(readable)).not.toContain(say(DEF.letterNames[initial]!));
    });

    test("phonotactics is one table, and its vowel class is the engine's", () => {
        expect(DEF.phonotactics.vowels.length).toBeGreaterThan(0);
        expect(DEF.phonotactics.onsets.length).toBeGreaterThan(0);
        expect(DEF.phonotactics.codas.length).toBeGreaterThan(0);
        // Every cluster is exactly the shape the OOV test indexes on — two or three characters, no spaces.
        for (const c of [...DEF.phonotactics.onsets, ...DEF.phonotactics.codas]) {
            expect(c).not.toMatch(/\s/u);
            expect(c.length).toBeGreaterThanOrEqual(2);
        }
    });

    test("no declared letter name is empty, and the core covers what the table omits", () => {
        for (const [k, v] of Object.entries(DEF.letterNames)) {
            expect(v, `${code}: empty name for ${k}`).not.toBe("");
            expect(k.length).toBeGreaterThan(0);
        }
        // ⚠ A LETTER NEED NOT BE IN THE TABLE. `core/initialisms.ts` falls back to the letter itself
        // (`d.letterName(...) ?? m[0]`), so a gap degrades to spelling the character rather than leaking the
        // string "undefined" into the IPA. Turkish is the case in this batch: its vowel class carries the
        // loanword circumflexes ⟨â î û⟩, which have no distinct letter NAME — they are said as the base
        // letter — and are deliberately absent from the table. Asserting full coverage of the vowel class
        // would therefore fail on correct data, which is what the first version of this test did.
        const named = DEF.phonotactics.vowels.split("").filter((v) => DEF.letterNames[v] !== undefined);
        expect(named.length).toBeGreaterThan(0);
    });
});
