/**
 * NO SOURCE FILE MAY CONTAIN A RAW SENTINEL CHARACTER (#1175).
 *
 * ⚠ THIS GUARDS THE REVIEW METHOD, NOT THE READING. Every mechanical pass this repo's port reviews rely on
 * — the regex-by-codepoint diff, the table-membership diff, the missing-constant sweep — is a grep or a
 * read over the source. A raw NUL makes `file(1)` classify the source as `data` and **`grep` then skips it
 * in silence**: no match, no error, no exit code. All of those passes return zero findings and the reviewer
 * reports the file clean.
 *
 * Three files were in exactly that state when this test was written, and the sweep that found them had to
 * be a Python scan — the `grep` looking for them came back empty, which is the defect demonstrating itself.
 *
 * A raw PUA character is quieter still: `file` is happy, `grep` works, and `const AGO = "…"` READS AS THE
 * EMPTY STRING, so a reviewer diffing a TS `const AGO = ""` against a C# `const string AGO = ""` calls
 * them equal even if one of them genuinely were empty.
 *
 * The fix at every site is an escape (a backslash-u form) or one of `src/core/markers.ts`'s named
 * constants. This test pins the absence so the class cannot come back.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/** Built with `String.fromCharCode` so this test file does not itself contain what it forbids. */
const FORBIDDEN: readonly { ch: string; name: string }[] = [
    { ch: String.fromCharCode(0x0000), name: "U+0000 NUL" },
    { ch: String.fromCharCode(0xe000), name: "U+E000 PUA" },
    { ch: String.fromCharCode(0xe001), name: "U+E001 PUA" },
    { ch: String.fromCharCode(0xe002), name: "U+E002 PUA" },
    { ch: String.fromCharCode(0xe003), name: "U+E003 PUA" },
];

const SKIP = new Set(["node_modules", ".git", "dist", "bin", "obj", "target", ".venv"]);
const EXT = /\.(ts|mts|cts|cs)$/;

function sources(dir: string, out: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
        if (SKIP.has(e)) continue;
        const p = join(dir, e);
        if (statSync(p).isDirectory()) sources(p, out);
        else if (EXT.test(e)) out.push(p);
    }
    return out;
}

describe("no raw sentinel characters in source", () => {
    test("every .ts / .mts / .cs file is free of raw NUL and PUA characters", () => {
        const files = [...sources("src"), ...sources("tools"), ...sources("csharp/Vernacula.Phonemizer"),
                       ...sources("csharp/Vernacula.Phonemizer.Tests"), ...sources("test")];
        expect(files.length).toBeGreaterThan(500); // the walk found the tree, not an empty directory
        const bad: string[] = [];
        for (const f of files) {
            const s = readFileSync(f, "utf8");
            for (const { ch, name } of FORBIDDEN) {
                if (!s.includes(ch)) continue;
                const line = s.split("\n").findIndex((l) => l.includes(ch)) + 1;
                bad.push(`${f}:${line} contains a raw ${name} — write the escape, or import from src/core/markers.ts`);
            }
        }
        expect(bad).toEqual([]);
    });
});
