/**
 * `onnxruntime-node` IS AN OPTIONAL DEPENDENCY, AND THE TYPECHECK MUST NOT DEPEND ON IT.
 *
 * ⚠ THE FAILURE THIS PINS IS AN INTERMITTENT CI BREAK, WHICH IS WHY NOTHING ELSE CATCHES IT. npm reports a
 * failed optional install as SUCCESS — the native binary is simply absent — and `tsc` then fails with TS2307
 * on a package the code deliberately tolerates missing. It lands in whatever change happens to be in flight:
 * on PR #746 the identical commit failed once and passed on re-run with nothing altered in between, in a job
 * that touched no ONNX code at all.
 *
 * Two things keep it fixed, and both are asserted here:
 *   · core/onnx.ts imports through a CONST specifier, so tsc never statically resolves the package. (An
 *     ambient `declare module` would also work, but this package exports TS SOURCE — a declaration shipped in
 *     src/ would land in consumers' compilations and shadow their own onnxruntime-node types.)
 *   · core/onnx.ts is the ONLY importer, which is what makes that one indirection sufficient. Every neural
 *     path — the English/French/Danish/Norwegian/Bengali/Sindhi taggers, the Persian restorers, the Arabic and
 *     rider diacritizers, the Khmer segmenter — goes through `loadOrt()` and falls back when it rejects.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";

import { describe, expect, test } from "vitest";

/** Every .ts under a directory, recursively. */
function sources(dir: URL): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const child = new URL(entry, dir);
        if (statSync(child).isDirectory()) out.push(...sources(new URL(`${entry}/`, dir)));
        else if (entry.endsWith(".ts")) out.push(child.pathname);
    }
    return out;
}

describe("onnxruntime-node stays optional", () => {
    const files = [
        ...sources(new URL("../src/", import.meta.url)),
        ...sources(new URL("../tools/", import.meta.url)),
    ];

    test("⚠ core/onnx.ts is the ONLY file that names the package in an import", () => {
        const importers = files
            .filter((f) => /(?:from|import\()\s*["']onnxruntime-node["']/u.test(readFileSync(f, "utf8")))
            .map((f) => f.replace(/^.*\/(src|tools)\//u, "$1/"));
        // If this fails, the new importer needs the same const-specifier treatment — or, better, should call
        // loadOrt() instead of importing the package itself.
        expect(importers).toEqual([]);
        // …and the one legitimate site does NOT use a literal, which is the whole point.
        const onnx = readFileSync(new URL("../src/core/onnx.ts", import.meta.url), "utf8");
        expect(onnx).toMatch(/const ORT_SPECIFIER = ["']onnxruntime-node["']/u);
        expect(onnx).toMatch(/import\(ORT_SPECIFIER\)/u);
    });

    test("it is declared OPTIONAL in package.json, never as a hard dependency", () => {
        const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
            dependencies?: Record<string, string>;
            optionalDependencies?: Record<string, string>;
        };
        expect(pkg.optionalDependencies?.["onnxruntime-node"]).toBeDefined();
        expect(pkg.dependencies?.["onnxruntime-node"]).toBeUndefined();
    });

    // ⚠ AN EXPLICIT TIMEOUT, BECAUSE THE DEFAULT MEASURES THE WRONG THING. This is the only test in the file
    // that cold-imports `src/index.ts`, i.e. the whole registry and every language module behind it, and at
    // the 5 s default it fails under CPU load while passing 3/3 on a quiet machine — observed repeatedly
    // during a four-agent batch, at `ef8f24a` and on every branch, always with the identical timeout and
    // never with a wrong reading. What the test asserts is a FALLBACK CONTRACT (an absent optional dep must
    // degrade, not throw); how long a cold ESM graph takes to resolve is not part of that contract, so the
    // default turned a green gate into a coin flip and trained readers to discount a red suite.
    test("the neural paths still degrade to the sync engine, whatever ORT does", async () => {
        // The contract the indirection protects: an absent optional dep is a FALLBACK, not an error. Proven
        // against a language whose neural path is opt-in, so this holds with or without the package installed.
        const { phonemize } = await import("../src/index.ts");
        expect(phonemize("hello world", "en").trim()).toBeTruthy();
    }, 60_000);
});
