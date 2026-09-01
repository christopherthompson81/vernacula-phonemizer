# Browser-ready engine — closing the Node seams (#1245)

Issue #1245 measures the Node coupling as two seams (`core/dataPath.ts`, `core/onnx.ts`) and asks for
injectable versions of both, with **no async refactor** of `phonemize()`. This log records what each run
measured and what it changed about the plan.

## Run 1 — 2026-09-01 — what actually imports Node

Question: is the issue's inventory complete?

```
grep -rn "node:fs|node:path|node:url|process\." src/
```

Raw finding — the issue's `fs` inventory is exact (27 `readFileSync` call sites, 15 modules, no other fs
API), but two things are under-reported:

- **`process.env` is read in six places, not one.** `dataPath.ts` (`VERNACULA_DATA_DIR`) plus five
  `*_ORT_EP` execution-provider overrides (`structuralTagger`, `contextRestorer`, `faTagger`,
  `englishTagger`, `hebrewTagger`). A bare `process.env.X` is a `ReferenceError` in a browser, not
  `undefined` — so each of these is a hard crash on the neural path, and they are downstream of the ORT
  seam the issue does scope.
- **Seven files import `dirname` from `node:path` and never use it** (`afrikaansTagger`, `bengaliTagger`,
  `centralKurdishTagger`, `danishTagger`, `frenchTagger`, `norwegianTagger`, `sindhiTagger`). Left over
  from the data-move; `tsc` does not run `noUnusedLocals`, so nothing flagged them. They are pure module
  graph weight, and they are node imports in the browser graph.

Implication: the seam count is right, but the sweep has to cover `process.env` too, and the dead `dirname`
imports come out on the way past.

## Run 2 — 2026-09-01 — what a browser consumer must prefetch

Question: the issue says "a browser consumer prefetches the selected language's files". Is the prefetch
set really per-language?

```
strace -f -e trace=openat npx tsx -e 'await import("src/registry.ts")'
```

Raw finding — **importing `registry.ts` alone opens 182 data files (4.5 MB) before any `getPhonemizer()`
call**, in 1.1 s / 218 MB RSS. `registry.ts` statically imports all 193 language modules, and a language's
`manifest.ts` calls `loadManifest()` at **module scope** (`export const MANIFEST = loadManifest(...)`), so
every manifest in the fleet is read at import time regardless of which language is wanted.

Implication, and it changes the design: the prefetch set has **two phases**, not one — a fixed ~4.5 MB
registry-import set, plus the per-language set that `getPhonemizer(lang)` then touches. The recording mode
must be able to report both, and the browser entry must expose the seams *without* statically importing
the registry, or the consumer can never install a data source before the first 182 reads happen.

That is why `src/browser.ts` puts the engine behind one dynamic `import()` while `setDataSource` /
`setOrtLoader` are static: the module load is async (it already is, in a browser), and `phonemize()`
stays synchronous, which is the constraint the issue is emphatic about.

## Run 3 — 2026-09-01 — the replay, and the branch the old `dataFile` kept alive

Question: with `dataFile()` returning a key instead of a path, does anything still reach the filesystem
behind the seam?

Built `test/browser-seams.test.ts`: record every key one process reads, then `vi.resetModules()`, install a
frozen `Map` with the Node source uninstalled, rebuild the whole engine and require byte-identical readings.

Raw finding — it passed first try for the sync path, but the full suite then failed two tests in
`test/zhuang-sawndip.test.ts`:

```
Cannot derive a data key from "file:///…/test/zhuang-sawndip.test.ts": no "/src/" segment
```

The old `dataFile` had a documented fallback for "a caller OUTSIDE `src/` (a test, a tool)". I had grepped
`test/` and `tools/` for `dataFile|dataDir`, found nothing, and concluded the branch was dead — but the
caller reaches it through `loadTsvMap`, which the grep did not cover. One caller, and it was hand-writing
`../data/languages/zhuang/sawndip-readings.tsv` — a guess into the asset tree, the exact thing
`core/dataPath.ts` exists to stop, and one that would let the test pass against a file the engine does not
load. Fixed by exporting `sawndipReadings()` so the test reads the dictionary the *engine* reads.

Implication: the fallback branch is now gone rather than ported, and the error is loud. A key derived from
a rewritten `import.meta.url` would miss, `loadTsv`'s `optional` would swallow the miss, and the result
would be an empty lexicon and a plausible wrong reading — so this had to throw, not guess.

## Run 4 — 2026-09-01 — per-language attribution is order-dependent

Question: what does `tools/browser-prefetch.mts` report per language?

```
npx tsx tools/browser-prefetch.mts es cy th
```

Raw finding — **`es` was charged 1.7 MB of `languages/thai/{dictionary.tsv,seg-words.txt}`, and `th` got an
empty list.** Every table is memoized in its own module (`READINGS ??= …`, `let cached`), so in one process
the first language to touch a shared file is charged for it and every later one records nothing. As a
prefetch manifest that is a Thai page that loads no Thai data.

(The delegation itself is correct and not a bug: `core/foreign.ts` hands a run in a script the host does not
own to another engine, which is why the Spanish engine touched Thai's tables at all.)

Implication: one child process per language. Corrected, `es` records 0 extra keys (its manifest is already
in the import phase — matching the issue's "Spanish 20 KB"), `cy` records `welsh/lexicon.tsv`, and `th` on a
Latin probe records **13.9 MB of English**, which is what the page would really load.

## Run 5 — 2026-09-01 — the sync path is the fallback, so the sync replay proves the wrong thing

Correction from the user, mid-implementation: *"Sync isn't super viable, it won't produce good results in
many important languages. It's very much the fallback from async."*

That is right, and it re-scopes the deliverable. Issue #1245's "keep the engine synchronous" is about not
refactoring `phonemize()` — it is not a claim that the sync path is what a consumer should call. For
`en bn da nb fr fa ur ps pnb af ckb sd km he` and the Arabic dialects the reading worth having comes from
`phonemizeAsync`, which loads an ONNX model and its sidecar **through this same data seam**.

Two things were measured wrong because of it, and both are now fixed:

- **`tools/browser-prefetch.mts` recorded the sync path**, so every manifest it emitted omitted every
  `.onnx`. Re-recorded against `phonemizeAsync`: `nb` 1.68 MB, `da` 3.44 MB, `en` 14.59 MB, each now
  carrying its `*.int8.onnx` + `*.meta.json`. The sync keys are a subset, so recording async covers both.
- **The replay test only replayed `phonemize()`.** Added an async replay against `nb` (724 KB — the
  smallest tagger in the fleet).

⚠ And the async replay had to pin the PATH, not just the output. Every neural entry degrades to the sync
engine when its model is absent *rather than throwing*, so a data seam that silently failed to deliver
model bytes would not raise — it would serve the fallback reading. So the test asserts the model key was
read, that the reading is **not** the sync one, and that ORT arrived through the installed `setOrtLoader`
rather than the built-in specifier.

## Run 6 — 2026-09-01 — gates

`vitest run` 291 files / 5,753 tests. `tsc --noEmit` clean. `check:package` ok.
C# parity **189 languages byte-identical, 0 differ** (36,495 rows); provenance **39,540/39,540 (100%)`;
poison clean on both engines; `regex-diff` **141,184 probe results identical, 0 DIFFER** after re-extracting
the corpus for the two new patterns (`src/core/dataPath.ts`, `src/core/nodeDataSource.ts`).

## Run 7 — 2026-09-01 — a key that does not exist is not prefetchable

Question (self-review of the diff, while the code review ran): `readData` records the key *before* calling
`source.read`. What happens for a read that is allowed to fail?

```
npx tsx …  # sweep 18 languages, collecting keys the engine asks for that NODE ITSELF lacks
→ []
```

Raw finding — **empty, in this checkout**, which is the reason to fix it rather than the reason not to.
Plenty of reads here are *allowed* to fail: `loadTsv`'s `optional`, and every model loader, treat a missing
file as "degrade", not as an error. Recording before the read means:

- `tools/browser-prefetch.mts` emits keys that do not exist, and the consumer ships fetches that 404;
- the tool's own `bytes()` re-reads each key and would throw on one;
- the replay test counts the key as a MISS, so a language whose optional table simply is not shipped would
  fail a gate that is supposed to be about the seam.

None of it fires today only because every optional file happens to exist here — the same shape as the
Slovak and Welsh defects earlier in this porting sweep, where every golden instance sat on the safe side.

Fixed in three places: record after a successful read; push in the tool after the read returns; and have
the replay distinguish "Node could not serve it either" from "the frozen Map was short". Pinned directly by
`recordDataKeys reports only keys that EXIST`, so the invariant is asserted rather than inherited from the
contents of a checkout.

`vitest run` 291 files / 5,755 tests.
