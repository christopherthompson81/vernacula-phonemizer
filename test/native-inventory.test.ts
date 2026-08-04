/**
 * A DECLARED INVENTORY IS A CLAIM ABOUT THE G2P (#657), so measure it instead of trusting it.
 *
 * `NATIVE_CLASS` names the letters an engine's g2p has rules for. `makeNativiser` folds everything OUTSIDE it to
 * a base the g2p can read, and leaves everything inside alone — so a class that lists a letter the g2p CANNOT
 * read produces silence: the fold declines to touch it, and the g2p then drops it.
 *
 * ⚠ THE WORD-LEVEL FOLD USED TO MASK THIS, which is why it went unnoticed. Folding the whole word when any one
 * letter was foreign meant an over-claimed letter got folded too, by accident, whenever it happened to share a
 * word with something genuinely foreign. Judging each character separately — which is the correct semantics, and
 * the fix for Turkish `İsveç` coming out *ɯsvˈed͡ʒ* — removes the accident and exposes the mismatch. Eight
 * engines were over-claiming: da, ro, kea, mt, lb, rup, ast, lg.
 *
 * ⚠ LETTERS ONLY. An apostrophe (`'`, `’`, `ʼ`), a word-joiner (`·`, `‑`) or a bare combining mark carries no
 * segment, so a g2p that ignores it is correct rather than over-claiming. The first version of this probe flagged
 * fourteen languages for exactly that and had to be narrowed — `\p{L}` minus `\p{Lm}`, since the modifier-letter
 * apostrophes are letters by Unicode category and punctuation by function.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { dirCodes } from "../tools/registry-map.ts";

/** Expand a character-class body to its literal characters (ranges only over short spans, which is all we use). */
function expand(body: string): string[] {
    const out: string[] = [];
    const cs = [...body];
    for (let i = 0; i < cs.length; i++) {
        if (cs[i + 1] === "-" && cs[i + 2] !== undefined) {
            const a = cs[i]!.codePointAt(0)!, z = cs[i + 2]!.codePointAt(0)!;
            if (z > a && z - a < 60) {
                for (let c = a; c <= z; c++) out.push(String.fromCodePoint(c));
                i += 2;
                continue;
            }
        }
        out.push(cs[i]!);
    }
    return out;
}

describe("a declared native inventory matches what the g2p can read (#657)", () => {
    test("no engine claims a letter its own g2p drops", () => {
        const overclaims: string[] = [];
        for (const [dir, codes] of dirCodes()) {
            const code = codes[0]!;
            for (const f of readdirSync(`src/languages/${dir}`).filter((x) => x.endsWith(".ts"))) {
                const src = readFileSync(`src/languages/${dir}/${f}`, "utf8");
                const m = src.match(/^const NATIVE_CLASS = "\[([^"]*)\]";$/mu);
                if (m === null) continue;
                const bare = phonemize("kao", code);
                for (const c of new Set(expand(m[1]!))) {
                    // ASCII is never in question; punctuation and modifier letters carry no segment.
                    if (/[a-zA-Z]/u.test(c) || !/\p{L}/u.test(c) || /\p{Lm}/u.test(c)) continue;
                    let out: string;
                    try {
                        out = phonemize(`ka${c}o`, code);
                    } catch {
                        continue;
                    }
                    if (out === bare) overclaims.push(`${code} claims ${c} but drops it`);
                }
                break;
            }
        }
        expect(overclaims, "a claimed letter the g2p drops — remove it from NATIVE_CLASS so the fold reaches it")
            .toEqual([]);
    });

    test("an out-of-inventory letter is FOLDED, never dropped", () => {
        // The letters NFD cannot decompose, which is the case the mark-stripping fold alone does not reach. The
        // assertion is that the leading letter still contributes: dropping it makes the word read as if it had
        // never been typed, so the reading must differ from the reading of the word WITHOUT it.
        for (const [w, lang] of [
            ["Æthelred", "de"],   // Æ → a; read *thˈɛlʁət*, the Æ simply gone, before the fold reached it
            ["Łódź", "de"],       // Ł → l
            ["Ærø", "es"],
        ] as const)
            expect(phonemize(w, lang), `${lang} ${w} — leading letter dropped`)
                .not.toBe(phonemize(w.slice(1), lang));
        // …and a letter that IS native survives untouched, which is what makes the fold conditional.
        expect(phonemize("þing", "is")).toContain("θ");
        expect(phonemize("blåbær", "nb")).toContain("æ");
        expect(phonemize("ɛdwuma", "ak")).toContain("ɛ");
    });
});
