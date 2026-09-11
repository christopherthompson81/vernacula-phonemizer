# csharp/goldens staleness — two failures, one missing gate

Issue #1283. `csharp/goldens/` is the port's definition of done, and it is a **generated artifact
committed to the repo**. Nothing regenerates it automatically and nothing noticed when it went stale.
That broke the parity gate twice in one day, in two different ways, and both times the stale artifact
made a deterministic system look broken — which is what cost the time.

## The two failures

**1. Not regenerated at all.** #1274 edited `data/` — which BOTH engines read — and left the goldens
behind. 78 rows sat red across en/en-GB/en-IN until #1281 happened to regenerate them. Nothing failed;
`npm run ci` is `typecheck && test && check:package` and parity is a separate manual `dotnet run`.

**2. A merge race**, which is the one no branch-scoped check can see:

```
2f2930c9  main
   ├── 8983ae46 (#1277)  edits g2p-dict + lexicon for `beyond`, does NOT regenerate goldens
   │                     — correct on its own; the contract was written nowhere
   └── #1281 branch      regenerates goldens from the data IT can see
                         full parity on the branch: 189 byte-identical, 0 differ — genuinely green
d54ba5ce  squash merge → data says bɪjˈɑːnd, golden says bɪˈɑːnd → 3 rows RED
```

`8983ae46` is not an ancestor of the #1281 branch. **Neither change is defective and neither author
skipped a step.** Git merged both cleanly because the conflict is SEMANTIC — the same shape as a
committed lockfile. A gate that runs only on a branch passes both branches here.

⚠ **The cost was not the red gate, it was the misdiagnosis.** I reported failure 2 first as
nondeterminism, then as cross-language order-dependence, and stated I could not reproduce a green run
that had been correct all along. A stale generated artifact is very good at impersonating a flaky engine.

## Run 1 — 2026-09-11 14:09 — what a freshness check can cost

`tools/gen_parity_goldens.mts` needs a 337 MB FLEURS corpus and an alignment DB, neither committed;
without them it emits a different, THINNER row set. So regenerate-and-diff is not available as a gate —
it would fail for the wrong reason, or overwrite goldens from a degraded source.

The check that IS available: re-render each golden's **own recorded text** and compare the IPA. That
verifies the rows that are there without re-deriving which rows should be there, and needs no corpus.

Measured per language (200 rows each):

```
en  async 647ms   th  async 261ms   ru  async 513ms
```

Full run, single process, `clearForeignOov()` per language:

```
goldens fresh: 189 languages, 36495 rows, 0 stale        real 1m0.4s
```

**60 seconds for the whole fleet.** Cheap enough to sit in `npm run ci` — which is where it has to be,
because `.github/workflows/ci.yml` has its automatic triggers deliberately off (solo repo; `npm run ci`
is the local pre-merge ritual). Added to the workflow too, for when the triggers go back on.

## Run 2 — 2026-09-11 14:25 — is `clearForeignOov()` enough? (⚠ I previously said no, and was wrong)

Issue #1275's Run 8 concluded that the per-language memo clear was **insufficient** and that a batch
regeneration needs one CHILD PROCESS per language. That conclusion is now contradicted by direct
measurement, and it was reached from a confused reading of file state rather than from an experiment.

Three runs of the same 36,495 rows:

```
single process, clearForeignOov() per language   →  0 stale        1m00s
one child process per language (--isolate)       →  0 stale       ~10m
single process, NO clear (--no-clear)            → 38 stale         51s
                                                    6 languages: mi 14, vi 13, nan 7, hak 2, hmn 1, sat 1
```

**The clear is NECESSARY** — without it 38 rows change, and the failures are exactly the documented
shape: `sat`'s English parenthetical `Pt.` renders `t` instead of `pt` (the very value I once
committed), `vi`'s `Daesh` renders `dˈɛʃ` instead of `dˈæɛʃ`.

**The clear is also SUFFICIENT** — the cleared single-process run and the fully isolated run agree
exactly, at 0. Process isolation buys nothing over the clear, at ten times the cost.

So the `sat` contamination in #1275 was real and its cause was correct (the global memo), but the
remedy I inferred was not: the clear alone fixes it, and the one-process-per-language step I adopted
afterwards was unnecessary. ⚠ The wrong claim is corrected in
`docs/investigations/en/en_es_plural_weak_vowel_investigation.md` and on #1283.

**Design consequence:** the gate runs in ONE process with the clear, which is why it costs 60s and can
sit in `npm run ci` at all. `--isolate` is kept as a diagnostic, to re-prove that equivalence if the
engines ever grow new cross-language state, and `--no-clear` is kept because it is the only way to see
that the clear is doing anything.

## Run 3 — 2026-09-11 14:55 — review: the gate had five ways to pass while checking nothing

Seven findings. Two were cosmetic; the rest were the gate failing open, which is the only failure mode
that matters in a thing whose whole job is to notice.

**The dangerous one — a missing optional dependency would have turned the gate into a weapon.**
`onnxruntime-node` is an `optionalDependency`, `npm ci` does not fail when it will not install, and both
`neuralRegistry.ts` and `core/onnx.ts` catch a load failure and fall back to the SYNC engine silently. The
goldens are async-mode output, so on such a machine every neural language reads as stale — and the gate's
own printed instruction ("decide which is wrong before regenerating") leads directly to re-recording the
whole fleet from a degraded engine. That is the `beyond` mistake at fleet scale, committed by a tool
built to prevent it.

Now guarded before any comparison runs, and it **asserts an inequality rather than a value**: pinning a
probe word's IPA would just create a second golden that goes stale on its own, whereas what identifies a
dead runtime is that async STOPS DIFFERING from sync. Verified by hiding
`data/languages/english/en-g2p-tagger.int8.onnx`:

```
⚠ the neural path is not live — `phonemizeAsync` is falling back to the sync engine.
exit=2        (and NOT a stale report, which is the point)
```

**Four more ways to pass while checking nothing**, all reproduced and all fixed:

```
check-goldens.mts zz-nonexistent   →  "0 languages, 0 rows, 0 stale", exit 0   a typo read as a pass
an empty/truncated golden          →  "0 rows", reported fresh
an orphan golden (code unregistered) → raw stack trace mid-fleet, ~180 languages never reached
--isolate                          →  undercounted every failing language to ONE stale row, no detail
```

The orphan case is the sharpest: a code dropped or renamed in `registry.ts` is exactly the class of change
this gate exists to report, and it reported it as an infrastructure crash. `gen_parity_goldens.mts` swallows
a throw because a rejected row is not a golden; here the row already IS one, so the rejection is the news.

⚠ `--isolate` now has the child emit JSON. Parsing the human-readable report is what silently drifted out
of step with the printer in the first place.

**And the workflow did not actually enforce anything.** The new step was added to a workflow whose
automatic triggers are all commented out, so it fired only on `workflow_dispatch` — the change shipped the
gate the issue asked for and left the enforcement to a human remembering. Worse, the header comment
justified the triggers being off on the grounds that `npm run ci` runs locally before every merge, which is
*precisely the branch-scoped check this investigation proved cannot see the merge race*.

`push: [main]` is now on. That is not a relaxation of the original decision: the objection was a ~6-minute
wait added to a loop where the work was already verified, and a post-merge run adds no wait to anyone's
loop. `pull_request` stays off for the reason originally given.

### Verification

```
npx tsx tools/check-goldens.mts     189 languages, 36495 rows, 0 stale     real 49s
                                    note: 4 registry codes have no golden: bgc mto pbt zsm
npm run ci                          295 files, 5812 tests, goldens fresh, package fence
```

The registry note is new: a newly ported language with no golden rows was previously invisible here.

## Run 4 — 2026-09-11 17:10 — the goldens are machine-local, confirmed (#1287)

Enabling `push: [main]` in Run 3 ran `check:goldens` on a GitHub runner for the first time. It reported
**44 stale rows across 20 languages** on a commit that is **0-stale locally**.

### Diagnosis, confirmed rather than inferred

```
generating machine : Intel Core i7-10700K (Comet Lake, NO avx512)
GitHub runner      : AMD EPYC 9V74 (Zen, avx512)

want (golden/local): … bˈaᶷndᵻd baᶦ ðə bˈɛlɪŋzʃˌaᶷzən sˈiː .
got  (runner)      : … bˈaᶷndᵻd baᶦ ðə bˈɛlɪŋʃˌaᶷzən sˈiː .
```

One phone in **Bellingshausen**, an OOV proper noun through the neural g2p. Different CPU vendor entirely.

**Ruled out before accepting it.** Thread count is not the cause — rendering the whole `en` golden at 1, 2,
8 and default threads gives an identical hash, so it is not intra-op reduction order (the one cause a
session option could have fixed). A dead model is not the cause either: `en` has ONE stale row in 200, the
liveness guard passed, and onnxruntime initialises in the runner log. What is left is int8 kernels
dispatching by instruction set.

### The hand-written exemption list would have been badly wrong

`--no-ort` (new) forces every neural path to fall back; a language whose output MOVES is ONNX-dependent.

```
ONNX-dependent: 74 of 189 languages
  acm acw af afb ajp am apc apd ar ary arz as ayl be bg bho bn bo chr chv cjy ckb cmn da el en en-GB
  en-IN fa fr gan grc gu hak he hi hmn hne hsn hy ja ka kk km kn ko ky lo mag mk mn mr my nb ne or
  pnb ps rkt ru sd si skr syl ta te tg th ti tt uk ur wuu yue
```

⚠ **The first draft of this entry said "eleven directories own a model", and that was itself a wrong hand
count** — in a section whose thesis is that hand counts are wrong. It is **twelve** (afrikaans, arabic,
bengali, central-kurdish, danish, english, french, hebrew, khmer, norwegian, persian, sindhi), plus
`data/core/riderDiacritizer.onnx`. And "the rest inherit it by delegating an embedded foreign run" was
wrong for about ten of them. The sixty-two reach ONNX by at least three routes:

- **the shared Arabic diacritizer** — nine codes beyond `ar` through `ARABIC_VARIETY` (`acm acw afb ajp
  apc apd ary arz ayl`), none of which owns a model;
- **the core rider diacritizer** — reached by Punjabi;
- **delegation** — a non-Latin engine meeting an embedded Latin run hands it to the English neural reader,
  which is why `ru:1`, `ja:5`, `th:10`, `cmn:6`, `ko:7`, `el:2` appear at one to ten rows each.

`lo`/`pnb`/`ps` — the three that made no sense in the CI output — are in the third class.

### What follows, and what does not

- **Exempting the ONNX languages on CI is not the answer**: that is 39% of the fleet unchecked, to
  suppress 44 rows.
- **A tolerance is not the answer either.** Real staleness has been 3 rows (`beyond`) and 78 (#1274);
  cross-machine noise is 44. No threshold admits the second without hiding the first.
- **So `check:goldens` cannot live in CI at all.** Removed from the workflow, with the reason in the file.
  `push: [main]` stays off — with the golden step gone there is nothing left for it to add that the local
  `npm run ci` does not already cover.
- ⚠ **It reaches `csharp/tools/parity` too.** That gate compares the C# engine against the same goldens,
  so running it on a different machine reports a port divergence that does not exist. Recorded in
  `csharp/PORTING.md`, because that is exactly the misdiagnosis this investigation has already made twice.

The honest position: the goldens are an artifact of one machine, the local gate is exact there, and the
post-merge check is a ritual rather than a mechanism. Making the artifact portable is a separate question
(#1287 keeps it open) and would want the fp32 models or a fixed execution provider, not a threshold.
