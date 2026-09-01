#!/usr/bin/env -S npx tsx
/**
 * Emit the data a browser consumer must prefetch, by RECORDING what the engine actually reads (#1245).
 *
 *   npx tsx tools/browser-prefetch.mts es tr cy > prefetch.json
 *   npx tsx tools/browser-prefetch.mts --text "日本語のテキスト" ja
 *
 * ⚠ RECORDED, NOT DECLARED, AND THAT IS THE POINT. The alternative is a per-language manifest emitted from
 * a list somebody maintains, which rots the first time a language gains a table — silently, because a
 * missing optional TSV is not an error to `loadTsv`: it is an empty Map, and every word then takes the OOV
 * fallback and gets a plausible wrong reading. This asks the engine instead.
 *
 * ⚠ THE OUTPUT HAS TWO PHASES BECAUSE THE ENGINE DOES. `engine` is what importing the registry reads —
 * every language's manifest, at module scope, 182 files / 4.5 MB — and it is needed whatever language you
 * want. `languages[code]` is what `getPhonemizer(code)` then reads on top of that. A consumer that ships
 * only the second gets a list that worked in this process, where the import had already happened, and
 * fails in the browser.
 *
 * ⚠ ONE CHILD PROCESS PER LANGUAGE, BECAUSE THE LOADERS MEMOIZE. Every table is cached in its module
 * (`READINGS ??= …`, `let cached`), so in a single process the SECOND language to want a shared file
 * records no read for it and the first is charged for both. Measured: recording `es cy th` together
 * attributed `languages/thai/{dictionary.tsv,seg-words.txt}` — 1.7 MB — to **es**, and left th with an
 * empty list, which as a prefetch manifest is a Thai page that loads no Thai data. Order-dependent
 * attribution is worse than none, so each language gets a fresh module graph.
 *
 * ⚠ AND THE PER-LANGUAGE LIST IS ONLY AS COMPLETE AS THE TEXT YOU FEED IT. Some tables load lazily on
 * first USE, not at construction — Japanese's kanji readings and Zhuang's Sawndip dictionary are both
 * behind a `??=` that a probe in the wrong script never reaches. The default probe exercises construction,
 * the number path and a Latin word; for a language whose script it does not touch, pass `--text` with
 * representative input, or record in your own app against the seam directly.
 *
 * ⚠ EXPECT ANOTHER LANGUAGE'S DATA IN THE LIST, AND IT IS NOT A BUG. A run in a script the host does not
 * own is delegated (`core/foreign.ts`), so probing `th` with the Latin "test 1234" pulls in 13.9 MB of
 * ENGLISH tables. That is what the page would really load; a prefetch list that omitted it would 404 at
 * the first mixed-script sentence.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { getDataSource, setDataSource } from "../src/core/dataSource.ts";

const argv = process.argv.slice(2);
const t = argv.indexOf("--text");
const probe = t < 0 ? "test 1234" : (argv[t + 1] ?? "");
const codes = argv.filter((a, i) => !a.startsWith("--") && !(t >= 0 && i === t + 1));
if (codes.length === 0) {
    console.error('usage: browser-prefetch.mts [--text "…"] <lang> [lang…]');
    process.exit(2);
}

const base = getDataSource();
if (base === undefined) throw new Error("no data source — run this under Node");

// ⚠ A WRAPPED SOURCE, NOT `recordDataKeys`, FOR THE IMPORT PHASE. `recordDataKeys` is synchronous — it has
// to be, or a second recording started across an `await` would collect the first one's keys — and the
// registry import below is an `await`. Wrapping the source is the same measurement without that limit.
let sink: string[] = [];
// Recorded only on success — an absent optional file is a legal read here (`loadTsv`'s `optional`, every
// model loader), and a key that does not exist is not prefetchable: emitting it ships a fetch that 404s.
setDataSource({ read: (key) => { const bytes = base.read(key); sink.push(key); return bytes; } });

const engineSink = sink;
await import("../src/registry.ts");
const engine = [...new Set(engineSink)].sort();

const bytes = (keys: string[]): number => keys.reduce((n, k) => n + base.read(k).byteLength, 0);

/**
 * Record one language in THIS process. Valid only because a `--one` run does exactly one of them.
 *
 * ⚠ IT RECORDS THE **ASYNC** PATH, AND RECORDING THE SYNC ONE WOULD SHIP A BROKEN MANIFEST. `phonemize()`
 * is the FALLBACK: for `en bn da nb fr fa ur ps pnb af ckb sd km he` and the Arabic dialects the reading
 * that a consumer actually wants comes from `phonemizeAsync`, which loads an ONNX model and its sidecar
 * through this same data seam. A sync-only recording omits every `.onnx` — and because each neural entry
 * DEGRADES to the sync engine when its model is missing rather than throwing, the browser would not error:
 * it would quietly serve the fallback reading, which is the defect this manifest exists to prevent.
 *
 * The sync keys are a subset, so recording async covers both.
 */
async function recordOne(code: string): Promise<string[]> {
    sink = [];
    const { phonemizeAsync } = await import("../src/index.ts");
    await phonemizeAsync(probe, code);
    return [...new Set(sink)].sort();
}

const one = argv.indexOf("--one");
if (one >= 0) {
    // Child mode: one language, one fresh module graph. Emits only its own list.
    console.log(JSON.stringify(await recordOne(codes[0]!)));
} else if (codes.length === 1) {
    const keys = await recordOne(codes[0]!);
    emit({ [codes[0]!]: keys });
} else {
    const self = fileURLToPath(import.meta.url);
    const languages: Record<string, string[]> = {};
    for (const code of codes) {
        const args = ["tsx", self, "--one", code, ...(t >= 0 ? ["--text", probe] : [])];
        const out = execFileSync("npx", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
        languages[code] = JSON.parse(out.trim().split("\n").at(-1)!) as string[];
    }
    emit(languages);
}

function emit(languages: Record<string, string[]>): void {
    console.log(JSON.stringify({
        probe,
        engine: { keys: engine, bytes: bytes(engine) },
        languages: Object.fromEntries(
            Object.entries(languages).map(([c, keys]) => [c, { keys, bytes: bytes(keys) }]),
        ),
    }, null, 2));
}
