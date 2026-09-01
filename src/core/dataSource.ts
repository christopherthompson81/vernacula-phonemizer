/**
 * The SYNCHRONOUS data seam: everything the engine loads goes through one `read(key)`.
 *
 * ⚠ SYNCHRONOUS IS THE WHOLE POINT, AND IT IS NOT AN OVERSIGHT. `phonemize()` is sync, callers depend on
 * that, and the C# port's parity contract is written against a sync engine. So this seam is a plain
 * `read(key): Uint8Array` — a browser consumer prefetches the bytes it needs and serves them from a Map,
 * which is why `readFileSync` being the ONLY fs API in `src/` matters: the shim is a Map lookup, not an
 * async refactor. Nothing here returns a promise, and nothing should.
 *
 * A key is the same string the C# port resolves — `languages/thai/syllables.tsv`, `core/phonology.jsonc`
 * — produced by `dataFile()`/`dataDir()` in dataPath.ts. Neither engine owns the data (see that file).
 *
 * ⚠ NOTHING IN `src/` IMPORTS `node:`. The default Node source (nodeDataSource.ts) reaches `fs` through
 * `process.getBuiltinModule`, so this seam is installed automatically under Node — 96 tools and 290 test
 * files import language modules directly and none of them had to learn about it — while a browser bundle
 * resolves no Node specifier. Off Node the default is `undefined` and `readData` throws a directed error;
 * it never falls back to something that would read as an empty lexicon.
 */

import { nodeDataSource } from "./nodeDataSource.ts";

/** Where the engine's data comes from. `read` THROWS for a missing key — callers that treat a file as
 *  optional (`loadTsv`'s `optional`, the model loaders) already catch. Returning empty bytes instead would
 *  turn an absent lexicon into a silently empty one. */
export interface DataSource {
    read(key: string): Uint8Array;
}

let source: DataSource | undefined = nodeDataSource();
let recorder: Set<string> | undefined;

/**
 * Install the data source, replacing the Node default. Call BEFORE importing the engine — `registry.ts`
 * reads 182 manifests at module scope, so a source installed afterwards has already missed them
 * (`src/browser.ts` exists to make that ordering possible). Passing `undefined` uninstalls, which is what
 * the browser test uses to prove the engine reaches nothing but this seam.
 */
export function setDataSource(next: DataSource | undefined): void {
    source = next;
}

/** The installed source, or `undefined`. For a consumer that wants to wrap rather than replace it. */
export function getDataSource(): DataSource | undefined {
    return source;
}

/**
 * No source installed at all — a CONFIGURATION error, not a missing file, and its own type so that the
 * callers who legitimately swallow a missing file cannot swallow this too.
 *
 * ⚠ `loadTsv`'s `optional` and every model loader catch broadly, by design: an absent table means
 * "degrade", not "fail". Untyped, a seam error reaches them as the same exception and the optional lexicon
 * quietly becomes an EMPTY Map — every word then takes the OOV path and gets a plausible wrong reading,
 * the failure this seam's header promises never to produce. `loadTsv` rethrows this one.
 *
 * The reachable path is narrow, and saying so is the point of writing it down: a consumer who NEVER calls
 * `setDataSource` dies at the first `loadManifest`, which does not catch, so the import fails loudly.
 * What this guards is the later, quieter case — `setDataSource(undefined)` mid-run, or an optional table
 * read lazily on first use long after the manifests loaded.
 */
export class NoDataSourceError extends Error {
    constructor(key: string) {
        super(
            `No data source installed — cannot read "${key}". Off Node there is no default: call setDataSource() BEFORE importing the engine (see src/browser.ts).`,
        );
        this.name = "NoDataSourceError";
    }
}

/** Raw bytes for `key`. Throws if no source is installed, or if the source throws. */
export function readData(key: string): Uint8Array {
    if (source === undefined) {
        throw new NoDataSourceError(key);
    }
    const bytes = source.read(key);
    // ⚠ RECORDED ONLY ON SUCCESS, AND THE ORDER IS THE WHOLE POINT. Plenty of reads here are ALLOWED to
    //   fail — `loadTsv`'s `optional`, and every model loader, treat a missing file as "degrade", not as an
    //   error. Recording before the read would put keys that do not exist into a prefetch manifest, and the
    //   consumer would ship fetches that 404. You can only prefetch bytes that exist.
    recorder?.add(key);
    return bytes;
}

const UTF8 = new TextDecoder("utf-8");

/** `readData` decoded as UTF-8 — the text form the loaders want. */
export function readDataText(key: string): string {
    return UTF8.decode(readData(key));
}

/**
 * Run `fn` and report every key it read — the "one-shot recording mode" a browser consumer uses to learn
 * what to prefetch, in preference to a hand-maintained per-language manifest that would rot.
 *
 * ⚠ RECORD BOTH PHASES OR THE LIST IS SHORT BY 182 FILES. The keys divide into a fixed set read when
 * `registry.ts` is imported (every language's manifest, at module scope) and a per-language set read by
 * `getPhonemizer(lang)`. Recording only the second yields a list that works in the recording process and
 * fails in the browser, because the import already happened. Nesting is supported so the caller can
 * record the import once and each language separately.
 */
export function recordDataKeys<T>(fn: () => T): { result: T; keys: string[] } {
    const outer = recorder;
    const own = new Set<string>();
    recorder = own;
    try {
        const result = fn();
        return { result, keys: [...own].sort() };
    } finally {
        recorder = outer;
        for (const k of own) outer?.add(k); // a nested recording still counts toward the enclosing one
    }
}
