/**
 * `data/` IS PUBLISHED AS ITS OWN PACKAGE, AND THE TWO MUST NOT DRIFT (#1247).
 *
 * The engine package ships `src/` and nothing else — 3.0 MB against the data tree's 151 MB — and reaches
 * the assets through `vernacula-phonemizer-data`, a real dependency. That is the npm expression of the rule
 * `core/dataPath.ts` states: DATA IS OWNED BY NO ENGINE. The tree is the artifact, published as-is, and the
 * C# port can consume the same one.
 *
 * ⚠ THE FAILURE THIS PINS IS SILENT AND SHIPS. Before it, `files` named neither `data` nor a data package,
 * so `npm pack` produced 734 files with ZERO under `data/` and an installed copy threw
 * `ENOENT … data/languages/hindi/hindi.jsonc` at the FIRST manifest read — at registry import, before any
 * consumer code ran. Nothing failed in the repo, because in a checkout the tree is simply there. The cost
 * of the split is that two package.jsons now have to agree; these are the assertions that make that
 * mechanical instead of remembered.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";

import { resolveDataRoot } from "../src/core/nodeDataSource.ts";

interface Pkg {
    name: string;
    version: string;
    files?: string[];
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    workspaces?: string[];
}

const read = (p: string): Pkg => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8")) as Pkg;
const root = read("../package.json");
const data = read("../data/package.json");

describe("the data package", () => {
    test("versions move together, and the engine depends on THIS version", () => {
        expect(data.name).toBe("vernacula-phonemizer-data");
        // ⚠ LOCKSTEP, NOT COMPATIBILITY. The engine asks for keys the data tree either has or does not; a
        //   data package one release behind is a set of missing files, and a missing file is `loadTsv`'s
        //   `optional` returning an empty Map — a plausible wrong reading, not an error.
        expect(data.version).toBe(root.version);
        // ⚠ AN EXACT PIN, NOT A CARET. A caret admits any newer 0.1.x — and once versions reach 1.x, any
        //   1.x — which is compatibility semantics, not lockstep. A data package the engine did not expect
        //   is a set of keys that may not be there, and a missing key is `loadTsv`'s `optional` returning
        //   an EMPTY Map: a plausible wrong reading, not an error. Nothing downstream would report it.
        expect(root.dependencies?.["vernacula-phonemizer-data"]).toBe(root.version);
        // A workspace, so a checkout resolves the dependency to the live tree rather than a published copy.
        expect(root.workspaces).toContain("data");
    });

    test("the engine package ships NO data — that is the point of the split", () => {
        expect(root.files).not.toContain("data");
        expect(root.files?.some((f) => f.startsWith("data"))).toBe(false);
    });

    test("⚠ every tracked file under data/ is inside a directory the data package SHIPS", () => {
        const tracked = execFileSync("git", ["ls-files", "data"], { encoding: "utf8" })
            .split("\n").filter(Boolean).map((p) => p.slice("data/".length));
        const shipped = new Set(data.files?.filter((f) => !f.startsWith("!")));
        const orphans = [...new Set(
            tracked.filter((p) => p !== "package.json").map((p) => p.split("/")[0]!),
        )].filter((top) => !shipped.has(top));
        // A new top-level directory under data/ is invisible to `files`, so it would simply not be
        // published — the assets would be in git, the gates would pass, and only an installed consumer
        // would find them missing.
        expect(orphans).toEqual([]);
    });

    test("⚠ it carries the ATTRIBUTION the data itself obliges", () => {
        // NOTICE.md exists because the project "ships and distributes data derived from third-party
        // sources", and two upstreams (EDRDG's JMdict/KANJIDIC among them) require specific, named
        // acknowledgement — "obligations, not courtesies", in its own words. Once `data/` is its own
        // package, THAT package is the artifact doing the distributing, so it is the one that must carry
        // them. A bare tree of tables would be a licence violation, not an untidy package.
        for (const f of ["LICENSE", "LICENSES", "NOTICE.md"]) expect(data.files).toContain(f);
        // They are copied in at pack time so the repo keeps one source of truth and the copies cannot drift.
        expect(data.scripts?.["prepack"]).toMatch(/pack-data-licenses/u);
    });

    test("the PyTorch training artifact is excluded; the runtime models are not", () => {
        // `km_segmenter.pt` is the training checkpoint — `khmerSegmenter.ts` loads `km-segmenter.int8.onnx`.
        expect(data.files).toContain("!languages/khmer/km_segmenter.pt");
        expect(data.files?.some((f) => f.startsWith("!") && f.includes(".int8.onnx"))).toBe(false);
    });
});

/**
 * ⚠ THE RESOLUTION IS THE PAYLOAD, AND NOTHING ELSE REACHES IT. The gates above check packaging METADATA;
 * a tarball install checks the happy path once, by hand. These drive every branch, including the two a
 * checkout can never take — an installed consumer (no `<pkg>/data`, so the package answers) and a
 * consumer missing the data package entirely.
 */
describe("dataRoot resolution", () => {
    const never = (): string => { throw new Error("resolve should not have been reached"); };
    const url = "file:///home/u/proj/src/core/nodeDataSource.ts";

    test("1. VERNACULA_DATA_DIR wins outright — an explicit answer is never second-guessed", () => {
        expect(resolveDataRoot({
            env: () => "/mnt/assets",
            exists: () => true, // …even though a checkout is right there
            resolve: never,
            moduleUrl: url,
        })).toBe("/mnt/assets");
    });

    test("2. the CHECKOUT beats the installed package", () => {
        // 96 tools, 290 test files and the C# parity harness read the live tree. A stale installed copy
        // shadowing it would make them measure a different corpus than the one under edit — silently,
        // since every file would still resolve.
        expect(resolveDataRoot({
            env: () => undefined,
            exists: (p) => p === "/home/u/proj/data",
            resolve: never,
            moduleUrl: url,
        })).toBe("/home/u/proj/data");
    });

    test("3. an INSTALLED engine falls through to the data package", () => {
        expect(resolveDataRoot({
            env: () => undefined,
            exists: () => false, // node_modules/vernacula-phonemizer/data does not exist
            resolve: () => "file:///app/node_modules/vernacula-phonemizer-data/package.json",
            moduleUrl: "file:///app/node_modules/vernacula-phonemizer/src/core/nodeDataSource.ts",
        })).toBe("/app/node_modules/vernacula-phonemizer-data");
    });

    test("4. with the package absent, the error names a real directory", () => {
        // `import.meta.resolve` throws when the package is missing. Returning the checkout path makes the
        // eventual failure an ENOENT on a path someone can go and look at, rather than a resolution error.
        expect(resolveDataRoot({
            env: () => undefined,
            exists: () => false,
            resolve: () => { throw new Error("ERR_MODULE_NOT_FOUND"); },
            moduleUrl: url,
        })).toBe("/home/u/proj/data");
    });

    test("⚠ a bundled `import.meta.url` does not silently chop the path", () => {
        // No `/src/` segment: `slice(0, -1)` would take the URL's LAST CHARACTER off and produce
        // `…/index.j/data`, a directory that never existed, in an error message claiming to name a real one.
        expect(resolveDataRoot({
            env: () => undefined,
            exists: () => false,
            resolve: () => { throw new Error("nope"); },
            moduleUrl: "https://cdn.example/assets/index-a1b2c3.js",
        })).toBe("https://cdn.example/assets/data");
    });

    test("a Windows file: URL resolves to the same place as a POSIX one", () => {
        expect(resolveDataRoot({
            env: () => undefined,
            exists: () => true,
            resolve: never,
            moduleUrl: "file:///C:/proj/src/core/nodeDataSource.ts",
        })).toBe("C:/proj/data");
    });
});
