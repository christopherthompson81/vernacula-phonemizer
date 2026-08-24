/**
 * The crore count above 999 — a wrong reading no throw ever announced.
 *
 * Indian 2-2-3 grouping bounds the thousand and lakh counts at 99, but the CRORE group takes everything
 * above 10^7, so its count runs to 900,719,925 at the safe-integer ceiling. `dravidianGroup` sent that
 * count to `dravidianBelow1000`, whose contract is 1-999, and a count of 1000 asked for `units[10]` —
 * `undefined` in JS, rendered by `join(" ")` as an empty string. 10^10, 10^12 and 10^15 therefore all read
 * as "hundred crore" with a leading space: three different quantities, one wrong answer, no error.
 *
 * The C# port throws on the same index, which is how it was found.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

describe("Dravidian numbers above the crore count of 1000", () => {
    // Each is a DISTINCT reading — the defect gave all three the same one.
    const CASES: [string, string, string, string][] = [
        //  n          ml                        kn                       te
        ["1000000000", "nˈuːrɨ kˈoːɖi", "nˈuːɾu kˈoːʈi", "ʋˈãn̪d̪a kˈoːʈlu"],
        ["10000000000", "ˈaːjiɾam kˈoːɖi", "sˈaːʋiɾa kˈoːʈi", "ʋˈejːi kˈoːʈlu"],
        ["1000000000000", "lˈakʂam kˈoːɖi", "lˈakʂa kˈoːʈi", "lˈakʂa kˈoːʈlu"],
        ["100000000000000", "kˈoːɖi kˈoːɖi", "kˈoːʈi kˈoːʈi", "kˈoːʈi kˈoːʈlu"],
    ];
    for (const [n, ml, kn, te] of CASES) {
        test(n, () => {
            expect(phonemize(n, "ml")).toBe(ml);
            expect(phonemize(n, "kn")).toBe(kn);
            expect(phonemize(n, "te")).toBe(te);
        });
    }

    test("no reading begins with the space an `undefined` count left behind", () => {
        for (const lang of ["ml", "kn", "te"] as const)
            for (let e = 8; e <= 15; e++)
                expect(phonemize("1" + "0".repeat(e), lang)).not.toMatch(/^\s/u);
    });

    test("distinct magnitudes get distinct readings", () => {
        for (const lang of ["ml", "kn", "te"] as const) {
            const seen = new Set<string>();
            for (let e = 9; e <= 15; e++) seen.add(phonemize("1" + "0".repeat(e), lang));
            expect(seen.size).toBe(7);
        }
    });
});
