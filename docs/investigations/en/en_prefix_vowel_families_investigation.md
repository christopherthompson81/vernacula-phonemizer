# en: the de-/re-/pre- prefix-vowel families (#1397)

CMUdict disagrees with itself about whether the unstressed prefix vowel is tense (`IY0` → `ɹi`) or
reduced (`IH0`/`AH0` → `ɹᵻ`), **inside single paradigms**:

    retrieve R IH0   retriever R IY0   retrieved R IY0   retrieving R IY0
    precise  P R IH0                   precision P R IY0

The difference is audible — `ɹipɹˈiːv` against `ɹᵻpɹˈiːv` — so this is not the `AH0`/`IH0` notation
pair, which both render `ᵻ` and which `normalise` therefore merges.

## Run 1 — 2026-09-22 — the family boundary, printed rather than counted

#1397 is explicit that the boundary is part of the work: four definitions gave 86, 57, 77 and 33
families, **and the issue was filed on one of the wrong ones**. Implementing the fourth (keep the
prefix; stem in a loop with a floor of prefix + 4; require the remainder to be a plausible suffix
chain):

    de-/re-/pre- words with an unstressed prefix vowel   2,979
    families with 2+ members                              560
    ⚠ INTERNALLY SPLIT on tense vs reduced                 51   (209 words)

⚠ **51, NOT THE ISSUE'S 33** — and rather than reconcile the numbers I printed the groups, which is the
standing rule for this class. Most read as real paradigms (`revolve/revolved/revolver/revolving`,
`retire/retiree/retirement`). **Two do not:**

    re:rehear    rehear rehearing rehearings  +  rehearsal rehearse rehearsed rehearses rehearsing
    re:reformat  reformat reformative  +  reformatories reformatory

`rehearse` is not an inflection of `rehear`, and `reformatory` is not one of `reformat`. My remainder
check accepted them because `se` decomposes into the suffixes `s` + `e`. **A suffix-based grouper
cannot know that `reformat` and `reformatory` are different words**, so rather than chase a perfect
grouper I made the ARBITRATION the decider and let a false family abstain — which is what happened:
neither survived the agreement test below.

## Run 2 — ⚠ ESPEAK CANNOT ARBITRATE THIS CLASS, AND A RECORDED MEASUREMENT RESTS ON THE ASSUMPTION THAT IT CAN

#1397's step 2 is "take espeak + gold + Moby and pick the majority". Measured over 745 of the 2,979
prefix words:

    espeak en-us:   tense (ɹi…)  0      reduced (ɹᵻ/ɹɪ…)  611      neither  134

    where OUR dict says IY0 (tense):   espeak tense 0   reduced 145
    where OUR dict says IH0/AH0:       espeak tense 0   reduced 466

**espeak never writes the tense vowel. Its vote is a constant.** It has no tense/reduced distinction
for this prefix, so it cannot corroborate a choice between them — it agrees with any reduced answer and
disagrees with any tense one, whatever the word.

⚠ **THAT BEARS ON A NUMBER ALREADY IN THE REPO.** #1378 item 4 recorded that espeak "backs the agreed
form on 27 of 35 rows", and #1397 repeats it. All 104 prefix rows the curated layer has applied move
**tense → reduced**. So "espeak backs it on 27 of 35" says only that 27 of those 35 agreed forms were
reduced; it is not independent corroboration and should not be read as any. The APPLIED rows are
unaffected — their notes cite `gold+Moby`, not espeak — but the plan built on that number is.

⚠ **AND misaki `us_gold.json` IS NOT ON THIS MACHINE**, so of the three sources the issue names, one is
uninformative and one is absent. **The arbitration rests on Moby alone**, which does discriminate:
`retrieve r/I/` reduced against `repress r/i/` tense.

## Run 3 — what one source can honestly settle

    split families                        51
      Moby covers at least one member     48
      and is INTERNALLY CONSISTENT        35
      Moby itself split                   13

⚠ **35 IS NOT THE SHIPPABLE NUMBER.** Many rest on ONE covered member generalised to a six-word family
— `re:rebuff` on 1 of 4, `de:debrief` on 1 of 4. A single word's vote is not a family verdict. Requiring
**two independent members to agree**:

    families settled by Moby on 2+ members   14
    rows changed                             22

Shipped: `revolve`/`revolved`/`revolves`/`revolving` → reduced (matching `revolver`/`revolvers`, which
already were), `prevention`/`preventer`, `prescriptive*`, `presumptive*`, `retiree`, `reflexively`,
`retaliatory`, `detractor`, `denominative`, `prevaricator`, `precipitousness`; and to TENSE:
`precess`/`precessional` (Moby 3/3) and `detoxication` (2/2).

⚠ **AND `revolve` WAS ALREADY CURATED, FOR A DIFFERENT REASON.** Appending a second row would have
CHAINED — the new row's `upstream` would have been the old row's output — which is #1334's defect and
exactly what `en-curation-gap.test.ts`'s "no word has two curated rows" exists to catch. Its existing
LOT/THOUGHT row was edited in place and its note now carries both reasons.

### The predicted cost, arriving as predicted

    expected [ 'prescriptive', 'prevention' ] to deeply equal []

#1397 said in advance: *"Expect new KNOWN_GAPS in en-curation-gap.test.ts: the model is trained on
upstream and recalls the inconsistency."* Two, both source N, both closing on the next retrain with the
rest of that tier.

### What is left, and what it needs

    51 split families → 14 settled → 37 open

- **13** where Moby itself is split across the family.
- **~21** where Moby covers fewer than two members.
- **2** that are not families at all (`rehear`/`rehearse`, `reformat`/`reformatory`).

⚠ **The remaining 37 cannot be settled by the sources on this machine.** They want misaki `us_gold.json`
— the one source the issue names that actually discriminates and that we do not have — and not more
work on the grouper, which is not what is blocking.

### ⚠ AND THE FIX UNLOCKED A CORRECT en-GB MEMBERSHIP, WHICH IS INDEPENDENT CORROBORATION

Rebuilding the en-GB lexical sets after the change: `en-gb-cloth.tsv` 898 → 899, and the new member is
**`revolve`**.

    referee   revolve  ɹɪvɒlv
    before    ɹivˈɔːɫv   — tense prefix, so the CLOTH edit ɔː→ɒ produced ɹivɒlv and matched nothing
    after     ɹᵻvˈɒɫv    — reduced prefix, folds to ɹɪvɒlv, and the referee attests it

**A third source that was never consulted about the prefix vowel now agrees with us on this word, and
could not before.** The wikipron UK referee plays no part in the arbitration above — it is a different
variety and was not asked — so this is corroboration arriving from outside the argument.

⚠ **AND THE SAME FAMILY IS STILL INCONSISTENT ON A DIFFERENT AXIS**: `revolver R IH0 V AO1 L V ER0`
against `revolvers R IH0 V AA1 L V ER0 Z`, AO against AA. That is the LOT/THOUGHT class — 161 rows by
the #1387 paradigm sweep — and is deliberately not touched here.
