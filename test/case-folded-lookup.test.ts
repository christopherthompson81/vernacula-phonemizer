/**
 * A CASE-FOLDED CLASS MUST NOT MATCH WHAT ITS LOOKUP TABLE CANNOT SERVE.
 *
 * ⚠ THE DEFECT IS A REGEX AND A TABLE DISAGREEING ABOUT THEIR ALPHABET, and it is systemic rather than
 * local: a normalizer builds its pattern FROM the table's own keys and then adds `i` — which under `u`
 * applies Unicode simple case folding, so the class silently grows. U+017F LONG S folds onto `s`, and the
 * Cyrillic historic forms `ᲀ ᲃ ᲅ` fold onto `в с т`. `ſr.` therefore matches an alternation built from
 * `sr|sra|…` while the key computed from the match is in no table. The lookups asserted non-null with `!`,
 * and `String.prototype.replace` stringifies a callback's `undefined`, so the LITERAL WORD was spoken:
 *
 *     es  ſr. García → undefinˈeð ɣaɾθˈia      ru  тыᲃ. руб  → ˌʌndɪfˈaᶦnd rup
 *     wo  km&ſup2 bi → kmundɛfinɛd bi          so  12°ſ      → … darad͡ʒo undefined
 *
 * ⚠ AND THE C# PORTS CRASHED ON THE SAME INPUT, because a .NET dictionary indexer throws where JS yields
 * `undefined` — `KeyNotFoundException` out of `Phonemize`, for the whole caller.
 *
 * ⚠ THIS IS NOT HYPOTHETICAL INPUT. Long s is what OCR'd and historic-orthography text carries, and this
 * tree already ships it: `csharp/goldens/nci.tsv` has `Caſtellana` and `Confeſsionario` in 16th-century
 * book titles. The affected corpora write it zero times TODAY, which is why no differential caught it.
 *
 * ⚠ THE INSTRUMENT IS GENERATED FROM THE TABLES THEMSELVES, not from a hand-picked trigger list — the first
 * version of this file swept `ſ`, `K` and `Å` into every shape, and two of the three produced probes that
 * matched nothing, so the callbacks under test were never entered and the test passed vacuously. Here each
 * probe substitutes a character that folds INTO one the key actually contains, so it is guaranteed to reach
 * the branch.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

/** Fold partners that widen a class written in the ordinary alphabet, from `csharp/fold-pairs.json`. */
const FOLDS: Readonly<Record<string, string>> = {
    s: "ſ", S: "ſ", k: "K", // Latin
    в: "ᲀ", с: "ᲃ", т: "ᲅ", о: "ᲂ", ъ: "ᲆ", // Cyrillic historic forms
};

/** One row per confirmed site: the language and a WELL-FORMED input whose abbreviation expands. */
const SITES: readonly (readonly [string, string])[] = [
    ["es", "sr. García"],
    ["pt", "sr. Silva"],
    ["cs", "sv. Petr"],
    ["ru", "тыс. руб"],
    ["en", "vs. them"],
    ["fr", "mlles. Dupont"],
    ["pl", "ds. tego"],
    ["id", "dsb. lain"],
    ["ceb", "mrs. Cruz"],
    ["bs", "str. 5"],
    ["gd", "srl. eile"],
    ["nl", "drs. Jansen"],
    ["hil", "sr. Cruz"],
];

/** The entity and compass sites, which take a different repair (fall back to the match / refuse it). */
const OTHER: readonly (readonly [string, string])[] = [
    ["wo", "km&ſup2 bi"], ["wo", "&nbſp x"], ["qu", "km&ſup2; bi"], ["qu", "&nbſp; x"],
    ["so", "12°ſ"], ["su", "12°ſ"], ["id", "12°ſ"],
];

/** Substitute the first character of `text` that has a fold partner — so the probe is guaranteed to match. */
function foldOne(text: string): string | undefined {
    for (const [plain, folded] of Object.entries(FOLDS)) {
        const i = text.indexOf(plain);
        if (i >= 0) return text.slice(0, i) + folded + text.slice(i + 1);
    }
    return undefined;
}

describe("a case-folded class never reaches an absent table entry (#1122)", () => {
    for (const [lang, wellFormed] of SITES) {
        const probe = foldOne(wellFormed);
        test(`${lang}: ${JSON.stringify(probe)} neither throws nor speaks "undefined"`, () => {
            expect(probe, "the probe must contain a foldable character").toBeDefined();
            const out = phonemize(probe!, lang);
            expect(out).not.toContain("undefined");
        });
    }

    /** ⚠ AND THE WELL-FORMED NEIGHBOUR STILL EXPANDS — without this the guard could refuse everything and
     *  every assertion above would still pass. The instrument is the DIFFERENCE between the two readings:
     *  the abbreviation expands, the folded near-miss is refused, so they cannot be equal. */
    for (const [lang, wellFormed] of SITES) {
        const probe = foldOne(wellFormed);
        test(`${lang}: ${JSON.stringify(wellFormed)} still expands where the folded form is refused`, () => {
            expect(phonemize(wellFormed, lang)).not.toBe(phonemize(probe!, lang));
        });
    }

    for (const [lang, probe] of OTHER) {
        test(`${lang}: ${JSON.stringify(probe)} neither throws nor speaks "undefined"`, () => {
            expect(phonemize(probe, lang)).not.toContain("undefined");
        });
    }

    /** ⚠ THE POSITIVE HALF FOR THE ENTITY SITES: an unconditional fallback would pass every test above. */
    test("the entity tables still expand what they DO carry", () => {
        expect(phonemize("km&sup2 bi", "wo")).not.toBe(phonemize("km&ſup2 bi", "wo"));
        expect(phonemize("&nbsp; x", "qu")).not.toBe(phonemize("&nbſp; x", "qu"));
    });

    /** …and the compass tables likewise. */
    test("the compass tables still expand what they DO carry", () => {
        for (const lang of ["so", "su", "id"]) {
            expect(phonemize("12°N", lang), lang).not.toBe(phonemize("12°ſ", lang));
        }
    });
});
