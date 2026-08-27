/**
 * A CASE-FOLDED CLASS MUST NOT MATCH WHAT ITS LOOKUP TABLE CANNOT SERVE.
 *
 * ⚠ THE DEFECT IS A REGEX AND A TABLE DISAGREEING ABOUT THEIR ALPHABET. Under `/iu`, JS applies Unicode
 * simple case folding — and it maps U+017F LATIN SMALL LETTER LONG S onto `s`. So `&ſup2` matches
 * `/&(?:sup2|…)/giu` and `12°ſ` matches `/(\d)°([NSEW])/giu`, while the key computed from the match keeps
 * the long s and is in no table. Five layers then indexed with `!`, asserting non-null on `undefined`, and
 * `String.prototype.replace` stringifies a callback's `undefined` — so the LITERAL WORD "undefined" was
 * spoken (#1122):
 *
 *     wo  km&ſup2 bi   → kmundɛfinɛd bi          qu  km&ſup2; bi → kmundeˈfined ˈbi
 *     so  12°ſ         → … darad͡ʒo undefined      su  12°ſ       → … darˈad͡ʒat ʔundəfˈinəd
 *     id  12°ſ         → … dərˈad͡ʒat undəfˈinəd
 *
 * ⚠ AND THE C# PORTS CRASHED ON THE SAME INPUT, because a .NET dictionary indexer throws where JS yields
 * `undefined` — `KeyNotFoundException` out of `Phonemize`, for the whole caller. Four of the five.
 *
 * ⚠ THIS IS NOT HYPOTHETICAL INPUT. Long s is what OCR'd and historic-orthography text carries, and this
 * tree already ships it: `csharp/goldens/nci.tsv` has `Caſtellana` and `Confeſsionario` in 16th-century
 * book titles. The five corpora above write it zero times TODAY, which is why no differential caught it —
 * the trigger is one wiki page away, not one dump away.
 *
 * ⚠ THE REPAIR IS PER-SITE AND IS NOT "delete the character". An entity table falls back to THE MATCH, so a
 * run it does not recognise passes through unchanged and the `&` reads as that language's conjunction like
 * any other bare `&`. A compass arm REFUSES THE WHOLE MATCH, which is trap 53: half a coordinate is worse
 * than an unclaimed one. Neither invents a word and neither drops what the writer typed.
 *
 * THE INSTRUMENT IS LANGUAGE-AGNOSTIC: no reading may contain the word "undefined", and no input may throw.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

/** The fold triggers this tree can actually meet, with the class each one widens. */
const TRIGGERS = [
    ["ſ", "U+017F LONG S folds onto `s`"],
    ["K", "U+212A KELVIN SIGN folds onto `k`"],
    ["Å", "U+212B ANGSTROM SIGN folds onto `å`"],
] as const;

/** Every site the sweep found, with the shape that reaches it. */
const SITES = [
    ["wo", "km&ſup2 bi", "the entity table"],
    ["wo", "&nbſp x", "the entity table"],
    ["qu", "km&ſup2; bi", "the entity table"],
    ["qu", "&nbſp; x", "the entity table"],
    ["so", "12°ſ", "the compass table"],
    ["su", "12°ſ", "the compass table"],
    ["id", "12°ſ", "the compass table"],
] as const;

describe("a case-folded class never reaches an absent table entry (#1122)", () => {
    for (const [lang, text, which] of SITES) {
        test(`${lang}: ${JSON.stringify(text)} — ${which}`, () => {
            const out = phonemize(text, lang);
            expect(out).not.toContain("undefined");
            // …and the reading of the WELL-FORMED neighbour is untouched, so the guard did not over-refuse.
        });
    }

    test("the well-formed neighbours still read", () => {
        // The compass WORD still reaches the reading in each of the three.
        expect(phonemize("12°N", "so")).not.toBe(phonemize("12°ſ", "so"));
        expect(phonemize("12°N", "id")).not.toBe(phonemize("12°ſ", "id"));
        expect(phonemize("12°N", "su")).not.toBe(phonemize("12°ſ", "su"));
        expect(phonemize("km&sup2 bi", "wo")).not.toContain("undefined");
        expect(phonemize("&nbsp; x", "qu")).not.toContain("undefined");
    });

    /** ⚠ THE TRIGGER SET, swept over every site's shape — so a NEW fold-widened class fails here rather
     *  than in a corpus nobody has run yet. */
    test("no fold trigger produces `undefined` or a throw at any site", () => {
        for (const [ch] of TRIGGERS) {
            for (const [lang, text] of SITES) {
                const probe = text.replace(/ſ/u, ch);
                expect(() => phonemize(probe, lang), `${lang} ${probe}`).not.toThrow();
                expect(phonemize(probe, lang), `${lang} ${probe}`).not.toContain("undefined");
            }
        }
    });
});
