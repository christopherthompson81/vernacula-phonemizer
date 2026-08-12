import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY PYTHON FILE UNDER tools/ MUST AT LEAST PARSE.
 *
 * ⚠ WHY THIS EXISTS. `npm run ci` was green for two commits with a syntactically invalid
 * `tools/normalization/filter-by-language.py` in the tree — a squash-merge resolved two other files by hand,
 * ran `git add -A` over the third, and committed the conflict markers. The markers also swallowed the closing
 * `),` of a dict entry. Nothing in the suite imported the file, so tsc had no reason to look at it and vitest
 * had nothing to run: 240 test files and 3769 tests passed over a module that could not be loaded at all.
 *
 * ⚠ AND THE GAP IS STRUCTURAL, NOT A ONE-OFF. 81 Python files live under tools/ — dump converters, corpus
 * filters, the language catalogue's build and derive scripts, the taggers' training code. Only a handful are
 * exercised by a test (`languageCatalogue.test.ts` shells out to two of them); the rest are run by hand, months
 * apart, by whoever next needs them. A file that stopped parsing would be discovered by a human at the moment
 * they most wanted it to work, with no hint of when it broke.
 *
 * This is deliberately the WEAKEST useful check: it proves the file is syntactically Python, nothing more. It
 * does not import (many need argv, a dump path, or torch), does not lint, and does not typecheck. The bug it is
 * built for produced a file that could not be parsed, and a merge accident is the likeliest way that recurs.
 */
const ROOT = join(import.meta.dirname, "..");
const TOOLS = join(ROOT, "tools");

const havePython = (() => {
    try {
        execFileSync("python3", ["-c", "import ast"], { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
})();

/** Every .py under tools/, skipping the byte-compiled cache. */
function pythonFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (entry === "__pycache__" || entry === ".venv") continue;
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) pythonFiles(p, out);
        else if (entry.endsWith(".py")) out.push(p);
    }
    return out;
}

describe("the Python tools parse", () => {
    // Skipped without python3 on PATH, the same shape as the catalogue tests — these scripts need only the
    // standard library's `ast`, so this skips on a bare container and nowhere else.
    it.skipIf(!havePython)("every .py file under tools/ is syntactically valid", () => {
        const files = pythonFiles(TOOLS);
        // A guard on the guard: if the walk silently stopped finding files, the test would pass vacuously.
        expect(files.length, "found no Python files under tools/ — the walk is broken, not the tree").
            toBeGreaterThan(50);

        const script =
            "import ast,sys\n" +
            "bad=[]\n" +
            "for p in sys.argv[1:]:\n" +
            "    try: ast.parse(open(p,encoding='utf8').read(), filename=p)\n" +
            "    except SyntaxError as e: bad.append(f'{p}:{e.lineno}: {e.msg}')\n" +
            "print('\\n'.join(bad))\n";
        const out = execFileSync("python3", ["-c", script, ...files], { encoding: "utf8", timeout: 120_000 }).trim();
        const failures = out ? out.split("\n").map((l) => relative(ROOT, l)) : [];
        expect(failures, `Python file(s) do not parse:\n${failures.join("\n")}`).toEqual([]);
    });

    it.skipIf(!havePython)("⚠ no file in the tree carries a merge conflict marker", () => {
        // The conflict-marker case is worth its own assertion because it is how the parse failure got in, and
        // because markers in a file that DOES still parse (a .ts, a .md, a .jsonc) would slip through entirely.
        // `git grep` is used rather than a walk so it respects .gitignore and only sees tracked content.
        let out = "";
        try {
            out = execFileSync("git", ["grep", "-lE", "^(<{7}|={7}|>{7})( |$)", "--", ":!*.test.ts"], {
                cwd: ROOT,
                encoding: "utf8",
                timeout: 60_000,
            }).trim();
        } catch (e) {
            // git grep exits 1 with no output when nothing matches — that is the passing case.
            const err = e as { status?: number; stdout?: string };
            if (err.status !== 1) throw e;
            out = (err.stdout ?? "").trim();
        }
        const files = out ? out.split("\n") : [];
        expect(files, `unresolved merge conflict marker(s) in:\n${files.join("\n")}`).toEqual([]);
    });
});
