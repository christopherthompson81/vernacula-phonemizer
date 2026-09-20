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

## Run 5 — 2026-09-20 19:30 — review of #1389: PALM's edit runs the wrong way

Six findings. One ships at scale and is fixed here; three are small and fixed here; two are pre-existing
classes, measured and filed rather than bolted onto a rebuild.

### ⚠ PALM IS THE ONE EDIT THAT RUNS *AWAY* FROM RP, AND THE CLAIM POLICY IS INVERTED FOR IT

BATH, CLOTH and LOTR move toward the RP-diagnostic realisation (`ɑː`, `ɒ`, `ɒɹ`), which is why the
builder's stated policy accepts a variant the referee merely lists. **PALM moves `ɒ → ɑː`, i.e. toward
the GenAm LOT vowel** — and the eval fold strips LENGTH, so an American `fɹɑɡi` row is indistinguishable
from an RP `fɹɑːɡi` one. The referee is known to carry American rows (#1383). So PALM claimed words on
the strength of the American reading with the British one sitting beside it:

    froggy     ref  fɹɑɡi | fɹɒɡi        shipped fɹˈɑːɡi   (main: fɹˈɒɡi)
    oggle      ref  ɑɡəl  | ɒɡəl         shipped ˈɑːɡəɫ
    thrombus   ref  θɹɑmbəs | θɹɒmbəs    shipped θɹˈɑːmbəs

⚠ **THE DISCRIMINATOR IS THE UN-EDITED FORM, AND IT IS CLEAN.** A genuine PALM word has no `ɒ` reading
at all — `father` is `fɑːðə`, `calm` is `kɑːm` — while a LOT word with an American row has both. PALM
alone now requires that the referee does NOT also attest what we already produce. **PALM 567 → 543**,
exactly the 24 the review identified, and `father`/`calm` are untouched.

⚠ This is the same mechanism as the scorer bug in Run 3, one level down: **the fold that makes the
comparison fair also destroys the distinction the claim depends on.**

### Three small ones, fixed

- `--check` read the committed file unguarded, but the runtime loads all five sets with
  `{ optional: true }`, so an absent file is legitimate and the ritual died with an ENOENT trace — the
  exact opposite of "say clearly which artifact disagrees with its source".
- the `--check` diff built its "committed" set with a looser filter than every other reader (any line
  with a tab), so a header comment carrying a tab would report a phantom `-1`.
- the builder's LOTR probe was `/ɑːɹ/u` where the runtime's is `/[ɑɔ]ːɹ/u` — the same builder/runtime
  drift the marry hunk exists to fix. Aligned. It changes nothing today (CLOTH is probed first and
  produces the identical result for those words) and is aligned so a reordering cannot silently un-widen
  the rule. The runtime's three comment blocks said LOTR "carries `sorry`"; it has not since this
  rebuild, and they now say so.

### ⚠ AND `barry` WAS DROPPED SILENTLY WHERE THE PRODUCT DELTA COULD NOT SEE IT

Run 3 named `clara`, `dara`, `scarry` as the three regressions and `barry` as dropped "silently". That
word is worth dwelling on: the referee attests BOTH `bæɹi` and `bɑːɹi`, so losing its BATH row still
scored **HIT**, and the delta — the instrument this whole PR rests on — was blind to it. Only the
runtime comment naming all four found it.

**So the product delta measures agreement with the referee, not correctness**, and where the referee
attests both variants it cannot see a change at all. That bound belongs on every number in Runs 2–4.

### Two pre-existing classes, measured and filed

⚠ **SET MEMBERSHIP IS PER SURFACE FORM, SO PARADIGMS SPLIT** — `transit` is BATH but `transits` is not,
so one sentence can carry both vowels for one lemma. The review called this a widening; measured, it is
not:

    inflections whose lemma is in a set but which are not   main 754   this branch 732
    paradigm pairs this rebuild SPLITS                       72
    paradigm pairs this rebuild HEALS                        88

Net −16, so the rebuild slightly improves paradigm consistency while introducing 72 new splits. The
class exists at scale on `main` and the fix — propagating membership across regular inflections in the
builder — is a real change with its own evaluation over ~732 rows. Filed, not bolted on.

⚠ **AND BATH ADMITS WORDS THAT ARE LEXICALLY TRAP**, because the referee lists a conservative `ɑː`
variant for them: `plasticity` (`plæstɪsɪti | plɑːstɪsɪti`), `blaspheme`, `allistic`, `aquacise`. Every
one is WITHIN the builder's stated policy — prefer the RP-diagnostic realisation whenever attested — so
this is a challenge to the policy, not a bug in applying it, and changing it moves a 679-row set. It is
also the same referee-quality question #1383 raises from the other side. Filed.

⚠ AND THE PALM GUARD FIXED A ROW THAT WAS ALREADY WRONG ON `main`. `socks` ships as `sˈɑːks` today —
the American vowel, claimed into PALM off the referee's `sɑːks` row with `sɒks` sitting beside it — and
is `sˈɒks` after. It appears twice in `csharp/goldens/en-GB.tsv`, so the guard's first visible effect is
to correct a golden rather than to churn one.

    PALM      567 → 543;  BATH/CLOTH/YOD/LOTR unchanged by the review fixes
    goldens   3 rows vs main, all improvements: `transported` → tɹɑːnspˈɔːtᵻd (BATH, referee-attested)
              and `socks` ×2 → sˈɒks (PALM guard dropping an American claim)
    suite     6,128 tests;  parity 189 byte-identical;  `--check` fresh
