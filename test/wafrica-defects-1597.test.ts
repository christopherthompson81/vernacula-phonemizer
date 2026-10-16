/**
 * #1597: the ha/wo/ig/ak defects the Rust port of the West African group found. Relational throughout, so no IPA is
 * typed; all inputs are synthetic. The ha long-s item was fixed fleet-wide by #1601, and the yo infix U+2212 is
 * declined (no sourced subtraction word; see the PR). Mirrored in C# (`WafricaDefects1597Tests.cs`) and in each
 * language's Rust module.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

/** How many whole tokens of `out` equal `token`. */
const count = (out: string, token: string): number => out.split(" ").filter((t) => t === token).length;

describe("ha: only a lone capital's dot is an initial", () => {
    test("a sentence ending in an acronym keeps its break, as one ending in a word does", () => {
        const acronym = phonemize("Ya je BBC. Bello ya zo.", "ha");
        const word = phonemize("Ya je Kano. Bello ya zo.", "ha");
        expect(count(acronym, ".")).toBe(count(word, "."));
        expect(count(acronym, ".")).toBe(2);
    });

    test("an initial before a name still loses its dot", () => {
        expect(count(phonemize("Ya je M. Bello ya zo.", "ha"), ".")).toBe(1);
        expect(count(phonemize("Ya je M. Ɗanjuma ya zo.", "ha"), ".")).toBe(1);
    });
});

describe("wo: the degree word's redundancy window stops at the next sign or clause mark", () => {
    const aj = phonemize("aj", "wo").trim();

    test("the first coordinate keeps its word when only the second is glossed", () => {
        // 12° gets its own word, and the gloss carries the second one's: two in all.
        expect(count(phonemize("12° ak 16° (fukk ak juróom benn aj)", "wo"), aj)).toBe(2);
    });

    test("a word in the next clause does not silence the sign", () => {
        expect(count(phonemize("tàng 30° la, waaye aj du", "wo"), aj)).toBe(2);
    });

    test("a sign glossed right after it is still said once", () => {
        expect(count(phonemize("60° (60 aj)", "wo"), aj)).toBe(1);
        expect(count(phonemize("0° (tus aj)", "wo"), aj)).toBe(1);
    });
});

describe("ig, ak: a digit-flanked ASCII x reads as the × it stands for", () => {
    for (const lang of ["ig", "ak"]) {
        test(`${lang}: glued, spaced and with a glued unit`, () => {
            expect(phonemize("4x100", lang)).toBe(phonemize("4×100", lang));
            expect(phonemize("4 x 100", lang)).toBe(phonemize("4 × 100", lang));
            expect(phonemize("4X100", lang)).toBe(phonemize("4×100", lang));
            expect(phonemize("4x100m", lang)).toBe(phonemize("4×100m", lang));
        });

        test(`${lang}: an x that is not between digits is untouched`, () => {
            expect(phonemize("x 100", lang)).not.toBe(phonemize("× 100", lang));
        });
    }
});
