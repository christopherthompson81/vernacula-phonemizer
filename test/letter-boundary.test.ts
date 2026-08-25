/**
 * The letter-boundary assertion has ONE spelling, and `\b` is never it.
 *
 * The fleet had this value written out 64 times as a named constant under FIFTEEN names — NOT_BEFORE,
 * NOT_AFTER, NOT_LETTER, NW_A, NW_B, NA, NB, L, R, WNB, NL, NLB … — so it was not only duplicated but
 * un-greppable under any single name. `src/core/boundaries.ts` now defines it once.
 *
 * ⚠ THE COST OF THE DUPLICATION WAS A SHIPPED DEFECT, not tidiness: five engines guarded the °C rule with
 * `\b`, which JS defines on ASCII `\w`, and read German `25°Cölner` as "Grad Celsius" + "ölner" (#949).
 *
 * ⚠ REGEX LITERALS ARE DELIBERATELY LEFT INLINE. 658 sites across 115 languages write
 * `(?![\p{L}\p{M}])` directly inside a `/…/` literal; converting those to `new RegExp` concatenation would
 * cost readability and the C# port's verbatim-pattern rule for no safety gain. This test pins their spelling
 * instead, which is the property that actually matters.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../src/core/boundaries.ts";
import { phonemize } from "../src/index.ts";

const FILES = readdirSync("src/languages", { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => readdirSync(`src/languages/${d.name}`)
        .filter((f) => f.endsWith(".ts"))
        .map((f) => `src/languages/${d.name}/${f}`));

const code = (p: string): string =>
    readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");

describe("the letter boundary is defined once", () => {
    test("no engine declares its own copy of the constant", () => {
        const offenders = FILES.filter((f) =>
            /const\s+\w+\s*=\s*"\(\?<?!\[\\\\p\{L\}\\\\p\{M\}\]\)"/u.test(code(f)));
        expect(offenders).toEqual([]);
    });

    test("the two exported fragments are the spelling the fleet actually uses", () => {
        expect(NOT_LETTER_BEFORE).toBe("(?<![\\p{L}\\p{M}])");
        expect(NOT_LETTER_AFTER).toBe("(?![\\p{L}\\p{M}])");
        // Both must be valid on their own, or a splice into a template silently breaks the host pattern.
        expect(() => new RegExp(`a${NOT_LETTER_AFTER}`, "u")).not.toThrow();
        expect(() => new RegExp(`${NOT_LETTER_BEFORE}a`, "u")).not.toThrow();
    });

    test("no engine uses \\b where the letter boundary is meant", () => {
        // The signature that bit us: a symbol-adjacent rule guarded by `\b`. After a word character it holds
        // for any NON-ASCII letter, so the rule fires into the following word.
        const offenders: string[] = [];
        for (const f of FILES) {
            for (const m of code(f).matchAll(/\/[^/\n]*[°%$€£¥][^/\n]*\\b[^/\n]*\/[a-z]*/gu)) {
                offenders.push(`${f}: ${m[0]}`);
            }
        }
        expect(offenders).toEqual([]);
    });
});

/**
 * ⚠ A CORRECTION IS RECORDED HERE BECAUSE IT NEARLY BECAME A BUG REPORT.
 *
 * While auditing the Uzbek `%i` site, a probe printed `50%i` as `50NaN` and it was written up as a live
 * defect. It was the PROBE: Node's `console.log` reads `%i` in its first argument as a printf integer
 * specifier and substitutes the next argument. Uzbek was always correct — `50%i` reads *ellik foizi*.
 *
 * The lesson is about the instrument, not the language: a harness that formats its own output cannot be
 * used to inspect text containing format specifiers. Every probe in this repo writes to a FILE for exactly
 * this reason; the one that lied was an ad-hoc `console.log` written in a hurry.
 */

describe("the probe harness does not reinterpret the text it prints", () => {
    test("a percent-letter sequence survives a round trip through a file", () => {
        const reading = phonemize("50%i", "uz");
        writeFileSync("/tmp/.vernacula-probe-check", `50%i\t${reading}\n`);
        expect(reading).not.toContain("NaN");
        // The possessive suffix is read, not dropped: ellik foizi.
        expect(reading).toBe(phonemize("ellik foizi", "uz"));
    });
});
