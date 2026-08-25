/**
 * An invisible character must be written as an ESCAPE, and must be NAMED where it is used.
 *
 * The fleet wrote the digit-grouping space class both ways: 55 sites in 28 languages spelled it with the
 * literal characters and 96 spelled it `[    ]`, plus ten more in upper-case hex — the same
 * class in three spellings. A literal is unreadable in source: `[  ]` (two ASCII spaces, a duplicated one)
 * and `[  ]` (space + NBSP) are indistinguishable on screen, which is exactly how #925 shipped 296
 * broken classes, and how the Burmese U+0001 join separator (#931) read as `join("")`.
 *
 * ⚠ ESCAPING IS NOT ENOUGH ON ITS OWN, which is why the second test exists. ` ` is legible but still
 * opaque — a reader has to know the codepoint. Every site now names the characters beside them.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";

const FILES: string[] = [];
for (const d of readdirSync("src/languages", { withFileTypes: true }).filter((x) => x.isDirectory()))
    for (const f of readdirSync(`src/languages/${d.name}`).filter((x) => x.endsWith(".ts")))
        FILES.push(`src/languages/${d.name}/${f}`);
for (const f of readdirSync("src/core").filter((x) => x.endsWith(".ts"))) FILES.push(`src/core/${f}`);

/** The characters a reader cannot see, whether written literally or as an escape. */
const INVISIBLE = new Set([
    0x00a0, 0x00ad, 0x2007, 0x2008, 0x2009, 0x202f, 0x205f, 0x3000, 0x0640,
    0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2060, 0xfeff, 0x0001,
    0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
]);
const ESCAPE = /\\u(?:00a0|00ad|2007|2008|2009|200b|200c|200d|200e|200f|202[abcdef]|205f|2060|206[6789]|3000|feff|0001|0640)/i;
const NAMED = /nbsp|non-break|thin space|narrow|zero-?width|zwsp|zwnj|zwj|\bbom\b|ideographic|figure space|punctuation space|soft hyphen|word joiner|tatweel|bidi|\bLRM\b|\bRLM\b|\bLR[EOI]\b|\bRL[EOI]\b|\bPD[FI]\b|\bFSI\b|u\+[0-9a-f]{4}|byte-order/i;

const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");

describe("invisible characters are escaped and named", () => {
    test("every invisible character is NAMED on its line or the one above", () => {
        const offenders: string[] = [];
        for (const f of FILES) {
            const lines = readFileSync(f, "utf8").split("\n");
            let inBlock = false;
            lines.forEach((l, i) => {
                const t = l.trim(), was = inBlock;
                if (t.startsWith("/*")) inBlock = true;
                const isComment = was || inBlock || t.startsWith("*") || t.startsWith("//");
                if (t.endsWith("*/")) inBlock = false;
                if (isComment) return; // a comment naming one is the thing we are asking for
                const literal = [...l].some((c) => INVISIBLE.has(c.codePointAt(0)!));
                if (!literal && !ESCAPE.test(l)) return;
                if (NAMED.test(l) || (i > 0 && NAMED.test(lines[i - 1]!))) return;
                offenders.push(`${f}:${i + 1}`);
            });
        }
        expect(offenders).toEqual([]);
    });

    test("the escapes are lower-case hex, so the class has ONE spelling", () => {
        const offenders: string[] = [];
        for (const f of FILES)
            if (/\\u(?:00A0|202F|2009[A-F]|3000[A-F])/u.test(readFileSync(f, "utf8"))) offenders.push(f);
        expect(offenders).toEqual([]);
    });
});
