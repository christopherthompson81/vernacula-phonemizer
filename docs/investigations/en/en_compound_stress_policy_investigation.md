# The compound path's stress policy

`compoundSplit` in `src/languages/english/englishG2p.ts` ends with

    return full.parts.flatMap((p, idx) => (idx === 0 ? p : stressDown(p)));

— the first piece keeps its primary, every later piece is stressed down, **unconditionally**. #1379's
stress audit made that visible: 32 of the 59 curation gaps it opened have this single cause, because the
path fore-stresses `over|come`, `under|take`, `back|yard` and `con|volution` by construction while both
referees put the primary on the stem.

#1379 measured the obvious alternative — key the choice on `tools/gen/en-morph-boundary.tsv`'s kind, the
table #1360 built for exactly this consumer — over its own 233 candidates, and **refused to act on it**:

    prefix    → primary moves LATER 36,  EARLIER 19
    compound  → primary moves EARLIER 18, LATER 8

Two-thirds each way is not a rule. But that measurement is over the CANDIDATE set, which is by
construction the set of rows where our placement was wrong — failure mode (b), a population that cannot
answer the question asked of it. This document measures the policy where it actually runs: over every
word the compound path decodes, against the dictionary.

## Run 1 — 2026-09-20 10:20 — the refusal was made on the wrong population, and the answer flips

The harness is a VALIDATED COPY of `compoundSplit`'s DP that also returns the piece boundaries, so
alternative policies can be flattened and scored. ⚠ The copy is only trustworthy if it reproduces the
shipped path exactly, so that is checked rather than assumed: over an unbiased 1-in-15 sweep it
reproduces `decompose(w).phones` byte-for-byte on **1,955 of 1,989** compound-path words (98.3%). The 34
it does not are the documented gap — the real `compoundSplit` falls back to `morphDecode` for a final
piece of five or more letters and the copy has no access to the unexported `SUFFIXES` table. They are
EXCLUDED from the score rather than guessed at.

Population: dict words of six or more letters that the path decodes when held out, where the decode's
segments already match the dict row (so the only difference is stress) and the row is polysyllabic with a
primary. **905 words.**

    POLICY                                        matches the dictionary
    A  first piece keeps the primary  (SHIPPED)   722   79.8%
    B  last piece keeps it                        181   20.0%
    C  boundary kind, prefix+confix → last        761   84.1%
    D  boundary kind, absent → last               433   47.8%
    E  `prefix` → last, everything else first     764   84.4%   ← best

    WHICH PIECE THE DICTIONARY AGREES WITH, by the table's kind at the split
      (absent)   first   422   last    91   neither   6
      compound   first   205   last    11   neither   0        95% first
      suffix     first    63   last     4   neither   0        94% first
      prefix     first    29   last    71   neither   0        71% LAST
      confix     first     3   last     0   neither   0

## ⚠ #1379 REFUSED THIS ON A MEASUREMENT OVER THE CANDIDATE SET, AND THAT POPULATION CANNOT ANSWER IT

The refusal quoted `prefix → LATER 36 : EARLIER 19` and `compound → EARLIER 18 : LATER 8`, called
two-thirds each way "not a rule", and said the dictionary is the mechanism. Over the population the code
actually runs on, `compound` is **95%** first and `suffix` **94%** first — not 69%. The candidate set is
*by construction* the set of rows where our placement was wrong, so every kind looks near-even there no
matter how good a discriminator it is. **That is failure mode (b), committed in the very sentence that
lists the failure modes**, and the PR body flagged the measurement as one to attack.

The honest reading of both numbers together: the kinds agree with the shipped policy so strongly that
almost none of their rows can BE candidates, which is why they arrive at the candidate set thinned to
near-parity. The signal was in the rows the candidate set excludes.

⚠ **AND `confix` GOES WITH THE FIRST PIECE, NOT THE STEM.** Policy C folded it in with `prefix` on the
strength of the table's own stress column and lost 3 rows for it. The table says a prefix boundary leaves
the primary on the stem; it says nothing that survives measurement about confixes, of which there are
three here and all three are fore-stressed. Policy E keys on `prefix` alone.

Next: does E's +42 of 905 survive the full population, and what does it do to the 32 curation gaps #1379
opened with this exact cause?

## Run 2 — 2026-09-20 10:45 — the full population, and the data-free list beats the table

Run 1's harness constructs a fresh `createEnglishG2p` per word, which is why it sampled. A faster
version drops the per-word validation against `decompose` and uses the copy directly — the cost is a
known 1.7% (the `morphDecode`-on-last-piece fallback the copy cannot see), stated rather than hidden,
with the sampled harness kept as the authority for the headline. That runs the whole dictionary.

    FULL POPULATION — 19,411 words the compound path decodes, segments already matching the dict row

    A  first piece keeps the primary   (SHIPPED)          15,683   80.8%
    B  last piece keeps it                                 3,565   18.4%
    E  keyed on en-morph-boundary.tsv's `prefix` label     16,323   84.1%
    F  a closed prefix list on the FIRST PIECE'S SPELLING  16,765   86.4%   ← shipped
    G  the list OR the table                               16,805   86.6%

    BY THE TABLE'S KIND AT THE SPLIT
      (absent)   n=13,115   first 82%   last 17%
      compound   n= 3,429   first 96%   last  4%
      prefix     n= 1,617   first 29%   last 69%
      suffix     n= 1,210   first 95%   last  4%
      confix     n=    40   first 65%   last 30%

⚠ **THE DATA-FREE LIST BEATS THE TABLE, WHICH SETTLES A DESIGN QUESTION AS WELL AS A NUMERIC ONE.**
`englishG2p.ts` loads no data on purpose ("so it still ports trivially to C#"), and
`tools/gen/en-morph-boundary.tsv` ships in neither package — #1360 moved it out deliberately. So a
runtime lookup was never actually available, and the honest finding is that it would not have been worth
having: the table cannot speak to a word Wiktionary does not carry, which is most of what reaches an OOV
path, while a prefix list generalises to any word spelled with one. **The table found the class; the
list is how the engine expresses it.** G's extra 0.2 points is not worth an unshippable dependency.

### ⚠ The first list was fitted to the ranking and had to be cut back

A first version took the measured top of the per-first-piece ranking plus some plausible additions. Two
separate mistakes, both caught by measuring per entry rather than in aggregate:

- **`micro` is net −6.** `MICRO·chip`, `MICRO·wave`, `MICRO·film` are compounds, not prefixed forms, and
  the piece scores 45% for the stem. It was in the list on the strength of "it looks like a prefix".
- **`mono` and `semi` are never the first piece of a split at all**, so they were pure decoration, and
  `contra` has 7 rows, which is not a basis for anything.

And three entries had to be *refused* despite scoring high, because they are not prefixes: `sup` (100%,
n=25), `imp` (90%, n=39) and `van` (83%, n=78) are the splitter cutting a fragment or a surname
(`van|derbilt`). Encoding them fits the splitter's noise rather than English. The final list is every
bound prefix with a positive net and n ≥ 12 — seventeen entries, 86.4%, two words better than the
twenty-one-entry version it replaced.

### ⚠ The stressed prefixes are refused, and the measurement agrees with the phonology

`over` 57%, `super` 52%, `multi` 60%, `poly` 58%, `post` 56%, `tri` 50%, `pro` 49%. These carry their own
stress and behave like the first element of a compound as often as not. `over` alone is net +54, so a
purely arithmetic rule would take it; a coin flip does not belong in a rule, and `over·COME` stays a
dictionary row and a documented curation gap.

### What it cost, exactly

    curation gate   closed  miscue, neolithic, hypertrophy, psychosocial
                    opened  hyperspace, psychobabble, extraordinary
    goldens         1 row, cjy — `preload` ˈpriːˌloʊd → priːˈloʊd

⚠ **`hyper` AND `psycho` ARE WRONG IN BOTH DIRECTIONS AT ONCE, AND THAT IS THE ARGUMENT FOR THE RULE.**
`hypertrophy` haɪˈpɜɹtɹəfi and `psychosocial` ˌsaɪkoʊˈsoʊʃəl are stem-stressed and both referees say so;
`hyperspace` ˈhaɪpɚˌspeɪs and `psychobabble` ˈsaɪkoʊˌbæbəl are fore-stressed and both referees say so. No
setting of the list reaches all four. They are dictionary rows, which is what the dictionary is for.

⚠ **AND THE GOLDEN ROW WAS READ BEFORE IT WAS REGENERATED, WHICH IS HOW THE CHANGE WAS VINDICATED.**
`preload` is a POS-conditioned heteronym in gold — `{DEFAULT: pɹilˈOd, NOUN: pɹˈilˌOd}` — and the new
output is gold's DEFAULT. The golden had been carrying the NOUN reading, which is right for that row's
text (`preload=Template:…`) and is not what an engine with no heteronym entry for the word should
produce. The family confirms the class: our own `preheat`, `prepay` and `preset` are all stem-stressed
and `preview` (the noun) is not.

## Run 3 — 2026-09-20 11:05 — a pinned test broke, and the arithmetic criterion was the reason

The full suite caught one word:

    subreddit    sˈʌbɹɛd̬ɪt  →  sʌbɹˈɛd̬ɪt        test/english.test.ts, pinned since #1317's sibilant guard

`ˈsʌbˌɹɛdɪt` is right and the new output is wrong. `sub` is 68% stem and net +50, so the "every entry
with a positive net" criterion of Run 2 took it — **and that criterion is a scrape, not a rule.** A prefix
at 68% is being wrong on one word in three, and one of those words was already pinned by a test that
predates the change.

⚠ **`sub-` IS GENUINELY TWO PREFIXES, WHICH IS WHY IT SITS AT 68% AND NOT AT 94%.** The Latinate verbs
are stem-stressed — `sub·MIT`, `sub·TRACT`, `sub·DUE` — and the productive noun-former is not: `SUB·way`,
`SUB·set`, `SUB·text`, `SUB·reddit`. The dictionary is full of the first kind and an OOV path mostly meets
the second, so **the measured population under-represents exactly the class the rule will be applied to.**
That is a bias a bigger sample cannot fix.

So the criterion is now a stated floor — **the dictionary puts the primary on the stem for at least 74% of
the piece's rows, over at least 12 rows** — which drops `sub` (68%), `ultra` (68%), `hyper` (64%) and
`retro` (62%).

    17 entries, any positive net     86.4%
    13 entries, floor at 74%         86.0%      ← shipped;  against 80.8% before, +1,008 words

74 words of 19,411, and what it buys: `subreddit` is right again, `hyperspace` stops being a curation gap
(`hyper` is gone), and the rule states in one sentence instead of enumerating exceptions. `hypertrophy`
returns to the structural gap it was in before this change, which is the honest bookkeeping — the wide
list had closed it for the wrong reason.

⚠ The remaining `psycho` asymmetry is kept deliberately: `psychosocial` stem, `psychobabble` fore, both
with two referees agreeing, at 82% overall. One prefix cannot be both, so `psychobabble` is a dictionary
row and a documented gap. That is the shape every honest rule in this repo has.

    gate      closed  miscue, neolithic, psychosocial      opened  psychobabble, extraordinary
    goldens   1 row, cjy — `preload`, and gold's own DEFAULT vindicates it

## Run 4 — 2026-09-20 11:20 — ⚠ THE FAST HARNESS WAS WRONG AND IT PICKED THE LIST

Runs 2 and 3 quoted a 19,411-word population, 80.8% for the shipped policy and 86.4%/86.0% for the
list. The VALIDATED harness — the one that checks every word against the real `decompose` — says
**13,661 words, 78.8% and 83.1%** on the same dictionary. A 42% gap in the denominator is not rounding,
so the two were run head to head on one sample:

    sample 7,389 words
      the copy finds a split:            2,805
      real decompose says source C:      1,989      ← 816 fewer
      the copy reproduces src.phones:    1,987
      scored FAST 1,286   scored SLOW 955   fast-only 331

**The copy does not merely MISS splits, it FABRICATES them**, which is the opposite of what Run 1
assumed when it called the missing `morphDecode` fallback a 1.7% shortfall. The mechanism:

    adding   copy  AE1 D IH2 NG  (add|ing)      real  AE1 D IH0 NG  source M
    aiding   copy  EY1 D IH2 NG  (aid|ing)      real  EY1 D IH0 NG  source M

`compoundSplit`'s DP maximises MIN PIECE LENGTH first. For a word of five or more letters it may reach
the end as a **single piece** through `morphDecode`, and that path has `minLen = n`, which beats any
real split — so it wins the DP and then fails `nparts < 2`, and `compoundSplit` returns **null**. The
word goes to the morph path. A copy without `morphDecode` never generates the winning one-part path, so
it happily returns `add|ing` for a word the engine never routes through the compound path at all.

⚠ **SO THE FAST HARNESS'S POPULATION IS 26% WORDS THE POLICY WILL NEVER APPLY TO** — failure mode (b),
committed in a document whose Run 1 opens by accusing #1379 of exactly that. The validation was written
in Run 1 *because* a copy cannot be trusted, and then Run 2 dropped it for speed and quoted the results
anyway. Speed is not a reason to stop checking; it is a reason to sample.

    what survives   the DIRECTION. Validated: shipped 78.8%, prefix-keyed 83.1% — the same ordering,
                    the same size of effect, and the same decision.
    what does not   every absolute number in Runs 2 and 3, the per-prefix shares that set the 74%
                    floor, and the "+1,008 words" in english.jsonc. All re-derived below.

⚠ `subreddit` and the four curation-gap movements are unaffected: those came from the ENGINE, not from
either harness.

## Run 5 — 2026-09-20 12:30 — the clean measurement, and the decision it restores

Run 4 established that only the VALIDATED harness may be quoted. Two further contaminations had to be
removed before it could be:

⚠ **THE VALIDATED HARNESS IS CONTAMINATED BY THE CHANGE ITSELF ONCE THE CHANGE IS APPLIED.** It keeps a
word only when the copy reproduces `decompose(w).phones`, and the copy flattens with the SHIPPED policy —
so as soon as the engine stem-stresses a prefixed form, every word the policy affects stops reproducing
and is dropped as "unmeasurable". The count went 524 → 1,767 and the list measured as **+1 word of
12,815**. A harness that scores a policy must be run against the engine the policy replaces, so the
change was stashed and the run repeated on a clean tree.

    VALIDATED, FULL POPULATION, PRE-CHANGE ENGINE — 13,661 words

    A  first piece keeps the primary  (what shipped)   10,764   78.8%
    B  last piece keeps it                              2,779   20.3%
    E  keyed on en-morph-boundary.tsv's `prefix`       11,352   83.1%
    H  a closed prefix list on the first piece         11,460   83.9%   ← the decision

    prefix   n=1,497   first 455   last 1,042   ← 70% stem, the discriminator
    compound n=3,262   first 3,136 last   125   ← 96% first
    suffix   n=  868   first 804   last    52   ← 93% first

So the direction, the size and the ordering all survive: **the list beats the table, the table beats
doing nothing, and doing nothing is 78.8%.** Runs 2 and 3 reached the same conclusion from numbers that
were wrong in both directions at once — the fast harness inflated the denominator with fabricated splits
and the contaminated one deflated the gain to nothing.

### The criterion, restated on data that can carry it

Every piece the dictionary stem-stresses on ≥74% of its rows, over ≥12 rows:

    non 97% +133   dis 95% +166   mis 94% +76   extra 94% +15   radio 94% +14   neo 92% +10
    pre 89%  +81   trans 86% +15   photo 81% +10   psycho 81% +13   electro 78% +13
    anti 77%  +24   bio 77%  +19   inter 76% +73   arch 75% +6

⚠ **TWO ENTRIES WERE MISSING FROM THE LIST THE CRITERION DESCRIBES**, and that is failure mode (c) — the
prose was stronger than the code. `photo` (81%, n=16) and `arch` (75%, n=12) both clear it and had been
left out because the discredited harness scored them differently. Added. **`arch` closed `archduke`** —
the row #1379 had to waive — by rule rather than by a dictionary entry, which is what the rule is for.

⚠ **`sub` MISSES AT 73%, WHICH VINDICATES THE FLOOR RATHER THAN THE ARITHMETIC.** Run 3 dropped it
because it broke `subreddit`; the clean measurement puts it just under the line on its own. `sub-` is two
prefixes — Latinate verbs stem-stressed (sub·MIT), the productive noun-former not (SUB·way, SUB·set,
SUB·reddit) — and the productive kind is what an OOV path meets.

⚠ **THREE PIECES CLEAR THE CRITERION AND ARE STILL REFUSED**, stated in the data file rather than
silently: `van` (85%, n=73), `imp` (82%, n=22) and `outs` (88%) are the splitter cutting a surname
(`van|derbilt`) or a fragment. No phonological statement covers them and encoding them would fit the
splitter's noise.

### Final state

    engine     `compoundSplit` consults `stemStressPrefixes` — 15 entries, TS and C# both
    gate       closed  archduke, miscue, neolithic, psychosocial
               opened  psychobabble, extraordinary
    goldens    1 row, cjy `preload`, and gold's own DEFAULT vindicates it;  189 / 36,495 / 0 stale
    parity     189 languages byte-identical

### What this cost, and the lesson that is worth more than the 712 words

Four measurements were taken before one could be quoted. The first was over the candidate set (#1379,
failure mode (b)). The second dropped the per-word validation for speed and scored fabricated splits
(Run 4). The third was run against the patched engine and scored the policy on the words it does not
touch (this run). Only the fourth — validated, full population, clean tree — is usable, and it happens to
agree with the first two about what to do.

**Every one of the three bad runs was internally consistent and looked exactly like the good one.** The
only thing that separated them was checking the harness against the thing it was modelling, which Run 1
did, Run 2 stopped doing, and Runs 4–5 had to reinstate twice.
