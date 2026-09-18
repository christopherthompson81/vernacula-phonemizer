/**
 * A TOOL THAT WRITES A MODEL WHERE THE ENGINE DOES NOT READ IT REPORTS SUCCESS AND CHANGES NOTHING.
 *
 * ⚠ THIS IS THE FAILURE THIS FILE EXISTS FOR, and it has happened at least three times. #876 moved 317 data
 * assets from `src/languages/<lang>/` to a shared `data/` tree and repointed 49 tools by hand — but not the
 * TRAINERS and EXPORTERS, because nothing runs them routinely, so nothing failed. `tools/english/
 * en_g2p_bilstm.py` read a dict that no longer existed (loud, harmless) while its ONNX export wrote to a
 * dead directory (silent, and the package fence ships `src/`, so a stray 3 MB model would have been
 * published). `tools/perso-arabic/export_onnx.py` had the same bug twice over, once documented in its own
 * header as "two ORPHAN files" and still pointing somewhere wrong afterwards.
 *
 * The gates cannot catch it: the test suite and the parity gate exercise the ENGINE, and a trainer is not
 * on that path. This test reads the tools instead.
 */
import { describe, expect, test } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** ⚠ ALLOWED: these read MODULE SOURCE (`.ts`) to discover which directory owns a language, which is
 *  exactly what `src/` is still for. `gen_parity_goldens.mts` says so in its own comment — "the .ts to
 *  identify which directory owns the code, the .tsv under data/ for the headwords". */
const READS_MODULE_SOURCE = new Set([
    "tools/gen_parity_goldens.mts",
    "tools/language-catalogue/derive-normalization.py",
    "tools/normalization/coverage.ts",
    "tools/normalization/review.ts",     // a comment RECORDING this bug class; inverting it destroys the point
    "tools/normalization/defects.ts",
    "tools/registry-map.ts",
    "tools/seam-parity.mts",
    "tools/arabic/eval_ar_runtime.mts",  // names src/languages/arabic/diacritizer.ts across two lines
]);

function walk(dir: string, out: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (e === "node_modules" || e.startsWith(".")) continue;
        if (statSync(p).isDirectory()) walk(p, out);
        else out.push(p);
    }
    return out;
}

const FILES = walk("tools").filter((f) => !/\.(png|jpg|onnx|pt|bin|gz|zip)$/u.test(f));

describe("tools resolve data under data/, not the pre-#876 src/ tree", () => {
    test("no tool joins a data path out of src/languages", () => {
        const bad: string[] = [];
        for (const f of FILES) {
            if (READS_MODULE_SOURCE.has(f)) continue;
            readFileSync(f, "utf8").split("\n").forEach((line, i) => {
                // an os.path.join(..., "src", "languages", ...) in tools/ is always a DATA path — a code
                // import is written as a module specifier string, never assembled from segments
                if (line.includes('"src", "languages"')) bad.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`);
                // …and a src/languages/<x>/<y>.<data-ext> reference is a data file wherever it appears
                if (/src\/languages\/[a-z-]+\/[A-Za-z0-9_.-]+\.(tsv|jsonc|onnx|pt|txt)/u.test(line))
                    bad.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`);
            });
        }
        expect(bad).toEqual([]);
    });

    // ⚠ THE SECOND HALF, AND THE ONE THAT CATCHES A *WRONG* data/ PATH rather than a stale src/ one.
    // `tools/perso-arabic/export_onnx.py` pointed at `data/languages/perso-arabic`, which has never existed
    // — repointing src/→data/ alone left it just as broken, and only checking that the directory EXISTS
    // finds that. riderDiacritizer is a shared core model and lives in `data/core`.
    test("every data/ directory a tool names actually exists", () => {
        const missing = new Set<string>();
        for (const f of FILES) {
            for (const m of readFileSync(f, "utf8").matchAll(/data\/(?:languages\/[a-z-]+|core)\b/gu))
                if (!existsSync(m[0])) missing.add(`${m[0]}  (named by ${f})`);
            for (const m of readFileSync(f, "utf8").matchAll(/"data", "languages", "([a-z-]+)"/gu))
                if (!existsSync(`data/languages/${m[1]}`)) missing.add(`data/languages/${m[1]}  (named by ${f})`);
        }
        expect([...missing]).toEqual([]);
    });
});
