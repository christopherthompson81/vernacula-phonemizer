# en: the de-/re-/pre- prefix-vowel families (#1397)

CMUdict disagrees with itself about whether the unstressed prefix vowel is tense (`IY0` → `ɹi`) or
reduced (`IH0`/`AH0` → `ɹᵻ`), **inside single paradigms**:

    retrieve R IH0   retriever R IY0   retrieved R IY0   retrieving R IY0
    precise  P R IH0                   precision P R IY0

The difference is audible — `ɹipɹˈiːv` against `ɹᵻpɹˈiːv` — so this is not the `AH0`/`IH0` notation
pair, which both render `ᵻ` and which `normalise` therefore merges.

## Run 1 — 2026-09-22 — the family boundary, printed rather than counted

#1397 is explicit that the boundary is part of the work: four definitions gave 86, 57, 77 and 33
families, **and the issue was filed on one of the wrong ones.** Implementing the fourth (keep the
prefix; stem in a loop with a floor of prefix + 4; require the remainder to be a plausible suffix chain)
and printing the groups rather than reconciling the count:

    de-/re-/pre- words with an unstressed prefix vowel   3,391
    families with 2+ members                               646
    ⚠ INTERNALLY SPLIT on tense vs reduced                  62   (209 words)

Most read as real paradigms. **Two do not:** `rehear` swallows `rehearse`, and `reformat` swallows
`reformatory` — the remainder `se` decomposes into the suffixes `s` + `e`. A suffix grouper cannot know
those are different words, so the ARBITRATION is the decider and a false family abstains; neither
survived the agreement test.

## Run 2 — ⚠ ESPEAK CANNOT ARBITRATE THIS CLASS, AND A RECORDED MEASUREMENT RESTS ON THE ASSUMPTION THAT IT CAN

#1397's step 2 is "take espeak + gold + Moby and pick the majority".

    espeak en-us over 848 words:  tense 0   reduced 658   neither 190

**espeak never writes the tense vowel. Its vote is a constant.** It has no tense/reduced distinction for
this prefix, so it agrees with any reduced answer and disagrees with any tense one, whatever the word.

⚠ **THAT BEARS ON A NUMBER ALREADY IN THE REPO.** #1378 item 4 recorded that espeak "backs the agreed
form on 27 of 35 rows", and #1397 repeats it. All 104 prefix rows the curated layer had applied move
**tense → reduced**, so that statement says only that 27 of those agreed forms were reduced. The APPLIED
rows are unaffected — their notes cite `gold+Moby` — but the plan built on the number is.

⚠ **AND misaki `us_gold.json` IS NOT ON THIS MACHINE.** Of the three sources the issue names, one is
uninformative and one is absent. The arbitration rests on **Moby alone**, which does discriminate:
`retrieve r/I/` reduced against `repress r/i/` tense.

## Run 3 — what one source can honestly settle

    split families                        62
      Moby covers at least one member     59
      and is INTERNALLY CONSISTENT        34
      ⚠ settled on TWO OR MORE members    14      → 26 rows

⚠ **34 IS NOT THE SHIPPABLE NUMBER.** The gap between 34 and 14 is families Moby covers on ONE member —
`re:rebuff` on 1 of 4, `de:debrief` on 1 of 4. A single word's vote is not a family verdict.

⚠ **AND THE TWO DIRECTIONS BOTH OCCUR, which is why this is arbitrated per family rather than by a
blanket "Latinate re- reduces" rule**: `prescriptive*` and `preserver*` go tense → reduced, while
`devaluate*` and `precess*` go reduced → TENSE, because Moby says so for each.

### ⚠ AND THE FIX UNLOCKED A CORRECT en-GB MEMBERSHIP, WHICH IS CORROBORATION FROM OUTSIDE THE ARGUMENT

`en-gb-cloth.tsv` gains `revolve`:

    referee   revolve  ɹɪvɒlv
    before    ɹivˈɔːɫv   — tense prefix, so the CLOTH edit ɔː→ɒ produced ɹivɒlv and matched nothing
    after     ɹᵻvˈɒɫv    — reduced prefix, folds to ɹɪvɒlv, and the referee attests it

The wikipron UK referee plays no part in the arbitration — different variety, never asked — so a source
outside the argument now agrees with us on a word it could not before.

### The predicted cost, arriving as predicted

#1397 said in advance: *"Expect new KNOWN_GAPS in en-curation-gap.test.ts: the model is trained on
upstream and recalls the inconsistency."* Two: `prescriptive` and `devaluate`, moving in **opposite**
directions, both source N, both closing on the next retrain.

## Run 4 — 2026-09-22 — review round: I destroyed 339 lines of irreplaceable prose

### ⚠ THE RE-SORT DELETED THE CURATED FILE'S ENTIRE COMMENTARY

Applying the rows by rebuilding the file as `header + sorted(data rows)` dropped **339 comment lines**,
369 → 30. Review checked them against the rest of the tree: **315 of 315 exist nowhere else in the
repo.** Lost blocks included the velar-nasal measurement, the `-lly` geminate's 708-to-5, the
two-referee selection rule, and — most costly — every record of a DELIBERATE ABSENCE: `bancroft`
("recorded here so the next reader does not spend the edit a second time"), `unnaturally`, `ia`,
`bengals`, `cham`, the dropped `-zz-` candidates.

**The concrete failure is not the missing prose, it is that the next sweep re-derives `bancroft` from
the referee evidence, adds the row the comment says would be INERT, and nothing in the tree contradicts
it.** The file's own header calls itself "the record that makes that loss visible and recoverable",
which the deletion falsified. Restored from `main` and the new rows appended as a block, the way
`covid` and `rr` were: 43 insertions, 2 deletions.

### ⚠ AND THE GUARD AGAINST ORPHANS TOOK THREE VERSIONS, EACH DEFEATED BY THE FAMILY BOUNDARY AGAIN

Review found that the first pass moved `prescriptive`, `prescriptively` and `prescriptiveness` to
reduced and **left `prescriptivist` tense** — a change whose every note reads "family consistency",
INTRODUCING a split that did not exist before it. Fixing it took three goes:

1. **add the missing suffixes** (`ist`, `ative`, `ivity`, `ology`) — necessary, not sufficient;
2. **check each FAMILY stays internally consistent** — cannot see it: `prescriptivist` keys to
   `pre:prescriptiv`, a family of ONE, because `ist` strips before `ive` can, and **a one-member family
   cannot be inconsistent**;
3. **check PAIRS** — still cannot see it, because `prescriptivist` does not `startsWith` `prescriptive`:
   the e-drop. Both forms are now tried with a trailing `e` removed.

Only then did the tool report `prescriptive R vs prescriptivist T`, and the fix it forced was to extend
a settled family by relatedness before applying. **Three iterations, all of them the same lesson this
class keeps teaching: the boundary is the measurement.**

⚠ **AND `IY2` WAS BEING DROPPED SILENTLY.** `loadPrefixWords` loaded only `IY0`, so
`precipitously P R IY2` was invisible while `precipitous`/`precipitousness` were "fixed" — the family
stayed split and the tool could not report it. A secondary-stressed tense prefix is the same contrast
wearing a different digit. `IY1` stays out: a primary-stressed prefix is a different word shape.

⚠ **AND `isPlausibleInflection` COULD NEVER FIRE AS CALLED.** Its comment claimed to be "the fourth
definition's whole content"; measured, **0 of 2,979 words were filtered**, because the stem is derived
from the word by stripping that same list in that same order. What actually keeps `debar` from
swallowing `debark` is the `prefix + 4` FLOOR. The comment said so wrongly, and the investigation
inherited the misattribution — both corrected, because someone relaxing the floor on the belief that
the check is the backstop would get false families back silently.

### And the arbitration is a committed tool now

`tools/english/en_prefix_arbitrate.mts`. Review's point is exactly right: **this PR's whole argument is
that an unaudited source was being trusted, so the arbitration step is the one that most needs to be
re-runnable.** It prints the espeak measurement under `--espeak`, the Moby verdicts, and refuses to
emit while any related pair would disagree.

### What is left, and what it needs

    62 split families → 14 settled → 48 open

13 where Moby itself is split, ~33 where it covers fewer than two members, 2 that are not families.
**They want misaki `us_gold.json` — the one source #1397 names that discriminates and that we do not
have — and not more work on the grouper**, which is not what is blocking.
