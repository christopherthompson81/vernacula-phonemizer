# core/trace: a static initializer poisons the FIRST PhonemizeTrace of a language (#1408)

⚠ **FILED UNDER `core/` RATHER THAN `ja/` BECAUSE THE DURABLE HALF IS THE SEAM.** `ja` is where it bit,
and the fix is one line in the Japanese normalizer — but the hazard is any static initializer anywhere
reaching the tracked rewrite seam, the gate is fleet-wide, and the finding that **the trace has no gate
at all** is about `core`, not about Japanese. `docs/investigations/README.md` lists `core/` as "engine
seams — registry, async path, browser, **trace**".

Reported by a downstream consumer using the trace to segment non-spacing scripts. C# only; TypeScript is
correct cold and warm.

    COLD ja tokens=3  "科学者たちが" in=NULL   "発表しました" in=NULL   "。" in=NULL
    WARM ja tokens=3  "科学者たちが" in=[0,6)  "発表しました" in=[6,12)  "。" in=[12,13)

⚠ **THE WORST SHAPE A DEFECT CAN HAVE: IT IS CORRECT THE SECOND TIME YOU LOOK.** The consumer's segmenter
falls back to whitespace when it sees no spans, so the *first* Japanese document a process opened got one
"word" per sentence and every later one got real phrases.

## Run 1 — 2026-09-22 — the poison sink names it in one run

`Provenance` has an `OnPoison` diagnostic hook. Installing it and taking a stack trace:

    POISON  tracked="科学者たちが発表しました。"  got="れい"
      Provenance.StartTrack        Provenance.cs:179
      Rewriter.Rewrite             Rewriter.cs:40
      Japanese.Normalize.ToKatakana   Normalize.cs:20
      Japanese.Normalize..cctor()     Normalize.cs:25        ← the static constructor
      Japanese.Normalize.NormalizeJapanese  Normalize.cs:111

`Normalize`'s **static constructor** builds its digit-kana table with `ToKatakana("れい")`. A static
constructor runs **lazily, on first use**, and for that class first use is inside `NormalizeJapanese` —
*inside the traced window*. So it called `StartTrack("れい")` while the tracked string was the caller's
whole sentence; the mismatch rule correctly refused it and **poisoned** the mapping, and every
`InputSpan` came back null.

⚠ **AND `Provenance`'s OWN HEADER NAMES THIS EXACT HAZARD**, from a previous instance:

> the method is also how a **static constructor builds a lookup table** … `Initialisms` runs
> `CLASS_BRACKETS.Replace(…)` inside a static initializer … Every language had its own poisoned length,
> once per process, on the first cold trace.

That instance was fixed by replacing a length check with a content check, which stopped the mapping being
*wrong*. It did not stop the clobber, so the cost simply moved from a wrong answer to a withheld one.

### The fix is one line, and the other half of the port already had it

    TypeScript  normalize.ts:40   s.replace(/[ぁ-ゖ]/gu, …)          ← plain, untracked
    C# Japanese.cs:16             HIRAGANA_RANGE.Replace(s, …)       ← plain, untracked
    C# Normalize.cs:19            Rewrite(s, HIRAGANA_RANGE, …)      ← TRACKED  ⚠

Three copies of the same helper; **one of them went through the tracked seam**, and that is the whole
defect. Its only caller is the static table, so it never touches a pipeline string and has no business in
the seam at all.

## Run 2 — the gate, and why it cannot live in the test assembly

⚠ **I TRIED TO PUT IT THERE FIRST AND VERIFIED THAT IT DOES NOT WORK.** The defect is **once per
process**, so by the time any test in the shared assembly runs, another test has already warmed `ja`.
With the fix reverted, **both** of these PASSED inside `dotnet test`:

- a poison-sink sweep over all 189 languages;
- a direct "`ja`'s first trace carries its input spans" assertion.

A cold-process assertion needs a cold process. The check is `csharp/tools/trace-cold`, and the xunit test
spawns it — the same device `test/engb-sets-shard.test.ts` uses, for the same reason.

⚠ **ONE PROCESS STILL COVERS EVERY LANGUAGE**, which is what makes it affordable: each language's static
initializers run on *its* first trace, so all 189 cost **~13s together**. Proved by reverting the fix —
the tool then names `ja` and the string `れい`, and reports `ja` under "no input spans on the cold trace"
as well.

⚠ **AND THE TRACE HAD NO GATE AT ALL BEFORE THIS.** `check-goldens` and the parity harness compare IPA
STRINGS; `InputSpan`, `IpaSpan` and token boundaries are in neither. That is why a port divergence this
visible reached a downstream consumer before anything in the repo noticed.

## Run 3 — ⚠ AND THE FULL C# SUITE HAD BEEN RED SINCE MY OWN #1402, FOR THIRTEEN MERGES

Running `dotnet test csharp` — which I had not done once in this session, only ever with a `--filter` —
found `AsyncPrewarmsAnEmbeddedLatinRunFromACOLDMemo` failing:

    Expected: "ʔab mˈændæɡ zɨbl"
    Actual:   "ʔab mˈɑːndˌæɡ zɨbl"

It fails in isolation, so it is deterministic, not an ordering flake. Bisecting: already red at
`e26d3c34` (#1400's n-gram retrain) and at `c6e26698` (#1402's BiLSTM retrain) — **both merged earlier in
this session**. TypeScript produces the identical pair, so this was never a port divergence; it was a
stale hand-written expectation, exactly the rot that file's own neighbours are made of.

⚠ **AND THE RULE ALREADY EXISTED.** `CONTRIBUTING.md` says, in bold:

> **`dotnet test csharp` IS PART OF THE ROUTINE, NOT A PORTING-ONLY STEP** — and it was missing from this
> list until ten of its tests had quietly gone red.

`docs/investigations/csharp_test_rot_investigation.md` records that incident and the fix. **The rot
recurred because I did not follow a rule written after the last time it happened**, not because the rule
was missing. The gate list is right; my ritual was `npm test` + `check:goldens` + `check:en-gb-sets` +
parity, and the C# suite was never in it.

### And the discrimination in that test has narrowed, which is the thing to watch

Its comment explains that it needs a word the two OOV tiers read **differently**, and that after a
retrain a discriminating word can stop discriminating and leave the test "asserting nothing while still
passing". The two used to differ from the first vowel (`mˈændæɡ` against `mˈɑːndəɡ`); they now agree
through `mˈɑːnd` and differ only in the final syllable. Recorded in the test, with the instruction to
pick another of the six the #1341 sweep found when they converge entirely.

    C# suite 6,706 passed (first green run of this session) · trace-cold 189 languages, no poisons

## Run 4 — 2026-09-22 — review round: the gate's own process handling was three bugs

All in the test that spawns the tool, none in the fix:

- ⚠ **A CLASSIC PIPE DEADLOCK.** `StandardOutput.ReadToEnd()` was drained to completion before stderr
  was read at all, so the moment the child filled the ~64KB stderr buffer it would block writing while
  the parent blocked reading. `dotnet run` is the child — a restore or build failure is the concrete
  trigger. Both pipes are read concurrently now.
- ⚠ **AND THE TIMEOUT WAS INERT.** `WaitForExit(600_000)` sat *after* two blocking reads, which had
  already waited forever, so it could never fire and `Assert.True(p.HasExited, …)` could never be
  false. A hung child would have hung the whole `dotnet test` run rather than failing at ten minutes.
  The timeout is on the READ now, with a kill.
- **The repo path resolved against the working directory** rather than `AppContext.BaseDirectory`,
  which is what every other test in the assembly anchors on. VSTest happens to set CWD conveniently;
  a runner that does not would have resolved five levels above the repo and reported a provenance
  defect that was not there.

And two in the tool:

- ⚠ **A BARE `catch` WAS SILENTLY REMOVING LANGUAGES FROM THE GUARD.** `traced` was printed and never
  compared against anything, so a regression making 50 languages throw would leave it printing
  `traced 139 languages / no poisons` and exiting 0 — **green, and three quarters of a guard**. It now
  names what it skipped and fails outright if coverage collapses.
- The non-zero exit message blamed a "cold-trace defect" for *any* failure, including exit 2 ("goldens
  not found") and a build failure. Exit 1 is the defect; anything else is the harness.

⚠ **AND THE LOG WAS IN THE WRONG PLACE — MY OWN RECORDED CONVENTION.** It sat at the flat root of
`docs/investigations/` while the README says one folder per language and per cross-cutting topic, and
the index was not updated, so it was unreachable. Moved to `core/` — `ja` is where it bit, but the
durable half is the seam, the gate is fleet-wide, and "the trace has no gate at all" is a `core`
finding. Index bumped 5 → 6.

Re-proved after all of it: reverting the one-line fix fails the test with `⚠ POISONED` naming `ja`.

    trace-cold  traced 189 of 189 languages · no poisons · ~13s

## Run N+1 — 2026-09-22 17:20 — the cross-port trace gate (#1419)

`trace-cold` closed the COLD-INIT half: every language traced once in a fresh process, failing on a
poisoned mapping or an all-null span set. It says nothing about whether the two ports **agree** on spans
they both produce. This closes that half.

### ⚠ The invariant the issue proposed is half false, and measuring is what found it

#1419 proposed asserting that the spans "tile the input without overlapping". Measured over all 36,495
golden rows:

```
exactly tile `normalized`:        1,723
leave gaps (whitespace etc.):    34,772      ← "tiling" would have failed almost everywhere
a token pair OVERLAPS:                0
a token pair SHARES a `span`:         0
a `span` goes backwards:              0      out of bounds: 0   inverted: 0
```

So **disjoint and strictly ascending is true; tiling is not.** Asserting the proposed form would have
produced a gate that fails on 95% of the corpus on day one.

⚠ **AND `inputSpan` BEHAVES DIFFERENTLY FROM `span`**, which matters because the natural instinct is to
assert the same thing about both:

```
rows with ANY inputSpan:                     36,495
rows where only SOME tokens have one:             0      ← all-or-nothing per row
adjacent pair SHARES an inputSpan:           12,103      ← sharing is ORDINARY, not an error
a token spanning the WHOLE input:                 0      ← this is the real defect shape (#1420)
```

Sharing an `inputSpan` is correct whenever the normalizer collapsed several tokens out of one stretch of
source. #1420 is exactly where asserting distinctness was the wrong call, and "no token spans the whole
input" was the property that actually held — so that is what this gate asserts.

### The shape

Nothing is committed: a full dump is ~18 MiB. `tools/dump-traces.mts` writes the TypeScript side in one
`tsx` process; `csharp/tools/trace-parity` computes its own in one `dotnet` process and diffs. The
expected values are the other port's, not a recorded artifact that could rot.

⚠ **ONE PROCESS PER SIDE, COLD, AND NEITHER CHECK MAY LIVE IN A TEST ASSEMBLY.** This run's own history
is the argument: a poison sweep over 189 languages AND a direct span assertion both passed inside
`dotnet test` with #1408 fully present, because a shared test process had already warmed every language.

### ⚠ Proved by injecting the defect, not by passing

A gate that is green on the day it is written has demonstrated nothing. Two perturbations of the C#
`Trace.cs`, each reverted after:

```
every InputSpan null   (the #1408 shape)              36,495 of 36,495 rows differ
InputSpan.Start off by one, in range and ordered      35,021 rows differ
restored                                              identical, 0 differ
```

The second is the one worth having: it is **in range, ordered, and structurally valid**, so no
per-port check can see it — it is only visible as a disagreement between the ports. That is the
silently-wrong-highlighting case #1419 was filed about, and it is caught.

**Gates.** 6330 TS · 6939 C# · goldens 189/36495 fresh · parity 189 byte-identical · trace-cold 189 of
189, no poisons · **trace-parity 189 languages, 36,495 rows, traces identical**.

**Review of the trace gate — a gate whose success signal matched its no-op.**

⚠ **NEITHER HALF CLEARED THE PROCESS-WIDE FOREIGN-OOV MEMO**, which every other golden-driven tool in
the repo does (`gen_parity_goldens`, `check-goldens`, the parity runner). The measurement is already
recorded in `check-goldens.mts`: without the clear, **38 rows go stale in 6 languages** (mi, vi, nan,
hak, hmn, sat). It matters MORE here than anywhere else, because the memo's CONTENT is port-specific —
a language whose foreign engine is still `PortPending` never populates it on the C# side — so an
uncleared memo can report a divergence on a row whose real cause is a different language, or let two
contaminations cancel and hide a real one. A gate that manufactures its own false positives is worse
than none.

⚠ **AND THE SUCCESS SENTENCE PRINTED WHEN ZERO ROWS WERE COMPARED.** Every row is skipped when the dump
does not cover it, and nothing asserted a floor — so a stale `.trace-parity/ts.tsv` from an earlier
subset dump, an empty dump, or goldens regenerated since, all printed *"traces identical across ports"*
and exited 0. That is the memo *a success signal that matches the no-op*, in a tool written to close a
hole of exactly that kind. `check-goldens.mts` states the rule ten lines from where the memo clear
lives: **an empty golden is a failure, not a pass.** Both a zero floor and a PARTIAL-dump check now
fail with exit 2, and the subset case is allowed only when `[codes…]` was asked for explicitly.

Three more: the C# side had no `[codes…]` filter, so a one-language repro had TypeScript reach `hak`
COLD while C# reached it after a hundred other languages — with a shared memo, precisely the condition
that manufactures a false diff, and it still paid for a full 36,495-row pass; a malformed dump crashed
with an index exception instead of saying "rerun the dump"; and the all-or-nothing `inputSpan` check
fired after a `break`, double-counting one defect and naming a shape the corpus has zero instances of.

**Proved again after the changes**, not assumed: injected offset error → 35,021 rows differ, exit 1;
restored → identical, exit 0; empty, partial and malformed dumps → exit 2 each.

**Gates.** 6330 TS · 6939 C# · goldens 189/36495 fresh · parity 189 byte-identical · trace-cold 189 of
189 · trace-parity 189 languages, 36,495 of 36,495 rows walked, identical.
