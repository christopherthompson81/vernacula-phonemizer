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

## Run 8 — 2026-09-01 — the browser entry, end to end

Question: does `src/browser.ts` actually deliver the ordering it claims — seams installable before anything
is read — and does the whole engine run from a Map?

```
import src/browser.ts → count reads → prefetch via a wrapped source → freeze → phonemizeAsync("…","nb")
```

Raw finding:

```
reads on importing src/browser.ts: 0
prefetched: 185 keys, 6.13 MB
nb: ˈhæɪ ˈʋæɖɳ        (from the frozen Map, no filesystem, ORT via setOrtLoader)
```

Implication: the deferral works, and 185 keys / 6.13 MB is the real cost of a Norwegian page including the
neural tier — 4.46 MB of it the fixed engine set. Promoted to a test, because that `0` is the load-bearing
claim of the file and a future static import in `browser.ts` would silently take it to 182 with no other
symptom until a consumer hit it.

⚠ Note the probe text matters: `phonemizeAsync("hei verden","nb")` equals the sync reading, because both
words are lexicon-covered. The async replay test uses `"hei verden, kringkastingssjefen"`, which does not —
an assertion that the neural reading differs from the fallback is worth nothing on a string where it
doesn't.

## Run 9 — 2026-09-01 — review findings, and the one that was a tautology

`/code-review 1246 --fix`. Nine findings; seven fixed, two skipped as decisions rather than defects. The
ones worth recording:

- **The import-phase assertion was vacuous.** I wrote `recordDataKeys(() => undefined)` and asserted
  `keys.length === 0` — trivially true, and it measured nothing about the two-phase split the comment above
  it claimed to make "observable". `recordDataKeys` is synchronous and the engine import is an `await`, so
  it *cannot* wrap that phase. I had already hit this limit in `browser-prefetch.mts` and moved to a wrapped
  source there, then left the vacuous version standing in the test. Now a snapshot of the wrapped source at
  the phase boundary: import phase > 100 keys, and the per-language phase asserted genuinely ADDITIVE.
- **The `node:` gate had three holes**: `[a-z/]+` excluded `_`, so `node:child_process` and
  `node:worker_threads` were invisible; a side-effect `import "node:fs"` matched neither alternative; and
  the bare spelling `from "fs"` — which a bundler resolves exactly as eagerly — was not checked at all. A
  language module reintroducing `import { readFileSync } from "fs"` would have passed the gate written to
  catch it. Replaced with a specifier extractor checked against the builtin set.
- **`loadTsv`'s `optional` swallowed a missing SEAM, not just a missing file** → an empty Map and a
  plausible wrong reading. Now a typed `NoDataSourceError` that `optional` rethrows. ⚠ Reachability
  checked rather than assumed: a consumer who NEVER calls `setDataSource` dies at the first `loadManifest`
  (which does not catch), so the guard is for the narrower later case — `setDataSource(undefined)` mid-run,
  or an optional table read lazily long after the manifests.
- **`loadOrt`'s catch cleared the memo unconditionally**, so a `setOrtLoader` during an in-flight load would
  have its new memo discarded when the OLD load rejected. Verified by reverting the fix locally: the new
  test goes red (`expected 2 to be 1` — the loader ran twice) and green with it.
- **`dataFile` produced a leading-slash key** (`"/x.jsonc"`) for a module directly in `src/`. Node's join
  forgives it, a Map lookup and the C# resolver do not. Currently unreachable — no root module loads data —
  so it is pinned as shape, not as a reproduced bug.

## Run 10 — 2026-09-01 — the published package has no data (pre-existing, filed separately)

The review flagged that `files` in package.json does not list `data/`. Measured rather than inferred:

```
npm pack → 734 files, 0 under data/
npm install ./vernacula-phonemizer-0.1.0.tgz && phonemize("hola","es")
→ Error: ENOENT … node_modules/vernacula-phonemizer/data/languages/hindi/hindi.jsonc
```

The published package is non-functional: it throws on the first manifest read, at registry import. This
**predates this PR** and is unchanged by it — the old `dataPath.ts` resolved the same `<pkg>/data` — but
this PR adds a `./browser` export that advertises npm consumption, so it is newly relevant.

Not fixed here. `data/` is 151 MB, so the answer is a distribution decision (a second package, a postinstall
fetch, `VERNACULA_DATA_DIR` plus documentation), not a one-line `files` addition, and #1245 did not ask for
it. Filed as its own issue.

# Publishing the data (#1247)

## Run 11 — 2026-09-01 — the distribution decision, measured

Question: `files` omits `data/`, so an installed copy throws. What should ship?

```
data/                 151 MB, 347 tracked files, 0 gitignored
  models (.onnx/.pt)   90.8 MB in 19 files
  everything else      69.1 MB in 328 files
175 language dirs: median 8 KB · 141 of them under 100 KB, 1.5 MB TOTAL
  heaviest: ar 35 · khmer 15 · en 14 · fa 13 · ja 8.9 · ru 8.4 MB
one package, all in:  63.4 MB tarball / 159.0 MB unpacked (1,080 files)
```

The distribution is brutally skewed — six languages are 94 of the 144 MB — but per-language packages are
blocked anyway: `registry.ts` reads **every** language's manifest at module scope, so no consumer can have
a subset of manifests. The real choice was one package or two.

⚠ And splitting by KIND (code / data / models) was measured and rejected: it makes the default install
rule-only, and `phonemize()` is the fallback path. The good reading comes from `phonemizeAsync`.

Decision (owner): **a separate `vernacula-phonemizer-data` package**, a real dependency of the engine. It is
the packaging form of the rule `core/dataPath.ts` already states — data is owned by no engine — so the tree
is published as-is and the C# port can consume the same artifact. `data/package.json` makes the tree itself
the package; `workspaces: ["data"]` links it in a checkout.

Verified end to end, not inferred:

```
npm pack -w data → 60.5 MB ;  npm pack → 3.0 MB  (engine, src only)
npm install ./…-data.tgz ./….tgz  in a clean app
  es      : ˈola kˈe tˈal
  th      : sˈa˨˩wa˨˩tdˌiː˧
  nb async: ˈhæɪ ˈʋæɖɳ , ˈkɾɪŋkɑstɪŋsˌʃeːfən     ← neural tier live
  nb sync : ˈhæɪ ˈʋæɖɳ , ˈkɾɪŋkɑstɪŋsːjəfən      ← and it differs, so the model really loaded
```

The engine drops from a would-be 63.4 MB to **3.0 MB**.

## Run 12 — 2026-09-01 — the attribution obligation, and two gates

⚠ `NOTICE.md` IS ABOUT THE DATA, so the data package is the artifact that must carry it. It exists because
the project "ships and distributes data derived from third-party sources", and two upstreams (EDRDG's
JMdict/KANJIDIC among them) require specific, named acknowledgement — "obligations, not courtesies", in its
own words. A bare tree of tables would be a licence violation, not an untidy package. `LICENSE`, `LICENSES/`
and `NOTICE.md` are copied in at pack time (`prepack`) so the repo keeps one source of truth.

Two gates, both verified by breaking them rather than by reading them:

- `tools/check-package-fence.mjs` gained a REQUIRED-file probe. The old fence was one-directional — it
  caught a file that LEAKS, never one that is missing, which is exactly how `data/` came to be absent from
  every artifact while the check stayed green. Removing `core` from the data package's `files` now exits 1
  naming `core/phonology.jsonc`; restored, exit 0.
- `test/data-package.test.ts` pins version lockstep, the dependency range, that the engine ships no data,
  that every tracked top-level directory under `data/` is one the package ships, and the attribution set.

⚠ Also fixed on the way: the `prepack` script logged to **stdout**, which `npm pack --json` shares — the log
line landed inside the JSON and every parse of it failed. It logs to stderr now.

Stale doc corrected: README's repository layout still described the pre-move world
(`src/languages/<lang>/ … + data`, "`src/` is self-contained at runtime").

## Run 13 — 2026-09-01 — review of #1248, and a licence bug I introduced fixing it

Eight findings. The largest is one the review scoped OUT and I judged in, because this PR was papering over
it:

**`.gitignore` still said `src/…` for the trainer intermediates, and the data move committed an 8.9 MB
torch checkpoint.**

```
git log --diff-filter=A -- data/languages/khmer/km_segmenter.pt
→ 908fface  repo: shared data/ tree for both engines (#876)
```

`km_segmenter.pt` is gitignored *by rule* — "a regeneratable intermediate; only the int8 graph and its meta
ship" — but the rule named `src/languages/khmer/…`, so `git mv` carried the file out from under its own
ignore and `git add` committed it. Meanwhile `test/packaging.test.ts` enforced "every gitignored `src/` path
is restated as a `files` negation" against paths that no longer exist: both lists propped each other up
while guarding nothing, and #1248's first draft hand-negated the `.pt` in the data package — a band-aid over
the actual defect. The four fp32 `.onnx` intermediates were never tracked, so the move left them behind and
they are gone from the tree entirely.

Fixed at the root: the patterns now name `data/…`, `git rm --cached` untracks the checkpoint (kept on disk),
the engine's dead `!src/languages/…` negations are dropped, and `packaging.test.ts` guards the DATA
package's allowlist — which is where the override-`.gitignore` trap now lives.

### ⚠ And deriving that gate mechanically stripped the attribution set

Generating the negations from `.gitignore` gave `!LICENSE`, `!LICENSES/`, `!NOTICE.md` — because the
pack-time copies are gitignored too. Measured:

```
npm pack --dry-run -w data → 349 entries (was 364)
  NOTICE.md              → True     (npm force-includes these two)
  LICENSE                → True
  LICENSES/PROVENANCE.md → False    ← 15 attribution files gone
```

**Every gate stayed green**, because `data-package.test.ts` asserted `files` *contains* `"LICENSES"` — which
it did, as a positive, with a `!` negation after it. Checking the DECLARATION instead of the ARTIFACT is
exactly what let it through, in the one package whose stated purpose is carrying an exactly-true attribution
set.

Two reasons a path is gitignored here, and they are opposite: a trainer intermediate must NOT ship; the
licence copies are generated at pack time and MUST. The rule is now "accounted for — negated **or**
deliberately shipped", and `check-package-fence.mjs` probes `LICENSES/PROVENANCE.md` and
`licencing_posture.md` in the PACKED output. Verified by re-introducing the bug: exit 1 naming both files;
restored, exit 0.

### The rest

- **`^0.1.0` → an exact pin.** The test comment said "LOCKSTEP, NOT COMPATIBILITY" while the range said
  compatibility. A caret admits any newer 0.1.x (and any 1.x later), and a data package the engine did not
  expect is a set of keys that may not be there — `loadTsv`'s `optional` returning an empty Map, i.e. a
  plausible wrong reading, not an error.
- **`resolveDataRoot` is now injectable and tested on every branch.** It is the whole behavioural payload of
  the split and was verified only by a manual tarball install; two of its branches (installed consumer, data
  package absent) are unreachable from a checkout. Six cases, including the bundled-`import.meta.url` guard
  and a Windows `file:` URL.
- Applied by the review: the unguarded `/src/` split (`slice(0, -1)` would chop the URL's last character and
  name a directory that never existed), `cpSync` overlaying rather than mirroring `LICENSES/` (a retired
  licence would survive from an earlier pack), and two stale doc lines.

Re-verified end to end: engine 3.0 MB, data 60.5 MB, 15 licence files present, `km_segmenter.pt` absent,
`nb` async ≠ `nb` sync. `npm ci` on a clean checkout exits 0 and the fence runs with no `node_modules`
(the two CI jobs). vitest 292 files / 5,768 tests.
