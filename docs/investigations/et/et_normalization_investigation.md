# et (Estonian) — text-normalization investigation

Chronological log for the Estonian normalization layer, per `docs/normalization_playbook.md`.
Worktree `vernacula-worktrees/et`, branch `norm-et`, based on `main`.

The bring-up run is recorded in the commit message of `fe28a2e`; this log begins at the REVIEW round, which
is where the runs stopped being confirmatory and started changing what was shipped.

## Run 1 — 2026-08-14 18:05 — reproduce the baseline before touching anything

**Command.**

```
git worktree add --detach <scratch>/et-fix/base ef8f24a          # the commit the layer was built on
corpus-diff.ts emit --lang et --corpus mined:et --out …/et.before   # from the pinned worktree
corpus-diff.ts emit --lang et --corpus mined:et --out …/et.head     # from norm-et @ fe28a2e
corpus-diff.ts compare --before …/et.before --after …/et.head --corpus mined:et
```

**Question.** Is the number in the shipped commit message reproducible, i.e. is the ruler the same one?

**Raw finding.** `changed 312/463 (67.4%)`, `DROP 96 → 14`, `THROW 0`, every other leak class 0 on both
sides — byte-identical to the commit message's claim. So the instrument is sound and any movement from here
is mine.

**Implication.** Both baselines are worth keeping: `et.before` prices the whole layer, `et.head` isolates the
review fixes. Everything below is measured against `et.head` first and re-checked against `et.before`.

## Run 2 — 2026-08-14 18:06 — the terminative, before writing the fix

**Command.**

```
attest.ts --lang et --words "kolmanda sajandini,kolmandani sajandini,üheksateistkümnenda sajandini,\
kolmandani,neljandani,kaheksandani"
```

**Question.** The reviewer says the attribute of a `-ni` head is GENITIVE, not agreeing. Does et.wikipedia
separate the two readings, or is this a grammar claim with no corpus behind it?

**Raw finding.**

```
kolmanda sajandini              1 token /  1 art   attested
kolmandani sajandini            0 / 0              absent
üheksateistkümnenda sajandini   0 / 0              absent
kolmandani                      2 / 2              attested
neljandani                      1 / 1              attested
kaheksandani                    3 / 3              attested
```

and the one `kolmanda sajandini` hit is the exact frame this rule feeds:

> "…sev riik, mis eksisteeris alates teisest sajandist eKr **kuni kolmanda sajandini** pKr."

**And the trap, which is the whole reason to read the examples.** The forms `kolmandani` / `neljandani` /
`kaheksandani` ARE attested, 6 examples between them, and every one is a HEADLESS substantivised ordinal —
the right operand of a span with no noun after it at all: *"esimesest kolmandani"*, *"viiendast
kaheksandani"*, *"järjestab võistkonnad esimesest neljandani"*, *"Sealt kolmandani viiv sai ajamiks…"*. The
form exists; it is not an ATTRIBUTE. A token-count probe on the WORD would have confirmed the defective
output. It is the phrase probe — the form beside its head — that answers the question.

**Implication.** Fix `caseOf` to translate the head's ending into the attribute's, rather than returning the
head's ending unchanged. `na`/`ta`/`ga` share the exception and are ×0 here, so they are listed beside `ni`
as a guard against the next ending admitted to `NOUN_ENDINGS` inheriting agreement by default. Cache entries
KEPT — they are the evidence.

## Run 3 — 2026-08-14 18:11 — the five fixes, differentially

**Command.** `corpus-diff.ts emit … --out …/et.after`, then `compare --before …/et.head --after …/et.after`,
plus a per-line word-level read of every changed row.

**Question.** Do the five changes move exactly what they were supposed to move, and nothing else?

**Raw finding.** `changed 17/463 (3.7%)`, DROP `14 → 14`, THROW 0. Read one at a time, the 17 are:

- **9 segments gain a `kuni`** from dropping `.` from the range rule's right guard — `lk 137–151.`,
  `1912–1913.`, `50 000 – 100 000.` and `1993–1996.` (both in one segment), `145–151.`, `24–27.`, `89-93.`,
  `231–238.`, `1944–1980.`. Zero regressions. `II.16-17.98b32–34` and `1750/1500–500` are still declined,
  by the LEFT guard, which is the point: the right-hand `.` had no shape left to protect and was declining a
  span for its SENTENCE PERIOD.
- **7 segments / 9 ordinals lose the spurious `-ni`** — `kolmandani kaheksandani sajandini` →
  `kolmanda kaheksanda sajandini`, `viieteistkümnendani kuueteistkümnendani eluaastani` → genitives,
  `…kaheksandani aastani` → `…kaheksanda aastani`, `üheksandani oktoobrini` → `üheksanda oktoobrini`,
  `esimeseni juulini` → `esimese juulini`, `üheksateistkümnendani aprillini`, `kahekümne kuuendani
  veebruarini`. Exactly the 7 contexts and 9 ordinals the review scoped.
- **1 segment regains a sentence period** — `…ja muu selline` now `…ja muu selline .`, from the
  abbreviation dot no longer being eaten when it is followed by whitespace + a capital or ends the input.

**And two fixes move NOTHING, which is the expected answer for both.** The clause-bounded `saidNear` window
and the anchored grouping head are latent classes: all 33 `°` instances and all 48 groupings in the retained
text are already correct, and the diff confirms the tightenings cost nothing. Pinned as branches in the
tests rather than as corpus instances.

**Implication.** Ship all five. The grouping regex was the one that could have cost something — it was
tightened rather than having its comment relaxed *because* the diff said the tightening was free.

## Run 4 — 2026-08-14 18:14 — the rest of the gates

**Command.** `tsc --noEmit`, `vitest run`, `mine.ts scan --in tools/corpus/mined/et.jsonc --lang et` (run on
both `fe28a2e` and the fixed tree), `review.ts --lang et`, `referee-eval/eval.ts et`, and
`compare --before …/et.before --after …/et.after`.

**Raw finding.**

```
tsc               clean
vitest            245 files / 4299 passed, 5 skipped
scan              13 classes / 26 instances — BYTE-IDENTICAL before and after
review.ts         1 FAIL, unchanged: `artifact scan`, i.e. the same 13 classes
referee           2732/2903 folded (94.1%), symbol accuracy 98.6% — unmoved
corpus-diff       ef8f24a → now: changed 317/463 (68.5%), DROP 96 → 14, THROW 0
```

**Note on a number in the shipped commit message.** It claims `mine.ts scan … → 13 classes / 25`. The class
count is right; the instance count is 26 (6+5+2+2+2+2+1+1+1+1+1+1+1). Corrected in the amended message. The
scan output itself is unchanged by this round, so this is an arithmetic slip in the prose, not a regression.

**Implication.** The single remaining `review.ts` FAIL is the documented one — `lk` ×2, `jpt` ×1, `vkj` ×1
unsourced; `ks` ×2 / `st` ×1 unreachable below the registry's Roman pass; `km`/`kg`/`sp`/`th`/`pl` shapes the
rate and exponent refusals decline; `DROP degree ×1` is the arc-minute coordinate refused whole. All five are
argued in `normalize.ts`'s header and none is touched by this round.
