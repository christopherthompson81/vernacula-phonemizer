# corpus-diff pairing investigation

Why `compare` throws `length mismatch` on exactly the improvement it exists to measure, and what it should
pair rows by instead. Worktree `fix/cdiff`.

## Run 1 — 2026-08-11 09:40 (reproduce the ug crash)

**Question.** Is the `length mismatch` the ug run hit a property of the ug artifact, or of the tool?

The tool needs two CHECKOUTS, so the pre-ug engine was materialised without touching any shared git state
(no `worktree add`, no `stash` — four agents share this repo):

```
$ git archive 9c7ae09^ | tar -x -C $BASE && ln -s <repo>/node_modules $BASE/node_modules
$ (cd $BASE && npx tsx tools/normalization/corpus-diff.ts emit --lang ug --corpus mined:ug --out $S/ug.before)
emitted 428 utterances → $S/ug.before
$ npx tsx tools/normalization/corpus-diff.ts emit --lang ug --corpus mined:ug --out $S/ug.after
emitted 428 utterances → $S/ug.after
$ npx tsx tools/normalization/corpus-diff.ts compare --before $S/ug.before --after $S/ug.after
Error: length mismatch: before 426, after 428 — different corpora?
```

**Raw finding.** Both artifacts are 428 lines on disk. `ug.before` contains two EMPTY lines, at file lines
242 and 252; `ug.after` contains none. `ug.before.src` and `ug.after.src` are 428 lines each and
`cmp` says they are BYTE IDENTICAL — the two sides read the same corpus in the same order.

```
$ wc -l ug.before ug.after ug.before.src ug.after.src   → 428 428 428 428
$ grep -c '^$' ug.before → 2      $ grep -c '^$' ug.after → 0
$ cmp ug.before.src ug.after.src  → (identical)
```

**Implication.** Nothing about the corpora differs. The message is a lie: `compare` builds its arrays with
`.split("\n").filter((l) => l !== "")`, which discards the two lines where the OLD engine read the empty
string. The emitted artifact is a POSITIONAL RECORD — line *i* is the reading of source line *i* — and the
empty string is a legitimate reading, in fact the single most interesting one a before/after can contain.
Filtering it deletes records from one side only.

Worse than the throw: had the counts happened to match (e.g. one line went empty→text while another went
text→empty), the filter would have shifted the two arrays past each other and `compare` would have printed
FABRICATED differences with no error at all. The crash is the benign case.

## Run 2 — 2026-08-11 09:55 (is positional pairing load-bearing, and what identity exists?)

**Question.** Can rows be paired by something other than position, and is the source text unique?

Findings from reading `emit`: it already writes `<out>.src`, one source line per artifact line, "so
`compare` can categorise a change by what produced it". Both readers (`corpusLines`, `minedLines`)
accumulate into a `Set`, so **source lines are deduplicated and therefore unique by construction** — the
source text IS a usable row identity. `compare` today reads only `<after>.src`, and only to print SRC in
the examples.

Negative result checked before relying on it: a source line containing a literal newline would put the
`.src` file out of step with the artifact (the IPA is `\n`-flattened, the source was not). Two of the 157
mined artifacts contain a `\n` escape (`oc`, `sq`); emitting `oc` gives 452 artifact lines and 452 `.src`
lines, so neither survives deduplication into a live segment today. It is one artifact away from being
true, so `emit` now flattens newlines in the `.src` writer the same way it already does for the IPA, and
`compare` verifies `.src` length against the artifact before trusting it.

**Implication.** Pair by source text, fall back to position when a `.src` is missing or out of step, and
never delete an empty reading from either side.

## Run 3 — 2026-08-11 10:20 (does the fix move any recorded number?)

**Question.** The DROP counts quoted in recent commits came from the filtering tool. Does keeping empty
rows and pairing by identity change what any language reports?

Method: the OLD tool (run from its own pristine base checkout) against the NEW tool, on the same three
artifact pairs. `ug` is the failing case (base `9c7ae09^`); `rw` (base `ca46b3f^`) and `hak` (base
`387e012^`) are two languages whose recorded runs compared cleanly.

```
lang   old tool                                        new tool
ug     Error: length mismatch: before 426, after 428   changed 237/428 (55.4%)  DROP 111 → 48
rw     changed 162/442 (36.7%)  DROP 94 → 21           changed 162/442 (36.7%)  DROP 94 → 21
hak    changed 367/411 (89.3%)  DROP 28 → 28           changed 367/411 (89.3%)  DROP 28 → 28
```

**Raw finding — NO LANGUAGE'S NUMBERS MOVE.** `rw` and `hak` are byte-identical under both tools, defect
class for defect class and denominator for denominator: neither artifact contains an empty reading on
either side, so the filter was a no-op there and `scan("")` matches none of DIGIT / SLOT-GAP / RAWMARK /
DROP / THROW anyway. Only `ug` moves, from "cannot be measured" to a number.

And the `ug` number the fixed tool gives is **237/428 (55.4%), DROP 111 → 48** — exactly what
`docs/investigations/ug/ug_normalization_investigation.md` Run 5 recorded from the sentinel-padded workaround. That was worth
checking rather than assuming: the padding could have compared a sentinel against itself and hidden the two
rows. It did not, and the two presentation-form rows are in the changed set under the fix
(indices 241 and 251, `⟨empty⟩` → a full reading). **Nothing recorded in `defects.ts` or in any
investigation doc needs re-baselining, and nothing was rewritten.**

## Run 4 — 2026-08-11 11:10 (does the new pairing actually catch a corpus that moved?)

**Question.** The identity pairing is only worth having if it survives what would have thrown before.

`ug.before` was doctored by deleting record 10 from both the artifact and its `.src` — a corpus that lost a
line between the two checkouts, which the old tool answers with `length mismatch`:

```
$ … compare --before $S/ug.short --after $S/ug.after
  ⚠ UNPAIRED: 0 before-only, 1 after-only (by source text) — compared on the 427 rows both sides share
changed 236/427 (55.3%)
  before  { DIGIT: 0, 'SLOT-GAP': 0, RAWMARK: 0, DROP: 111, THROW: 0 }
  after   { DIGIT: 0, 'SLOT-GAP': 0, RAWMARK: 0, DROP: 48, THROW: 0 }
```

**Raw finding.** 427 rows still pair correctly — the 417 rows AFTER the deleted one are matched to their
own before-readings, not shifted by one, which is what position would have done had it not thrown. The
changed count drops by exactly the one row removed (237 → 236).

**Implication.** Reporting the unpaired rows and comparing the shared ones is strictly more information
than the throw. A large UNPAIRED count is what "different corpora?" actually looks like, and now it is a
number rather than a guess.

## Run 5 — 2026-08-11 11:25 (gates)

```
$ npx vitest run     → 3644 passed, 1 failed: test/onnx-optional.test.ts, "Test timed out in 5000ms"
                       ⚠ NOT this change — that file passes on its own here AND in the pristine base
                       checkout (3/3 in ~3s each); it is a 5s timeout losing to full-suite load.
                       Includes 16 new corpus-diff pairing tests, all passing.
$ npx tsc --noEmit   → clean
```

Negative result worth keeping. Two designs were considered for the defect columns and one was rejected:
scanning the WHOLE artifact on each side (as before) versus scanning only the paired rows. On all three
languages here the two agree, because unpaired rows only exist in the doctored Run 4 case — so this choice
is unobservable on real data and was made on the argument rather than the measurement: scanning whole
artifacts would put a "before" total over one corpus next to an "after" total over a different one, and
that is the same class of error as the mis-pairing this whole fix is about. Paired rows only; the unpaired
count is printed separately instead of being folded into either column.

Also declined: making `compare` throw when UNPAIRED exceeds some fraction. There is no threshold that is
right for both "the artifact gained a segment" and "you passed two different languages", and the printed
count already makes the second obvious.
