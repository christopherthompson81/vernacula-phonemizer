/**
 * ⚠ A DOUBLED PLAIN SPACE INSIDE A CHARACTER CLASS IS A FOLDED NON-BREAKING SPACE, and this test is what keeps
 * it out. `[  ]` LOOKS like "space or something else" and matches exactly what `[ ]` matches: a class of one
 * character written as two.
 *
 * It was the fleet's most widespread latent defect — 296 sites across 44 normalizers (#925), every one a
 * separator slot (currency-code folds, dotted-abbreviation runs, era markers, clock separators, digit
 * grouping). The shape is invisible in review and no gate can see it: nothing vanishes from the TEXT, only
 * from the READING, and no golden happens to carry a NBSP in one of those slots. Measured on constructed
 * input it was worth real readings — nb `1<NBSP>000 kroner` read *én null* instead of *tusen*, zu lost a
 * whole magnitude, sw read `1000<NBSP>BC` as the cluster *ɓk*, and nl dropped a currency word outright
 * (#924).
 *
 * The rule is therefore: a spaces class is written with ESCAPES (`\u00a0`, `\u202f`, `\u2009`), never with
 * literal exotic spaces, because a literal one folds to a plain space in exactly the way that produced this.
 */
import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Every .ts file under src/, walked rather than globbed so a new directory cannot escape the check. */
function sources(dir: string): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) out.push(...sources(p));
        else if (e.name.endsWith(".ts")) out.push(p);
    }
    return out;
}

/** A character class holding two ADJACENT plain spaces. */
const DOUBLED = /\[[^\]\n]*  [^\]\n]*\]/gu;

describe("no character class holds a doubled plain space", () => {
    test("src/ is clean", () => {
        const offenders: string[] = [];
        for (const f of sources("src")) {
            const text = readFileSync(f, "utf8");
            for (const m of text.matchAll(DOUBLED)) {
                const line = text.slice(0, m.index).split("\n").length;
                offenders.push(`${f}:${line}  ${m[0]}`);
            }
        }
        expect(offenders).toEqual([]);
    });
});
