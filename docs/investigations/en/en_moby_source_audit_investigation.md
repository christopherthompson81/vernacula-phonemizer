# The Moby/gold source audit — the consensus signal is exhausted

The loop this continues: run the triple-source audit, take the words where two independent sources agree
against our CMUdict-derived dictionary, correct the lexicon, and retrain the BiLSTM once the corrections
amount to a real bump in data. #1338 took ~500 corrections on that rule; #1344 imported 16,227 Moby
headwords the dictionary lacked. This is the next round.

Baseline before anything, `tools/referee-eval/eval.ts en --jobs 8`:

    wikipron eng_latn_us broad [PRIMARY, independent]   61.7%  (4,046)   67.0% +intentional
    Moby — words the dictionary carries  [secondary]    74.2%  (35,202)  79.9% +intentional
    Moby — words it does NOT carry       [secondary]    36.0%  (41,276)  40.4% +intentional

## Run 1 — 2026-09-18 18:40 — 271 candidates, and they cluster

    MOBY=/mnt/data/moby/mobypron.unc GOLD=…/misaki/data/us_gold.json \
      npx tsx tools/english/en_source_compare.mts

    triple-sourced frequency words: 19,439
      all three agree:                15,598 (80.2%)
      gold AND Moby agree AGAINST us:    271 (1.4%)     ← the candidate pool
      split / no majority:             3,570 (18.4%)

By the shape of the disagreement, the pool is not noise — the largest single class is one morphological
pattern:

    42  multi-phone (2)              35  segment-count differs
    18  AY→AH   ← unstressed Latinate `di-`: diverse, divert, diversion, digestive, dilute, dissect…
    14  IY→AH   ← `pre-`/`com-pre-`: comprehensive, comprehension, precarious, retriever
    14  IH→IY   ← the SAME prefix in the OPPOSITE direction: predict, precisely, predictable

⚠ **`pre-` APPEARS IN BOTH DIRECTIONS**, which is the first sign the pool is not a list of defects.

## Run 2 — 2026-09-18 18:45 — our own dictionary IS internally inconsistent, and that is not the same as wrong

    divide D IH0    division D IH0    divided D IH0    divisive D IH0    divine D IH0   dissolve D IH0
    divert D AY0    diverse  D AY0    diversion D AY0  divergence D AY0  digest D AY0   dissect  D AY0

Same prefix, same unstressed position, two readings — `dɪvˈaᶦd` against `daᶦvˈɝs`. That looked like a
clean selection defect in the CMUdict import, and gold+Moby agree on the reduced form for every one of
the `D AY0` half. ⚠ **AND THE OBVIOUS SWEEP WOULD HAVE BEEN WRONG.** Merriam-Webster lists `dī-` FIRST
for `digestive`, `digestion` and `dilute` while gold and Moby give `də-` for all of them, so the class is
not uniform in the direction the audit points.

## Run 3 — 2026-09-18 18:50 — the independent referee sides with US, 11 to 4

The audit's rule is "gold AND Moby agree against us", and both are DICTIONARIES. The wikipron referee is
the independent one, and it covers 16 of the 271:

    sides with US (11)  minority alien julian syrup shea abdomen amour cumin scallop shamanism mandala
                        oxymoron
    sides with gold+Moby (4)  a (ours is a declared intentional) · iran · madeleine · ponce

## Run 4 — 2026-09-18 18:55 — and the RECORDINGS side with us 4 out of 4

The repo's own tie-breaker when dictionaries conflict (#1280, #1289). `align.sqlite`, en_us + en_gb,
2,602 utterances — thin coverage of this pool, but unambiguous where it lands:

    divergence   d aɪ v ɚ dʒ ə n s   ×2      ours daɪ ✓     gold+Moby də ✗
    digestive    d aɪ dʒ ɛ s t ɪ v   ×2      ours daɪ ✓     gold+Moby də ✗
    minority     m aɪ n oː ɹ ɪ ɾ i           ours maɪ ✓     gold+Moby mə ✗
    catholic     k æ θ l ɪ k         ×5      ours 2-syll ✓  gold+Moby 3-syll ✗

⚠ **EVERY WORD THIS ROUND'S TWO INDEPENDENT ARBITERS CAN REACH CONFIRMS THE READING WE ALREADY HAVE** —
15 of the ~20 checkable candidates, and 4 of 4 on recordings.

## What this round concludes

⚠ **THE CONSENSUS SIGNAL IS EXHAUSTED, AND APPLYING THE 271 WOULD BE A NET REGRESSION.** #1338 took the
real corrections; what is left at 1.4% is not a residue of defects but a systematic REGISTER axis. Both
gold and Moby are dictionaries, and dictionaries record the careful-speech reduced Latinate prefix
(`dəˈvɜːrdʒəns`) where read speech uses the spelling pronunciation (`daɪˈvɜːrdʒəns`). Our lexicon is
CMUdict-derived, and CMUdict came from read speech — so on this axis it is our source that matches the
recordings and the two referees that do not.

⚠ **AND THE BiLSTM RETRAIN HAS NOTHING TO TRAIN ON.** The premise was "retrain once the corrections are a
big enough bump". This round yields ZERO defensible corrections against #1344's 16,227 imported
headwords. A retrain now would re-learn the same dictionary and cost a fleet-wide golden regeneration for
no measurable gain.

## Where this leaves the loop

  1. Nothing to apply, nothing to retrain. The lexicon is unchanged by this round.
  2. The `di-`/`pre-` axis is a MEASURED notation difference, not an error, which is exactly what the
     referee config's `intentional` mechanism is for. Declaring it would move the reported Moby number
     without changing a single reading — score accuracy, not score inflation, and the recordings are the
     evidence. Not done here: it needs its own sizing, and an `intentional` class declared on four
     arbitrated words would be over-claiming.
  3. If more corrections are wanted, the source has to change. The candidates this rule can still find
     are ones where BOTH dictionaries share a convention we do not — which the recordings say is
     usually them. A recordings-first sweep over the frequency list is the instrument that would
     actually find defects; its limit is coverage (2,602 English utterances).


## Run 5 — 2026-09-18 19:05 — the OOV corpus, mined by grapheme, and two Moby DATA defects

The correction loop being exhausted (Runs 1–4), the question became whether Moby has anything else to
give. It does, in the OOV tier — 41,276 rows at 36.0%, the largest and least-examined corpus we have.

Scored every row through the shipping path (`phonemizeEnNeural`) with the eval's own `makeFold`, which
reproduced its number EXACTLY (14,842/41,276 = 36.0%), then ranked grapheme classes by EXCESS failures
over the 64% baseline rather than by folded-form pair, which only ever yields singletons:

    -ness  n=1590  fail 100%      -ally  n=450  fail 98%
    -ess   n=1715  fail  99%      -lly   n=532  fail 97%

⚠ **A 100% FAILURE RATE ON THE MOST REGULAR SUFFIX IN ENGLISH IS NOT A DEFECT, IT IS AN INSTRUMENT
FAULT.** Both classes are Moby's own data, carried faithfully by the builder:

    kindness      'k/aI/ndn/I/s              → nɪs
    abidingness   /@/'b/aI/d/I//N/n/E/s      → nɛs
    aboriginally  ,/&/b/@/'r/I//dZ//@/n/-/ll/i/  → əlli   (a geminate /ll/)

## Run 6 — 2026-09-18 19:10 — establishing that each fix is MOBY'S inconsistency, not our disagreement

That distinction is the whole difference between repairing a referee and neutering one, so both were
argued from Moby's own behaviour before anything was changed.

**`-ness`.** Tallying the vowel Moby writes in every unstressed suffix:

    -ness   EH 1622   IH 146        ← the only one written with a full vowel
    -less   IH  209   EH  34        ← the phonologically IDENTICAL shape
    -age    IH  334      -ous  AH 1693

So the suffix is reduced everywhere in Moby except here. Mapped to `IH0` — MOBY'S OWN other spelling of
the same suffix — not to our schwa, which keeps the claim minimal and leaves the ə/ɪ axis to the
`intentional` class that already declares it.
⚠ CONDITIONED ON THE SYLLABLE BEING UNSTRESSED: `dungeness`, `inverness` and `sultaness` carry a real
stressed `/E/` there, and folding those would be a genuine loss.

**Geminates.** 1,031 rows carry an identical adjacent consonant pair, 694 of them `LL`. The engine's OOV
paths finish every reading through `collapseGeminates` and so cannot emit one — the FORCE→NORTH argument
already in the builder, applied to a second class.
⚠ **AND IT IS OOV-ONLY, WHICH THE FIRST DRAFT WOULD HAVE GOT WRONG.** The DICTIONARY path does not
collapse: 144 `g2p-dict.tsv` rows carry a real geminate (`backcourt`, `barroom`, `blackcap` — compound
seams), so in the LEXICON file the engine has freedom here and a blanket fold would hide a real
difference. Verified after the rebuild: `barroom` keeps `bɑɹɹum` in the lexicon file.

⚠ **AND THE `-ness` FIX COSTS US ROWS, DELIBERATELY.** Our own dictionary writes `EH2` on that suffix for
`carefulness`, `faithfulness`, `awesomeness` and five others — rows that passed only because Moby had the
same full vowel. They now fail. That is the referee reporting our defect instead of agreeing with it, and
it is the reason to prefer this over a fold that would have credited us for both sides being wrong.

## Run 7 — 2026-09-18 19:20 — measured

Rebuilt; row counts identical (35,202 / 41,276), so nothing was added or dropped — only corrected.

                                  before    after
    primary wikipron (untouched)   61.7%    61.7%     ← unchanged, as it must be
    Moby lexicon  +intentional     79.9%    80.1%
    Moby OOV      bare folded      36.0%    36.7%     +318 rows (the degemination)
    Moby OOV      +intentional     40.4%    44.0%     +1,514 rows

The bare number moves only by the degemination and the `-ness` credit lands in `intentional`, which is
exactly what normalising to Moby's `IH` rather than to our `ə` was chosen to do.

⚠ **THE POINT IS THE UNMASKING, NOT THE POINTS.** Re-mining the repaired corpus, the 97–100% classes are
gone and what is left is flat and plausible — `-es` (486, 91%), `-ia` (950, 71%), `-ne`, `-is`, `-ine`,
`-ra`, `-na`, `-ta`, `-os`: the classical and proper-noun final vowels the OOV tier is documented to be
made of, plus a possible real `-es` class. That is a list worth working; the old one was a list of two
transcription bugs wearing 4,000 rows as a disguise.

Full suite 316 files / 6,062 tests green; 189 languages, 36,495 golden rows, 0 stale (no engine change).


## Run 8 — 2026-09-18 19:45 — mining the LEXICON residual, and what the blocks turn out to be

Same method as Run 5, against the lexicon file and the `+intentional` line: 35,202 rows, 28,204 credited,
**6,998 residual** (reproduced the eval exactly, intentional crediting and all). Ranked by edit shape:

    same length (pure substitution) 4,103   |   length differs 2,895
    of the first, exactly ONE symbol differs: 3,035

    520  ɪ → i     258 of them before ɹ, 103 in `-ing`
    220  ɛ → æ     216 before ɹ — MARRY–MERRY, deliberately left visible by the builder
    189  ŋ → n     160 before k, 26 before ɡ
    174  ɔ → ɑ     cot–caught, already refused as a class

⚠ **THE TOP BLOCKS ARE AXES, NOT DEFECTS — AND THEY DO NOT ALL RESOLVE THE SAME WAY.** Three were run
through the bar `RefLang.intentional` sets ("evidence that WE ARE RIGHT, not merely that we disagree"),
which is the bar the `ɔ`/`ɑ` pair already failed.

## Run 9 — 2026-09-18 19:55 — one declared, one refused, one turned out to be ours

**`-ing` → a BUILDER fix, not a class.** Moby writes the suffix `/I//N/` 1,264 times and `/i//N/` 230 —
`king`, `sing`, `ring`, `thing`, `building`, `farming`, `running` all in the majority, `alarming` not.
15% scatter with no environment, so it is the `-ness` finding again and belongs in the builder.

**NEAR vowel `i`→`ɪ` before `ɹ` → DECLARED.** It passes the bar the cot–caught pair failed, by the same
test: ⚠ MOBY DOES NOT RECORD THE DISTINCTION — `iɹ` 349 rows, `ɪɹ` **zero** — so its `i` is a convention,
not a per-word judgement. wikipron backs us at 76.9% (40 against 12, diphthong offglides excluded; the
naive count says 60/12 and is contaminated by `baɪɹi`-shaped rows). Scoped to the environment, because a
bare `i`→`ɪ` would credit all 520 rows including real defects — which needed a new `nextIs` field on the
intentional schema.

**VELAR `n`→`ŋ` → REFUSED as a class.** wikipron backs us 71% (82 against 33), which looked sufficient.
⚠ BUT MOBY RECORDS IT: `ŋ`+k/ɡ 556 against `n`+k/ɡ 302. Lexical disagreement, neither side shown right —
the cot–caught ground exactly. And our own dictionary is split the same way, 2,424 `NG` against 924 `N`.

## Run 10 — 2026-09-18 20:05 — arbitrating the velar anyway, and finding it is OUR defect

Refusing the class is not the same as not knowing the answer, so the 189 rows were arbitrated per word.

    wikipron covers 7:  backs US 2 (dunkirk, increment)
                        backs MOBY 5 (bancroft, inclination, unclean, unconditional, unquestionable)

Four of the five are transparent `un-`/`in-` boundaries, which is the phonological rule: velar
assimilation is obligatory WITHIN a morpheme and blocked across a transparent prefix boundary. The split
is 148 of 189 at a prefix (115 productive `un-`/`in-`/`non-`, 33 lexicalised `con-`/`en-`/`syn-`).

The recordings settle it — 15 to 2 for `n`:

    income n×4 ŋ×1   increase n×4   uncomfortable n×2   increasingly n×4   incredible ŋ×1   conclude n×1

⚠ **AND CMUdict ALREADY ENCODES THE DISTINCTION CORRECTLY:**

    bank NG    uncle NG    anchor NG    finger NG          ← assimilation applies
    unclean N  income N    increase N   conclude N         ← assimilation blocked

So the dictionary is right, all three referees agree with it, and the defect is ours: an UNCONDITIONED
rule at `englishArpabet.ts:494` rewriting every `N` before `K`/`G` to `ŋ`, destroying a distinction the
lexicon had already made. ⚠ AND IT HAS NO COMMENT, which in this file is itself a signal.

⚠ **THE CODE IS NOT THE WHOLE FIX, WHICH THE FIRST ATTEMPT AT IT MISSED.** Disabling the rule changes
nothing: `unclean` still reads `əŋklˈiːn`, because `data/languages/english/accent-lexicon.tsv` is a
GENERATED layer with the `ŋ` already baked in (`conclude` → `kəŋklˈuːd`), and it is consulted before the
ARPABET path. 3,466 of its rows carry `ŋ` before a velar. The fix is the rule PLUS a regeneration of that
artifact PLUS the goldens that follow — a separate change from this referee work, and one worth its own
before/after.

## Standing state

    primary wikipron   folded 61.7% (unchanged)   +intentional 67.0% → 67.2%
    Moby lexicon       folded 74.2% → 74.5%       +intentional 79.9% → 81.2%
    Moby OOV           folded 36.0% → 36.9%       +intentional 40.4% → 44.9%

⚠ The bare `folded` number on the PRIMARY is untouched, which is the one every floor is set against.

## Run 11 — 2026-09-18 20:40 — the velar fix, and why it is a CONDITION and not a deletion

The finding of Run 10 turned into a change. Three things had to be right, and the first draft of each
was wrong.

⚠ **THE RULE CANNOT SIMPLY BE DELETED, WHICH THE FIRST ATTEMPT ASSUMED.** "CMUdict already encodes the
distinction" is true of the 2,424 `NG` rows and of the prefix cases, but not of everything: 346 of the
923 `N`-before-velar rows are slips on TAUTOMORPHEMIC words — `anglophile`, `anglophone`, `ankh`,
`ancona`, `agincourt` — where the rule is the only thing producing the right reading. So it is a REPAIR
with an over-application, and the fix is a condition:

    !(i <= 3 && TRANSPARENT_PREFIX.test(word))     un|in|non|con|en|syn|down|trans

⚠ THE INDEX GUARD IS WHAT MAKES THE SPELLING TEST SAFE. Only a nasal inside the prefix is exempt, so
`unkink` keeps its second one: `ənkˈɪŋk`. Verified in the diff.

⚠ **THE C# PORT CARRIES THE SAME RULE** (`EnglishArpabet.cs:350`) and the goldens are the parity gate,
so it was mirrored. Parity after: 189 languages byte-identical, 0 differ.

⚠ **AND THE HETERONYM TABLE HAD ITS OWN FROZEN COPIES.** `concrete`, `incline` and `increase` are
consulted BEFORE the lexicon, so the rule fix could not reach them and `increase` still read `ˈɪŋkɹiːs`
after everything else was corrected. Three rows in `english.jsonc`, now `n`.

### The measured result

    accent-lexicon.tsv    545 rows rewritten (round-trip was 100.00% clean beforehand, so every
                          changed row changed BECAUSE of the rule)
    goldens               42 rows across 7 languages, all `include`/`incubator`/`incomplete`
    C# parity             189 byte-identical, 0 differ
    regex-diff            144,302 probes identical, 0 DIFFER

                       folded            +intentional
    primary wikipron   61.7% → 61.9%     67.0% → 67.4%
    Moby lexicon       74.2% → 74.9%     79.9% → 81.6%
    Moby OOV           36.0% → 37.1%     40.4% → 45.3%

⚠ **THE PRIMARY'S BARE NUMBER MOVED, AND THAT IS THE ONE THAT MATTERS.** Everything before this run was
instrument repair and left 61.7% untouched by construction. This is an ENGINE change measured against
the INDEPENDENT referee, and it is the only part of this whole investigation that improved it.

### Three tests moved, and none of them was testing this

`inquiring`, `inquiry`, `inquiries`, `unencumbering` — all `in-`/`en-` prefixes, all now `n`. CMUdict
writes `N` for every one and Merriam-Webster agrees (`in-ˈkwī(-ə)r`, `in-ˈkəm-bər`). What those rows pin
is the `-ing` RHOTIC after a PRICE diphthong, `aᶦɹ`, which is unchanged — the example moved, the claim
did not. Expectations updated with that noted in place.

### Known miss, recorded rather than hidden

`increment` — wikipron reads `ŋ` and we now read `n`, because `in-` is not transparent there. One
lexicalised exception against a rule this regular is not worth a word list, and it is written into the
rule's comment so the next reader does not rediscover it as a bug.
