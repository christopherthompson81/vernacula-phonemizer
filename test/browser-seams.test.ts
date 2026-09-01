/**
 * THE ENGINE RUNS WITH NO NODE UNDER IT (#1245).
 *
 * Two seams stand between the engine and Node — `core/dataSource.ts` and `core/onnx.ts` — and the value of
 * a seam is entirely in whether anything bypasses it. That is invisible to every other gate in this repo:
 * a stray `readFileSync` or `import { join } from "node:path"` in a language module passes the typecheck,
 * passes the goldens, passes parity, and breaks only in a browser, which nothing here runs.
 *
 * So the load-bearing test is not "the seam exists" but the REPLAY below: record every key one process
 * reads, then rebuild the whole engine from a frozen Map with the Node source uninstalled, and require the
 * readings to be byte-identical. It fails if the engine reaches the filesystem behind the seam's back, and
 * it fails if the recorded key list is short — which is the failure a browser consumer would actually hit.
 */
import { describe, expect, test, vi } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";

/** The neural path needs the optional model + onnxruntime-node; without either it degrades to the sync
 *  engine, which would make the async replay below assert nothing about the models. Norwegian is the
 *  smallest tagger in the fleet (724 KB), so it is the cheapest language that exercises the whole tier. */
const NB_MODEL = "../data/languages/norwegian/nb-g2p-tagger.int8.onnx";
const haveModel = existsSync(new URL(NB_MODEL, import.meta.url));

/** Cheap, rule-only languages across four scripts — enough to cross the manifest, TSV and lexicon loaders. */
const CASES: Array<[lang: string, text: string]> = [
    ["es", "hola qué tal"],
    ["tr", "merhaba dünya"],
    ["cy", "bore da"],
    ["zu", "sawubona"],
    ["th", "สวัสดี"],
    ["vi", "xin chào"],
];

/**
 * A file's CODE, with comments removed — block comments and whole-line `//`.
 *
 * ⚠ SCAN CODE, NOT PROSE, AND DO NOT EXEMPT THE TWO FILES INSTEAD. Both guarded files necessarily NAME the
 * thing they are guarding against (`nodeDataSource.ts` explains why it is not `import "node:fs"`;
 * `env.ts` explains why a bare `process.env.X` is a ReferenceError), so a raw scan reports them and an
 * allowlist would then be the obvious fix — at the cost of making the two files where a real offender is
 * most likely the two files that can never fail. Stripping comments keeps them under the gate.
 */
function code(file: string): string {
    return readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//gu, "")
        .split("\n")
        .filter((l) => !/^\s*(?:\/\/|\*)/u.test(l))
        .join("\n");
}

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

describe("the browser seams", () => {
    test("⚠ NOTHING IN src/ IMPORTS A `node:` SPECIFIER — a bundler resolves the graph, not the branch", () => {
        const offenders = sources(new URL("../src/", import.meta.url))
            .filter((f) => /(?:from|import\()\s*["']node:[a-z/]+["']/u.test(code(f)))
            .map((f) => f.replace(/^.*\/src\//u, "src/"));
        // A static `node:` import is resolved by a bundler whether or not the code path runs, so one of
        // these anywhere in the graph is a broken browser build. `nodeDataSource.ts` is how Node is reached
        // instead: `process.getBuiltinModule("fs")`, a property access on an object a browser lacks.
        expect(offenders).toEqual([]);
    });

    test("`process` is touched only where its absence is handled", () => {
        const users = sources(new URL("../src/", import.meta.url))
            .filter((f) => /\bprocess\.(?:env|cwd|argv|platform)\b/u.test(code(f)))
            .map((f) => f.replace(/^.*\/src\//u, "src/"));
        // A bare `process.env.X` is a ReferenceError in a browser, not `undefined`. Every reader goes
        // through `core/env.ts`, which optional-chains off `globalThis`.
        expect(users).toEqual([]);
    });

    test("keys are the SAME strings the C# port resolves — `/`-joined, rooted at the data tree", async () => {
        const { dataFile, dataDir } = await import("../src/core/dataPath.ts");
        const url = "file:///anywhere/vernacula/src/languages/thai/thai.ts";
        expect(dataFile(url, "syllables.tsv")).toBe("languages/thai/syllables.tsv");
        expect(dataDir(url)).toBe("languages/thai");
        // Windows `file:` URLs must not produce a different key, or the two engines disagree by platform.
        expect(dataFile("file:///C:/v/src/core/phonology.jsonc", "x.tsv")).toBe("core/x.tsv");
        // ⚠ LOUD ON A LOST SOURCE PATH. A bundler that rewrites `import.meta.url` to a chunk URL erases the
        //   only thing naming the data; guessing a key would surface as a missing lexicon, i.e. a plausible
        //   wrong reading — the defect class the goldens are least able to see.
        expect(() => dataFile("https://cdn/assets/index-a1b2c3.js", "x")).toThrow(/no "\/src\/" segment/u);
    });

    test("⚠ REPLAY: the whole engine rebuilds from a frozen Map with the Node source uninstalled", async () => {
        // ── Phase 1: run on Node, recording every key and its bytes. ────────────────────────────────────
        vi.resetModules();
        const rec = await import("../src/core/dataSource.ts");
        const node = rec.getDataSource();
        expect(node, "Node auto-installs its source via process.getBuiltinModule").toBeDefined();
        const prefetched = new Map<string, Uint8Array>();
        // ⚠ AND RECORD WHAT NODE ITSELF COULD NOT SERVE. Some reads are ALLOWED to fail — `loadTsv`'s
        //   `optional`, every model loader — so an absent key is not evidence of a broken seam, and
        //   counting it as a miss below would make this test fail for a language whose optional table
        //   simply is not shipped. Every optional file happens to exist in this checkout, which is exactly
        //   why the distinction has to be made here rather than when it first bites.
        const absent = new Set<string>();
        rec.setDataSource({
            read: (key) => {
                try { const b = node!.read(key); prefetched.set(key, b); return b; }
                catch (err) { absent.add(key); throw err; }
            },
        });

        // The two phases the browser consumer has to prefetch separately: importing the engine reads every
        // language's manifest at module scope, and only then does getPhonemizer(lang) read that language's
        // tables. Recording nests, so the split is observable rather than folded together.
        const importPhase = rec.recordDataKeys(() => undefined);
        const engine = await import("../src/index.ts");
        const perLanguage = rec.recordDataKeys(() =>
            CASES.map(([lang, text]) => engine.phonemize(text, lang)),
        );
        const expected = perLanguage.result;
        expect(expected.every((ipa) => ipa.length > 0)).toBe(true);
        // The import phase dominates and is fixed; the per-language phase is what lazy loading buys.
        expect(prefetched.size).toBeGreaterThan(perLanguage.keys.length);
        expect(importPhase.keys.length).toBe(0); // nothing is read before the engine module is imported

        // ── Phase 2: no filesystem. A frozen Map, and a key outside it is a hard error. ─────────────────
        vi.resetModules();
        const browser = await import("../src/core/dataSource.ts");
        const frozen = new Map(prefetched);
        const missed: string[] = [];
        browser.setDataSource({
            read: (key) => {
                const bytes = frozen.get(key);
                if (bytes === undefined) {
                    if (!absent.has(key)) missed.push(key); // Node could not serve it either → not a miss
                    throw new Error(`not prefetched: ${key}`);
                }
                return bytes;
            },
        });
        const replayed = await import("../src/index.ts");
        expect(CASES.map(([lang, text]) => replayed.phonemize(text, lang))).toEqual(expected);
        // A miss that a loader swallowed (`loadTsv`'s `optional`) would still leave the reading subtly
        // wrong, so assert the key list was COMPLETE rather than trusting the readings alone.
        expect(missed).toEqual([]);
    }, 120_000);

    test.skipIf(!haveModel)(
        "⚠ REPLAY, ASYNC: the NEURAL path rebuilds from a frozen Map, with ORT reached through its seam",
        async () => {
            // ⚠ THIS IS THE REPLAY THAT MATTERS, AND THE SYNC ONE ABOVE WOULD HAVE HIDDEN ITS FAILURE.
            //   `phonemize()` is the FALLBACK path — for `en bn da nb fr fa af ckb sd km he` and the Arabic
            //   dialects the reading a consumer wants comes from `phonemizeAsync`, which loads an ONNX model
            //   and its sidecar through this same data seam. And each neural entry DEGRADES to the sync
            //   engine when its model is missing rather than throwing, so a seam that failed to deliver
            //   model bytes would not raise: it would quietly serve the fallback reading. That is a defect
            //   that produces a READING, so the assertions below pin the PATH, not only the output.
            vi.resetModules();
            const rec = await import("../src/core/dataSource.ts");
            const node = rec.getDataSource()!;
            const prefetched = new Map<string, Uint8Array>();
            const absent = new Set<string>();
            rec.setDataSource({
                read: (key) => {
                    try { const b = node.read(key); prefetched.set(key, b); return b; }
                    catch (err) { absent.add(key); throw err; }
                },
            });

            const engine = await import("../src/index.ts");
            const text = "hei verden, kringkastingssjefen";
            const expected = await engine.phonemizeAsync(text, "nb");

            // The tier actually ran: its model came through the seam, and its reading is not the fallback's.
            const models = [...prefetched.keys()].filter((k) => k.endsWith(".onnx"));
            expect(models).toContain("languages/norwegian/nb-g2p-tagger.int8.onnx");
            expect(expected).not.toBe(engine.phonemize(text, "nb"));

            // ── Replay with no filesystem, and ORT installed through setOrtLoader. ─────────────────────
            vi.resetModules();
            const browser = await import("../src/core/dataSource.ts");
            const frozen = new Map(prefetched);
            const missed: string[] = [];
            browser.setDataSource({
                read: (key) => {
                    const bytes = frozen.get(key);
                    if (bytes === undefined) {
                        if (!absent.has(key)) missed.push(key); // Node lacked it too → not a seam failure
                        throw new Error(`not prefetched: ${key}`);
                    }
                    return bytes;
                },
            });
            // Stands in for `setOrtLoader(() => import("onnxruntime-web"))`: the seam is what a browser
            // consumer swaps, and the loader here proves the runtime arrives through it rather than
            // through the built-in specifier.
            const onnx = await import("../src/core/onnx.ts");
            let loaderCalled = 0;
            onnx.setOrtLoader(() => { loaderCalled++; return import("onnxruntime-node"); });

            const replayed = await import("../src/index.ts");
            expect(await replayed.phonemizeAsync(text, "nb")).toBe(expected);
            expect(missed).toEqual([]);
            expect(loaderCalled).toBeGreaterThan(0); // the installed loader was the route, not the default
            onnx.setOrtLoader(undefined);
        },
        120_000,
    );

    test("recordDataKeys reports only keys that EXIST — an absent optional file is not prefetchable", async () => {
        vi.resetModules();
        const ds = await import("../src/core/dataSource.ts");
        const node = ds.getDataSource()!;
        ds.setDataSource({ read: (key) => node.read(key) });
        const { keys } = ds.recordDataKeys(() => {
            try { ds.readData("languages/thai/thai.jsonc"); } catch { /* exists */ }
            try { ds.readData("languages/thai/no-such-table.tsv"); } catch { /* the point */ }
        });
        // ⚠ A READ IS ALLOWED TO FAIL HERE. `loadTsv`'s `optional` and every model loader treat a missing
        //   file as "degrade", not as an error — so recording the key before the read would put files that
        //   do not exist into a prefetch manifest and the consumer would ship fetches that 404.
        expect(keys).toEqual(["languages/thai/thai.jsonc"]);
    });

    test("with no source installed at all, a read is a directed error — never an empty lexicon", async () => {
        vi.resetModules();
        const ds = await import("../src/core/dataSource.ts");
        ds.setDataSource(undefined);
        expect(() => ds.readDataText("languages/thai/syllables.tsv")).toThrow(/No data source installed/u);
        // ⚠ THE ALTERNATIVE IS THE REAL HAZARD: returning empty bytes would make an absent lexicon read as
        //   an empty one, and every word would take the OOV fallback and get a plausible wrong reading.
    });

    test("setOrtLoader swaps the runtime AND clears the memo", async () => {
        vi.resetModules();
        const onnx = await import("../src/core/onnx.ts");
        const fake = { InferenceSession: { create: () => Promise.resolve({ run: () => Promise.resolve({}) }) } };
        onnx.setOrtLoader(() => Promise.resolve(fake));
        await expect(onnx.loadOrt("test")).resolves.toBe(fake);

        // ⚠ THE MEMO IS WHY THIS IS NOT A ONE-LINER. loadOrt caches the library for the process, so a loader
        //   installed after anything had prewarmed a model would be accepted and then ignored — the caller
        //   sees a successful setOrtLoader and keeps running on the old runtime.
        const second = { InferenceSession: fake.InferenceSession, marker: 2 };
        onnx.setOrtLoader(() => Promise.resolve(second));
        await expect(onnx.loadOrt("test")).resolves.toBe(second);

        onnx.setOrtLoader(() => Promise.reject(new Error("no runtime here")));
        await expect(onnx.loadOrt("Khmer word segmentation")).rejects.toThrow(/setOrtLoader/u);
        onnx.setOrtLoader(undefined);
    });
});
