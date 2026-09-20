# The checked-in lexical sets no longer reproduce from their builder (#1381)

`data/languages/english-gb/en-gb-{bath,cloth,yod,palm,lotr}.tsv` are a generated artifact committed to
the repo, built by `tools/referee-eval/build-en-gb-sets.ts` from the wikipron UK referee and the GenAm
dictionary's output. Running the builder today rewrites hundreds of rows across all five: the dictionary
underneath them has moved and the sets have not been rebuilt since.

⚠ Same failure mode as the goldens — a generated artifact that nothing regenerates and nothing notices
when it goes stale — but with no equivalent check. It is also the same shape as #1388's inert dictionary
rows, one level up: the artifact and its source have drifted and every gate is green.

## Run 1 — 2026-09-20 17:40 — the before state, and what the signal can and cannot be

    set     committed
    bath      586
    cloth     773
    yod       787
    palm      407     (406 + the `tomato` hand row removed by #1385)
    lotr       13
    marry     522     (the builder does not write this one)

    eval.ts en-GB --jobs 8
      folded backbone  39,752 / 76,284 (52.1%)
      symbol accuracy  86.4%
      scored path      rules

⚠ **THE EVAL HEADLINE CANNOT MOVE AND THAT IS NOT A NULL RESULT.** The sets are consulted on the SHIPPED
path and `eval.ts` deliberately scores `rules`, so the headline is blind to this change by construction —
the same non-circularity that makes the eval honest makes it useless as the before/after here. The signal
has to be the `product delta` and a hand reading of the moved rows.

## Run 2 — 2026-09-20 18:20 — the rebuild, and what the churn actually is

    set     committed  rebuilt   +     −
    bath       586       679    171    78
    cloth      773       694    151   230
    yod        787       824    116    79
    palm       407       567    202    42
    lotr        13         6      1     8

1,031 memberships move, which the net deltas hide completely. The issue asks whether that is the
dictionary improving and the sets correctly following it, or the builder's single-edit heuristic being
unstable. It is the first, and the two shrinking sets are the clearest evidence.

### ⚠ THE `lotr` SHRINK IS A MIGRATION, NOT A LOSS

All 8 departures are `sorry`, `sorrow`, `sorrowful`, `morrow`, `overmorrow`, `florist`, `categorical`,
`categorically` — and **all 8 are in `cloth` now**. #1334 realigned the parent's AA/AO to gold's
LOT–THOUGHT split and moved exactly these from `ɑː` to `ɔː`; `lotr`'s edit is `[ɑɔ]ːɹ → ɒɹ` and `cloth`'s
is `ɔː → ɒ`, so once the vowel moved, `cloth` claims them first and `lotr` is redundant for them. Every
one still renders correctly (`sorry` → `sˈɒɹi` against the referee's `sɒɹi`).

### ⚠ AND THE `cloth` SHRINK IS THE SAME THING IN THE OTHER DIRECTION

`blog`, `apostolic`, `amniotic` and their like moved `ɔː → ɑː`, where the UNIVERSAL LOT rule
(`ɑː(?!ɹ) → ɒ`, which needs no membership at all) now handles them. Leaving `cloth` is correct and the
output is unchanged.

So the peer's guess — that the churn is the sets following a dictionary that moved under them — holds,
and the mechanism is more specific than "following": words migrate BETWEEN sets, and some graduate to
needing no set at all.

## Run 3 — 2026-09-20 18:40 — ⚠ THE FIRST PRODUCT DELTA WAS WRONG, AND MY SCORER MADE THE REGRESSIONS

The eval headline cannot move (Run 1), so the signal is the product delta: render every word whose
membership moved, on the SHIPPED path, and compare to the referee under the eval's own fold, once per
side. First result:

    473 MISS → HIT        48 HIT → MISS

and 43 of the 48 broke by JOINING `bath` — `hasp`, `laughable`, `blaspheme`, `unmask`, `declass`. Which
looked like the builder over-claiming, until the referee rows were read in full:

    hasp     hæsp   hɑːsp
    unmask   ʌnmæsk ʌnmɑːsk

⚠ **THE WIKIPRON ROWS CARRY SEVERAL READINGS AND MY SCORER READ ONLY COLUMN 2.** The builder's stated
policy is to prefer the RP-diagnostic realisation *whenever it is attested*, so claiming these into
`bath` is exactly right — and scoring against the first column alone turns a correct claim into a
regression. **43 of the 48 "regressions" were manufactured by the measuring instrument**, which is the
third time this session that a harness rather than the code was the thing at fault.

Corrected:

    473 MISS → HIT        3 HIT → MISS        259 MISS → MISS      259 HIT → HIT

### ⚠ And the 3 that remain are a blind spot the RUNTIME already documents

`clara`, `dara`, `scarry` — with `barry` dropped silently alongside them. `english-gb.ts` says:

> marry–merry RUNS FIRST, BEFORE BATH, and the order is load-bearing. Four words are in BOTH sets
> (`barry`, `clara`, `dara`, `scarry`): they were `æ` in the parent, BATH lifted them to `ɑː`, and the
> merger then made them `ɛ` …

The builder probes `phonemizeWordRules`, which does **not** apply `marry` — that set is shipped-path and
this builder does not write it. So the rules-only form is `klɛɹə`, the BATH edit `æ → ɑː` matches
nothing, and **the builder is structurally incapable of producing a membership the runtime documents as
load-bearing.** The comment records the consequence and not the cause.

Fixed in the builder rather than by hand: a word in `en-gb-marry.tsv` gets the marry edit applied before
the set probes, mirroring the runtime's own order. All four are claimed again, `bath` 673 → 679.

⚠ **THE ALTERNATIVE WAS A HAND EDIT IN A GENERATED FILE**, which is precisely the hazard #1385 (the
`tomato` palm row) and #1388 (seven inert dictionary rows) were both about. Landing this rebuild with
four hand-added BATH rows would have re-created the bug three days after fixing it twice.

    FINAL   473 MISS → HIT        0 HIT → MISS

## Run 4 — the freshness check, and it is verified to fire

`build-en-gb-sets.ts --check` rebuilds in memory and diffs against what is committed, naming the per-file
delta and exiting 1. Wired as `npm run check:en-gb-sets`.

⚠ A ritual on `main`, not a CI job, for the same reason `check-goldens` is one — a run is minutes over a
76k referee and a 135k dictionary.

⚠ **AND IT IS VERIFIED TO FIRE, INCLUDING ITS EXIT CODE**, because a check that reports without failing
is the #1388 bug wearing a different hat: appending one row gives
`⚠ STALE … en-gb-bath.tsv: committed 680, builder 679 (+0 / -1)` and `exit=1`, against `exit=0` clean.
