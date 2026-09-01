/**
 * Browser entry — the two seams, and the engine behind one dynamic import.
 *
 *   import { setDataSource, loadEngine } from "vernacula-phonemizer/browser";
 *
 *   setDataSource({ read: (key) => prefetched.get(key) ?? throwMissing(key) });
 *   setOrtLoader(() => import("onnxruntime-web"));
 *   const { phonemizeAsync } = await loadEngine();
 *   await phonemizeAsync("hei verden", "nb");
 *
 * ⚠ REACH FOR `phonemizeAsync`, NOT `phonemize`. The sync entry is the FALLBACK: for `en bn da nb fr fa ur
 * ps pnb af ckb sd km he` and the Arabic dialects the reading worth having comes from the neural tier, and
 * the unpointed abjads (`ar`, `he`) expect vocalized input on the sync path. Both seams are needed for it —
 * the model bytes come through `setDataSource` like every other file, the runtime through `setOrtLoader`.
 * And each neural entry DEGRADES to the sync engine when its model is absent rather than throwing, so a
 * prefetch list missing an `.onnx` does not error in the browser; it quietly serves the fallback reading.
 * `tools/browser-prefetch.mts` records the async path for exactly that reason.
 *
 * `phonemize()` remains synchronous and is what `phonemizeAsync` falls back to — that has not changed, and
 * this file does not make it async.
 *
 * ⚠ THE ENGINE IS BEHIND `loadEngine()` AND THAT IS NOT DECORATION. `registry.ts` statically imports all
 * 193 language modules, and a language's `manifest.ts` calls `loadManifest()` at MODULE SCOPE — importing
 * the registry reads 182 data files (4.5 MB) before any `getPhonemizer()` call. If this file imported the
 * registry statically, those 182 reads would happen while this module's own body — including the
 * consumer's `setDataSource()` call — had not yet run. One dynamic import is what makes the ordering
 * expressible. The module LOAD is async, which in a browser it already was; `phonemize()` is not, and the
 * issue is emphatic about that: it is load-bearing for callers and for the C# port's parity contract.
 *
 * ⚠ AND THE PREFETCH SET HAS TWO PHASES. `loadEngine()` reads every language's manifest (182 files,
 * 4.5 MB, whatever language you want); phonemizing then reads that language's tables and models. Record
 * both — `recordDataKeys` nests for exactly this, and `tools/browser-prefetch.mts` emits the pair — or the
 * list works in the recording process, where the import already happened, and fails in the browser.
 *
 * ⚠ EXPECT ANOTHER LANGUAGE'S DATA IN THE LIST. A run in a script the host does not own is delegated
 * (`core/foreign.ts`), so a Thai page with an English phrase in it loads English's tables too; and
 * `phonemizeAsync` prewarms the English tagger for any mixed-Latin text in a non-English language.
 *
 * ⚠ KEYS COME FROM `import.meta.url`. `dataPath.ts` derives `languages/thai/syllables.tsv` from the calling
 * module's source path, so a bundler that rewrites `import.meta.url` to a chunk URL erases the only thing
 * that names the data. It throws rather than guessing; bundle with module paths preserved, or serve the
 * source as ESM.
 *
 * Nothing in this file's module graph resolves a `node:` specifier — `test/browser-graph.test.ts` pins that.
 */
export { setDataSource, getDataSource, readData, readDataText, recordDataKeys, NoDataSourceError, type DataSource } from "./core/dataSource.ts";
export { setOrtLoader, type OrtLike, type OrtSession, type OrtTensor } from "./core/onnx.ts";
export { dataFile, dataDir } from "./core/dataPath.ts";

/** Load the engine. Call AFTER `setDataSource()`; see the note above on why this is not a static import. */
export async function loadEngine(): Promise<typeof import("./index.ts")> {
    return import("./index.ts");
}
