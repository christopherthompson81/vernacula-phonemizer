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

## Run 12 — 2026-09-18 20:55 — review, and the two findings whose proposed remedies were wrong

Seven findings on the velar fix. Two are worth recording because acting on them as written would have
regressed the engine.

⚠ **THE SYMMETRIC GUARD WAS REJECTED, AND MEASURED BEFORE BEING REJECTED.** The observation is real —
the one-directional guard leaves CMUdict's own `NG` at a prefix boundary untouched, so ten families now
split (`increment`/`increments`, `conquest`/`conquests`, `engel`/`engels`, `incompetent`/`incompetents`,
`inconclusive`/`inconclusively`). But rewriting `NG`→n at the same boundary also reaches `congo`,
`congress`, `congregate`, `conga`, `english` and `uncle`, which are ŋ for everyone. The splits were
CMUdict disagreeing with ITSELF, so they are fixed in the dictionary.

⚠ **NARROWING THE PREFIX LIST MEASURES WORSE**, which is the opposite of what the individual misses
suggest. Over the 867 nasal+velar words the Moby referee covers:

    no rule at all              451/867  52.0%
    un|in                       561/867  64.7%
    un|in|non                   565/867  65.2%
    un|in|non|con               585/867  67.5%
    un|in|non|con|en|syn|down|trans  589/867  67.9%   ← shipped
    …plus the dict corrections       591/867  68.2%
    …plus an optional OUTER prefix   597/867  68.9%   ← final

So `congruent`, `syncope`, `encore` and `engel` are genuine misses of the spelling test, and the right
place for them is the DICTIONARY, not a narrower rule that costs more than it saves.

### What the review changed

  1. **Nine dictionary corrections**, each a CMUdict row that contradicted itself or had no live prefix:
     `conquests`, `engel`, `incompetents`, `inconclusively`, `increment` (which also closes the recorded
     wikipron miss), `congruent`, `congruence`, `syncope`, `encore`.
     ⚠ AND RECORDED IN `g2p-curated.tsv`, which the first pass forgot. That file exists because
     `en_g2p_ngram.ts --emit` regenerates the dict from upstream and silently reverts hand edits; every
     hand-correction PR since #1329 has paired the two, and this one now does.
  2. **An optional OUTER prefix** in `TRANSPARENT_PREFIX`, so a derived form cannot contradict its stem:
     `disengage` was dɪsɪŋɡˈeᶦd͡ʒ against `engage` ɛnɡˈeᶦd͡ʒ, `disincline` against `incline`. +6 rows.
  3. **Nine source-less lexicon rows hand-patched** — `incumbent's`, `concord's`, `inco's`,
     `uncharacteristically` and five more. `en_rebuild_lexicon.mts` passes rows with no ARPABET source
     through untouched, so these kept the pre-fix ŋ: the frozen-copy problem again, a third layer down
     after the generated lexicon and the heteronym table.
  4. `JsRegex.Compile` rather than `new Regex` in the C# port — the only raw Regex in the whole
     `Languages` tree, and it bypassed the dialect harness that proves the two ports agree.
  5. The vacuous null guards dropped from both ports: `word` defaults to `""` in TS and is non-nullable
     in C#, where the test was also producing three new CS8604 warnings. Build is back to 0 warnings.
  6. Two doc comments reattached to the declarations they describe, in both ports.

Final: goldens 2 further rows (`increment` in `nan`), C# parity 189 byte-identical, regex-diff 144,302
identical, 316 TS files / 6,064 tests, C# 6,687 tests, check:package clean.

## Run 13 — 2026-09-18 21:30 — two vowel blocks that dissolved, and the instrument bug underneath them

Working the residual by block. ⚠ **TWO OF THE THREE BIGGEST DID NOT SURVIVE MEASUREMENT**, and that is
the finding: after the velar fix, what is left of the lexicon residual is mostly AXIS, not defect.

**`-es` (486 OOV rows, 91% failing) — not productive.** The OOV half is real (classical `-es` is its own
syllable /iːz/) but it is `aeacides`, `aegicores`, `aesyetes`. The LEXICON half is 23 rows and almost all
false: Moby reads ENGLISH words as Latin — `comes` koʊmiz, `dares` dɛɹiz, `manes`, `tales`, `imagines` —
where our reading is the right one. Every common member of the class (`Socrates`, `Hercules`, `Achilles`,
`Hades`, `Archimedes`, `Aristophanes`, `Thucydides`, `Xerxes`, `Ramses`) was already correct. One real
defect: `Hippocrates`, which CMUdict read as the plural of a "hippocrate", hˈɪpəkɹˌeᶦts.

**The `re-`/`pre-` prefix vowel (83 frequency words) — an axis, not a defect.** Our dictionary splits 49
families arbitrarily (`predict` ɪ ×10 against `prediction`/`predictions` i; `prevent` 6 against 3), which
looked exactly like the velar's self-evidencing inconsistency. ⚠ **BUT BOTH REFEREES ARE SPLIT TOO** —
wikipron ɪ30/i25, Moby ɪ357/i252 — and normalising each family to its own majority measured
SCORE-NEUTRAL: Moby 10→10 of the 23 covered, and the single wikipron-covered row went 1→0. 72 rows not
changed, on the repo's own bar that a class needs evidence we are RIGHT, not merely that we disagree.

**And underneath them, a referee bug worth more than either.** Mining the length-differs bucket surfaced
rows that are not disagreements at all: `city` scored against `boʊʒɚ`, `peak` against `kɔɹkoʊvɑdoʊ`.
Moby has BOTH `City 'b/oU//Z//[@]/r` (a surname) and `city 's/I/t/i/`, and the builder lower-cased the
key and took FIRST-WINS — so the surname displaced the common noun. 565 headwords carry more than one
distinct reading once folded and 273 had a capitalised entry winning: `air`, `acre`, `airy`, `abbe`,
`alba`. ⚠ THE OLD COMMENT'S REASONING WAS SOUND FOR THE CASE IT ADDRESSED (variants of ONE word) AND
BLIND TO THIS ONE (two different lexemes). Case is the discriminator: our keys are lower-case common
words, so the lower-case entry wins and the capitalised reading is DROPPED rather than offered as an
alternative — crediting a surname's reading for a common noun would hide a real error. Genuine
same-case variants are still emitted tab-separated, which the eval credits any of.

## Run 14 — 2026-09-18 21:45 — how far the dictionary can be extended, measured

⚠ **THE DICTIONARY ALREADY COVERS ALL 40,000 FREQUENCY WORDS — zero gaps.** So extension means the tail,
and the import census says what is there:

    considered 123,211   already in dict 81,950   no gold 33,684   gold disagrees 7,411   importable 0

⚠ **THE DISAGREEMENTS ARE MOSTLY SUBSTANTIVE, NOT CONVENTION.** 6,170 of 7,453 differ in LENGTH, i.e. in
syllable count. The two-source bar was right to exclude them.

⚠ **BUT READING THEM, RATHER THAN COUNTING THEM, FOUND TWO THINGS A PASS/FAIL TEST CANNOT.**
  · The delta-1 bucket (4,565, the largest) is dominated by `-ian` as /iən/ against /jən/
    (`abbevillian` L IY ə N vs L Y ə N, `abelian` the same) and by weak vowels — DECLARED axes, so much
    of that bucket may be importable after all. Not taken here; it wants its own sizing.
  · Five Moby entries transcribe an initial `/dZ/` on a VOWEL-SPELLED word, where the palatal glide
    belongs: `Eurocommunism`, `unilocular`, `uninucleate`, `usucaption`, `Egan` — four of them directly
    before /u/ or /ʊ/. A word spelled with an initial vowel cannot begin with /d͡ʒ/. The converter is not
    at fault; it renders `/j/` correctly everywhere else. Fixed in the builder.

    eurocommunism  d͡ʒʊɚoʊkɑmjʊnɪzəm → jʊɚoʊkɑmjʊnɪzəm

### Shipped in this block

  · `Hippocrates` corrected (dict + curated).
  · `Euripides` and `Herodotus` ADDED — both were OOV and wrong (jʊɹˌɪpʰˈaᶦdz, hˈɛɹoᶷdˌɑːt̬əs with the
    stress on the wrong syllable), both carried by Moby AND gold, both recorded in `moby-import.tsv` so
    the referee excludes them rather than scoring us on a reading we took from it.
  · The case-folding collision and the initial-yod defect in the referee builder.

                       folded            +intentional
    primary wikipron   61.9% (unchanged) 67.4%
    Moby lexicon       74.9% → 75.0%     81.6% → 81.7%
    Moby OOV           37.1% → 37.2%     45.3%

⚠ THE SCORE BARELY MOVES AND THAT IS NOT THE POINT OF THE CASE FIX: most collisions shared a reading, or
we were wrong on both. What changed is that the instrument stopped asking about `city` and answering
"Bougère".


## Run 15 — 2026-09-18 22:10 — review: "lower-case wins" was the wrong fix, measured

⚠ **PREFERRING THE LOWER-CASE ENTRY FIXED `city` AND BROKE 63 OTHER ROWS.** Measured pass→fail against
fail→pass on the lexicon referee: 63 against 75. Roughly half our headwords ARE the capitalised lexeme,
and several lower-case Moby rows are TYPOS that the capitalised row gets right:

    cook       k/u/k          against  Cook      k/U/k              (ours kʊk — the lower-case row is wrong)
    charlie    't/S//A/rl/i/  against  Charlie   '/tS//A/rl/i/      (affricate written as two symbols)
    dalmatian  d/&/l'm/eI/sh/@/n       Dalmatian …/S//@/n           (a literal ASCII `sh`)
    canada     k/@/n'/j//A/d/@/        Canada    'k/&/n/@/d/@/      (Cañada)
    august     /O/'g/@/st              August    '/O/g/@/st         (the adjective, not the month)

⚠ **THE ANSWER WAS TO STOP DISCARDING READINGS, NOT TO CHOOSE BETTER ONES.** The eval credits ANY
tab-separated reading, so both cases are now emitted and nothing is picked. `city` gets `sɪti boʊʒɚ` and
is credited; `cook` gets both and is credited. 471 rows carry more than one reading.
⚠ The residual risk is named rather than hidden: where a surname and a common noun genuinely differ, the
row credits either, so a real error on one can hide. That is far narrower than the 63, and it is the
latitude every multi-variant referee row already carries.

    Moby lexicon   75.0% → 75.3%      +intentional 81.7% → 82.0%

### And the two hand-added headwords were reverted, for a better reason than the review gave

`euripides` and `herodotus` were put in `moby-import.tsv`, whose contract is "Moby AND gold agree" and
whose job is to be RE-APPLIABLE after an `--emit`. They cleared neither: the readings match neither
source exactly, so the generator would reject them. ⚠ AND CHECKING **WHY** THEY FAIL SETTLES WHERE THEY
BELONG:

    euripides  moby Y UH0 R IH1 P IH0 D IY2 Z   gold Y ER0 IH1 P AH0 D IY0 Z    UH0 vs ER0
    herodotus  moby HH IH0 R AA1 D AH0 T AH0 S  gold HH EH0 R AA1 D AH0 T AH0 S IH0 vs EH0

Both differ ONLY on an UNSTRESSED vowel — they are members of the 1,954-row class measured in Run 14,
which the import tool will take mechanically once it folds that axis. Hand-adding them now would have
pre-empted a rule with two exceptions. Reverted; they come back with the rest.

### Also from the review

  · `fixInitialYod` is now gated on a following /u/–/ʊ/. Ungated it also rewrote `Egan /dZ//oU/gz` — a
    MISALIGNED row whose body belongs to another headword — laundering obvious garbage into a
    plausible-looking wrong reading. The four real entries are all before the yod's vowel.
  · The diagnostic counted headwords appearing in BOTH cases (1,759) while claiming to count
    DISPLACEMENTS (~230). It now counts rows that actually carry more than one reading: 471.
  · The emitted header no longer claims "one reading per headword".

## Run 16 — 2026-09-18 23:00 — the unstressed-vowel import, and the three things QC caught

The extension measured in Run 14, built. `en_import_moby.mts` now folds vowels the sources THEMSELVES
mark unstressed before comparing, and takes GOLD's reading where they agree only after that fold —
Moby's unstressed vowels being the unreliable half, as its own `-ness` rows (1,622 `nɛs`) demonstrate.

⚠ **THREE THINGS WENT WRONG AND EACH WAS CAUGHT BY A DIFFERENT GATE.** None of them by the headline
number, which is the point of having the gates.

**1. The fold merged a RHOTIC away — caught by reading the QC sample.** `ER0` reduces to the same symbol
as `AH0`, so on `squiredom` Moby's `S K W AY1 ER0 D AH0 M` and gold's `S K W AY1 AH0 D AH0 M` — gold
simply dropping the /r/ of `squire` — "agreed", and the import would have taken the r-less reading.
`en_source_compare.mts` already states the rule this broke: "ɚ against ə is a real distinction, not a
notation one". ER excluded; 1,960 → 1,874.

**2. The manifest DELETED the previous import — caught by the referee corpus size.** A word imported by
an earlier run is in `g2p-dict.tsv`, so `have` skips it and it never reaches `rows`; writing `rows` over
`moby-import.tsv` therefore dropped all 16,227 rows of #1344, leaving 1,874. ⚠ NOTHING IN THE DICTIONARY
CHANGED, SO THE LOSS WAS SILENT THERE. It surfaced as the lexicon referee jumping 35,202 → 51,429,
because the builder reads that file to exclude imported words and they had stopped being listed. The
manifest is now the UNION: 16,227 carried forward + 1,874 new = 18,101.

**3. Two rows dropped an ⟨r⟩ — caught by `en-missing-rhotic.test.ts`.** `cahier` and `zabrze`, and both
turned out to be legitimate silent-⟨r⟩ under rules the allow-list already names (French `-ier`, Polish
`rz` = /ʒ/), so they joined it rather than being excluded. That test is an allow-list of NAMED RULES
precisely so this decision has to be argued.

⚠ **AND ONE ALARM WAS FALSE, CHECKED BEFORE ACTING ON IT.** The goldens moved `Toscana` from
`tʰˌɔːskˈænə` to `tɔːskˈɑːnə`, which looked like a STRESSED vowel changing — something the fold must
never do. Tracing it: Moby `T AO0 S K AA1 N AA0` against gold `T AO0 S K AA1 N AH0` differ only in the
final unstressed vowel, and the large output change is OOV → DICTIONARY, the old reading being the OOV
path's guess. Likewise `Enceladus` ɛn→ən is gold's reduced initial, which Merriam-Webster gives as
\in-ˈse-lə-dəs\. Both improvements.

### Measured

    imported                1,874 headwords (manifest 16,227 + 1,874 = 18,101)
    g2p-dict.tsv            133,712 → 135,586 rows
    goldens                 5 languages, 9 rows — all embedded English runs
    C# parity               189 byte-identical, 0 differ

                       folded             +intentional
    primary wikipron   61.9% → 62.0%      67.4%
    Moby lexicon       75.3% (unchanged)  82.0%
    Moby OOV           37.2% → 38.1%      45.4% → 45.5%

⚠ **THE OOV NUMBER IS NOT COMPARABLE ACROSS THIS CHANGE** — the same caveat #1344 carries. Its
population went 41,276 → 39,402 because the imported words leave the corpus, and they were words the OOV
path was guessing at, so removing them raises the rate mechanically. ⚠ THE PRIMARY IS THE ONE THAT
SPEAKS: 61.9% → 62.0%, on a referee that knows nothing about either source.


## Run 17 — 2026-09-18 23:45 — review: the fold was merging READINGS, not just notation

Five findings, and two changed the import materially.

⚠ **THE FOLD MERGED THE DIPHTHONGS, WHICH IS A READING DIFFERENCE.** `reduceUnstressed` collapsed twelve
qualities into one, so it accepted 501 rows where the two sources disagree `AH0` against `OW0` at an
unstressed slot — `acanthocephalan` Moby `TH AH0 S`, gold `TH OW0 S`. A diphthong is a different vowel,
not a different way of writing the same one. Restricted to monophthongs: **1,874 → 1,395**.

⚠ **AND THE COMMENT'S EMPIRICAL CLAIM WAS WRONG.** It said "Moby writes a FULL unstressed vowel where
gold reduces". Measured over the selected rows, 488 are the INVERSE — Moby reduced, gold full
(`abjection` Moby `AH0`, gold `AE0`). The axis is real; its direction is not constant. Gold is taken
because it is the convention this engine follows, not because it is the reduced side. Corrected in
place.

⚠ **GOLD'S READING WAS NOT MODERNISED, AND THE MOBY BRANCH'S IS.** The module header states the
invariant — a row entering the LEXICON arrives in this engine's conventions — and `merge` alone is only
the marry–merry half. Two rows shipped with a yod the Moby path removes: `exudation` as
`ˌɛksjuːdˈeᶦʃən` where the engine coalesces S+j+uː → ʃuː, and `minho` as `mˈiːnjuː` where it drops the
yod after N.

⚠ **AND THE OBVIOUS FIX WOULD HAVE BROKEN TWELVE MORE, WHICH IS A LATENT BUG IN `modernise` ITSELF.**
Its `AH R` rule carries a following-vowel lookahead — `AH R` before a vowel is an onset, `around` =
ə-ɹaʊnd — and its `OW R` rule carries none. So FORCE→NORTH fired on compound seams:
`auto·radiography`, `photo·reconnaissance`, `oleo·resin`, rewriting the `oʊ` of `auto-` as `ɔ`. The
guard was given to both rules, then gold's reading modernised.

    exudation            EH2 K SH UW0 D EY1 SH AH0 N       yod coalesced
    minho                M IY1 N UW0                       yod dropped
    autoradiography      AO2 T OW0 R EY2 D IY0 AA1 …       OW0 kept before the onset r

Also from the review: the manifest's `catch {}` swallowed every read error, not only a missing file, so
any other failure would write the new rows over the whole manifest — the silent deletion the block was
added to prevent, arriving by a different door. Carried-forward rows are now reconciled against
`g2p-dict.tsv` rather than copied, so a later hand correction cannot be reverted by the re-apply step.
And `have` learns the rows a run adds, so a Commonwealth spelling and its American counterpart arriving
together no longer both slip past the spelling-fold guard.

    imported            1,395 (manifest 16,227 + 1,395 = 17,622)
    g2p-dict.tsv        133,712 → 135,107 rows
    goldens             5 languages, 11 rows

                       folded             +intentional
    primary wikipron   61.9% → 62.0%      67.4%
    Moby lexicon       75.3% (unchanged)  82.0%
    Moby OOV           37.2% → 38.0%      45.3%

⚠ The primary gains one row rather than four, which is the stricter fold being right rather than
generous. The OOV figure is still not comparable across the change — its population is now 39,881.

## Run 18 — 2026-09-19 00:30 — the no-gold bucket: REFUSED, and the evidence that nearly admitted it

33,684 Moby headwords the dictionary lacks and gold has no reading for. Importing them means dropping
the two-source bar to one, so the question was measured rather than argued.

⚠ **THE FIRST MEASUREMENT SAID NO, AND IT WAS CONFOUNDED.** Judged against GOLD, over 6,184
out-of-dictionary words gold can arbitrate:

    Moby matches gold 23.0%     our OOV tier matches gold 36.9%

But gold is CMUdict-derived and so is our OOV model, while Moby is independent — gold was scoring its
own descendant.

⚠ **THE SECOND MEASUREMENT SAID YES, AND IT WAS CONFOUNDED THE OTHER WAY.** Against wikipron:

    arbiter          n       Moby     our OOV   Moby-only right   OOV-only right
    wikipron US    352      46.6%      34.4%          77                34
    wikipron UK  6,416      30.9%      21.1%         949               322

Same direction, ~3:1, and the UK sample is large. On that basis the import was built and run: 33,383
rows, with Moby's known tail defects repaired on the way in.

⚠ **AND THE REPO'S OWN GATE REFUSED IT.** `en-missing-rhotic.test.ts` found **115 rows with no rhotic
at all**, and they are systematic rather than scattered:

    answerphone  AA1 N S AH0 F OW2 N        overblow        OW2 V AH0 B L OW1
    undercliff   AH1 N D AH0 K L IH0 F      supercelestial  S UW2 P AH0 S IH0 L EH1 S …
    uncoloured, unflavoured, unhonoured, unneighbourly, governessy, weathermost …

**Moby's tail is NON-RHOTIC.** It transcribes RP for a whole class of words, and the import was putting
r-less readings into a GenAm dictionary. Alongside them, outright garbage: `cury` HH OW0 T IY1 N,
`neanderthaloid` N IY0 P, `sleipnir` S N T, `shtreimel` SH UW0, `frykowski` V OW0 Y T IH0 K (Wojciech).

⚠ **WHICH EXPOSES THE SECOND CONFOUND: UK WIKIPRON IS NON-RHOTIC TOO.** Using it as the "independent"
arbiter systematically rewarded exactly the readings that make Moby unusable here — the mirror of the
gold confound, and the larger sample was the more misleading one. The only clean arbiter was US
wikipron at n=352, which is too thin to carry a 33,684-row change.

⚠ AND THE SIZE ARGUMENT WAS SOUND BUT IRRELEVANT. 6,300 remaining OOV rows would have been a respectable
referee — larger than English's own PRIMARY (4,558), larger than Norwegian (5,943), above the 75th
percentile of the fleet's 257 files. The instrument was never the reason to refuse; the readings were.

**Refused.** The two-source bar is not conservatism, it is the thing that catches this.

### What the block did produce

⚠ **A KNOWN MOBY DEFECT WAS BLOCKING LEGITIMATE TWO-SOURCE AGREEMENT.** The repairs ran only on the
single-source arm, so `unilocular` — `JH UW2 …` in Moby, its initial-yod bug — could never match gold's
`jˌunəlˈɑkjələɹ`, fell out as "gold disagrees", and would then have come back through `--no-gold` on ONE
source when TWO actually agree about it. Moving the repairs BEFORE the comparison recovers **198**
headwords, each with two-source backing. The repairs are Moby-internal and independent of gold, so this
removes a corruption rather than manufacturing an agreement.

    unilocular  JH UW2 N IH0 L AA1 K Y UH0 L AH0 R → Y UW2 N AH0 L AA1 K Y AH0 L ER0

    imported     198 (manifest 17,622 + 198 = 17,820)
    g2p-dict     135,107 → 135,305 rows
    goldens      unchanged, 0 stale

                       folded             +intentional
    primary wikipron   62.0% (unchanged)  67.4%
    Moby lexicon       75.3% (unchanged)  82.0%
    Moby OOV           38.0% → 37.9%      45.2%

## Run 19 — 2026-09-19 01:00 — the defective rows, marked

Run 18 refused the single-source import but left two things it had surfaced. The first: the nonsense
rows are defects and have to be recorded as such.

⚠ **NOT A LINE OFFSET, WHICH WAS CHECKED FIRST** because an offset would have been recoverable — the
whole block could have been shifted back. It is not: the NEIGHBOURS of every corrupt row are correct.

    shrunken 'S r@Nk@n     shtreimel /S//u/       shuck /S//@/k
    soleplate 'soUl,pleIt  soleprint s/O/'l/E/m   Soleure s/O/'l/y/R

Each row is individually corrupt, so each has to be named.

**Found three ways, and each found rows the others missed.** A first-phone plausibility test (a surname
cannot be read as a given name); a phones-per-letter ratio (median 0.89, these sit under 0.40 with six
or more letters); and reading the Moby/gold disagreements.
⚠ THE RATIO TEST NEEDS THE LENGTH GATE, and without it flags only correct rows: `awe` AO, `eau` OW,
`err` ER, `aye` EY all score low and are all right, as are `thorough`, `though`, `borough`, `jacques`
and `maugham` with their silent letters.

25 rows, in three shapes:

    a surname whose body is a GIVEN name    carr→Antoine, cordero→Ángel, corrigan→Mairead,
                                            dunston→Sean, frana→Javier, gaston→Cieto,
                                            gorbachev→Mikhail, frykowski→Wojciech
    the body is a DIFFERENT word            hodges→canister, pathology→pathomorphism,
                                            terminology→terminological, result→resultive,
                                            react→reactor, soleprint→solemn, selfward→selfwill
    truncated or nonsense                   workbasket, freelance, ninetieth, shtreimel,
                                            neanderthaloid, passel, reiterate, sleipnir, wakayama

⚠ **THEY ARE DROPPED, NOT REPAIRED.** A repair would be a guess at what Moby meant; dropping leaves the
word to the OOV tier, which is what already happens for every word Moby does not carry. Both the
referee builder and the import tool read the same list, so a defective row can never arbitrate and can
never be imported.

    en.moby-lexicon.tsv   35,202 → 35,185
    en.moby-oov.tsv       39,683 → 39,675

### Still open: the non-rhotic tail belongs to en-GB, not to GenAm

The 115 r-less rows that refused the import are not worthless — they are RP, and en-GB is the variety
that wants them. en-GB today has ONE referee (`en-gb.wikipron-uk`, 76,284 rows), no secondary, and no
declared `intentional` class at all, against a 51.7% score. A Moby-derived en-GB referee — or an en-GB
import on the same two-source bar, with a non-rhotic gold — is the obvious next use for the half of
this corpus GenAm cannot take. Not started.

## Run 20 — 2026-09-19 02:00 — the RP rows out of the GenAm corpora, the loanwords left alone

Run 18 refused the single-source import because Moby's tail is non-rhotic. Those rows were still sitting
in the GenAm REFEREE, scoring us wrong for being right, and every residual mining pass kept rediscovering
them.

⚠ **RP IS NOT THE SAME THING AS A LOANWORD, AND THE FIRST DRAFT CONFLATED THEM.** Moby writes
`afterwards` as `æftəwədz` because the transcription is BRITISH — we say the /r/, it does not. It also
writes `dossier` as `dɑsieɪ`, where the ⟨r⟩ is silent IN GenAm TOO, because that is how English borrowed
the word. The second kind is a GenAm fact, we read it r-less as well, and those rows PASS today.
Excluding them would have thrown away credit we are earning, and the plan to "pick them up for en-GB
later" was wrong twice over — they are not RP and they are not en-GB's.

⚠ **THE DISCRIMINATOR IS THE WORD, NOT THE SPELLING SHAPE.** The wikipron config's rule is spelling-based
and accepts one false positive in 98; here the false-positive class is 10%, so it is named instead.
⚠ AND `-et` LOOKED LIKE A FRENCH ENDING AND IS NOT: exempting it keeps `hairnet` hɛnɛt, `overset`
oʊvəsɛt and `superhet` supəhɛt, all plainly RP. `-ier` and its plural are the reliably French ending
(30 rows: `dossier`, `bustier`, `chansonnier`, `menuisier`, `cuvier`, `tablier` …); the six that do not
fit it — `boucher`, `tourniquet`, `angers`, `chorzow`, `beziers`, `ateliers` — are named individually.

    dropped as non-rhotic   242
    en.moby-lexicon.tsv     35,185 → 35,098
    en.moby-oov.tsv         39,675 → 39,515

                       folded             +intentional
    primary wikipron   62.0% (unchanged)  67.4%
    Moby lexicon       75.3% → 75.5%      82.0% → 82.2%
    Moby OOV           37.9% → 38.1%      45.2% → 45.4%

⚠ **THE NUMERATORS DID NOT MOVE** — 26,499 and 15,055 before and after. Only the denominators shrank, so
the gain is entirely the removal of rows we could never have passed. No reading improved; the instrument
stopped asking a question GenAm cannot answer.

## Run 21 — 2026-09-19 02:40 — review: one of the two non-rhotic rules is not enough

⚠ **THE FIRST RULE ALONE LEAVES THE LARGEST CLASS.** `[aeiouy]r(?![aeiouy])` rejects every
`-ered`/`-ored`/`-ured`/`-ared` word, because the ⟨e⟩ after the ⟨r⟩ is a vowel LETTER even when it is
silent — so `battered bætəd`, `coloured kʌləd`, `unanswered ənɑnsəd`, `unpaired ənpɛd` all survived,
45 of them. en.jsonc:31 already carries the second rule for exactly this and names `featured fiːt͡ʃəd`;
this reimplemented only the first. ⚠ AND THE SECOND RULE LOOKS AT THE TAIL ONLY, because an ONSET /ɹ/
shields a non-rhotic coda: a whole-string test keeps `particolored pɑɹtɪkʌləd`.

⚠ **AND THE SPELLING EXEMPTION WAS THE THING I HAD ARGUED AGAINST ONE RUN EARLIER.** Run 20 says the
discriminator is the word, not the shape — and then used `iers?$`. 8 of the 12 rows it exempted have a
RHOTIC dictionary reading, i.e. they are RP rows readmitted by hand: `pliers` against our
`P L AY1 ER0 Z`, and `messier`, where Moby has the ASTRONOMER and our headword is the comparative of
`messy` — the common-word/proper-noun collision #1352 exists to prevent. `tourniquet` too: ours is
`tʰˈɝnɪkɪt`, rhotic, so Moby's `tʊənɪkeɪ` is the RP CURE diphthong, not a silent-⟨r⟩ loan.

The builder already loads `g2p-dict.tsv`, so the real discriminator was available all along: **drop the
row iff OUR reading carries a rhotic and the referee's does not.** Exact wherever the dictionary has the
word; the `-ier` ending survives only as a proxy for the OOV corpus, where there is no second opinion.
⚠ `-eur`/`-oir` ARE GONE: the ⟨r⟩ of `chauffeur`, `connoisseur`, `liqueur`, `memoir`, `choir` is
PRONOUNCED in GenAm and Moby writes it, so those arms fired on nothing and would have retained RP if
they ever had.

    dropped as non-rhotic   242 → 318
    en.moby-lexicon.tsv     35,185 → 35,049
    en.moby-oov.tsv         39,675 → 39,485

                       folded             +intentional
    primary wikipron   62.0% (unchanged)  67.4%
    Moby lexicon       75.3% → 75.6%      82.0% → 82.4%
    Moby OOV           37.9% → 38.1%      45.2% → 45.4%

Three more defective rows, and the reason none of the rhotic rules reach them is worth recording: their
⟨r⟩ is INTERVOCALIC, which RP pronounces, so a reading with no ⟨r⟩ at all is corruption rather than a
dialect difference — `monosaccharide` (body is *monoscope*), `missouri` mɪzʊi, `zippered` zɪpi. The list
is 33. And the exclusion is now pinned in `test/en-moby-referee.test.ts`, which that file's own header
asks for: the fold/no-fold line lives in the test, not in the generator's comments.

### And the defective list was 25, not the 29 the last PR claimed

Four rows were identified in that session (`anderson`→Sulam, `millimeter` truncated, `oder`→Odessa,
`piker`→pikestaff) and never added — the edit was described and not made. Found by this sweep, because a
row whose body is a different word often also loses the ⟨r⟩ its headword is spelled with, so the r-less
detector catches corruption the rhotic rules were not looking for. With `flayer` (`ɛfwʌn`, i.e. "F one")
the list is now 30.

## Run 22 — 2026-09-19 03:10 — FORCE→NORTH on the PRIMARY, which never had it

With RP and the corrupt rows out of the corpora, the residual is finally clean enough to read, and the
first thing in it is a fold the Moby artifact has had all along and the primary never got.

The primary marks us wrong on `chorus` koɹəs, `gore` ɡoɹ, `morning` moɹnɪŋ, `emporium`, `Cawnpore`,
`Mauritania`, `aurally`, `amorce`, `corniced` — it keeps FORCE apart from NORTH and this engine cannot:
CMUdict writes `more` and `nor` alike as `AO R`, so there is no FORCE for us to regress INTO.
`build-en-moby-referee.mts` applies exactly that argument when folding FORCE→NORTH into the Moby
artifact; `en.jsonc` simply never got the same treatment.

⚠ **AND THE BLINDING WAS MEASURED, NOT ASSUMED, WHICH CHANGED THE ANSWER.** Scoped first as a trade —
+13 rows against blinding the 36 `OW R` rows the dictionary holds — it turns out to cost nothing:

    rows the pattern can touch   26
    pass today                    0
    pass after the fold          16
    rows where BOTH sides write `oɹ`   0

⚠ THE REASON IS THE PATTERN, NOT LUCK. It matches a BARE `o` before `ɹ`, never `oʊɹ`, and our inventory
has no bare `oɹ`: AO renders `ɔɹ` and OW renders `oʊɹ`. So the 36 rows are compound seams —
`arrow·root` ɛɹoʊɹut, `auto·rad`, `elbow·room`, where the `r` is an ONSET — and they fold to themselves
on both sides.

    primary wikipron   62.0% → 62.4%      +intentional 67.4% → 67.8%
    Moby corpora       unchanged (the builder already folds this into the artifact)

⚠ AND THE PRIMARY IS THE ONE THAT COUNTS. Every referee-repair run in this log left 62.0% untouched by
construction; the two that moved it were the velar fix (an ENGINE change) and this, a fold the
instrument was missing.

## Run 23 — 2026-09-19 03:40 — review: the fold re-measured independently, and the one thing it does NOT cover

Review of Run 22's fold. Question: is `oɹ`→`ɔɹ` really score-positive and really non-blinding, or was the
+16 measured on a path the scorer does not take?

Re-ran the primary at the gate's own sample (`evaluate("en", true, 3000)`), once with the fold and once
with the fold object deleted from `en.jsonc`:

    with fold      1265/2023   62.53%   intentional-credited 112
    without fold   1257/2023   62.14%   intentional-credited 112

+8 rows on a 2,023-row sample scales to the claimed +16 on the full corpus, nothing regresses in the
aggregate, and `intentionalCredited` is unchanged — the fold is not eating rows the `intentional` classes
were already crediting. The referee file holds exactly 26 rows matching `o ɹ`, which is the note's number.

The non-blinding claim also holds by construction, checked rather than assumed:

- `grep -rP "oɹ" data/languages/english/ src/languages/english/` → 0 hits. The ARPABET map has no bare `o`
  (AO `ɔː`, OW `oᶷ`), so the fold rewrites the REFEREE side only and cannot credit an error of ours.
- fold ORDER is not load-bearing here: `oᶷ`→`oʊ` sits *after* this fold, and neither `oᶷɹ` nor `oʊɹ`
  matches `oɹ`, so moving it either way changes nothing. `makeFold` normalizes NFD, not NFKD, so the
  modifier letters survive to their own folds.
- the fold is length-preserving (1 char → 1 char), so the positionwise `intentional` alignment is untouched.
- both Moby corpora hold ZERO occurrences of `oɹ` — the artifact is already `ɔɹ` — so "Moby unchanged" is
  exact, not approximate.

⚠ AND THE REVIEW FOUND ONE THING RUN 22's NOTE OVERSTATES, in the Moby artifact rather than in this fold.
The note says the compound seams "fold to themselves on BOTH sides". True on the primary and in our
dictionary. NOT true of the Moby artifact: `build-en-moby-referee.mts` folds `OW R → AO R` on the bare
phone pair with no check that the `r` is a coda, so it has already collapsed the seams —

    arrowroot  æɹɔɹut     elbowroom  ɛlbɔɹum    showroom  ʃɔɹum
    towrope    tɔɹoʊp     bowring    bɔɹɪŋ                        (10 rows spelled `owr` across both files)

against our `ʃoᶷɹuːm`, `toᶷɹoᶷp`. Those rows are marked wrong for a GOAT we read correctly, and no fold on
our side can reach them because the damage is baked into the artifact. Pre-existing, not introduced by
Run 22, and small — but it is the same onset/coda distinction Run 22 relied on, applied in the one place
that did not make it. Fixing it means gating the builder's fold on the `r` not being a following syllable's
onset, and rebuilding the artifact.

## Run 24 — 2026-09-19 03:52 — the builder's FORCE fold, gated on spelling

Acting on Run 23's finding. Question: what tells a FORCE coda from a compound seam, given the phone shape
cannot?

Nothing in the phone string can. `chorus` is `AO R` followed by a vowel and DOES merge; `showroom` is the
same phone shape and must not. The discriminator has to be the spelling, so the builder's fold now takes
the headword and exempts any word containing `owr`:

    if (t[i]![0] === "OW" && t[i+1]?.[0] === "R" && !w.includes("owr"))

Rebuilt. Four rows corrected, corpus sizes unchanged (lexicon 35,049 / OOV 39,485):

    arrowroot  æɹɔɹut  → æɹoʊɹut      elbowroom  ɛlbɔɹum → ɛlboʊɹum
    showroom   ʃɔɹum   → ʃoʊɹum       towrope    tɔɹoʊp  → toʊɹoʊp

⚠ `bowring` WAS NOT A FOLD ARTIFACT, which is worth recording because Run 23 listed it as one and the
count of ten rows made it look like a class. Moby writes it `'b/O/r/I//N/` — an `/O/` in the source, not
an `OW R` the builder collapsed. It survives the gate unchanged and correctly. Of the ten rows spelled
`owr`, five carry MOUTH (`dowry`, `lowry`, `cowry`, `avowry`, `mowrah`) and were never eligible, one is
`bowring`, and four were the real damage. The gate is cheap and the class is closed.

Primary unmoved at 62.4% by construction (this touches only the Moby artifacts). Moby-lexicon 75.6%.

## Run 25 — 2026-09-19 04:05 — two referees agreeing against us, and what is left when they do

A new selection rule, and the strongest bar this audit has used. Question: where do the two INDEPENDENT
referees — wikipron GenAm (human transcribers) and Moby — agree with EACH OTHER on a reading that is not
ours? Neither alone settles anything; together they are two sources that have never seen each other.

    both referees cover:                    1,428 dictionary words
    they agree and we differ:                  73
    …after every declared-intentional class:   38

The intentional filter is doing most of the work and doing it correctly: the weak vowel ə↔ɪ in both
directions and the NEAR vowel before ɹ account for 35 of the 73, exactly the classes measured and declared
in earlier runs. ⚠ THE 38 REPRODUCED A PRE-COMPACTION COUNT EXACTLY, which is the only reason it is
quoted with confidence — the same probe written twice from different directions gave the same number.

The 38 break down as:

    known axes, not actionable      13   marry–merry (barrett, paris, apparel, comparatively, narrow),
                                         cot–caught (dong, thong, stomp, backwash), en-/ɪn- (enfranchise,
                                         enhance, exploit), transmit
    two attested readings, ours     11   octave ɑktɪv/ɑkteɪv, whoop wup/hup, holm, ensign (the rank vs the
       being one of them                 flag), lower (the verb vs the scowl), kafka, cremation, newness
                                         (yod), reconstitute (yod), saccharine, absorbing/absurdity
    referee wrong, instrument gap     2   perchlorate, weatherproof — see below
    genuine dictionary defects        8   shipped
    a defect the dictionary cannot    1   bancroft — see below
       express

⚠ TWO OF THE 38 WERE THE INSTRUMENT, NOT THE DICTIONARY, and finding them is why a residual gets read
rather than counted. `perchlorate pəklɔːɹeɪt` and `weatherproof wɛðəpɹuːf` are RP rows in the GenAm file
that BOTH existing non-rhotic exclusions miss: the first asks whether a rhotic appears anywhere, the second
only in the last three symbols, and here the only ɹ is another syllable's ONSET (`klɔːɹ`, `pɹuːf`). This is
the same onset/coda confusion the Moby builder had in Run 24 — third time this distinction has been the
bug. A third exclusion now asks for a CODA rhotic specifically: `ɚ`/`ɝ`, or `ɹ`/`ɻ`/`r` not followed by a
vowel. 9 rows, all failing, so the denominator drops and the numerator does not.

⚠ ITS SPELLING SIDE NEEDED TWO EXCLUSIONS, BOTH FOUND BY READING THE ROWS IT ADDED rather than by trusting
the count. `[aeiouy]r+` BACKTRACKS, so a geminate matches its own first half and `arrange əɹeɪnd͡ʒ`,
`narrow næɹoʊ`, `Barrett bæɹɪt` — ordinary GenAm — were flagged for having an onset ɹ where there is no
coda r at all; the `rh` digraph did the same to `gonorrhea` and `ornithorhynchus`. Excluding a following
`r` or `h` took the rule from 61 newly-caught rows (mostly wrong) to 14 (all right). It also does NOT
subsume the word-final rule, which is what I expected it to do: 12 rows spelled `-re`/`-red` have no
post-vocalic r for its spelling side to match, so all three rules stay.

The 8 shipped corrections, each recorded in `g2p-curated.tsv` with both referees' readings:

    siobhan         ʃaʊbɑn        → ʃəvɔn          an Irish name read off its letter shape
    champaign       tʃæmpeɪn      → ʃæmpeɪn        said like `champagne`
    clio            klioʊ         → klaɪoʊ         the muse is KLY-oh
    parthenia       pɑɹθɛniə      → pɑɹθiniə
    marmara         mɑɹmɑɹə       → mɑɹməɹə        stress AND reduction both wrong
    terracotta      təɹəkɑtə      → tɛɹəkɑtə       ɛɹ under secondary stress, not a reduced ɚ
    appreciative    əpɹiʃieɪtɪv   → əpɹiʃiətɪv     no FACE vowel in -ciative; GOLD AGREES, so three sources
    appreciatively  (as above)

⚠ THE LAST TWO DO NOT CONVERGE ON THE REFEREES AND THE ARROW ABOVE IS NOT THE REFEREE'S READING. What the
two referees settle is the ABSENCE OF THE FACE VOWEL: they write `əpɹiʃətɪv`, CMUdict's EY2 is the error,
and both are now gone. They ALSO drop the `i` and we keep it — gold reads `əpɹˈiʃiəɾɪv`, our corrected
reading segment-for-segment, and `appreciatory` is parallel — so these two rows still SCORE as divergences
after the fix. That is why eight corrections bought SIX rows on the primary and not eight, and the
arithmetic only closes if this is said out loud.

⚠ THE GOLD DISSENTS ON TWO AND THEY SHIPPED ANYWAY, recorded rather than quietly dropped: misaki reads
`champaign` with tʃ and `clio` as kliːoʊ. Two referees plus the dictionaries outweigh it, and on
`appreciative` gold agrees with the referees AGAINST CMUdict — which is what a third source is for.

⚠ `bancroft` IS A REAL DEFECT THAT THE DICTIONARY CANNOT EXPRESS, and the edit was made, measured, and
reverted. Both referees read `bænkɹɔft`: `Ban·croft` is a compound seam where the nasal ends the first
element and never assimilated. But the converter DERIVES ŋ from N before K/G itself, gated only on a
transparent PREFIX, so `NG`→`N` in the dictionary changes nothing — `en_rebuild_lexicon.mts --diff` listed
all 8 other rows and not this one. A seam-aware guard in the converter is its own block. Recorded in
`g2p-curated.tsv` as an explicit absence so the next reader does not spend the edit again.
⚠ AND IT DOES NOT CONTRADICT THE VELAR REFUSAL. That refusal was of a BLANKET intentional credit, on the
ground that Moby RECORDS the ŋ/n distinction and so its `n` is a per-word judgement. A per-word judgement
is evidence about the word it is made about; it is only a notation choice that cannot be evidence.

    primary folded backbone   62.4% → 62.6%   (2523/4046 → 2529/4037)
    +intentional              67.8% → 68.1%
    Moby — lexicon            26499 → 26505   (75.6%)   ⚠ a MIRROR, see below
    Moby — OOV                unchanged
    goldens                   189 languages, 36,495 rows, 0 stale

The primary moved on both counts at once — 6 rows entered the numerator (the dictionary fixes) and 9 left
the denominator (the instrument fix) — so the two are separable and are reported separately above.

⚠ THE MOBY-LEXICON +6 IS NOT INDEPENDENT EVIDENCE AND MUST NOT BE READ AS CONFIRMATION. The builder drops
a headword from the referee only when it is in `moby-import.tsv`; a CURATED correction is not an import,
so all eight rows stay in the referee and six of them now match because we changed the dictionary to agree
with Moby. 26,499 → 26,505 is that, by construction. The number worth reading is the PRIMARY, where
wikipron had no part in the correction — and even there, half the credit is the exclusion rather than the
dictionary. Recorded because a mirror that moves in the right direction is the easiest number to believe.

⚠ AND THE RULE HAS A NAMED FALSE POSITIVE, `Jedburgh` — the one of its 9 rows with no en-GB counterpart.
The referee's `d͡ʒɛdbəɹə` is correct (Scottish `-burgh`); we read `d͡ʒɛdbəɹɡ` off the OOV path because the
dictionary is itself split, `edinburgh` B ER0 OW0 against `pittsburgh`/`newburgh` B ER0 G. Dropping the row
hides a real divergence. Left in and named, exactly as rule 1 names `dossier`: one row does not buy the
machinery to special-case it, and the split dictionary is its own finding for a later block.

## Run 26 — 2026-09-19 04:35 — independent review of Run 25 (verify, don't trust)

Re-measured every claim in Run 25 from scratch on `fix/two-referee-agreement` (bec817ea) rather than
reading the numbers off the previous entry. Commands: `MOBY=/mnt/data/moby/mobypron.unc npx tsx
tools/referee-eval/eval.ts en`, `npx tsx tools/english/en_rebuild_lexicon.mts --diff`, `npx vitest run`,
plus a standalone probe that loads `CONFIG["en"].referees[0].excludeRows` and replays eval.ts's own
filter predicate row by row over `en.wikipron-eng-latn-us-broad.tsv`.

**Everything load-bearing reproduces.** The headline numbers are exact:

    primary   folded 2529/4037 (62.6%)   +intentional 2749/4037 (68.1%)   symbolAcc 90.8%
    Moby lex  folded 26505/35049 (75.6%)                                  symbolAcc 94.6%
    Moby OOV  folded 15056/39485 (38.1%)
    excluded rows 521      lexicon round-trip 135,305/135,305, 0 would change
    vitest 316 files / 6,069 tests green

The denominator arithmetic holds and is separable exactly as claimed. Replaying the five exclusions
cumulatively gives marginal counts **98 / 18 / 9 / 6** for rules 1–4 (rule 0 catches 390), so the new
coda rule removes **9** rows — 4046 → 4037. I read all nine and phonemized each against the folded
referee: every one was a FAIL before the change, so the numerator cannot have moved from them.

    Jedburgh  interlocutory  ornithorhynchus  perchlorate  perlustrate
    reimbursement  resort  retards  weatherproof

Eight of the nine appear in `en-gb.wikipron-uk.tsv` with a byte-identical first reading — the same
corroboration standard rules 1 and 2 were validated against. The exception is `Jedburgh`, below.

And the numerator: of the 8 corrected headwords, 7 are in the primary referee (`appreciative` is not),
and exactly **6 flipped FAIL→PASS** — champaign, clio, marmara, parthenia, siobhan, terracotta. 2523 + 6
= 2529. `appreciatively` still fails; see the finding below.

**ARPABET is well-formed.** All 16 strings (8 upstream + 8 curated) use only the 39-phone set, carry
exactly one primary stress, and stress-mark every vowel. `g2p-curated.tsv` column 3 equals the live
`g2p-dict.tsv` row for all 2,097 curated words (not just the 8), no duplicate headwords in either file,
4 columns on every row, no trailing whitespace or CR. The `accent-lexicon.tsv` diff is exactly 8 rows —
the 8 corrected words and nothing else — and `--diff` reports 0 further rows would change, so the
generated file is in sync with the converter and the dict.

**The exclusion regexes do what the note claims, and the two carve-outs are load-bearing.** Removing the
`r`/`h` exclusion from the spelling side takes the rule from 9 uniquely-dropped rows to **53** (the note
says 61; that figure is against rules 1–2 only, where I measure 60 — see the count discrepancy below).
The 44 extra are ordinary GenAm: `arrange`, `narrow`, `Barrett`, `Garrett`, `Perry`, `horrible`,
`burrito`, `gonorrhea`, `irrespective`… ⚠ **AND `terracotta` IS AMONG THEM.** Without the carve-out the
rule would have dropped the very referee row this PR used as evidence for one of its 8 corrections. That
is the strongest argument for the carve-out and it is not in the note.

Things I probed for and did **not** find:
- the `˞` rhotic hook (U+02DE) is absent from the coda-rhotic class, but the file has only 2 rows using
  it (`Cryptocarya`, `Hicoria`) and both are spared by the spelling side anyway.
- the spelling class matches lowercase `r` only (`[…AEIOUY]r+`). The only two headwords with an
  uppercase post-vocalic R are `ARPA` and `USAR`, both rhotic. Empty in practice; rule 1 has the same
  asymmetry already.
- a coda ɹ before a stress mark cannot be misread as an onset (stress precedes its syllable), and a ɹ
  followed by a non-listed symbol falls to the CODA side, which is the conservative direction.
- word-final geminates (`Barr`, `Kerr`) do still match the spelling side — `r+` plus end-of-string — but
  every such row here carries a coda rhotic, so none is dropped.
- one row the carve-out costs us: `furriery fɜɹiəɹi` is non-rhotic and now survives. One row.

### Findings

⚠ **`Jedburgh` IS THE RULE'S ONE FALSE POSITIVE, and it is exactly the `dossier` case rule 1 documents.**
The referee reads `d͡ʒɛdbəɹə`, which is correct — Jedburgh is a Scottish `-burgh` that rhymes with
Edinburgh — and it is the one dropped row with no en-GB counterpart, i.e. the one that is *not* an RP row
in the GenAm file. We read `d͡ʒɛdbəɹɡ`, off the OOV path (the word is not in the dict), because `-burgh`
is genuinely split in the dictionary: `edinburgh EH1 D AH0 N B ER0 OW0` against `pittsburgh … B ER0 G`
and `newburgh … B ER0 G`. So a real divergence is now hidden, on a word where the referee is right. The
remedy is the one rule 1 already chose for `dossier`: leave it in and NAME it in the note, so the next
reader does not rediscover it as a bug. Right now the note claims the rule's 14 rows are "all right".

⚠ **THE `14 further rows` IN THE JSONC NOTE IS WRONG BY THE FILE'S OWN CONVENTION, and it contradicts
this document.** Measured cumulatively — the convention the sibling notes use, and the one that matches
the denominator — the rule adds **9**, which is what Run 25 says in prose and what 4046→4037 says in
arithmetic. 14 is the count against rules 1 and 2 *only*, ignoring rule 0; five of those 14 (`arthropod`,
`asterperious`, `overarm`, `overpraise`, `superoverlord`) are already dropped as RP-vowel rows. The note
should read 9, or say explicitly which baseline 14 is against. Same for "61 newly-caught rows", which
measures 60 against rules 1–2 and 53 cumulatively.

⚠ **`appreciative` / `appreciatively` DID NOT CONVERGE ON THE REFEREES, AND THE SUMMARY TABLE SAYS THEY
DID.** This entry's table writes the new reading as `əpɹiʃətɪvli`. The shipped reading is
`əpɹˈiːʃiʲət̬ɪvli` → folded `əpɹiʃiətɪvli`, with the `i` retained. Both referees write it WITHOUT the
i — Moby `əpɹiʃətɪv`, wikipron `ʌpɹiʃətɪvli` — so `appreciatively` remains a FAIL against the primary
referee after the fix, and the 8 corrections bought 6 rows, not 7, for this reason. The correction that
shipped is still right and is better evidenced than the table suggests: misaki gold reads
`əpɹˈiʃiəɾɪv`, i.e. it agrees with the shipped form segment for segment, and the existing
`appreciatory AH0 P R IY1 SH IY0 AH0 T AO2 R IY0` row is parallel. What the two referees actually agreed
on is the absence of the FACE vowel, not the absence of the `i`; the curated note's `əpɹiʃi/ətɪv` slash
is carrying that whole distinction silently. Worth one clause in both places, and the table's
`→ əpɹiʃətɪvli` should be `→ əpɹiʃiətɪvli`.

⚠ **THE MOBY-LEXICON +6 IS A MIRROR AND IS REPORTED BESIDE THE INDEPENDENT ONE WITHOUT SAYING SO.**
`build-en-moby-referee.mts` drops a headword from both corpora when it appears in `moby-import.tsv`,
on the stated ground that "scoring ourselves against Moby on a word whose reading we TOOK FROM MOBY is a
mirror". A curated correction is not in that file, so all 8 of these rows stay in the referee — and 6 of
them now match Moby because we changed the dict to match Moby. 26499→26505 is definitionally that. It is
0.017pp and harmless, but the primary referee's +6 is only half-independent for the same reason (the
selection rule was "both referees agree against us"), and neither number is evidence the engine improved.
The honest framing is the one this entry already uses for the exclusion — report the movement, say which
part is by construction.

Smaller notes, no action needed:
- `ornithorhynchus` is cited in the jsonc note as a row the `rh` carve-out protects; it is dropped
  anyway, via its *first* `or`, and correctly so (`ɔːnɪθəɹɪŋkəs` is RP). The carve-out's real
  beneficiaries are the `arr`/`err` geminates and `gonorrhea`.
- the `marmara` curated note says "Moby + wikipron mɑɹməɹə"; Moby actually writes `mɑɹmɚə` and wikipron
  `mɑːɹməɹə`. Both fold to the same thing, so the conclusion stands.
- `docs/language-maturity.md` line 136 still shows en at "41.8% word · 82.0% symbol" against today's
  62.6% / 90.8%. Pre-existing — several PRs have moved these — but it is now badly stale.

### Verdict

The eight corrections are right as GenAm readings and well-formed; `clio` and `champaign` are the two
where a second reading genuinely exists (Clio Awards KLEE-oh, and gold dissents on both), and both are
declared rather than buried, which is the right handling. The exclusion rule is sound, its carve-outs are
necessary, and its effect on the score is the honest direction — 9 rows out of the denominator, all of
them already failing. Nothing else in the tree breaks. The defects are in the prose: one mis-stated count
(14 vs 9), one summary row that states an outcome the engine does not produce (`appreciatively`), one
undeclared false positive (`Jedburgh`), and one score movement that is partly self-scored.

## Run 27 — 2026-09-19 — the velar rule measured AT THE SITE, and it is wrong more often than right

The `bancroft` row Run 25 could not express turned out to be a class. Question: across the whole
dictionary, where a nasal precedes /k/ or /ɡ/, what do the referees say, and what does the engine say?

Built a labelled evaluation set — every `g2p-dict.tsv` word with `N`/`NG` before `K`/`G`, labelled by
whichever of Moby, wikipron-US and wikipron-UK cover it, keeping only sites where every covering source
agrees. ⚠ THE en-GB REFEREE IS ADMISSIBLE HERE AND NOWHERE ELSE IN THIS AUDIT: `ŋ` versus `n` is a
CONSONANT, so it is not part of the RP delta — non-rhoticity and the RP vowels cannot reach it.

    labelled sites                    1,130   (461 with two or more agreeing sources)
    dict N, referees say n               298      ← the dictionary is right
    dict N, referees say ŋ                33      ← the dictionary slipped
    dict NG, referees say ŋ              774
    dict NG, referees say n               25

⚠ THAT IS 298 AGAINST 33, AND THE RULE ASSIMILATES ALL OF THEM. The converter's comment justifies itself
as repairing "346 slips" among the 923 `N`+velar rows; at two or more sources the split is 107 against 4.
So the dictionary's `N` is a statement roughly nine times out of ten, and the rule overrides it every time
a transparent prefix does not intervene.

Then measured the engine against those labels — and the first measurement was WRONG IN A WAY WORTH
RECORDING: toggling the rule off changed nothing at all (1041/89 both ways, referee scores flat to ±2
rows). The reason is that `accent-lexicon.tsv` is consulted BEFORE the ARPABET path, so for a dictionary
word the rule's output is already baked into the flat lexicon. Rebuilding the lexicon with the rule off
is what makes the experiment real:

                           labelled sites   primary   Moby-lexicon   Moby-OOV
    rule on  (baseline)      1041 / 89       2529       26505         15056
    rule off                 1072 / 58       2530       26527         15054

+31 at the site, +22 on Moby-lexicon, +1 primary, −2 OOV. The "68.9% against 52.0%" that licensed the
rule does not reproduce as a corpus effect in either direction: whole-word exact match over 867 words was
measuring everything in the word except the site in question.

⚠ AND YET THE RULE MUST NOT SIMPLY BE DELETED, which is the finding that cost the most to establish.
Turning it off flips 360 shipped words. Of the 71 the referees label, 51 flip correctly — `pancake`,
`raincoat`, `mankind`, `painkiller`, `turnkey`, `vanguard`, `vancouver`, `leningrad`, `dunkirk`,
`ironclad`, `loincloth`, `plainclothes`, `sunglasses` — every one a COMPOUND SEAM. But 20 flip wrongly:
`anglophile`, `ankh`, `gangrene`, `idiosyncrasy`, `laryngoscope`, `tonga`, `drinkable`, `lancaster`,
`punctate`, `thunk` are tautomorphemic and are `ŋ` for everyone. The rule is papering over real CMUdict
slips at the same time as it is destroying real CMUdict statements.

⚠ THE DISCRIMINATOR IS A COMPOUND SEAM, AND IT IS NOT LEARNABLE FROM THIS EVIDENCE. Two attempts:

1. A SPLITTER — does the word divide at the n|velar boundary into two dictionary words? On the labelled
   seam words it is 31 right to 2 wrong, but it also claims `benghazi`, `pangloss`, `sancho`,
   `panchromatic`, `galingale` and misses 20 labelled rows including `vancouver`, `ongoing`,
   `stonecutter`, `minecraft`, `serengeti`.
   ⚠ CORRECTED IN RUN 30. This list first read "`benghazi`, `hangul`, `pangloss`, `sancho`,
   `panchromatic`, `vainglorious`, `cancan`, `galingale` (all `ŋ`)" and three of those eight are
   not `ŋ`: `hangul` (wikipron US *and* UK), `vainglorious` and `cancan` are `n` on referee
   evidence, and Run 28 shipped rows for all three. Five of eight is still enough to sink the
   splitter as a rule, but the aside asserted a verdict for words it had not looked up.
2. A MORPHEME LIST, derived from the labelled data rather than imagined — the first elements attested by a
   referee-labelled `n` with a real second element, outside the transparent prefixes, are: `corn` 3,
   `green` 3, `pan` 3, `man` 2, `on` 2, `turn` 2, and then thirty morphemes with ONE attestation each.
   `pan` reaches `pancreas`/`pangloss`/`panchromatic`, `van` reaches `vancomycin`, `ton` reaches `tonga` —
   all `ŋ`. A list built from one-attestation morphemes is a word list wearing a rule's clothes.

So the code comment's own guess — "the real discriminator is PREFIXED versus COMPOUND, which needs a
morphological inventory this module does not have" — is confirmed, and now with a measurement behind it.
This is LEXIS, not phonology, and the repo already has a mechanism reserved for exactly that: a per-word
table injected into the data-free converter, the way `en-syllabic.tsv` is. That is the next step.

## Run 28 — 2026-09-19 — the seam table, and what it does and does not buy

Built `en-nasal-seam.tsv` on Run 27's conclusion: the seam is lexis, so it ships the way this repo ships
lexis — a per-word table of phone indices injected into the data-free converter, exactly as
`en-syllabic.tsv` is. `tools/gen/build-en-nasal-seam.mts` derives it from the three referees; nothing is
hand-listed.

    dictionary words with an N+velar site the converter would assimilate
      protected by a transparent prefix already:                     590
      every covering referee says [n]  → A ROW:                       32  (+5 inflections = 37)
      every covering referee says [ŋ] — a CMUdict slip the rule fixes: 20
      referees split, no referee, or single-source and not a seam:   311

⚠ THE GATE WAS TIGHTENED AFTER READING THE ROWS IT LET THROUGH, which is the only reason the table is
worth anything. A single source is admitted when the seam is visible in the spelling — the word divides
into two dictionary words at the boundary — and dictionary membership alone is nearly free, because
CMUdict carries every surname: `kalanchoe` parsed as `kalan`+`choe` and `agincourt` as `agin`+`court`.
Both happen to have the right answer, which is exactly how a loose gate survives a spot check. Requiring
the second element to be in `g2p-common.txt` and four letters or more drops the count 35 → 32.
⚠ AND THE `four letters` HALF OF THAT WAS WRONG — see Run 30. It dropped `corncob`, a true positive,
while leaving both rows it was aimed at; the floor is 3 now and the count is 33 (+5 = 38). The `35 → 32`
figure does not reproduce either: the obvious loose variant gives 34.

⚠ AND INFLECTIONS ARE CARRIED ALONG, because the first table shipped `pancake` but not `pancaked`, and
`sunglass` but not `sunglasses` — the referees happened to cover one form of each. A suffix cannot move
a seam, so the stem's indices are reused; +5 rows.

36 of the 37 rows change the flat lexicon (`melancholy` was already `n`), all in the same direction:

    pancake  pʰˈæŋkˌeᶦk → pʰˈænkˌeᶦk      raincoat  ɹˈeᶦŋkˌoᶷt → ɹˈeᶦnkˌoᶷt
    mankind  mˌæŋkˈaᶦnd → mˌænkˈaᶦnd      vanguard  vˈæŋɡˌɑːɹd → vˈænɡˌɑːɹd
    turnkey  tʰˈɝŋki    → tʰˈɝnki         leningrad lˈɛnəŋɡɹˌæd → lˈɛnənɡɹˌæd

    primary folded backbone   62.6% → 62.7%   (2529 → 2531)
    Moby — lexicon            26505 → 26520   (75.6% → 75.7%)
    Moby — OOV                unchanged
    goldens                   3 English rows moved (`ongoing` in the en/en-GB/en-IN sentence 200)
    C# parity                 189 byte-identical after mirroring the table into EnglishArpabet.cs

⚠ THE LOADER IS NOW IN THREE PLACES and the third one is a test. `english.ts`, `en_rebuild_lexicon.mts`
and `test/en-lexicon-regenerable.test.ts` each build the map themselves, and adding the table to the
first two made the third fail with "the lexicon is not reproducible" — the right failure for the wrong
reason. Noted in that test, because the next table added will hit it again.

⚠ WHAT THIS DOES NOT BUY: the 311 undetermined sites. They are surnames and place names the referees do
not cover — `vancouver`, `dunkirk`, `plainclothes`, `songbook`, `minecraft`, `stonecutter`, `moonquake`,
`womankind`, and two hundred Rosen-/Steen-/Van- names — where the dictionary says `N`, the engine says
[ŋ], and nothing arbitrates. On Run 27's base rates the dictionary is right about nine times in ten
there, so most of them are probably wrong today. That is the largest single block of known-unknown left
on this axis, and closing it needs a source that covers surnames rather than a cleverer rule.

## Run 29 — 2026-09-19 — review of the seam table: every claim reproduces, and the gate dropped a true positive

Independent review of `fix/nasal-compound-seam` (#1358) against `origin/main`. Everything Run 28 claims
was re-run rather than taken on trust.

    npx tsx tools/gen/build-en-nasal-seam.mts --write   → byte-identical to the committed table
    npx vitest run                                       → 317 files, 6073 passed, 5 skipped
    npx tsx tools/check-goldens.mts --jobs 8             → 189 languages, 36495 rows, 0 stale
    dotnet run --project csharp/tools/parity -c Release  → 189 byte-identical, 0 differ; 5/5 accents build
    MOBY=… npx tsx tools/referee-eval/eval.ts en         → primary 2531/4037 62.7%; Moby-lexicon 26520 75.7%;
                                                           Moby-OOV 15056 (unchanged)

Run 28's numbers are exactly right — 2529→2531, 26505→26520, OOV flat, 3 golden rows, C# parity intact.
The builder's census reproduces at 590 / 37 / 20 / 311. TS and C# guards are behaviourally identical
(`!nasalSeam.get(word)?.includes(i)` against `!(nasalSeam is not null && TryGetValue && Contains(i))`),
both loaders skip `#` and blanks the same way, both regexes are the same `JsRegex`-compiled source, and
the tagger path is unwired on both sides symmetrically. Word casing is folded before the lookup, so
`Pancake`/`PANCAKE`/`pancake's` all read `pʰˈænkˌeᶦk`.

⚠ THE TIGHTENED GATE DROPPED A TRUE POSITIVE AND KEPT BOTH FALSE POSITIVES. Run 28 records the
`common`-membership tightening as the thing that stopped `kalanchoe`=`kalan`+`choe` and
`agincourt`=`agin`+`court`. Re-ran the builder with the loose gate (`dict.has(head) && dict.has(tail)`,
no length bound) and diffed the row lists. The tightening removes exactly two rows:

    corncob      ← corn·cob, Moby `kɔɹnkɑb`, an unambiguous compound seam
    kalanchoe    ← the intended casualty

`agincourt` survived, because `court` is in `g2p-common.txt`; so did `mankato`, because `kato` sits at
rank 20,530 of a 40,000-word Norvig web-frequency list that carries surnames freely. `corncob` was lost
to `tail.length >= 4`, not to the frequency gate at all. Net effect in the shipped lexicon:

    corncrake  kʰˈɔːɹnkɹeᶦk     corncrib  kʰˈɔːɹnkɹˌɪb     corncob  kʰˈɔːɹŋkˌɑːb   ← same `corn·`
    greengrocer ɡɹˈiːnɡɹoᶷsɚ                               greenkeeper ɡɹˈiːŋkiːpɚ ← same `green·`

Relaxing the bound to `tail.length >= 3` adds `corncob` and NOTHING ELSE (re-ran and diffed), so it is a
one-character change with one row of effect and no new risk.

⚠ THE SINGLE-SOURCE LICENCE IS DOING REAL WORK AND IS MOSTLY RIGHT. Instrumented the builder to emit the
`src` field it computes and then discards. 17 of the 32 derived rows rest on one referee:

    moby only  agincourt corncrib glengarry greencastle guncotton ironclad loincloth mankato pancake
               rheingold sunglass
    uk only    greengage greengrocer mooncalf pancakes pincushion vainglorious

Fifteen are transparent compounds and are right. The two that are not — `agincourt` (a French place
name, `agin`+`court`) and `mankato` (a Dakota place name, `man`+`kato`) — are exactly the words the
tightening was supposed to catch, and both rest on Moby alone, the noisiest of the three referees and
the subject of this very audit. Both happen to have the defensible answer (M-W writes `\ˈa-jən-ˌkȯrt\`
and `\man-ˈkā-(ˌ)tō\`), which is again how a loose gate survives a spot check.

⚠ THE TABLE IS NOT A COMPOUND-SEAM TABLE, WHICH THE HEADER AND THE FILENAME BOTH CLAIM. `hangul`,
`quincuncial`, `melancholy`, `agincourt` and `mankato` are not compounds; they are in the table because
two referees, or one plus a spurious split, write `n`. That is a defensible bar — but it is "the
referees say `n` here", not "there is a seam here", and the difference matters for the next reader
deciding whether a word belongs.

⚠ RUN 27'S PROSE CONTRADICTS THE SHIPPED TABLE. Run 27 lists the splitter's false positives as
"`benghazi`, `hangul`, `pangloss`, `sancho`, `panchromatic`, `vainglorious`, `cancan`, `galingale` (all
`ŋ`)". Three of those eight — `hangul`, `vainglorious`, `cancan` — are rows in the table Run 28 shipped.
The referees are unambiguous (`hangul`: us `h ɑ n ɡ u l`, uk `hɑːnɡuːl`; `cancan`: moby `kænkæn`, uk both
readings `n`; `vainglorious`: uk `veɪnɡlɔːɹiəs`), so the table is right and Run 27's aside is wrong.

⚠ THE TSV HEADER ADVERTISES A WORD IT DOES NOT CONTAIN. Both `en-nasal-seam.tsv` and
`build-en-nasal-seam.mts` use `Van·couver` as the worked example; `vancouver` is not a row and still
reads `væŋkˈuːvɚ`. It fails the bar legitimately — Moby says `n`, but wikipron-UK carries both
`vænkuːvɚ` and `væŋkuːvɚ`, so `verdict` returns null for UK and the word falls to single-source with no
common tail (`couver`). Run 28's "what this does not buy" is honest about it; the header is not.

Three latent defects in the builder, all empty against today's data:

1. `verdict` takes the FIRST `[nŋ]` before a velar in each reading and applies that one verdict to EVERY
   index in `idx`. Only three dictionary words have two `N`+velar sites (`inconclusive`, and its two
   inflections) and all three are prefix-protected, so nothing is affected today.
2. The inflection carry-over checks `p[i] === "N"` but NOT that `p[i+1]` is a `K`/`G`, while
   `test/en-nasal-seam.test.ts` checks both. The builder can therefore emit a row its own gate test
   rejects. Swept every stem × suffix against the dict: no such form exists today.
3. `transparentCompound` scans every `n` before `[ckgq]` in the SPELLING and licences the whole word if
   any of them splits, without checking that the split position corresponds to the phone index being
   licensed. Harmless while every row is single-index.

Rot: the new test catches the documented vector — an `en_g2p_ngram.ts --emit` that shifts phones leaves
an index that is no longer `N`+velar, and the test reports it by name; a word dropped from the dict is
caught too. What is NOT caught is a word that NEWLY earns a row, a referee file rebuilt from a different
`$MOBY`, or an index that silently lands on a different `N`+velar site in the same word. There is no
"the generated table is up to date" gate re-running the builder and diffing, and this repo has no such
convention for `tools/gen/*` generally, so that is a gap rather than a regression.

Smaller notes. The `src` provenance string the builder computes is never written — the third tuple
element is dropped by `rows.map(([w, i]) => …)`, so per-row sourcing exists only in the author's head.
`verdict`'s velar class is `[kɡ]` with U+0261 only; all four referee files are clean of ASCII `g` today
(checked: 0 occurrences in the phone columns) and clean of prosodic marks between nasal and velar (2 of
4,445 sites, both junk headwords), so neither bites, but neither is asserted. The C# parse maps a
`int.TryParse` failure to −1 and filters, while the TS keeps anything `Number.isInteger` accepts — so an
empty value field is index 0 in TS and nothing in C#; this mirrors the existing `en-syllabic` loader
exactly, so it is precedent rather than a new divergence. Run 28's "35 → 32" does not reproduce: the
obvious loose variant gives 34, so the intermediate being described is not the one the tool can express.

Verdict: the change is sound, the measurement is honest, and the one substantive defect is `corncob`.

## Run 30 — 2026-09-19 — review fixes: one real row, and three claims that were not checked

Acting on Run 29.

⚠ THE LENGTH FLOOR WAS COSTING A TRUE POSITIVE AND BUYING NOTHING. Run 28 tightened the single-source
licence with two conditions at once — the second element must be in `g2p-common.txt` AND be four letters
or more — and reported the pair as "35 → 32". Separating them:

    tail ≥ 3, no common gate      34 rows      (Run 28's "35" does not reproduce)
    tail ≥ 4, common gate         37 rows      shipped
    tail ≥ 3, common gate         38 rows      ← now

The `common` gate is the one that works: it drops `kalanchoe`, which is what it was added for. The
length floor drops only **`corncob`** — `corn`+`cob`, Moby `kɔɹnkɑb`, as plain a seam as the file
contains — and leaves BOTH rows the tightening was aimed at, because `agincourt` has a common `court`
and `mankato` a `kato` that the frequency list carries along with every other surname. So the shipped
table said `corncrake` and `corncrib` with `n` and `corncob` with `ŋ`, and `greengrocer` with `n` beside
`greenkeeper` with `ŋ`. Floor is 3; `corncob` is the only row it adds, verified by diff.

⚠ AND THE TWO SURVIVORS ARE NOW NAMED RATHER THAN THRESHOLDED, which is the right shape for them: a
threshold that cannot separate `agin`+`court` from `corn`+`cob` should not be asked to. The builder
prints the 18 single-source rows and says which two are not really compounds. It also now prints the
evidence census it was computing and throwing away.

⚠ THE FILE IS NOT A COMPOUND-SEAM FILE AND THE HEADER SAID IT WAS. `hangul`, `melancholy`,
`quincuncial`, `agincourt` and `mankato` have rows and are not compounds of anything; the bar is "every
referee covering this word writes `n` here", and the name describes the majority, not the criterion.
Header and provenance now say so, and both now say what the file is NOT — `Vancouver` was offered in the
header as an example and has no row, because wikipron-UK carries both readings and the verdict is null.

⚠ AND RUN 27 ASSERTED A VERDICT FOR WORDS IT HAD NOT LOOKED UP. Its splitter-false-positive list read
"`benghazi`, `hangul`, `pangloss`, `sancho`, `panchromatic`, `vainglorious`, `cancan`, `galingale` (all
`ŋ`)". Three of the eight are `n` on referee evidence and Run 28 shipped rows for them. Five of eight
still sinks the splitter as a rule, so the conclusion holds and the supporting sentence did not.
Corrected in place with a pointer here rather than silently, because the overstatement is the finding.

Three latent builder gaps Run 29 found are all empty against today's data and are now named in the code
rather than fixed speculatively: `verdict` reads the first site and speaks for all of them (only
`inconclusive*` has two, all prefix-protected); `transparentCompound` licences a whole word rather than
an index; and the inflection carry-over checked only that the phone was an `N`, not that a `K`/`G`
followed — that one IS fixed, because the gate test asserts both and the builder could have emitted a
row its own test rejects.

    en-nasal-seam.tsv         37 → 38 rows (+corncob)
    accent-lexicon.tsv        1 further row
    Moby — lexicon            26520 → 26521
    primary / OOV / goldens   unmoved
⚠ AND THAT +1 CONTRADICTS WHAT THIS ENTRY FIRST SAID, which was "unmoved — `corncob` is in no referee
corpus". It is in the Moby lexicon corpus (`kɔɹnkɑb`), which is the single source that licensed the row
in the first place. Written before the eval was re-run and corrected by re-running it; noted because
"this cannot have moved anything" is exactly the claim that does not need checking right up until it
does.

## Run 31 — 2026-09-19 — the inversion, measured and REFUSED, and the 310 residual re-characterised

Run 30's plan was to invert the seam table: delete the assimilation rule, honour CMUdict's `N`, and list
the SLIPS instead of the seams — on the argument that slips are bounded and referee-covered while seams
are open-ended, and that the ~310 undetermined sites would then default to `n`, right about nine times
in ten on Run 27's base rate. The first measurement kills it.

⚠ THE 298:33 BASE RATE IS NOT THE RATE THAT APPLIES. It counts every labelled site in the dictionary,
including the 590 the transparent-prefix guard already protects — `unclean`, `income`, `incline` — which
are `n` for everyone and which the rule never touches. Restricted to the words the converter ACTUALLY
assimilates:

    words the converter assimilates today (dict N, no transparent prefix)   363
      two or more sources say n                                              15
      one source says n                                                      38
      every source says ŋ — the slips                                        20
      sources split                                                           8
      NO REFEREE AT ALL                                                     282

53 against 20, not 298 against 33. And the 38 single-source rows do not survive reading:

    ancona      moby  ɑnkɔnɑ        pancreatic  moby  pænkɹiætɪk
    mancunian   uk    mankjuːnɪən   lohengrin   moby  loʊənɡɹɪn
    serengeti   uk    sɛɹənɡɛti     wollongong  uk    wʊlənɡɒŋ

Every one of those is [ŋ] in speech. They are real transcriptions, from both sources rather than one
loose one (20 Moby, 18 UK), and they are writing the PHONEME and not the realisation. `nomenclature`
gives it away completely: the UK referee carries `nəʊmɛnklət͡ʃə` AND `nəʊmɛŋklət͡ʃə` for the same word.
That is the signature of a notation choice, not a lexical judgement.

Tested whether the convention is syllabification — write `ŋ` only where the nasal and the velar share a
coda — by cross-tabulating every referee's own sites:

                                  velar is an ONSET        velar in a CODA
    moby lexicon                  n 175  ŋ 212  (55% ŋ)    n 122  ŋ 343  (74% ŋ)
    moby oov                      n 249  ŋ 333  (57% ŋ)    n 131  ŋ 336  (72% ŋ)
    wikipron us                   n  17  ŋ  41  (71% ŋ)    n  15  ŋ  41  (73% ŋ)
    wikipron uk                   n 331  ŋ 909  (73% ŋ)    n 221  ŋ 969  (81% ŋ)

Not a clean convention either — the position moves Moby 19 points and wikipron-US 2. So it is neither
purely lexical nor purely notational: it is a per-transcriber mixture, and that is the worst possible
substrate for a 282-word blanket flip. Corrected honest estimate among the labelled: roughly 35 seams,
26 slips, 20 undecidable. Flipping 282 unlabelled words on a ~57% base rate is a coin toss with a
provenance file attached. **REFUSED.**

⚠ AND RUN 28'S CHARACTERISATION OF THE RESIDUAL WAS WRONG, which matters more than the refusal. It says
of the ~310 undetermined sites that "on Run 27's base rates the dictionary is right about nine times in
ten there, so most of them are probably wrong today". They are not a defect backlog. They are sites
where the sources disagree with each other about a notation, and where [ŋ] — what we emit — is the
natural realisation anyway. This engine transcribes at a NARROW depth (aspiration, dark l, flapped t),
and [ŋ] before a velar is correct at that depth even where a broad referee writes the phoneme /n/.

So the #1358 table stands on its own terms — it required EVERY covering referee to agree, which is a
much stronger bar than the base rate — but the axis is closed. It is not where the next improvement is.

⚠ WHAT THIS DOES CHANGE IS THE CASE FOR COMPOUNDS AS DATA, upward. The reason this axis dissolved is
that transcription conventions cannot settle a morphological question. An independent morphological
inventory can — and it would settle it for the classes where the answer is AUDIBLE rather than
notational: compound fore-stress (106 named words, `englishArpabet.ts`), the compound-seam geminates
(93 dictionary rows, `KNOWN_GAPS`), and the OOV grapheme seams the skeleton probe turned up, where
`haphazardly` reads ⟨ph⟩ as /f/ ACROSS hap|hazard. Those are real errors a listener hears. The velar is
not. Next step is the coverage probe, not more velar work.

## Run 32 — 2026-09-19 — compounds as data: the coverage probe, before the 3 GB download

Run 31 closed the velar axis and argued the case for a morphological inventory went UP, because a
transcription convention cannot settle a morphological question. Question for this run: does a
non-circular inventory actually exist, and does it carry the distinction the engine needs?

English Wiktionary via kaikki. ⚠ NOT DOWNLOADED — the full extract is 3.0 GB, and kaikki serves
per-word JSONL at `/dictionary/English/meaning/<l>/<l2>/<Word>.jsonl`, so the coverage question can be
answered for a few hundred words at 0.2 s each. (Capitalisation matters in the PATH as well as the
filename: `V/Va/Vancouver` is 200, `v/va/Vancouver` is 404. Found by getting 404s for every proper noun
in the first sample and assuming the words were absent.)

⚠ THE DISTINCTION THE CODEBASE SAID IT COULD NOT HAVE IS IN THE DATA, and it is the hyphen:

    pancake        surf      ['pan',   'cake']        ← compound
    panchromatic   ety       ['pan-',  'chromatic']   ← PREFIX, and marked as one
    misspell       ety       ['mis-',  'spell']
    idiosyncrasy   surf      ['idio-', 'syn-']
    drinkable      suffix    ['drink', 'able']

`pan·cake` against `pan-chromatic` is the exact pair that defeated every rule in Run 27, and Wiktionary
separates them. Precision on the first sample is the other half of the news: `anglophile`, `ankh`,
`gangrene`, `pancreas`, `pangloss` and `vanguard` carry NO compound template — every one a word that a
splitter claims and should not. `vanguard` is the nicest of them; it is from *avant-garde* and is not
`van`+`guard`, which no amount of dictionary lookup would ever have told us.

⚠ THE TEMPLATE ARGUMENT LAYOUT VARIES AND THE FIRST EXTRACTOR GOT 1 HIT OUT OF 23. `compound` and `af`
put the parts at args 2 and 3, `ety` and `surf` at 3 and 4 — so an extractor keyed to one layout reports
near-zero coverage and looks like a finished negative result. The fix is to take every positional arg
and drop language codes and the `:`/`+`/`-` control values.

Coverage measured against a REAL evidence set rather than a hand-picked sample — the 153 dictionary
words carrying a geminate consonant, which is the `KNOWN_GAPS` compound-seam class:

    lemma decomposed by Wiktionary           74   48%
    recoverable by inflection carry-over     19         (bookkeepers, coattails, misspells, …)
    ─ combined                               93   61%
    genuinely uncovered                      60

And the 60 are not a random tail. 27 of them are `-ness`/`-ly` derivations whose geminate is at the
suffix boundary — `fineness`, `greenness`, `thinness`, `drolly`, `dully`, `genteelly` — which need no
inventory at all: a stem ending in the consonant the suffix begins with is a regular, derivable rule.
Another handful are CMUdict's unhyphenated spellings (`parttime`, `shortterm`, `iceskate`). What is
left is about 30 real gaps, `roommate` and `teammate` among them — which is a hand list, not a project.

    Wiktionary 61%  +  a regular suffix rule (~27)  +  ~30 hand rows  ≈  the whole class

⚠ AND THE STRESS CLASS IS THE WORST FIT, WHICH IS THE OPPOSITE OF WHAT I EXPECTED. The 106 words
`englishArpabet.ts` names as its evidence set are fore-stressed compounds heavy in proper nouns and
neologisms, and the four it names by name — `Afrobeat`, `Twitterverse`, `Antabuse`, `allemande` — carry
no compound template between them. Wiktionary templates ordinary lexis well and coined proper nouns
badly, so the class with the loudest audible payoff is the one this source serves least. It should be
attempted last, if at all.

Order this argues for: the geminate seams first (61% + a derivable rule + a short hand list, and the
`--emit` gate already exists), then the OOV grapheme seams (`haphazard` decomposes, and ⟨ph⟩ read as
/f/ across `hap|hazard` is an error a listener hears), then stress, on a different source or not at all.

Building the inventory needs the 3.0 GB dump — 135k per-word fetches at 0.2 s is seven hours and rude.
That download is the first step of the next block, not this one.

## Run 33 — 2026-09-19 — adversarial re-measurement of Runs 31 and 32

Re-ran every number in the two entries above from the files they name, plus fresh kaikki fetches. Run
31 survives. Run 32's headline coverage figure does NOT: it is an UNDER-count, and the mechanism is the
arg filter the entry itself describes.

**Run 31 — reproduces.** Population and guard are exact:

    dict words with an N before K/G, prefix-protected (i<=6 && TRANSPARENT_PREFIX)   590   ← entry says 590
    dict words with an N before K/G, NOT protected                                   363   ← entry says 363
    (the two sets are disjoint; 953 words carry a site at all)

`two or more sources say n` = 15, exact. The 20 Moby rows in the single-source bucket are exact. The
other buckets do not reproduce to the digit because the entry does not say how a referee that carries
BOTH variants is scored — which is the `nomenclature` case it highlights. Three defensible readings
bracket it:

                              2+ n   1 n   all ŋ   split   no ref
    entry                       15    38     20       8      282
    all UK variants, strict     15    35     19      13      281
    first UK column only        17    36     18      10      282
    any-n-wins within referee   18    36     19       9      281

Every reading gives ~50-54 n against ~18-20 all-ŋ with ~281 unlabelled, so the refusal argument is not
sensitive to it. ⚠ BUT THE ENTRY SHOULD SAY WHICH RULE IT USED, because it cites a within-referee split
as its central piece of evidence and then silently collapses those rows into a bucket.

Spot checks all hold: `ancona ɑnkɔnɑ`, `pancreatic pænkɹiætɪk`, `lohengrin loʊənɡɹɪn` (moby-lexicon);
`mancunian mankjuːnɪən`, `serengeti sɛɹənɡɛti`, `wollongong wʊlənɡɒŋ` (UK); and the UK row for
`nomenclature` really does carry `nəʊmɛnklət͡ʃə` AND `nəʊmɛŋklət͡ʃə` (four variants in all).

Cross-tab reproduces to within one or two counts (site detection at the margins — a following combining
mark, a word-final velar):

                          entry onset      mine onset      entry coda      mine coda
    moby lexicon          175/212  55%     175/212  54%    122/343  74%    124/346  73%
    moby oov              249/333  57%     249/335  57%    131/336  72%    133/341  71%
    wikipron us            17/41   71%      17/42   71%     15/41   73%     16/41   71%
    wikipron uk           331/909  73%     331/912  73%    221/969  81%    226/979  81%

⚠ ONE NUMBER MOVES THE ARGUMENT SLIGHTLY THE ENTRY'S WAY: wikipron-US comes out 71% onset / 71% coda
here, i.e. ZERO points of position effect, not two. The "neither purely lexical nor purely notational"
reading is if anything stronger than written.

**Run 32 — the 48% is reproducible AND it is wrong, by 26 points.** Reconstructing the described
extractor (positional args; drop language codes and values starting with `:`, `+`, `-`) over the same
population lands on the entry's numbers, including a detail that could not be a coincidence:

    lemma decomposed, arg filter AS DESCRIBED        71-80 of 155   46-52%   (entry: 74 of 153, 48%)
    of the uncovered, -ness/-ly                              27              (entry: 27)

⚠ SO THE RECONSTRUCTION IS FAITHFUL, AND THE `-` RULE IS THE DEFECT. Wiktionary marks a SUFFIX with a
LEADING hyphen, exactly as it marks a prefix with a trailing one — `af{Twitter|-verse}`,
`ety{room|-mate}`, `surf{idio-|syn-|-crasy}`. Dropping leading-hyphen args therefore deletes the second
element of every suffix decomposition, which either truncates it or drops it below two parts and makes
it read as "no template at all". The entry's own insight is that THE HYPHEN IS THE DISTINCTION; its
extractor is throwing half the hyphens away. Keeping them:

    lemma decomposed, hyphenated args KEPT          107-116 of 155   69-75%
    of the uncovered, -ness/-ly                               0

⚠ AND THE TWO WORDS THE ENTRY NAMES AS THE CANONICAL HAND-LIST GAPS ARE IN THE SOURCE:

    roommate   ety  ['room', '-mate']
    teammate   ety  ['team', '-mate']

So "~27 -ness/-ly handled by a derivable suffix rule + ~30 hand rows, `roommate` and `teammate` among
them" is an artefact of the filter, not a property of Wiktionary. All 27 -ness/-ly rows are templated;
`roommate`/`teammate` are templated. What is actually left uncovered is 39 rows, and they are dominated
by INFLECTIONS of covered lemmas (`bookkeepers`, `coattails`, `roommates`, `misspells`, `lampposts`,
`outtakes`, `missteps`) — the entry's own +19 carry-over, scaled up. The genuine residue is small:
CMUdict's unhyphenated spellings (`parttime`, `shortterm`, `iceskate`, `profittaking`), two acronyms
(`cxc`, `scs`, no kaikki page at all), and a handful of real misses (`birddog`, `exsolve`, `goddam`,
`nonnegative`, `unnerved`, `misspoke`/`misspent`, `loosestrife`). Combined coverage after inflection
carry-over is roughly 90%, not 61%.

The direction of the error does not reverse the recommendation — geminate seams first is if anything
MORE attractive at 75% lemma coverage than at 48% — but the plan attached to it is void. Rewrite the
arg filter to strip a leading hyphen and RECORD it as affix marking rather than discard the arg, then
re-measure before sizing any hand list.

**Run 32's precision sample has three wrong rows, two of them load-bearing.** Fetched fresh:

    anglophile     confix {'1':'en','2':'Anglo','3':'phile'}      ← entry says NO template
    Afrobeat       prefix {'1':'en','2':'Afro','3':'beat'}        ← entry says NO template
    Twitterverse   af     {'1':'en','2':'Twitter','3':'-verse'}   ← entry says NO template

`Twitterverse` is the `-` filter again. `anglophile` and `Afrobeat` are a template-NAME gap: the entry
counts `suffix` (for `drinkable`) as coverage but evidently not `prefix` or `confix`, which is not a
distinction the source makes. Confirmed genuinely absent: `ankh`, `gangrene`, `pancreas`, `pangloss`,
`vanguard`, `Antabuse`, `allemande`. Confirmed present as printed: `pancake surf ['pan','cake']`,
`panchromatic ety ['pan-','chromatic']`, `misspell ety ['mis-','spell']`, `drinkable suffix
['drink','able']`. `idiosyncrasy` is really `surf ['idio-','syn-','-crasy']` — the entry prints the
truncated two-part form, which is the same bug showing in the evidence.

⚠ WHAT THAT COSTS THE ARGUMENT. `anglophile` is one of the five words the converter comment names as a
real [ŋ] SLIP that a splitter wrongly claims, and Run 32 uses its absence from Wiktionary as the proof
that this source has the precision a splitter lacks. Wiktionary decomposes it. The precision claim
needs re-testing against the labelled slips rather than a hand-picked six. And with `Afrobeat` and
`Twitterverse` both templated, "the four it names by name carry no compound template between them" is
2 of 4, so "the stress class is the worst fit, attempt it last" is not established by this probe.

⚠ AND ABSENCE CUTS BOTH WAYS ON THE SEAM TABLE, which neither entry says. `vanguard` genuinely has no
compound template — and `vanguard` is a ROW in `en-nasal-seam.tsv`, a referee-confirmed [n] seam. For
the velar use case an inventory keyed on Wiktionary would LOSE that row. Absence is presented as pure
precision; for the seam table it is recall loss.

**On "153, which is the KNOWN_GAPS compound-seam class".** Two separate looseness problems.

The population is "dict rows with an adjacent identical consonant phone". That measures 155 today, not
153 (the two extra are likely the acronyms `cxc`/`scs`, which have no kaikki page and may have been
dropped silently — say so if they were). Same definition at `ab2e3277`, where the `93 rows` comment in
`test/en-curation-gap.test.ts` was written, measures 98. So 93 and 153 are the SAME population at
different dict snapshots, not two populations — the Moby import grew it — and Run 6 of this same
document already reports 144 for it. ⚠ THREE DIFFERENT NUMBERS FOR ONE CLASS ARE NOW LIVE IN THE REPO
(93 in the test comment, 144 in Run 6, 153 here). Pick one measurement, date it, and fix the stale ones.

But calling it "the `KNOWN_GAPS` compound-seam class" is wrong on its face: `KNOWN_GAPS` holds four
seam rows (`earrings`, `roommate`, `roommates`, `teammate`), and 39 of the 155 are `-ness`/`-ly`
derivations that are not compound seams at all — a fact the entry relies on three paragraphs later when
it routes 27 of them to a suffix rule. The denominator is "any geminate", which is a defensible
evidence set, but it should be named that way.

**Verdict.** Run 31 lands as written (tighten the referee-variant rule). Run 32's finding that
Wiktionary marks prefixes with a hyphen is real and is the valuable part; its coverage measurement, its
precision sample and its ordering recommendation all rest on an arg filter that discards suffix
marking, and should be re-run before anything is built on them.

## Run 34 — 2026-09-19 — the hyphen bug, re-measured; and the type label IS the velar discriminator

Run 33 is right about the bug and it is the important kind. Wiktionary marks a SUFFIX with a LEADING
hyphen exactly as it marks a prefix with a trailing one, and Run 32's extractor dropped every arg
starting with `-`. That deletes the second element of every suffix decomposition, which is why the
`-ness`/`-ly` tail looked like a coverage hole that needed "a regular rule rather than an inventory".
It was the instrument. Run 32's own printed evidence showed it and I did not read it: `idiosyncrasy` is
`['idio-', 'syn-']` there, and the real template is `['idio-', 'syn-', '-crasy']`.

Re-measured with the leading hyphen kept, `prefix`/`confix` added to the template set, and `la:…`
cognate args dropped (which is what put `blackcap = la:ātricapillus|black` in Run 32):

    geminate set, 153 words      lemma decomposed  95  (62%)
      by boundary type           suffix 43   compound 33   prefix 19
      uncovered                  58, now dominated by INFLECTIONS of covered lemmas

⚠ I GET 62%, NOT RUN 33's 69–75%, and the entry should say so rather than adopt the reviewer's figure.
Same direction, same conclusion, different number; the gap is probably the template set or the
capitalisation retry. What is not in doubt: `-ness`/`-ly` goes from 27 uncovered to 0, and `roommate`
`['room','-mate']` and `teammate` `['team','-mate']` — Run 32's two named "hand list" gaps — are in the
source. **The "27 suffix rule + ~30 hand rows" plan is void.**

⚠ AND `anglophile` DECOMPOSES, WHICH RUN 32 USED AS ITS PROOF OF PRECISION. My fetch was lowercase and
got a 702-byte stub; `Anglophile` is `confix ['Anglo', 'phile']`. Our dictionary is lowercased, so the
builder must try both cases — the same case-sensitivity Run 32 recorded for URLs, missed one level down.
⚠ RUN 33 IS WRONG ABOUT `Afrobeat`, checked against a fresh fetch rather than my cache: 814 bytes,
`etymology_templates: []`. `Twitterverse` is `af ['Twitter', '-verse']` and is Run 33's point. So the
stress class is 1 of 4, not 0 (Run 32) and not 2 (Run 33) — still the worst-served class, and now with
the right number under it.

⚠ AND THE CORRECTION REVERSES RUN 27's CENTRAL NEGATIVE. `anglophile` decomposing is not a precision
failure; it is the answer. Boundary TYPE, not boundary presence, is what predicts velar assimilation:

    SLIP  (referees say ŋ), 17 words   compound  0   confix 2  prefix 3  suffix 2  no template 10
    SEAM  (referees say n), 15 words   compound 12   confix 0  prefix 0  suffix 0  no template  3

`compound` is 12 for 12 with no false positives, and not one slip is a compound. `Anglo|phile`,
`laryngo|scope`, `idio|syn|crasy`, `vanco|mycin` are neoclassical confixes and prefixes — bound
combining forms, phonologically one word — and they assimilate. `pan·cake`, `rain·coat`, `corn·cob` are
compounds and do not. That is exactly the `pan·cake` against `pan-chromatic` pair Run 27 could not
separate, and Wiktionary separates it with a label rather than a rule.

So Run 27's "the discriminator is not learnable from this evidence" was true OF THAT EVIDENCE and is
false in general. It is not learnable from spelling, from dictionary-membership splitting, or from a
morpheme list mined out of referee labels — all three were tried and all three failed. It is learnable
from an external morphological inventory that distinguishes compounding from affixation, which is what
this repo would not have had before this probe.

⚠ RECALL, NOT PRECISION, IS THE REMAINING PROBLEM, and Run 33 names the case that shows it: `vanguard`
has no Wiktionary template AND is a referee-confirmed row in `en-nasal-seam.tsv`. So does `leningrad`,
so does `cancan`. Three of fifteen seams are invisible to the source. The shape that follows is a
CASCADE, not a replacement: `compound` blocks; every other label does not; NO LABEL falls through to
today's rule plus the referee-backed seam table, which stops being the mechanism and becomes the recall
patch it should always have been.

Two smaller corrections Run 33 is right about:
- Run 32 calls the 153 words "the `KNOWN_GAPS` compound-seam class". They are not. `KNOWN_GAPS` holds
  four seam rows; this is "dictionary words with two adjacent identical consonant phones", which is a
  superset and includes 39 `-ness`/`-ly` non-compounds — a fact the same entry then relies on. The
  count is also a moving target: 153 under this run's filter (`^[a-z]{5,20}$`), 155 under Run 33's,
  144 in Run 6, 98 at the commit where the "93 rows" comment was written. Dated and defined here.
- Run 31 never says how a referee carrying BOTH variants is scored, which is the `nomenclature` case it
  leads with. It is scored as NO VERDICT (the `verdict` helper returns null unless the readings agree).
  Run 33 brackets the alternatives at 35/19/13/281 … 36/19/9/281; the refusal is insensitive to the
  choice, and the 590/363 split and the 15 two-source rows reproduce exactly either way.

## Run 35 — 2026-09-19 — the boundary table, built; and an honest accounting of what it bought

Downloaded the 3.0 GB kaikki English extract and built `en-morph-boundary.tsv`.

    kaikki lines                                     1,492,836
    English entries whose headword we carry             88,631
    a stated morpheme split                             24,368
      rejected — parts do not concatenate to the word    6,905
      rejected — first element not in our dictionary     1,175
      rejected — its phones are not a prefix of the word's 2,963
    → ROWS                                              13,325
        suffix 6,048   compound 4,115   prefix 3,549   confix 115

⚠ THE DESIGN GOT CHEAPER THAN RUN 34 PROPOSED, and this is the part worth copying. The boundary table
is a BUILD-TIME input to `build-en-nasal-seam.mts`, not a runtime input to the converter. So there is
no new engine parameter, no C# mirror, and no fourth copy of a loader — the cascade lives in one place
and the thing that ships is a table the engine already consults. An ENOENT catch means a checkout
without the 3 GB dump rebuilds the referee-backed rows byte-identically, which was verified before the
dump finished downloading.

⚠ THE DRY RUN CAUGHT TWO BUGS THAT WOULD BOTH HAVE SHIPPED AS A CONVINCING ZERO. Running the builder
against ~200 cached per-word fetches before the dump landed:
- SHORT MORPHEMES WERE BEING DELETED AS LANGUAGE CODES. The first `partsOf` dropped any 2–3 letter arg
  on the assumption it was a code, which removes `cob` from `corn·cob`, `pan` from `pan·cake`, and
  `gun`, `key`, `man`, `ear`, `bar` — most of the compounds worth having. The table just looks sparse;
  nothing errors. These templates are only read off English entries, so the only code is `en` and it is
  dropped by value now. 74 → 98 rows on the mini set.
- AN OFF-BY-ONE IN THE CONSUMER. The table indexes the first phone AFTER the boundary; the seam
  builder's index is the position of the NASAL. `rain·coat` is R EY1 N | K OW2 T — nasal at 2, boundary
  at 3. Matching on the wrong one finds nothing and is indistinguishable from a source with no coverage.

What it bought on the velar class, stated plainly because it is less than Run 34 implied:

    seam table          38 → 49 rows   (26 now earned by a compound boundary, 23 by referees)
    new rows            greenkeeper, machinegun(s), mankiller, moonquake, oceangoing,
                        stonecutter(s), suncoast, turncock, winegrower
    undetermined        310 → 300
    Moby — lexicon      26521 → 26522
    primary             2531, unmoved
    goldens             0 stale; C# parity 189 byte-identical; 6,076 tests

⚠ ELEVEN ROWS AND ONE SCORE POINT. The residual on this axis is surnames — Rosenkranz, Steenkamp,
Vancamp — and Wiktionary has no etymology for those, exactly as Run 32 predicted. The velar consumer
was chosen first because its gate already existed, not because it was the payoff; it is the smallest of
the table's four uses. The 11 words are ones Run 28 listed under "what this does not buy", so the
mechanism is doing what it claimed — there is just not much of this particular class left.

The table is the deliverable. Its other three consumers are untouched and are where the value is:
the compound-seam geminates (155 words, and the `-ness`/`-ly` boundaries are now IN the source rather
than needing a rule of their own), compound fore-stress (worst-served — 1 of the 4 words
`englishArpabet.ts` names has a template), and the OOV grapheme seams, where `haphazard` decomposes and
⟨ph⟩ read as /f/ across `hap|hazard` is an error a listener hears.

⚠ AND THE INTERMITTENT TEST FAILURE IS NAMED THIS TIME. `test/check-goldens-jobs.test.ts` failed once
during this run and passed in isolation and on re-run. It spawns child processes to compare a pooled
golden check against a serial one, and both failures in this session happened while something else was
saturating the machine (a `dotnet` build here, a parallel suite earlier). It is contention, not flake,
and the fix if it recurs is to serialise that test rather than to retry it.

## Run 36 — 2026-09-19 — review of #1360: every number reproduces, and the KIND label has a mechanical hole

A high-effort review of `feat/morph-boundary-table` against `origin/main`. Everything the branch
claims about reproducibility is true; the finding is about the one field the design says is the whole
point.

### Reproduction — all three claims hold

    KAIKKI=/mnt/data/kaikki-English.jsonl npx tsx tools/gen/build-en-morph-boundary.mts --write
    → md5 73100b33b1570a9edb986fcf7e84e6a8, IDENTICAL to the committed table
    kaikki lines 1492836 · carried 88631 · split 24368 · 6905/1175/2963 rejected · ROWS 13325
    suffix 6048  compound 4115  prefix 3549  confix 115        ← every stated number, exactly

    npx tsx tools/gen/build-en-nasal-seam.mts --write
    → IDENTICAL to the committed 49-row table. 26 by compound boundary, 23 by referee.

    (boundary table moved aside) npx tsx tools/gen/build-en-nasal-seam.mts --write
    → "(no en-morph-boundary.tsv — referee evidence only)", 38 rows, BYTE-IDENTICAL to origin/main.

Reordering the unanimous-[ŋ] check above the compound check is behaviour-preserving on the referee-only
path, which is what that last run proves rather than argues.

    eval en: primary 2531/4037 (62.7%) · Moby-lexicon 26522/35049 (75.7%)   — both as stated
    check-goldens --jobs 8: 189 languages, 36495 rows, 0 stale
    dotnet parity -c Release: 189 byte-identical, 0 differ; 5/5 accent variants
    npx vitest run: 317 files, 6076 passed, 5 skipped, 0 failed (no contention flake this time)

### The 11 new seam rows are all correct, and one is inert

`greenkeeper machinegun(s) mankiller moonquake oceangoing stonecutter(s) suncoast turncock winegrower`
— every one a transparent N|velar compound seam that GenAm citation speech keeps as [n], each with
secondary stress on the second element in the dictionary row. Nothing here should assimilate.

⚠ `oceangoing` CHANGES NOTHING. `accent-lexicon.tsv` reads `ˈoᶷʃn̩ɡˌoᶷɪŋ` — the nasal is already
syllabic `n̩` from `en-syllabic.tsv`, so the velar rule never reached it. That is why the lexicon moved
10 rows for 11 new seam rows, and the 10/11 discrepancy in Run 35 is explained rather than an error.

Cross-check of the label against the referees on this axis, over the whole dictionary:

    compound boundary at an N+velar site, referees UNANIMOUSLY [ŋ]:  0
    compound boundary at an N+velar site, referees SPLIT:            0
    compound boundary but the prefix guard catches it first:         4
      downcomer  incomparable  ingoing  innkeeper

Zero false positives that reach output. But `incomparable` in that list is the thread to pull.

### ⚠ THE `+pre` / `+com` MARKER IS THE KIND, AND `partsOf` THROWS IT AWAY

`{{surf}}` — 664 of the 13,325 rows — puts the kind in its FIRST POSITIONAL ARG, before the language
code:

    incomparable -> surf {1:'+pre', 2:'en', 3:'in',  4:'comparable'}
    pancake      -> surf {1:'+com', 2:'en', 3:'pan', 4:'cake'}

`partsOf` drops any arg starting with `+` as a control value and `kindOf` never sees it, so an unhyphenated
`+pre` split falls through to the DEFAULT bucket, which is `compound`. `pancake` is right by luck; these are
not. Recomputed over the shipped table, by marker against assigned kind:

    +suf → compound   46      +pre → compound   17      +con → compound    1
    +com → compound   24  ✓   +suf → suffix      1  ✓   +af  → pre/suf/com 5

Eighteen shipped rows carry `compound` where the source explicitly says prefix or confix:

    abreast across disburse disclose foreman impenitent improper incomparable insoluble
    miscarry mislead outburst outdraw overman overstep pentad underwrite unlearn

A second, independent instance of the same hole: **`con` is in `TPL` but missing from `kindOf`'s name
switch.** `{{con}}` is the `{{confix}}` shortcut; 22 of its 27 matched entries are labelled `compound`,
5 of which reach the table — `polyphonic prefix procaine triangle underman`, i.e. `tri·angle` and
`pre·fix` are shipped as compounds. `com`→compound is fine only because compound is the default.

⚠ THE POINT IS THAT `compound` IS THE DEFAULT BUCKET, NOT AN ASSERTION. The provenance says "a consumer
decides which kinds it respects"; what the file actually offers is three positively-identified kinds and
one residue. The velar consumer survives because its 26 compound hits happen to be clean and because
`TRANSPARENT_PREFIX` catches `in-`/`un-`/`syn-` before the table is consulted. The three consumers Run 35
names as "where the value is" have no such guard: compound FORE-STRESS reading `mis|lead`, `dis|close`,
`un|learn`, `in|comparable`, `over|man`, `fore|man`, `french|man`, `dread|ful`, `grace|ful` and `act|ive`
as compounds is `MIS-lead` and `FRENCH-man` with a full vowel. Fix before a second consumer lands:
read the `+xx` marker in `partsOf`/`kindOf` instead of discarding it, and map `con`→confix.

### Three named examples are not in the table

`build-en-nasal-seam.mts` lines 22–24 and the provenance both say "`Anglo·phile`, `laryngo·scope`,
`vanco·mycin` are confixes and prefixes, and they assimilate". They have NO ROW AT ALL —
`anglo` is `AE1 NG G L OW0` against `anglophile`'s `AE1 N G L AH0 …` so the alignment gate rejects it,
and `laryngo`/`vanco` are not in the dictionary. Their assimilation is preserved by ABSENCE, not by the
kind distinction, which is a materially weaker claim than the comment makes. The table DOES carry the
discriminating negative evidence, 160 non-compound boundaries at N+velar sites — `panchromatic`
(prefix, and the one the test uses), `incombustible`/`syncarpous`/`synclinal` (confix),
`humankind`/`irangate`/`stevengraph` (suffix) — so the comment should name words it actually contains.

### Rot

- ⚠ NOTHING LINKS THE TWO TABLES. `en-nasal-seam.tsv` is now derived from `en-morph-boundary.tsv`, and no
  test asserts they agree. Regenerate either without the other and goldens, parity and the suite all stay
  green, because the engine reads the committed seam table and never the boundary table.
- The new gates fire on gross corruption — verified by mutation: a `99:compound` row and a `3:bogus` row
  each fail their test. Neither catches the failure mode the comment itself names: an index that SHIFTS
  but stays in bounds after an `--emit` moves a word's phones. The table stores no morpheme, so the test
  cannot re-derive the boundary. Emitting the head morpheme as a third column would make the check exact.
- The ENOENT fallback is silent on purpose, which also means a deleted table plus `--write` quietly drops
  11 rows with one line of output. An explicit `--no-boundary` opt-in would make absence an error.
- `considered` (printed as, and copied into the provenance as, "English entries whose headword we carry
  88,631") is counted after `found.has(w)` skips, so it is neither entries nor distinct words.

### Licence hygiene — the fence is incomplete

`en-morph-boundary.tsv` is a CC-BY-SA 4.0 / GFDL derivative and IS distributed: `data/` is the
`vernacula-phonemizer-data` workspace, whose `files` allowlist packs all of `languages/`. NOTICE.md's own
closing rule is "any new data file lands with a `*.PROVENANCE.md` sidecar, a row in the provenance map,
and — where attribution is owed — an entry here." The branch delivers the sidecar and neither of the
other two:

- `LICENSES/PROVENANCE.md` §3 "Shipped lexica/tables" does not list it. It would be the FIRST shipped
  `english/` file in §3 — §1 currently declares the English data directory as CMUdict/public-domain, so
  this is a stratum change for that language, not just one more row.
- `NOTICE.md` §3 Wiktionary bullet is not extended.
- The file is build-time-only: nothing in `src/` or `csharp/` reads it. Shipping 270 KB of share-alike
  data in the runtime data package to feed one `tools/gen` script is worth questioning — `tools/` is
  outside both packages and is where the referee corpora already live.
- `tools/gen/README.md` enumerates every generator in that directory and gains neither new entry, and
  the tool takes `KAIKKI=` where the three sibling kaikki builders take `$DUMPS`.

## Run 37 — 2026-09-19 — review fixes, and the surname families measured

Run 36's two mechanical holes were real and both defaulted to the one label that changes engine output.

⚠ `partsOf` WAS THROWING AWAY THE KIND STATEMENT. `{{surf}}` states the kind in arg 1, BEFORE the
language code — `incomparable` is `{1:'+pre', 2:'en', 3:'in', 4:'comparable'}` — and the `+` filter
dropped it. The split it gives is unhyphenated, so `kindOf` saw two bare morphemes and fell through to
its default, which is `compound`. `pancake` (`+com`) was right by luck. Also `con`, the `confix`
shortcut, was in the template set but not in `kindOf`. Fixed: a stated control arg wins, then the
template name, then the hyphens.

    compound 4115 → 4036   suffix 6048 → 6099   prefix 3549 → 3571   confix 115 → 121

79 false compounds removed. None reached engine output today — the velar consumer's prefix guard
catches `in-`/`un-`/`syn-` first — but `mislead`, `frenchman`, `dreadful` and `active` as compounds
would have given `MIS-lead` and `FRENCH-man` the moment the stress consumer landed.

⚠ AND THE TABLE MOVED OUT OF `data/`. It is CC-BY-SA with no runtime consumer, and
`data/languages/english/` is otherwise a CMUdict/public-domain stratum, so shipping it in the data
package changed that directory's licence character to feed one build script. Now
`tools/gen/en-morph-boundary.tsv`, the same shape as `tools/gen/de-consonant-curated.tsv`, with rows in
LICENSES/PROVENANCE.md §3, NOTICE.md and tools/gen/README.md, and `--kaikki <path>` to match the
sibling kaikki builders. Run 36 is also right that the three examples named in the seam builder's
header — `Anglo·phile`, `laryngo·scope`, `vanco·mycin` — have no row at all, so their assimilation
survives by absence; replaced with `pan-chromatic` and `humankind`, which are real non-compound rows.

⚠ THE SURNAME QUESTION, MEASURED PROPERLY, because Run 35 waved at it. Of the 264 residual sites with
no referee, only 16 appear in the RAW Moby file before any of our filtering, and not one of those 16 is
a surname. So for surnames there is not a weak source being rejected — there is no source.

But the surnames are not unstructured, and a recurring element reaches 121 of the 264: `-co` ×16,
`-quist` ×12, `-cor` ×9, `-kamp` ×9, `-court` ×6, `-corp` ×6 on the right; `van-` ×11, `rosen-` ×8,
`ban-` ×7, `fran-` ×7 on the left. That is the attestation density Run 27's mined morpheme list
lacked — thirty morphemes with one attestation each. So: generalise from a family member that IS
attested? Measured, and it splits by which side the element sits on:

    RIGHT-hand element   `-court` ×8, two witnesses (agincourt, betancourt) → bettencourt,
                         billancourt, jeancourt, rancourt — all French `-court`, all plainly [n]
    LEFT-hand element    `pan-` ×10, witness `pancake` → reaches `panchromatic` and `pangloss`, both [ŋ]
                         `man-` ×11, witness `mankind`  → reaches `mancala`, `mancha`, `mancusi`, [ŋ]

Which is Run 27's failure again, and for the same reason: a left element is a prefix as often as it is
a compound's first half, while a right element that recurs across surnames IS the morpheme. So the
defensible rule is one witness per RIGHT-hand element, applied only to that element's family — and the
big families have no witness at all (`-kamp`, `-quist`, `-corp`, `-co` are unattested by any referee).
It would reach roughly 15 words today. Recorded as available and not taken: it is real, it is small,
and it is a different mechanism from the boundary table, so it should not ride in on this PR.

## Run 38 — 2026-09-19 08:41 — re-review of #1360 after the fix commit: the kind fix reproduces, and what it did not reach

Second review of `feat/morph-boundary-table` (bc90952e + 7a47b53e), focused on the fix commit and on
what Run 36 did not ask. Every gate green: typecheck clean, `npx vitest run` 317 files / 6,076 passed
/ 5 skipped, `check-goldens --jobs 8` 189 languages 36,495 rows 0 stale, `dotnet run --project
csharp/tools/parity -c Release` 189 byte-identical 0 differ + 5/5 accent variants,
`check-package-fence` ok, `MOBY=… referee-eval en` unchanged (no shipped data differs from the first
commit).

### Reproduction — byte-identical, counts exact

    npx tsx tools/gen/build-en-morph-boundary.mts --kaikki /mnt/data/kaikki-English.jsonl --write
    → cmp against the committed table: IDENTICAL
    kaikki lines 1492836 · carried 88631 · split 24368 · 6905/1175/2963 rejected · ROWS 13325
    suffix 6099  compound 4036  prefix 3571  confix 121   — exactly as the commit message claims

Diffed against the first commit's table: the ROW SET is unchanged (0 words added, 0 removed) and 79
rows changed kind — 48 compound→suffix, 18 compound→prefix, 6 compound→confix, 7 suffix→suffix
(inner boundary of a two-level row). Every change moves AWAY from `compound`, never toward it, so the
fix can only shrink the false-compound population. The 24 compound→prefix/confix flips are all
`{{surf}}` `+pre`/`+con` or template `con` and all read correctly (`a|breast`, `mis|lead`,
`in|comparable`, `tri|angle`, `pre|fix`, `poly|phonic`).

`build-en-nasal-seam.mts --write` after the move also reproduces `en-nasal-seam.tsv` byte-identically
at 49 rows, so the new `dirname(fileURLToPath(import.meta.url))` path resolves end to end.

### The control-arg vocabulary, enumerated from the dump rather than assumed

Full pass over the 3.0 GB extract collecting every arg beginning `+` or `:` on any of the twelve
templates in `TPL`. On the template the builder actually SELECTS (dict words only), the distinct
control values are:

    8130 :af      127 +suf      34 :afeq     32 :af<surf>   31 +com    26 +pre
      21 :inh      19 :bor      15 +af       11 :lbor        9 +con      7 :blend
       6 :influence 4 :uder      3 :from      3 :der<unc>    2 +com+     2 :blend<unc>
       2 :from<unc> 2 :clq       2 :clipping  2 +suffix      1 each of :calque, :clip, :univ,
       :der, :afeq<surf>, :calque<unc>, :af<ref:…>, :inh<ref:…>

Across the WHOLE dump (not just selected templates) the only other `+`-form controls are `+prefix` ×2,
`+deverbal` ×3, `+blend` ×2, `+clip` ×2, `+com+` ×2 and a bare `+` ×2.

**Verdict: `STATED` is complete for every control value that actually states a kind and reaches a
selected template.** `+suf/+suffix/+pre/+prefix/+com/+con/+af` are all covered. Everything unmapped
(`:af`, `:afeq`, `:af<surf>`, `:inh`, `:bor`, `:lbor`, `:blend`, `:clq`, `:uder`, `:from`, `:influence`,
…) is an ETYMOLOGY-TYPE marker on `{{ety}}`, not a kind claim, and correctly falls through to the
hyphen heuristic. There is no `:pre`/`:suf`/`:com`/`:con` anywhere in the dump, so the `:` branch of
the control test is speculative but harmless.

⚠ `af: "affix-unknown" as Kind` IS A BEHAVIOURAL NO-OP AND SLIGHTLY WORSE THAN OMITTING IT. Recomputed
all 24,368 found entries offline with `af` deleted from the map: **0 of 24,368 kinds change.** The
sentinel exists only to be ignored by `kindOf`. Where it is not a no-op it is a hazard: `stated` is
last-wins, so a template carrying a real control followed by `:af` has its real kind ERASED back to the
heuristic, which omitting the key would not do. Same for `+com+`, whose `slice(1)` is `"com+"` and
misses the map — 0 of 24,368 changes today (both words are compounds anyway), but it is an exact-match
lookup with no trailing-`+` strip. Both are cleanups, not defects.

### The 4,036 compounds, sampled adversarially

Grouped every compound-labelled row by its source template and control:

    2918 compound/—   400 com/—   299 ety/:af   247 af/—   47 surf/—   24 surf/+com
      24 affix/—      and a dozen singletons

The `surf/—` and `af/—` buckets are where a false compound can still hide: `{{surf}}` or `{{af}}` with
NO control arg and args spelled WITHOUT the hyphen that the heuristic needs. Reading all 47 `surf/—`
rows and cross-checking every compound row whose last element is a derivational suffix or whose last
element is not a free dictionary word:

    burying   = bury|ing     → should be suffix
    buxomness = buxom|ness   → should be suffix
    foully    = foul|ly      → should be suffix
    rootless  = root|less    → should be suffix
    wrathful  = wrath|ful    → should be suffix
    (marginal: nonetheless = none|the|less; hayward/millward/woodward on agentive -ward)

**So the fix closed the `{{surf}}`-with-a-control subset (79 rows) but not the
`{{surf}}`-without-a-control subset.** Five clear residual false compounds, none with an N+velar site,
so no engine output changes today — the same standard the commit message applies to its own 79. The
root cause is unchanged and structural: where Wiktionary omits both the control arg and the hyphen, the
hyphen heuristic has no signal and `compound` is still the default. Worth a follow-up, not a blocker:
a cheap patch is to treat an unhyphenated final element drawn from a closed derivational-suffix list as
`suffix`, which reaches all five.

All 14 compound rows whose last element is NOT a free dictionary word are otherwise sound compounds
(`seafarer`, `wayfarer`, `gatecrasher`, `potsherd`, `henpecked`, `stargazer`, …); only `wrathful`
is wrong in that set.

### ⚠ The replacement example in the seam builder's header is itself wrong

The fix replaced three examples that had no row (`Anglophile`, `laryngoscope`, `vancomycin` — verified
absent) with `pan-chromatic` and `humankind`, and both DO have rows (`panchromatic 3:prefix`,
`humankind 6:suffix`). But the sentence says they "assimilate", and `humankind` does not:

    en-nasal-seam.tsv:33   humankind   5          ← it is a listed seam, admitted on referee evidence
    engine: humankind → hjˈuːmənkˌaᶦnd            ← [n], not [ŋ]

`humankind` is a `suffix` row, so the boundary table does not block it; the referee tier does, and the
engine ships it with [n]. It is the same defect the fix commit was correcting — an example that does
not hold — with the polarity reversed. `panchromatic → pʰˌæŋkɹoᶷmˈæt̬ɪk` is correct. The honest
non-compound assimilating example from the table is a prefix row such as `incalculable` or
`syncarpous`, or `irangate` (`ɪɹˈɑːŋɡˌeᶦt`, a `suffix` row) if a suffix one is wanted.

Same sentence, minor: "160 non-compound N+velar boundaries". Measured against the shipped dict it is
**161** (155 prefix + 3 suffix + 3 confix, 161 distinct words), against 29 compound N+velar boundaries.

### The move out of `data/` — verified, and sufficient

    npm pack --dry-run   root package: 735 files, no tools/ entry at all
    npm pack --dry-run   data package: 371 files, no morph entry
    npm run check:package → ok — engine 735 files (no docs/ tools/ test/, no data/), data package 371

Root `files` is `["src","LICENSES","NOTICE.md",…]` and data `files` is `["core","languages",…]`, so
`tools/gen/en-morph-boundary.tsv` is genuinely outside both published tarballs. No stale reference to
the old path survives (`grep -rn en-morph-boundary`). The test's
`join(EN, "..", "..", "..", "tools", "gen", …)` resolves correctly. The builder's ENOENT fallback
still works — with the table moved away it prints `(no en-morph-boundary.tsv — referee evidence only)`
and rebuilds 38 referee-backed rows — though `test/en-nasal-seam.test.ts` hard-fails at collect time in
that state (top-level `readFileSync`). That asymmetry is fine: the table is committed, so any checkout
has it; the builder tolerates absence because a contributor may not have the 3 GB dump.

LICENSES/PROVENANCE.md §3 row is in §3, its 13,325 rows is right, and "same shape and same terms as
the German row below" is accurate. NOTICE.md §3 Wiktionary bullet is accurate.

Two documentation staleness nits from this commit:

- ⚠ `tools/gen/en-morph-boundary.PROVENANCE.md` still says "Regenerate with
  `KAIKKI=/path/… npx tsx tools/gen/build-en-morph-boundary.mts --write`". The commit changed the tool
  to `--kaikki <path>` and the env var now throws. The tool's own header and `tools/gen/README.md`
  were updated; this file was missed.
- The NOTICE bullet says the two build inputs are "not shipped in either package". True of the FILES,
  but `de-consonant-curated.tsv` is merged into the shipped `german/consonant.tsv` per its own §3 row,
  so its CONTENT is shipped. The English one genuinely is not. Worth one clause so the two cases do
  not read alike.

### One observation the PR should record rather than fix

`foreman`, `overman` and `underman` moved compound→prefix/confix on Wiktionary's `+pre`/`con`. The
table's own stress column says a prefix boundary leaves primary stress on the stem — which predicts
`fore-MAN`. English has `FORE-man`. So for the stress consumer the commit message invokes as the
motivation, the fix trades `MIS-lead` (removed, correct) against `fore-MAN` (introduced, wrong) on a
handful of `-man` words. The table faithfully reports the source and says a consumer decides which
kinds it respects, so this belongs in the stress consumer's design, not here — but it should be known
before that consumer lands.

## Run 39 — 2026-09-19 — Run 38's findings applied, including one I made twice

⚠ I NAMED `humankind` AS A WORD THAT ASSIMILATES AND IT IS ROW 33 OF THE TABLE I WAS DOCUMENTING.
Run 37 replaced three examples that had no row at all with two that do — and got the polarity wrong on
one of them. `humankind`'s boundary is a SUFFIX (`-kind`) and it ships `hjuːmənkaᶦnd` with an [n] on
referee evidence. The same defect the fix was fixing, reversed. The honest statement is narrower than
either version: a suffix boundary is not evidence about this process in EITHER direction, only
`compound` is, which is exactly why the referee path exists underneath. Now uses `pan-chromatic` and
`syn-carpous`, both real prefix/confix rows that do assimilate, and the count is 161 rather than 160
(155 prefixes, 3 confixes, 3 suffixes).

⚠ AND THE COMPOUND DEFAULT WAS STILL LEAKING, because Run 37 closed only the subset that HAS a control
arg. `{{surf}}`/`{{af}}` with neither a control nor a hyphen still fell through: `burying`,
`buxomness`, `foully`, `rootless`, `wrathful` shipped as compounds. Closed with a list of bound
derivational suffixes for an unhyphenated final element — a second element that is a FREE word stays a
compound. compound 4,036 → 4,008. None of the five has an N+velar site, so none reached engine output,
which is the same standard the previous fix was held to; the stress consumer would have read every one
as fore-stressed.

Two cleanups from the same review, both measured as 0-change and taken anyway because they are hazards
rather than bugs: `af` is gone from `STATED` (it mapped to a sentinel `kindOf` ignored, and since
`stated` is LAST-WINS a real control followed by `:af` was erased back to the heuristic — omitting the
key cannot do that), and a trailing `+` is now stripped before the lookup, so `+com+` matches.
Enumerating every control value in the dump confirms the map is otherwise complete: the kind-stating
ones are `+suf`, `+suffix`, `+pre`, `+com`, `+con`, `+af`, `+com+`, and everything else — `:af` ×8,130,
`:inh`, `:bor`, `:blend`, `:clq` — is an etymology-TYPE marker on `{{ety}}`, correctly left to the
hyphens.

Docs: the provenance file still said `KAIKKI=…`, which the tool now rejects; and the NOTICE bullet
called both build inputs "not shipped in either package", true of the English one and false of the
German one, whose rows are merged into the shipped `german/consonant.tsv`.

⚠ RECORDED FOR THE STRESS CONSUMER, NOT FIXED HERE. `foreman`, `overman` and `underman` moved
compound → prefix/confix on Wiktionary's own `+pre`. The kind table says a prefix leaves the primary on
the stem, which predicts `fore-MAN`. So for the very consumer this table was built to serve, the fix
trades `MIS-lead` away (correct) and introduces `fore-MAN` (wrong) on a few `-man` words. That is a
decision for that consumer's design — the label is right, the stress rule keyed to it will need an
exception — and it should be known before it lands rather than discovered by a golden.

    compound 4,036 → 4,008;  seam table unchanged at 49 rows
    goldens 0 stale;  C# parity 189 byte-identical;  6,076 tests

## Run 40 — 2026-09-19 — the BiLSTM retrain, and the measurement that nearly misled me

The dictionary gained 17,825 rows (117,483 → 135,308) since #1341 retrained the OOV models, almost all
of it the Moby imports. Retrained on the full 135,305-row dict; held-out report first, then the
production train and int8 export.

⚠ THE HEADLINE IS FLAT, AND ONLY THE SPLIT MAKES THAT VISIBLE. The raw held-out reads 70.7%
stress-independent against a 71.5% baseline, which looks like a small regression and is not one: the
held-out is 10% of a dictionary that GAINED the hard Moby tail, so the population changed. The md5
split is deterministic, so the old population survives exactly (n=11,748):

    words the old dictionary also had   71.4%   (baseline 71.5% — flat)
    words added since, the Moby tail    65.7%

The old shipped model scored 56.3% on the added words, so the gain is ~+9pp and it is entirely on the
tail. More data did not make the model better at English; it made it cover a vocabulary type it had
never seen. For an OOV tier that is the right kind of gain, but it should not be sold as a general one.

    wikipron primary (independent)   62.7% → 64.0%   symbol 90.8% → 91.3%
    Moby — OOV tier                  38.1% → 44.2%   symbol 85.6% → 87.4%
    Moby — words the dict carries    75.7%, unchanged (the model is not consulted for them)

⚠ AND I TOLD THE USER SOMETHING FALSE ON THE WAY HERE. Before the run I reported "the BiLSTM scores
37.8% on the Moby OOV referee against the sync path's 38.0% — on an independent OOV corpus it has no
advantage over its own fallback". `PHON["en"]` resolves to `engine-text-neural`, so BOTH columns were
the neural path and the tie was tautological. There was no n-gram in that measurement. The conclusion I
drew from it — that the BiLSTM may not be worth retraining — was unfounded, and the retrain moved the
independent referee more than any dictionary block in this audit.

⚠ A QUARTER OF THE OOV CORPUS IS EXACTLY ONE SYMBOL OFF, which is why 44.2% understates the model.
Edit distance from the nearest referee reading: 0 off 37.9%, ≤1 off 63.0%, ≤2 off 81.4% (pre-retrain
sample). Reading the one-symbol misses, the symbol is almost always an unstressed vowel — `aerometry
ɛɹɑmətɹi` against `ɛɹɑmɪtɹi`, `acmatic əkmætɪk` against `ækmætɪk` — which is the weak-vowel axis already
declared intentional on the other two referees. Much of the OOV gap is a referee floor.

⚠ 55 GOLDEN LANGUAGES MOVED, 232 ROWS, AND THE REASON IS WORTH KNOWING: the English neural tagger
renders EMBEDDED English in every other language, so Cherokee (`Sundance`), Tibetan (`vasanta`) and
Belarusian (`caro`) all move when it is retrained. Sampled before accepting rather than regenerated on
faith — majority repairs: `medicines` had been reading as "medi-signs", `Aldwych` as `ˈɔːɫdwɪk`.

⚠ AND ONE OPEN FLAKE, RECORDED HONESTLY BECAUSE I MISDIAGNOSED IT TWICE. `test/check-goldens-jobs.test.ts`
fails intermittently inside a full suite run and passes in isolation. I called it "contention" twice and
then "maxBuffer"; both are wrong. Run cleanly, the serial and pooled reports are byte-identical
(159,335 bytes each), the tool already refuses an incomplete pool (`results.length !== order.length`
→ exit 2), and the captured failure is a TRUNCATED capture — 349 lines against 644 — with no error line
at all. It predates this change (it first failed during #1357). Not fixed, not explained, not dismissed.

## Run 41 — 2026-09-19 — independent review of the retrain (#1361), and the two claims that did not survive it

Adversarial re-measurement of Run 40 from a clean worktree (`git worktree add --detach` at
`788934a8`, because the shared checkout went dirty mid-review with an unrelated `-lly` block). Every
number below was re-derived, not read off the provenance.

⚠ EVERY REFEREE NUMBER REPRODUCES EXACTLY, INCLUDING THE BEFORE-NUMBERS. Ran
`MOBY=… npx tsx tools/referee-eval/eval.ts en` twice, the second time with the `origin/main` model
checked back in over the new one, so the "before" column is a measurement rather than a memory:

    wikipron primary   2531/4037 62.7% → 2584/4037 64.0%   symbol 90.8% → 91.3%
    Moby OOV           15,056/39,485 38.1% → 17,454/39,485 44.2%   symbol 85.6% → 87.4%
    Moby in-dict       26,522/35,049 75.7% both eras — unchanged to the row

⚠ THE HELD-OUT SPLIT CLAIM IS SOUND, AND IT IS THE ONE CLAIM THAT MOST DESERVED CHECKING. The split
is `md5("en:"+w) % 10 == 0` over a word key, so it is content-addressed per word and cannot reshuffle
when the dictionary grows. Recomputed against `dedf6398`'s dictionary (117,482 loadable rows vs today's
135,305): held-out 11,748 then, 13,528 now, the old held-out is a strict subset of the new one with
**zero words lost**, and new-minus-old is exactly 1,780. n=11,748 and n=1,780 are both confirmed. The
three accuracies recompute off `/tmp/en_bilstm_holdout.tsv` to the decimal: 70.7% raw, 71.4%/66.4% on
the old population, 65.7%/53.7% on the added tail. Gold drift between the two eras touches **1 row**
of the 11,748, so "flat against a 71.5% baseline" is comparing the same population against the same
labels.

⚠ BUT THE "56.3% → 65.7%, ABOUT +9 POINTS" FIGURE DOES NOT REPRODUCE, AND THE GAIN IS SMALLER. Decoded
the shipped `origin/main` int8 graph directly (onnxruntime + its own meta, masked argmax, the same
`decode_chunks` rule the trainer uses) over the same 1,780 added words:

    OLD shipped model, 1,780 added words   59.6% stress-indep   45.4% incl. stress
    NEW held-out model, same words         65.7%                53.7%

So +6.1pp, not +9pp. Via the full serving path (`englishTagger.ts`, i.e. after the digraph guard,
`enforceSinglePrimary`, `collapseGeminates`, `arpabetToIpa`, compared against the gold rendered through
the same `arpabetToIpa`) the old model reads 54.9% stressless — still not 56.3%. The direction of the
claim holds and is the real gain; the magnitude is overstated by about a third and should be corrected
to +6pp before this is quoted again. Also worth stating plainly in the provenance: 71.4/65.7 belong to
the **90%-split model**, not to the artifact that ships. The shipped model is trained on the full dict
and scores 99.1%/98.9% on those same rows because they are its training data — a number that means
nothing except "the export is not broken".

⚠ "55 GOLDEN LANGUAGES MOVED … AND NONE OF THEM IS ENGLISH-ONLY" IS FALSE AS WRITTEN. `en.tsv`,
`en-GB.tsv` and `en-IN.tsv` are three of the 55 files and carry 45 of the 232 rows (15 each) — the
largest block after `chr.tsv` (21). The underlying point survives (the other 187 rows are embedded
English inside non-Latin hosts, and all 232 changed rows do contain Latin letters in their source), but
the sentence says the opposite of what the diff shows.

⚠ AND THE SAMPLE IS NOT ALL REPAIRS. Aligned old-vs-new at the IPA-token level with `difflib` over all
232 rows (170 distinct old→new→context triples) and probed the tagger directly on the suspects. Repairs
confirmed: `aldwych` ˈɔːɫdwɪk → ˈɔːɫdwɪt͡ʃ, `medecines` …sˌaᶦnz → …sˌɪnz, `resistivity` ɹˌɛz… → ɹˌiːz…,
`saens` snz (no vowel at all) → sˈiːnz, `tahlequah` təlˈɛkwə → tʰˈɑːɫkwə, `vidhi` vˈiːd̬i → vˈɪd̬i,
`nasab` nɑːsˈɑːb → nˈæsæb, `biorhythm` baᶦˈɔːɹhɪðəm → bˈaᶦɔːɹhˌɪðəm. The 32-row `rr` block
(ɹˈɝ → ˌɑːɹˈɑːɹ) is also a repair and a consistency one: the adjacent bare `r` already reads ˈɑːɹ in
both eras, so spelling `rr` as ar-ar now matches its neighbour. But:

    Tt (Audi TT)   tʰˌiːtʰˈiː  →  t        a bare consonant, no vowel — REGRESSION
    kW             kʰˈuː       →  kw       same shape — REGRESSION
    heHe           hˈiːhi      →  hˈiːh    trailing bare h — REGRESSION
    Rossby         ɹˈɔːsbi     →  ɹˈɔːbi   the /s/ is gone — REGRESSION
    Dhara          dˈɑːɹə      →  dˈɛɹə    REGRESSION
    stealthily     stˈɛɫθɪli   →  stˈɛɫθəli   weak-vowel axis, minor

⚠ THE VOWELLESS OUTPUTS LOOK ALARMING AND ARE NOT NEW, WHICH IS WORTH RECORDING BECAUSE I ALMOST
REPORTED THEM AS A SYSTEMIC REGRESSION. Enumerated every 2- and 3-letter string and a 1-in-7 sample of
the 4-letter space, counting predictions with no ARPABET vowel:

    len 2   old 48 / 676      new 52 / 676
    len 3   old 853 / 17,576  new 850 / 17,576
    len 4   old 3,189/65,283  new 3,209/65,283

The class is flat; `tt` and `kw` fell into it while others fell out. So this is churn on a pre-existing
defect (a per-letter tagger with no "the word needs a nucleus" constraint), not something the retrain
introduced. It is still worth its own issue — a vowelless reading is unpronounceable, and declining to
"" so the n-gram takes the word would be strictly better.

⚠ THE ARTIFACT IS SOUND AND THE META MATCHES THE WEIGHTS. `onnx.checker` passes; the graph answers
T = 1/4/7/23 with `[1, T, 208]`, so it is not length-specialised; `emb.weight_quantized` is `[28, 64]`
against a 28-entry `src`; `tags` is contiguous 0…207 with no duplicates; every `charTags` list is
non-empty, references only in-range tag ids, covers all 26 letter ids, and contains the silent tag. The
pairing is also proven behaviourally — the old meta over the new graph throws an out-of-range tag id
(209 tags vs 208 logits), which is the mismatch, and in TS `maskedArgmax` that same index would read
silently into the next position's row rather than throw.
⚠ ONE ORDERING HAZARD REMAINS IN THE EXPORTER. `en_g2p_bilstm.py` writes `meta.json` into `data/` and
THEN calls `quantize_dynamic`. If the quantise raises, the tree is left with a new vocab beside the old
weights — the exact failure the provenance says was fixed. Writing the meta after the quantise, or to a
temp path promoted on success, closes it.

⚠ REPRODUCIBILITY IS WEAKER THAN THE PROVENANCE IMPLIES. `random.seed(0)` and `torch.manual_seed(0)`
are set, but there is no `cudnn.deterministic`, no `use_deterministic_algorithms`, and the model is a
cuDNN LSTM whose backward uses non-deterministic atomics — so a re-run on the same dictionary and the
same box may produce a materially different model, and on a different GPU almost certainly will.
Nothing in the repo pins the training environment: no `requirements.txt`, no recorded torch / CUDA /
onnxruntime version, and the recipe's `.venv/bin/python` does not exist in this checkout (the run used
`/mnt/data/Programming/vernacula/.venv-indicconformer-export/bin/python`). The recipe should name the
interpreter that was actually used and record the three versions, or the provenance table is a number
nobody can re-derive.

⚠ GATES: ALL THREE GREEN, RUN SERIALLY IN THE ISOLATED WORKTREE.

    npx vitest run                              317 files, 6,076 passed, 5 skipped
    npx tsx tools/check-goldens.mts --jobs 8    189 languages, 36,495 rows, 0 stale
    dotnet run --project csharp/tools/parity    189 byte-identical, 0 differ; 5/5 accent variants

`test/check-goldens-jobs.test.ts` PASSED here (all 9), so the flake did not reproduce in one full run.

⚠ ON THAT FLAKE, A STRUCTURAL FINDING RATHER THAN A ROOT CAUSE. I could not reproduce the truncation
(three slow-pipe runs against the `--no-ort --show 200` path all returned the full 643 lines /
159,335 bytes), so the mechanism is still open. But the test cannot TELL you which mechanism it was,
and that is fixable now: `run()` catches, discards `err.signal`, coerces a missing `err.status` to -1,
and returns `stdout + stderr` — so a child that was KILLED mid-stream (partial stdout, no error line,
status swallowed) is indistinguishable from a child that ran to completion and disagreed. The suite
then fails on `expect(pooled.out).toBe(serial.out)` with a truncated string, which is exactly the
reported signature: 349 lines, no error line, and a diff where the real event was a death. The test
asserts `serial.status === 0` but never asserts `pooled.status === 0`. Two lines — assert the pooled
status, and surface `err.signal` in `run()` — and the next occurrence names its own cause instead of
presenting as a content mismatch. Note also that the report path the test exercises ends in
`process.exit(0)` after ~640 `console.log` calls (`tools/check-goldens.mts`, the `noOrt || noClear`
branch); `process.exit` does not flush pending async writes to a pipe, which is the standard way to get
exactly this symptom. Unproven here, but it is the cheapest thing to remove.

VERDICT: the model change is real and the evidence for it holds — approve after (1) correcting the
+9pp claim to +6pp and saying which model the held-out numbers describe, (2) fixing the "none of them
is English" sentence, (3) recording the six golden regressions above rather than describing the set as
"majority repairs" only. The exporter ordering, the vowelless-reading class and the flaky test's
diagnosis are follow-ups, not blockers.

## Run 42 — 2026-09-19 — Run 41's findings applied, and a plausible cause for the flake

⚠ THE GAIN IS +6.1pp, NOT +9. Run 40 subtracted two numbers that were not comparable: 56.3% came from
a 3,000-word stride sample of ALL 17,825 added words through the full serving path, while 65.7% is the
split model decoding 1,780 specific rows off the raw graph. Measured like for like — same graph
interface, same rows — the previous shipped model gives 59.6%, so the tail gain is a third smaller than
claimed. The provenance now also says which model the 71.4/65.7 belong to: the 90%-SPLIT model. The
shipped artifact scores 99.1% on those rows because they are its training data, and quoting a shipped
model's number against its own training set is the mistake that table was one sentence away from.

⚠ AND "55 LANGUAGES MOVED, NONE OF THEM ENGLISH-ONLY" WAS THE OPPOSITE OF THE DIFF. `en`, `en-GB` and
`en-IN` are three of the 55 files and carry 45 of the 232 rows — the largest block after `chr` at 21.
What I meant, and what is true, is that every changed row contains Latin source text.

⚠ SIX ROWS REGRESSED AND "MAJORITY REPAIRS" BURIED THEM:

    Tt (Audi TT)  tʰˌiːtʰˈiː → t        kW      kʰˈuː   → kw
    heHe          hˈiːhi     → hˈiːh    Rossby  ɹˈɔːsbi → ɹˈɔːbi   (the /s/ is gone)
    Dhara         dˈɑːɹə     → dˈɛɹə    stealthily  ɪ → ə

They are recorded rather than fixed because the class they belong to is FLAT, which is the only reason
that is defensible: enumerating every 2- and 3-letter string plus a 1-in-7 sample of 4-letter ones
gives 48/853/3,189 vowelless outputs before and 52/850/3,209 after. `tt` and `kw` fell in while others
fell out. A per-letter tagger with no nucleus constraint can always emit a vowelless word; that is a
structural issue for its own block, not a retrain regression.

⚠ THE EXPORTER COULD STILL STRAND A VOCAB BESIDE OLD WEIGHTS — the failure its own header says was
fixed. `meta.json` was written into `data/` BEFORE `quantize_dynamic`, so a quantise that raised left
the new vocab next to the old graph. Meta now lands after the quantise, via a temp file and
`os.replace`, so neither an exception nor an interrupted write can produce the mismatched pair.

Reproducibility: `cudnn.deterministic` is requested (seeds alone cannot make a cuDNN LSTM repeatable —
its backward pass uses atomics), the recipe no longer names a `.venv` that does not exist, and the
exact environment behind the shipped weights is in the provenance: torch 2.11.0+cu128, cuda 12.8, onnx
1.21.0, onnxruntime 1.24.4, python 3.12.3, RTX 3090.

⚠ AND THE FLAKE HAS A MECHANISM AT LAST, after three wrong diagnoses of mine (contention, maxBuffer, a
dead worker). Run 41 found the capture discards `err.signal` and coerces a missing status to −1, so a
child KILLED mid-stream is indistinguishable from one that finished and disagreed — which is exactly
the reported signature. Both are now surfaced, and `pooled.status` is asserted before the byte
comparison so a non-zero exit reports as itself.

The likelier cause is upstream of that, though, and is now removed: `process.exit` DOES NOT FLUSH A
PIPE, and every one of this tool's outputs goes down one. The report branch the test exercises ends in
`process.exit(0)` after ~640 `console.log` calls; a child ends in one after streaming its JSON lines,
where a lost last line is a lost LANGUAGE; and the error paths end in one after the `console.error`
that explains the failure. All eight exits after the helper now drain stdout and stderr first.
⚠ STILL A SUSPECT, NOT A PROVEN CAUSE. The flake did not reproduce in this session's last four full
runs either. Recorded as the cheapest mechanism that produces the symptom, with the note that if it
recurs, it was something else.

    goldens 0 stale · C# parity 189 byte-identical · 6,076 tests · serial and pooled reports
    byte-identical at 159,335 bytes each

## Run 43 — 2026-09-19 — mining the inverse of the 82.4%: one class shipped, one refused

The in-dictionary residual — the rows that are neither exact nor declared-intentional — is 6,159 of
35,049. Enumerated it and classified by what actually differs:

    edit distance from the referee   1 off 3,217 (52.2%)   ≤2 off 82.2%   ≤3 off 93.3%

    single substitutions (2,508)  æ→ɛ 222   ɑ→ɔ 175   i→ɪ 164   ɛ→ɪ 154   ɪ→i 150
                                  ɑ→ə 137   ə→ɑ 130   ɛ→ə 124   æ→ə 91   ʊ→ə 84
    we have an extra symbol (317) ə 78   a 56   ɹ 47
    we drop a symbol (392)        l 108   ə 72   i 41   j 41

⚠ THE SUBSTITUTION HALF IS ALMOST ENTIRELY SETTLED AXES. `æ→ɛ` is marry–merry (deliberate, #1336),
`ɑ→ɔ` is cot–caught (refused on evidence), `i↔ɪ` is the NEAR vowel (already partly intentional), and
the ə-against-everything rows are unstressed vowel quality. 41% of the residual is not work.

The insert/delete half is where the classes are, and they turned out to be three different things.

⚠ THE `-lly` GEMINATE WAS OURS AS WELL AS THEIRS. Moby writes `abnormally` as `æbnɔɹməlli` from the
⟨ll⟩ spelling — 102 residual rows. The obvious move is to collapse it in the builder, and the builder
refuses precisely this: the geminate collapse is OOV-only because 155 dictionary rows carry a REAL
geminate (`earring`, `bookkeeper`, `backcourt` — compound seams) and a blanket fold would hide them.
⚠ A BOUNDARY-TABLE GATE WAS TRIED FIRST AND FAILED. #1360's table should say where a real seam is, but
only 88 of the 155 have a boundary row and the uncovered ones are exactly the inflections —
`earrings`, `bookkeepers`, `coattails`. Gating on it would collapse what the rule protects.
What worked was going at it from the spelling, and doing that surfaced the better finding: OUR OWN
DICTIONARY DISAGREES WITH ITSELF 708 TO 5. Stem-l + `-ly` degeminates in GenAm and 708 `-lly` rows say
so; five say otherwise — `drolly`, `dully`, `evilly`, `foully`, `genteelly` — and the en-GB referee
reads `evilly` as `iːvli` and `foully` as `faʊli`, single. Those five are CMUdict slips against our own
majority (`foully` additionally had NO primary stress at all). Fixed in `g2p-curated.tsv`; with them
gone the referee-side collapse, gated on the headword ending `-lly`, hides nothing.

    Moby — words the dict carries   26,522 → 26,624 (75.7% → 76.0%), +intentional 82.4% → 82.8%
    primary / OOV / goldens          unmoved — the five words are in no other corpus

⚠ AND THE YOD CLASS IS REFUSED, on the repo's own bar. Moby is conservative after coronals — `avenue`
`ævənju`, `costume` `kɑstjum` — where GenAm drops the yod and we are right. It cannot go in
`intentional`, which is positionwise and needs equal length. As a fold, `[tdnszlθ]ju` → `$1u` buys 28
rows. But WE EMIT CORONAL+`ju` OURSELVES, so we make this distinction lexically and a symmetric fold
would blind the referee to a real yod error, in either direction, at every one of those sites.
FORCE→NORTH was accepted because it blinds nothing; this is the same test with the opposite answer.
⚠ THE COUNT IS 147, NOT THE 199 FIRST WRITTEN HERE — see Run 45. 199 was a grep over the whole TSV, so
the SPELLING column supplied most of it (`adjunct`, `adjudicate`, `manjur`). In the IPA column alone it
is 147: `n` 62, `ɫ` 59, `θ` 12, `s` 6, `d` 5, `t` 3. The refusal is unchanged — 147 against 28 is the
same verdict — but a number that large was worth being right about.

Left on the table, measured and not taken: the syllabic-l class (78 rows, `cycling` `saɪkəlɪŋ` against
`saɪklɪŋ`) is the same shape as the yod one and probably falls the same way; the ~650 unstressed-vowel
rows need the weak-vowel classes revisited rather than a new mechanism; and `astilbe əstɪbi` — we drop
an /l/ Moby has — is a genuine single defect found in the dropped-l bucket while looking for the class.

## Run 44 — 2026-09-19 09:55 — reviewing Run 43: reproduced, and where its prose overstates its evidence

Independent review of `fix/lly-geminate-and-yod` against `origin/main` (4b2c463e), run from a detached
worktree pinned to 9f3abda8 so nothing shared the working tree.

    MOBY=/mnt/data/moby/mobypron.unc npx tsx tools/gen/build-en-moby-referee.mts
    npx tsx tools/english/en_rebuild_lexicon.mts
    npx tsx tools/referee-eval/eval.ts en --jobs 8      # on BOTH 4b2c463e and 9f3abda8

⚠ EVERYTHING NUMERIC IN RUN 43 REPRODUCES. The referee regenerates byte-identical (both
`en.moby-lexicon.tsv` and `en.moby-oov.tsv`, `git status` clean after the run) and the lexicon
round-trips 135,305/135,305 with 0 rows changed. Baseline → branch, re-measured end to end:

    primary (wikipron us)   2584/4037 (64.0%)  →  2584/4037   unmoved
    Moby in-dict            26522 (75.7%)      →  26624 (76.0%)   +102
    Moby +intentional       28890 (82.4%)      →  29004 (82.8%)   intentional 2368 → 2380
    Moby OOV                17454 (44.2%)      →  17454           unmoved

⚠ AND THE 143-vs-102 GAP IS NOT A REGRESSION — MEASURED, NOT ARGUED. Dumped the full residual set on
both trees (the rows that are neither folded-exact nor intentional-credited) and diffed them as sets:

    main residual 6159 · branch residual 6045 · left the residual 114 · ENTERED the residual 0

The 143 changed referee rows decompose as 102 newly exact + 12 newly intentional-credited + 27 still
residual + 2 (`bully`, `gilly`) that already passed on main via a second, geminate-free variant. Zero
rows moved the wrong way, and the structural reason is checkable without the run: `en.jsonc` has no
`(.)\1` fold, our own dictionary now has 0 of 713 `-lly` rows with `L L`, and no engine reading of the
143 contains an adjacent `l`/`ɫ` pair — so a referee row carrying the geminate could not have been
matching before it was collapsed.

⚠ THE RESIDUAL CHARACTERISATION IS EXACT. Recomputed on 4b2c463e: 6,159 rows, distance 1 = 3,217
(52.2%), ≤2 = 82.2%, ≤3 = 93.3%; 2,508 single substitutions + 317 extra-symbol + 392 dropped-symbol =
3,217, and every listed pair and count matches (the doc writes substitutions referee→ours, the
`intentional` convention). `æ→ə 91` and `ʊ→ə 84` are each in a tie (with `æ→ɑ 91` and `ɛ→ə 84`), which
is presentation, not error.

`collapseSuffixL` IS SAFE, and the strongest check is not the spelling gate but the phone filter: it
removes only an `L` whose predecessor is `L`. `unnaturally` is the one dictionary word that both ends
`-lly` AND carries a real geminate, and its geminate is `N N`, so the filter cannot see it. Of the 150
real geminates remaining in `g2p-dict.tsv`, no other ends `-lly`; `earring`, `bookkeeper`, `coattail`
and `backcourt` are all still there.

⚠ THREE PLACES WHERE THE PROSE CLAIMS MORE THAN THE DATA.

  • THE en-GB CITATION IS SELECTIVE. `evilly` is `iːvli`/`iːvəli` — both single, as claimed. But
    `foully` is `faʊli` AND `faʊlli`, and the citation takes the first of two variants; and `drolly`,
    the headline example, is `dɹəʊlli` in en-GB — geminate, single variant, and not mentioned. The
    corrections are still right, but on OUR OWN 708-to-5 consistency, not on en-GB corroboration.
    The internal argument is in fact stronger than Run 43 made it: 554 `-lly` dictionary words whose
    stem is itself in the dictionary and ends in `/L/` are single, 0 geminate, and the directly
    comparable shapes — `fully`, `coolly`, `cruelly`, `wholly`, `solely`, `civilly`, `squally`,
    `smelly` — are all single.
  • THE YOD COUNT OF 199 IS A GREP ARTIFACT. `nju` 121 / `dju` 42 / `sju` 18 / `θju` 12 are substring
    hits over the WHOLE TSV, and the spelling column supplies most of them — `adjunct`, `adjudicate`,
    `manjur`. Counted in the IPA column only, we emit coronal+`ju` at 146 sites (`n` 62, `ɫ` 58, `θ`
    12, `s` 6, `d` 5, `t` 3). THE REFUSAL SURVIVES THE CORRECTION — 146 blind spots against 28 rows
    bought is the same verdict — and so does the environment-scoped variant, which was worth asking
    about: restricting the fold to coronal + STRESSED `juː` still covers 58 sites, and they include
    `disunion`, `disunity`, `disuse`, `ingenue`, `fondue`, `bethune`, where the yod is correct GenAm.
    There is no environment here that separates our right yods from Moby's wrong ones.
  • `155 real geminates` IS NOW 150. It was 155 on `origin/main` — and 5 of those 155 are exactly
    `drolly`, `dully`, `evilly`, `foully`, `genteelly`, the rows this branch declares NOT real. The
    number in the new comment and in Run 43 counts the defect it is fixing as part of the protected
    class. The file header separately still says 144, a third figure, and still reads as an absolute
    ("THE DICTIONARY PATH DOES NOT COLLAPSE") with no pointer to the carve-out 90 lines below it.

  Two smaller things: `degeminate`'s one-line doc comment is now orphaned above `collapseSuffixL`'s
  block comment, so `degeminate` is undocumented and `collapseSuffixL` has two headers; and the claim
  that the 102 rows are "every one stem-final ⟨l⟩ plus `-ly`" is not quite true — `bally`, `bully`,
  `colly`, `gilly`, `hally` are simplex and `gravelly` is stem + `-y`. Collapsing them is still right
  (Moby is transcribing ⟨ll⟩), but the class is "headword spelled `-lly`", not "the adverbial suffix".

The one residual blind spot the carve-out does buy: `coolly` and `cruelly` are collapsed on the
referee side, and some GenAm sources do give `coolly` a long/ambisyllabic /l/. Our dictionary already
commits to single there, so nothing regressed — but the referee can no longer say otherwise.

    goldens 0 stale · C# parity 189 languages byte-identical, 36,495 rows · 6,076 tests / 317 files pass

## Run 45 — 2026-09-19 — Run 44's findings applied, and a citation that was selective

Run 44 measured what I argued: dumping the full residual on both trees and diffing as SETS, 114 rows
left it and **0 entered**, so the 143-row referee diff hides no regression. The 143 are 102 newly
exact, 12 newly intentional-credited, 27 still residual, and 2 (`bully`, `gilly`) that already passed
via a geminate-free second variant. That is a better proof than the one I offered, which was that the
count matched my prediction.

⚠ I CITED THE en-GB REFEREE SELECTIVELY, WHICH IS THE FINDING WORTH KEEPING. I wrote that it "reads
`evilly` as `iːvli` and `foully` as `faʊli`, single". True of `evilly`. `foully` has BOTH `faʊli` and
`faʊlli`, and `drolly` — the first word on the list — is `dɹəʊlli`, geminate, its only variant. I
quoted the two that agreed with me and not the one that did not. The corrections are still right, and
the argument that makes them right was already in hand and stronger: restricted to `-lly` words whose
STEM is in the dictionary and ends in /L/, the dictionary was 551 single to 3, with `fully`, `coolly`,
`cruelly`, `wholly`, `solely` and `civilly` all single. That needs no witness. Both the curated note
and the builder now say so, and say what the referee actually holds.

⚠ AND THE YOD COUNT WAS A GREP ARTIFACT. 199 was a substring search over the whole TSV, so the
SPELLING column supplied most of it — `adjunct`, `adjudicate`, `manjur`. In the IPA column alone it is
147: `n` 62, `ɫ` 59, `θ` 12, `s` 6, `d` 5, `t` 3. The refusal stands (147 against 28 is the same
verdict), and Run 44 also closed the variant I had not tried: restricting to coronal + STRESSED `juː`
still covers 58 sites including `disunion`, `disunity`, `disuse`, `ingenue`, `fondue` and `bethune`,
where the yod is correct GenAm. There is no safe environment here, not just no safe blanket fold.

Two comment defects, both the kind that rot quietly:
- THE PROTECTED-GEMINATE COUNT WAS WRITTEN THREE TIMES AND NEVER AGREED: 144 in the file header, 155 in
  the new block, 150 in fact — and five of the 155 were the very rows this branch declares defective,
  so the comment was counting the defect as part of the class protecting against it. One number now,
  with the header pointing at the carve-out instead of reading as absolute.
- `degeminate` LOST ITS DOC COMMENT to the new block landing directly beneath it, leaving
  `collapseSuffixL` with two headers and `degeminate` with none.

Also corrected: "every one stem-final ⟨l⟩ plus `-ly`" is the majority and not the rule — `bally`,
`bully`, `colly`, `gilly`, `hally` are simplex and `gravelly` is stem + `-y`; the class the gate names
is "headword spelled `-lly`". And the carve-out's one honest cost is now recorded: `coolly` and
`cruelly` are collapsed on the referee side too, so the referee can no longer disagree with our single
/l/ there, though nothing regressed because our dictionary already committed to it.

## Run 46 — 2026-09-19 — the consonant classes, and the class I did NOT fix

The skeleton probe's remaining classes. An accent difference is a vowel or a rhotic; a spelling trap is
a CONSONANT, which is what makes the en-GB referee admissible for a GenAm lexical fact. 433 dictionary
words have a consonant skeleton both referees share and we do not; three classes come out of it clean:

    ⟨ch⟩ = /k/     achaean ətʃiən → əkiən      stich stɪtʃ → stɪk
    ⟨g⟩  = /d͡ʒ/    armiger ɑɹmɪɡəɹ → ɑɹmɪd͡ʒəɹ  gibberish ɡɪbəɹɪʃ → d͡ʒɪbəɹɪʃ  gaea  hemorrhagic
    ⟨z⟩  = /ts/    mozart moʊzɑɹt → moʊtsɑɹt   mainz meɪnz → maɪnts  palazzo  piazza  paparazzi

All eleven carry two or more INDEPENDENT sources; six carry three. `gibberish` is the one that should
not have survived this long — an ordinary word, read with /ɡ/, with Moby, wikipron-UK and misaki gold
all saying /d͡ʒ/.

⚠ AND THE TEMPTATION WAS TO FIX THE CLASS RATHER THAN THE WORDS. The `-lly` block worked because the
dictionary had an overwhelming internal majority to appeal to — 551 to 3. This one does not: our
dictionary splits **41 to 67** on whether Italian `-zz-` is /ts/ or /z/, with `intermezzo` already
carrying `T S` while `palazzo` carried `Z`. Inconsistent without being wrong in a direction, and the
~108 Italian surnames in the class have no evidence either way. Per-word referee agreement is the only
bar that holds here, so it is the only one used, and the class stays open.

⚠ FOUR CANDIDATES WERE DROPPED BY THAT BAR, which is what it is for:
- `reg` — both referees say `ɹɛd͡ʒ`, but American `reg` (regulation, regs) is /ɹɛɡ/ and gold has no row.
- `hegemonic` — both referees say `hɛd͡ʒəmɑnɪk` and GOLD SAYS `hˌɛɡəmˈɑnɪk`. A live variant, not a defect.
- `cham`, `ich` — the two referees disagree with each other, so there is nothing to agree with.
`piazza` is the weakest row KEPT and is marked as such: Moby reads it `piæzə` with /z/, against the
en-GB referee and gold. Two of three, and the two that agree are the independent pair.

Plus `astilbe` — `əstɪbi`, a dropped /l/, three sources against it. Not a class, just a defect that
turned up in the dropped-l bucket while looking for one.

    Moby — words the dict carries   26,624 → 26,632 (76.0%)
    Moby — OOV                      17,454 → 17,455
    primary                         2,584 unmoved — none of the twelve is in the wikipron corpus
    goldens 0 stale · parity 189 byte-identical · 6,076 tests

⚠ THREE OF THE TWELVE ARE LIVE SPLITS AND JOIN `KNOWN_GAPS`. Held out of the dictionary, the OOV path
reproduces the upstream shape for `gaea`, `mainz` and `piazza` — all source N, the n-gram tier reading
a loanword spelling as English. There is no rule to key a fix on (the 41-to-67 split is exactly the
absence of one), and the model has not been retrained since these corrections landed, so a retrain
absorbs them for free the way #1341 did for `collaborative`.

## Run 47 — 2026-09-19 — reviewing Run 46: reproduced, one rejection that was wrong, and a class not exhausted

Reviewed `fix/moby-consonant-defects` (8b062a0e) against `origin/main` (cd2f5dbf) from a detached
worktree. Every number in Run 46 reproduces; every cited source exists and reads as quoted; the twelve
readings are all right as GenAm. What follows is the residue.

### Reproduced exactly

    MOBY=/mnt/data/moby/mobypron.unc npx tsx tools/referee-eval/eval.ts en   (both trees)
    Moby — words the dict carries   26,624/35,049 → 26,632/35,049   (+8, as claimed)
    Moby — OOV                      17,454/39,485 → 17,455/39,485   (+1, as claimed)
    primary wikipron-US             2,584/4,037 on BOTH trees       (unmoved, as claimed)

    npx tsx tools/english/en_rebuild_lexicon.mts    135,305 rows regenerate byte-identically, 0 would
                                                   change — the 12 lexicon rows are exactly the 12 dict rows

The **41 to 67** split reproduces on `main` for headwords spelled `-zz[aeio]`: 41 `T S`, 67 `Z`, n=108,
and `intermezzo` does carry `T S`. ⚠ AFTER THIS BRANCH IT IS **44 to 64** — `palazzo`, `piazza` and
`paparazzi` all end `-zz[aeio]` — yet both the `g2p-curated.tsv` block and the new `KNOWN_GAPS` comment
state 41-to-67 in the PRESENT TENSE about the shipped tree. Two stale numbers in files this branch edits.

The skeleton probe was re-run independently (Moby ∩ en-GB referee ∩ our accent-lexicon, vowels and
length/stress/tie marks stripped, ɫ→l and ɚ/ɝ/ɹ→r): **409** words where both referees share a skeleton
that is not ours, against Run 46's 433. Same instrument, different folding; the denominator stands. ⚠ THE
PROBE ITSELF IS NOT COMMITTED, so neither 433 nor the class membership behind it is reproducible from the
tree — and the repo already owns the instrument for this bar, `tools/english/en_source_compare.mts`.

### Source support, row by row

Three sources (Moby + en-GB referee + misaki gold): `achaean` `armiger` `gibberish` `hemorrhagic`
`palazzo` `astilbe`. Two: `stich` `gaea` `mozart` `mainz` (Moby + en-GB), `piazza` `paparazzi` (en-GB +
gold; Moby has no `paparazzi` row and dissents on `piazza`). INDEPENDENCE HOLDS IN EVERY PAIR — no row
rests on wikipron-US and wikipron-UK alone, which is the one pair that shares ancestry.

⚠ "All eleven carry two or more; **six** carry three" — five of the eleven do. The sixth three-source row
is `astilbe`, which that sentence has already set aside.

### `cham` WAS REJECTED ON A WRONG READING OF THE EVIDENCE

Run 46: "`cham` and `ich` were dropped because the two referees disagree with each other." For `ich` that
is right. For `cham` it is not:

    ours          cham  CH AE1 M
    Moby          kæm
    en-GB referee t͡ʃæm | kæm          ← carries the /k/ reading as a variant
    misaki gold   Cham → kˈæm         ← NOT CONSULTED

Gold has no lowercase `cham`, exactly as it has no lowercase `achaean` — and Run 46 DID consult the
capitalized key for `achaean` ("gold əkˈiən" exists only under `Achaean`). `en_import_moby.mts` codifies
that lookup: `gold[w] ?? gold[Capitalized]`. Applied consistently, `cham` clears the bar with three
sources, and the title (a variant of *khan*) is \ˈkam\. This is the one rejection that should be reversed.

### THE THREE CLASSES WERE NOT EXHAUSTED

Crossing the 409 against gold gives 136 rows where Moby, the en-GB referee AND gold all agree against us.
Inside the three classes Run 46 names, these clear the same three-source bar and were not taken:

    chalcedony  CH AE1 L S AH0 D OW2 N IY0   Moby kælsɛdəni · uk kælsədoʊni|kælsɛdəni · gold kælsˈɛdəni
    chimera     CH IH0 M EH1 R AH0           Moby kɪmiɹə · uk kɪmɪəɹə|kʌɪmɪəɹə|kaɪmɪəɹə · gold kImˈɪɹə
    chiron      CH AY1 R AH0 N               Moby kaɪɹɑn · uk kaɪɹən · gold kˈIɹən
    concha      K AA1 N CH AH0               Moby kɑŋkə · uk kɒŋkə · gold kˈɑŋkə
    loggia      L AO1 G IY0 AH0              Moby lɑd͡ʒə · uk loʊd͡ʒə|lɒd͡ʒiə|lɒd͡ʒə · gold lˈɔʤiə
    catsup      K EH1 CH AH0 P               Moby kætsəp · uk kætsəp · gold kˈætsəp

`celtic` and `padua` also surface and are correctly skippable — the en-GB referee carries BOTH readings
for each, so they are live variants like `hegemonic`. The point is the prose: "three classes come out of
it clean", followed by eleven words, reads as if the classes were exhausted, and they were not.

### STALE SIBLINGS

    paparazzis    g2p-dict        P AA2 P AA0 R AO1 Z IY2 Z   ← one line below the corrected paparazzi,
                                                                still carrying BOTH the old Z and the old AO1
    paparazzi's   accent-lexicon  pʰˌɑːpɑːɹˈɔːziːz            ← no dict source, so the rebuild passes it through
    mozart's      accent-lexicon  mˈoᶷzɑːɹts                  ← same; the lexicon now says Mozart /moʊts-/
                                                                and Mozart's /moʊz-/

`mozartean` (`M OW2 Z AA1 R T IY0 AH0 N`) and `piazzolla` (`P IY2 AH0 Z AA1 L AH0`) are the same family
and also /z/. No referee evidence was cited either way, so they are out of scope — recorded here so the
next pass does not rediscover them as new.

### THE VOWEL RIDERS ARE NOT UNIFORMLY COVERED BY THE CONSONANT ARGUMENT

Run 46's admissibility rule is that a consonant is a spelling trap and a vowel is an accent difference,
which is precisely what licenses a BrE referee on a GenAm lexical fact. Held to it:

- `mainz` EY1→AY1 — CLEAN. Both cited sources read `maɪnts`, and German ⟨ai⟩ is not an accent axis.
- `piazza` AE1→AA1 — gold `piˈɑtsə` plus the en-GB referee's SECOND variant; its first is `piætsə`.
- `paparazzi` AO1→AA1 — gold alone. The en-GB referee reads `pæpəɹætsi`, whose TRAP vowel the rule itself
  declares inadmissible for a GenAm claim.

Both readings are right (M-W \pē-ˈät-sə\, \ˌpä-pə-ˈrät-sē\) and the old `AO1` was plainly wrong, so
nothing needs reverting. But "as `palazzo`, nucleus too" asserts the consonant bar carries the vowel, and
for `paparazzi` it does not.

### CITATION SLIPS, ALL IN THE BRANCH'S OWN FAVOUR

- `reg`: "both referees say `ɹɛd͡ʒ`". The en-GB referee carries `ɹɛd͡ʒ` AND `ɹɛɡ`, and **wikipron-US — the
  PRIMARY referee — reads `ɹ ɛ ɡ`**, positively confirming our row. The strongest evidence for the
  rejection is the piece not cited. Rejection right.
- `hegemonic`: "both referees say `hɛd͡ʒəmɑnɪk`". The en-GB referee also carries `hɛɡɪmɒnɪk`, and gold's
  `hˌɛɡəmˈɑnɪk` matches our `HH EH2 G AH0 M AA1 N IH0 K` phone for phone. Rejection right.
- `piazza`: "uk piɑtsə" is cited without saying the en-GB row's FIRST variant is `piætsə`. Run 45 of this
  same document was about a selective citation; this is the same shape.

### "NO INTERNAL MAJORITY TO APPEAL TO" IS TOO STRONG

True of the Italian surname class. False of the words. Our own dictionary already reads the corrected way
across the immediate family of six of the twelve — `achaea` K; `distich`/`hemistich`/`tetrastich`/
`stichomythia`/`sticht`/`stichter` all K; `neogaea`/`notogaea` JH; `gibber` JH; `hemorrhage`/`-ed`/`-ing`
JH; `palazzi`/`palazzola`/`palazzolo`/`dipiazza` T S — and the n-gram, held out, already PREDICTS the
corrected consonant for `stich` (`S T IH1 K`), `palazzo` (`P AA0 L AA0 T S OW1`) and `astilbe`
(`AH0 S T IH1 L B`). The sentence disclaims support the change actually has.

### KNOWN_GAPS: the three additions are right

Held out of the dict and read through `decompose()`:

    gaea    src=N  oov=[G IY1 AH0]        = upstream → LIVE
    mainz   src=N  oov=[M EY1 N Z]        = upstream → LIVE
    piazza  src=N  oov=[P IY0 AE1 Z AH0]  = upstream → LIVE

and the other nine are NOT live, so three is exactly the right number. Source N is confirmed for all
three. The `gaea` and `mainz` waivers are accurate. The `piazza` waiver names only the ⟨zz⟩; the n-gram
also returns `AE1` for the nucleus, which is half the correction that row made.

### The Moby delta is not independent evidence

`26,624 → 26,632` scores eight corrections taken FROM Moby against the Moby referee.
`test/en-moby-referee.test.ts` says so itself — "against Moby on a word whose reading we took from Moby is
a mirror". Run 46 reports "primary 2,584 unmoved", which is the honest line; the Moby delta should be
labelled confirmation that the edit landed rather than a quality gain.

### Gates (serial, PR worktree)

    npx vitest run                                    317 files, 6,076 passed / 5 skipped — matches
    npx tsx tools/check-goldens.mts --jobs 8          189 languages, 36,495 rows, 0 stale — matches
    dotnet run --project csharp/tools/parity -c Release
                                                      189 byte-identical, 0 differ; 5/5 accent variants build

No English golden carries any of the twelve (`csharp/goldens/en.tsv` is 200 rows and holds none of them),
so "0 stale" is the expected result rather than a near miss. The only golden rows matching these stems
belong to other engines — `gn`, `rup`, `chr` — and none reads through the English dictionary rows changed
here.

### Verdict

The twelve corrections are right and the evidence for them exists. Four things should change before
merge: reverse the `cham` rejection (or restate its reason), fix the `paparazzis` dict row and the two
pass-through lexicon rows, update 41-to-67 to 44-to-64 in both places, and soften the prose where it
claims more (three classes "clean") and less (no internal majority) than the evidence supports.

## Run 48 — 2026-09-19 — Run 47's findings: a wrong rejection, stale siblings, and three slips my way

⚠ `cham` WAS REJECTED ON EVIDENCE I DID NOT GATHER. Run 46 dropped it saying "the two referees
disagree with each other". Moby reads `kæm`; the en-GB referee carries `kæm` as its SECOND variant;
and gold — never consulted — has `Cham` → `kˈæm` under the capitalized key, which is the same lookup
`en_import_moby.mts` codifies and the same one Run 46 itself used for `achaean` two rows earlier. Three
sources. Fixed, and it is the second time in three runs that the failure was reading only part of what
a multi-variant referee holds.

⚠ AND THE THREE CLASSES WERE NOT EMPTIED, which "come out of it clean" implied. Crossing the probe
against gold surfaces six more that clear the same bar and were left behind — `chalcedony`, `chimera`,
`chiron`, `concha` (⟨ch⟩=/k/), `loggia` (⟨gg⟩=/d͡ʒ/), `catsup` (read as `ketchup`, a different word).
All six now fixed; `celtic` and `padua` also surface and are correctly skipped, being live variants
the en-GB referee carries both readings of.
⚠ `concha` NEEDED `NG`, NOT `N`, and the first attempt shipped `kʰˈɑːnkə`. `con-` is a transparent
prefix, so the converter's velar rule declines to assimilate — the guard from #1358 working exactly as
designed against a word that is not prefixed at all. Caught by reading the rebuilt lexicon rather than
by a gate.
⚠ `loggia` ALREADY HAD A CURATED ROW from a LOT/THOUGHT pass, so adding a second one broke the
file's own "no word has two curated rows" rule — the exact failure #1334 wrote that test for, where
`upstream` columns chain and the re-apply order stops being defined. Folded into the existing row.

⚠ THREE STALE SIBLINGS. `paparazzis` sat one line below `paparazzi` in the dictionary keeping both the
old /z/ and the old AO1. `mozart's` and `paparazzi's` are apostrophe rows with NO dictionary source, so
`en_rebuild_lexicon.mts` passes them through and cannot reach them — the shipped lexicon said Mozart
/moʊts-/ and Mozart's /moʊz-/. Hand-corrected.

⚠ AND THREE CITATIONS WERE SLANTED MY WAY, each omitting the piece that argued hardest for what I
concluded. `reg`: I wrote "both referees say `ɹɛd͡ʒ`" — wikipron-US, the PRIMARY referee, positively
reads `ɹ ɛ ɡ`, confirming our row, and the en-GB referee carries `ɹɛɡ` too. `hegemonic`: the en-GB
referee likewise carries `hɛɡɪmɒnɪk`. `piazza`: the en-GB variant I quoted is its SECOND; the first is
`piætsə`. In all three the conclusion was right and the evidence was reported thinner than it was —
the mirror image of Run 45, where I quoted only what agreed with me.

⚠ AND I DID SMUGGLE ONE VOWEL. `mainz` EY1→AY1 is clean. `piazza` AE1→AA1 rests on gold plus the
en-GB SECOND variant. `paparazzi` AO1→AA1 rests on GOLD ALONE — the en-GB reading is `pæpəɹætsi`,
whose TRAP vowel this audit's own admissibility rule rules out for a GenAm claim. The readings are
right and the old AO1 was plainly wrong, but "as `palazzo`, nucleus too" asserted the consonant bar
covered the vowel, and for `paparazzi` it does not. Both notes now say what each rests on.

Two corrections of fact: the `-zz[aeio]` split is **44 to 64** after this branch, not the 41-to-67
stated in the present tense in two places; and of the original eleven, FIVE carried three sources, not
six — the sixth was `astilbe`, which that sentence excluded.

⚠ AND THE HEADLINE NUMBER IS A MIRROR, which Run 46 should have said. Scoring corrections taken FROM
Moby against the Moby referee is what `en-moby-referee.test.ts` calls a mirror in as many words. The
honest line is the one that did not move: the independent wikipron primary is 2,584 before and after,
because none of these words is in its 4,037 rows. That is also why they survived this long.

    Moby — words the dict carries   26,624 → 26,636 (76.0%)   ⚠ a mirror, see above
    Moby — OOV                      17,454 → 17,455
    primary                         2,584 unmoved
    goldens 0 stale · parity 189 byte-identical · 6,076 tests

`cham` joins `gaea`, `mainz` and `piazza` in KNOWN_GAPS: held out, the n-gram reads ⟨ch⟩ as /t͡ʃ/,
which is right for the English word and wrong for the title.

## Run 49 — 2026-09-19 — the grapheme seam: the last boundary-table consumer, and it was nearly clean

The class #1360 named as where the table's value lay: a digraph straddling a morpheme boundary, where a
grapheme-level reader gives the single sound. `haphazardly hæfəzɚdli` — ⟨ph⟩ read as /f/ across
`hap|hazard` — was the motivating example.

⚠ TWO PROBES IN A ROW FOUND HUNDREDS OF NOTHING, and the reason is worth recording because the same
mistake is available to anything that reconstructs a spelling split from a phone index. The boundary
table stores phone indices, not morphemes, so the split has to be recovered by trying each cut and
keeping the one whose head has the right phone count. Taking the FIRST such cut gives `as|hen`,
`fis|hing`, `pac|king`, `wit|hout` — 293 hits, all spurious, because a shorter head can have the same
phone count as the right one. Requiring both halves to be dictionary words cuts it to 85, still all
spurious. Taking the LONGEST cut gives 6, and those 6 are ambiguous splits where the digraph is inside
the head anyway (`goth|ic`, `smooth|ie`).

So the dictionary is already right on this class, and comprehensively: `haphazard`, `alphorn`,
`chophouse`, `cupholder`, `flophouse`, `hophead`, `loophole`, `peephole`, `upheaval`, `uphill` and
`uphold` all carry `P HH`. What is left is four rows where a STEM is right and something derived from
it is not:

    haphazardly  hˈæfəzɚdli   → hæphˈæzɚdli    Moby + uk + gold; the stem was already right
    upholstery   əpʰˈoᶷɫstɚi  → əphˈoᶷɫstɚi    the /h/ was ABSENT, not read as /f/
    upholster    əpʰˈoᶷɫstɚ   → əphˈoᶷɫstɚ     Moby + gold (⚠ uk dissents: əpɐlstə, no /h/)
    upholstered  (follows its stem)

⚠ AND THE OOV PROBE FOUND A MOBY DEFECT INSTEAD OF AN ENGINE ONE. 18 of 63 probed OOV rows looked like
our failures; reading the raw source, Moby's consonants are BARE LETTERS with only vowels in slashes,
so `p,h` is a deliberate two-sound claim and `althorn '/&/lt,h/O/rn`, `Einthoven`, `Godthaab`,
`Gruithuisen`, `Jagannatha`, `lanthorn` are all genuine seams we read wrong — but they are OOV, so
there is nothing to correct in a dictionary that does not contain them. Sweeping all 35 rows whose
body has a bare `p`+`h` against whether the spelling splits into two dictionary words: 29 genuine
seams, and one row the split cannot explain — `geomorphological`, where `morpho-` is /f/ and Moby's
OWN `morphology` is `m/O/rf/@/l/oU/g/i/`. Added to MOBY_DEFECTIVE, which is now 34.

⚠ I ALSO SPENT A PROBE ON A THEORY THAT WAS BACKWARDS. Seeing bare letters outside the slashes in
`Imphal '/I/mph/@/l`, I swept for "rows with bare letters" as a corruption detector and got 96,713 —
i.e. most of the file, because that is simply how Moby writes consonants. The detector was measuring
the notation, not a defect in it.

    Moby — words the dict carries   26,636 → 26,639
    Moby — OOV                      39,485 → 39,484 rows (the defective row dropped), 17,455 held
    primary                         2,584 unmoved
    goldens 0 stale · parity 189 byte-identical · 6,076 tests

`upholstery` and `upholster` join KNOWN_GAPS as source N. Their derived forms do NOT: `haphazardly`
and `upholstered` close through `morphDecode` the moment the stem is corrected, because that path
looks the stem up in the shipped dictionary. Only the roots the n-gram must spell from letters stay
open, and it has no way to know ⟨ph⟩ spans a seam in `up·holstery` and not in `morphology`.

## Run 50 — 2026-09-19 11:33 — review of #1364: the four corrections hold, the SWEEP does not

Independent review of `fix/ph-seam` (fc68153c) against `origin/main` (aa684f1e), run from detached
worktrees so the shared tree stayed untouched.

### What reproduced exactly

    npx tsx tools/gen/build-en-moby-referee.mts      git status clean — byte-identical
    npx tsx tools/english/en_rebuild_lexicon.mts     135305/135305 round-trip, 0 would change
                                                     --write leaves the tree clean
    npx tsx tools/referee-eval/eval.ts en   (MOBY=/mnt/data/moby/mobypron.unc, both trees)
        primary          2584/4037 →  2584/4037   unmoved, as claimed
        Moby in-dict    26636/35049 → 26639/35049 +3, as claimed
        Moby OOV        17455/39485 → 17455/39484 held, denominator −1, as claimed
    npx vitest run                          317 files, 6076 passed, 5 skipped
    npx tsx tools/check-goldens.mts --jobs 8   189 languages, 36495 rows, 0 stale
    dotnet run --project csharp/tools/parity -c Release   189 byte-identical, 0 differ

### The four corrections: all four hold, `upholster` included

misaki `us_gold.json` was read directly rather than taken from the note:

    haphazard    hˌæphˈæzəɹd     haphazardly  hˌæphˈæzəɹdli
    upholster    ˌʌphˈOlstəɹ     upholstery   ˌʌphˈOlstəɹi
    upholstered  ˌʌphˈOlstəɹd    upholsterer  ˌʌphˈOlstəɹəɹ

⚠ `upholstered` IS DIRECTLY ATTESTED IN GOLD and does not need the family-consistency argument the
curated note gives it. The note is not wrong, only weaker than the evidence — cite gold.

On `upholster`: the en-GB dissent is a variant, not a rival GenAm reading. Wells lists /ʌpˈhəʊlstə/
first and the h-less form as a variant, and the SAME en-GB referee file carries `upholstery ʌphəʊlstəɹi`
and `upholsterer ʌphəʊlstəɹə` WITH the /h/ — so the referee contradicts itself inside the family and the
h-less row is the outlier, exactly as argued. Confirmed.

`decompose()` on a held-out dict, all four plus the two OOV relatives:

    haphazardly   M  HH AE0 P HH AE1 Z ER0 D L IY0   = dict     KNOWN_GAPS correctly omits it
    upholstered   M  AH0 P HH OW1 L S T ER0 D        = dict     KNOWN_GAPS correctly omits it
    upholstery    N  AH0 P OW1 L S T ER0 IY0         ≠ dict     live source-N gap, as listed
    upholster     N  AH0 P OW1 L S T ER0             ≠ dict     live source-N gap, as listed
    upholsterer   M  AH0 P HH OW1 L S T ER0 ER0      now right — an OOV word the stem fix reached
    upholstering  M  AH0 P HH OW1 L S T ER0 IH0 NG   same

### `geomorphological` is genuinely defective — and gold says so more sharply than Moby does

Moby's own `morphological ,m/O/rf/@/'l/A//dZ//I/k/@/l` is the same word minus `geo-` and has /f/;
gold has `ʤˌiOmˌɔɹfəlˈɑʤəkᵊl`. The note cites `morphology`; `morphological` is the stronger citation.
The five rows dismissed as false alarms are all correctly dismissed — `hap|hazard`, `hip|huggers`,
`up|heaval`, `up|holsterer`, `up|holstery` are genuine seams that the both-halves-are-dict-words test
cannot see because `hazardly`, `huggers`, `heaval`, `holsterer`, `holstery` are not dict rows.

### ⚠ THE SWEEP IS REPRODUCIBLE AND IT IS WRONG IN TWO PLACES

The 35/29/6 partition reproduces exactly — same 35 rows, same 29, same 6 — which is what makes the two
holes worth naming, because both are in the METHOD and not in the arithmetic.

**1. `Imphal` was never "explained". The split that cleared it is `imp` + `hal`.** Both are dict rows,
so the two-dictionary-words test passed it into the 29 and it never reached the bucket to be judged.
Gold has `ˈɪmpˌʌl` — /p/, no /h/, no /f/. It is OOV-only, so nothing in the dictionary turns on it, and
leaving the row alone is a defensible outcome (Moby's `ph` plausibly transliterates the Indic aspirate).
But it was left alone on a justification that does not exist. The test admits spurious splits whenever
a short head and a short tail both happen to be words; `imp|hal` is the case in this sweep, and nothing
bounds how often it fires in the next one.

**2. The sweep required ⟨ph⟩ IN THE SPELLING, and that is what makes it 35 rows instead of 39.** The four
single-word Moby rows with a bare `p`+`h` body and no ⟨ph⟩ spelling are `crapehanger`, `crepehanger`,
`typeholder` — and `snapped`:

    Moby  snapped  'sn/&/p,h/E/d        (sits between `snapout` and `snapper`)
    ours  snapped  S N AE1 P T          gold  snˈæpt
    en.moby-lexicon.tsv   snapped   snæphɛd     ← single reading, IN-DICT tier

⚠ `snapped` IS A MOBY_DEFECTIVE ROW THAT THE SWEEP CANNOT SEE, and unlike `geomorphological` it is in the
tier that scores against the shipped dictionary, so it is a permanent false disagreement on a common word.
It belongs in MOBY_DEFECTIVE ("body is a compound of `snap`"). Found by asking a question the ph-sweep
does not ask: which referee rows contain an /h/ the SPELLING has no letter for.

### ⚠ AND THE ⟨ph⟩ CLASS IS THE SMALL END OF ITS OWN FAMILY — ⟨sh⟩ HAS 21 IN-DICT ROWS

The premise of the whole probe — "Moby's consonants are bare letters, so `p,h` is a deliberate two-sound
claim" — is TRUE FOR `p`+`h` AND FALSE FOR `s`+`h`, because Moby is internally inconsistent about ʃ. It
normally writes `/S/`, but lapses into the spelling `sh` on hundreds of rows. `Dalmatian d/&/l'm/eI//S//@/n`
and `dalmatian d/&/l'm/eI/sh/@/n` are both in the file, four lines apart.

Sweeping the in-dict referee for rows where EVERY reading contains a bare `s`+`h` while OUR dict has `SH`
at that position — i.e. guaranteed false disagreements, not judgement calls — gives 21:

    adulation charades confucianism decentralization exhalation exhumation fashioned initiate
    ludwigshafen oxidation pagination plowshare predaceous rationality reddish rehash shears
    shew sugarcane violation washbasin

(The other 18 bare-`s`+`h` rows — `mishap`, `grasshopper`, `foxhole`, `household`, `dachshund` … — are
genuine seams and correct, the same 29-to-6 shape the ⟨ph⟩ sweep found.) Five more of the same kind sit in
`ɡh`/`kh`: `giza ɡhizə` (dict `G IH1 Z AH0`), `guillermo ɡhiɛɹmoʊ`, `gehrke ɡhɚki`, `jauregui jɔɹeɪɡhi`,
`deconcini dikhænsini`. So the honest headline is not "one defective row" but "the ⟨ph⟩ slice of a
bare-letter-digraph class, and it is the smallest slice."

⚠ These are NOT dictionary defects — every one of the 21 is a REFEREE row that can never be satisfied.
They are also not all MOBY_DEFECTIVE material: the row is not corrupt, the NOTATION is ambiguous, so the
cheaper remedy is in `mobyToArpabet` (read a bare `sh` as /ʃ/ except across a seam) rather than 21 more
map entries. Either way it is a separate change from this PR and is left as a finding, not a request.

Two rows survive only because Moby happens to carry a second reading: `corporation` has both
`kɔɹpəɹeɪʃən` and `bʊŋɡhi` (the body of a lost `Bungee` headword), `county` both `kaʊnti` and `bəlɑhi`.
Multi-reading rows hide corruption from any all-readings test — worth remembering for the next sweep.

### Is MOBY_DEFECTIVE the right mechanism?

Yes, but not for the reason the header gives. `repairMoby` lives in `en_import_moby.mts` and never runs
in `build-en-moby-referee.mts`, so it CANNOT reach the referee at all; it is also a set of class-wide
regexes with no per-word table. MOBY_DEFECTIVE is the only lever that exists on the referee side. The
header's stated rationale — "a repair would be a guess at what Moby meant" — does not hold for this row
(gold and Moby's own `morphological` both say /f/, unambiguously), and the cost of dropping rather than
repairing is one lost OOV referee row. Small, but the comment should say the real reason.
`geomorphological` is not in `moby-import.tsv` (Moby and gold disagreed there), so the import layer is
unaffected and no regeneration is owed.

⚠ The two call-site comments now overstate the set: "NEVER IMPORT A ROW WHOSE BODY IS A DIFFERENT WORD"
and "A ROW WHOSE BODY IS A DIFFERENT WORD CANNOT ARBITRATE ANYTHING" no longer describe every member —
this row's body is the right word with one wrong consonant.

### Did the dictionary keep any other ⟨ph⟩ seam defect? No.

Every dict row whose ⟨ph⟩ is preceded by a free morpheme ending in ⟨p⟩ (282 rows) was read out and
classified. All 252 non-`P HH` ones are genuinely /f/ (`alpha`, `amphora`, `earphone` = ear+phone,
`rephrase` = re+phrase, `prophet`, `sophomore`, the `stephan-` family) or correctly h-less
(`shepherd`, `stephen`, `upham`, `ophthalmology`). The 34 `P HH` rows are all real seams. The dict is
clean on this class after the fix.

The same sweep was run for ⟨th⟩ ⟨sh⟩ ⟨ch⟩ ⟨gh⟩ ⟨wh⟩ against `en-morph-boundary.tsv` and against the
both-halves-are-words test. It returns hundreds of candidates and no defects — `doublethink`, `bethink`,
`enthuse`, `garlinghouse`, `widowhood`, `nowhere`, `gingham` are all already right, and the rest are
surnames where the split is an accident of spelling. The negative result is the finding: ⟨ph⟩ was the
only digraph with a live seam defect in the dictionary.

### Verdict

Ship it. The change is correct, the numbers are exactly as recorded, the referee and lexicon regenerate
byte-identically, and all three gates pass. Two follow-ups, neither blocking:

  1. `snapped` → MOBY_DEFECTIVE. In-dict tier, common word, currently unsatisfiable.
  2. The bare-`sh`-as-/ʃ/ class: 21 in-dict rows plus 5 `ɡh`/`kh` names. Probably a `mobyToArpabet`
     change, not 26 map entries.

And one correction to the record above: Run 49's "35 rows, 29 genuine seams" should read "35 rows OF THE
39 that exist, because the sweep filtered on the spelling", and `Imphal` should be counted with the 6, not
the 29.

## Run 51 — 2026-09-19 — Run 50's findings, and the hole the ⟨ph⟩ sweep could not see

Run 50 reproduced the 35/29/6 partition row for row, which is what makes its two objections method
holes rather than arithmetic.

⚠ `snapped` IS A DEFECTIVE ROW THE SWEEP WAS BUILT NOT TO FIND. It filtered on ⟨ph⟩ in the SPELLING,
so it found 35 rows where 39 exist. Moby writes `snapped 'sn/&/p,h/E/d` — a `-ped` past tense with a
stray `h` — and it reaches the IN-DICT tier as `snæphɛd`, single reading, against our `S N AE1 P T`
and gold's `snˈæpt`. A permanent false disagreement on an ordinary word, invisible to a filter keyed
on the spelling of the thing being mis-transcribed. Added; MOBY_DEFECTIVE is 35 and the in-dict
referee is 35,048.

⚠ `Imphal` WAS LEFT ALONE ON A JUSTIFICATION THAT DOES NOT EXIST. It cleared into the 29 "genuine
seams" on the split `imp`+`hal`, both of which happen to be dictionary rows, which is not a
morphological analysis of a city in Manipur. The outcome is still right — it is OOV-only and Moby's
`ph` plausibly transliterates the Indic aspirate — but the both-halves-are-words test admits spurious
splits and nothing in the sweep bounds how often. Recorded as unexplained rather than as cleared.

Two citations improved, both toward evidence that already existed:
- `upholstered` is DIRECTLY ATTESTED in gold as `ˌʌphˈOlstəɹd`. The note appealed to the inflection
  principle instead, which is the weaker claim when the row is simply there.
- `upholster`'s en-GB dissent is SELF-REFUTING: the same referee file reads `upholstery ʌphəʊlstəɹi`
  and `upholsterer ʌphəʊlstəɹə` with the /h/, so the h-less verb is the outlier inside its own source.
- `geomorphological` is now cited against `morphological` — the same word minus `geo-`, `/f/` in the
  same file — rather than `morphology`, which needed one more inferential step.
And the MOBY_DEFECTIVE reason is corrected: it is a drop rather than a repair because `repairMoby`
lives in `en_import_moby.mts` and NEVER RUNS in the referee builder, not because the intent is
unclear. Gold and Moby's own `morphological` make it unambiguous; the cost of dropping is one referee
row.

⚠ AND ⟨ph⟩ IS THE SMALL END OF ITS OWN FAMILY, which is the finding to carry forward. The premise
"bare letters, so `p,h` is a deliberate two-sound claim" holds for `p`+`h` and FAILS for `s`+`h`:
Moby normally writes `/S/` for ʃ but lapses into the spelling on hundreds of rows, and both forms
appear four lines apart — `Dalmatian d/&/l'm/eI//S//@/n` against `dalmatian d/&/l'm/eI/sh/@/n`. In the
in-dict tier, 21 rows have bare `s`+`h` in EVERY reading where our dictionary has `SH`: `adulation`,
`charades`, `confucianism`, `exhalation`, `fashioned`, `initiate`, `oxidation`, `plowshare`, `reddish`,
`rehash`, `shears`, `sugarcane`, `violation`, `washbasin` and seven more, plus five in `ɡh`/`kh`
(`giza ɡhizə`, `guillermo`, `gehrke`). Another 18 bare-`s`+`h` rows ARE genuine seams (`mishap`,
`grasshopper`, `household`, `dachshund`) — the same 29-to-6 shape, one digraph over.
These are 26 guaranteed false disagreements and they are NOT 26 more MOBY_DEFECTIVE entries: the
notation is ambiguous rather than the rows being corrupt, so the remedy belongs in `mobyToArpabet`
with the same seam test. Left as a measured finding for its own block, because a converter change has
a wider blast radius than a defect list and deserves its own before-and-after.

Also recorded for whoever writes that block: `corporation` and `county` each carry a corrupt reading
(`bʊŋɡhi` from a lost `Bungee` headword; `bəlɑhi`) that stays harmless only because a second, correct
reading sits beside it. Multi-reading rows hide corruption from any all-readings test.

    Moby — words the dict carries   26,639/35,048 (76.0%)
    primary                         2,584 unmoved

## Run 52 — 2026-09-19 — the bare `sh` class, and a discriminator that needed no morphology

Run 51 left this measured and untaken: Moby writes ʃ as `/S/` but lapses into the spelling `sh` on 41
rows, and `Dalmatian d/&/l'm/eI//S//@/n` sits four lines from `dalmatian d/&/l'm/eI/sh/@/n`.

⚠ THE DISCRIMINATOR IS THE SEPARATOR, and finding it meant the block needed no headword, no seam test
and no boundary table — which is the opposite of how the last three blocks went. Moby writes a genuine
/s/+/h/ seam with a stress or syllable mark between the two letters:

    mishap 'm/I/s,h/&/p     grasshopper 'gr/&/s,h/A/p/@/r     foxhole 'f/A/ks,h/oU/l

Measured over every in-dict row: ADJACENT `sh` is **18 lapses and 0 seams**; SEPARATED `s,h`/`s'h` is
**35 seams and 0 lapses**. Not one exception in either direction.

⚠ AND THE FOUR APPARENT EXCEPTIONS WERE MY CLASSIFIER, NOT THE DATA. `exhalation`, `exhumation`,
`ludwigshafen` and `sheepshead` first came out as "separated lapses". They are nothing of the kind:
`exhalation ,/E/ks,h/@/'l/eI//S//@/n` has a genuine `ks,h` AND a correct `/S/` in the same row. I had
classified on "our dictionary has SH somewhere in this word", which is not the same question as "at
this position" — the same position-versus-anywhere error that produced 293 phantom hits in Run 49.

⚠ AND IT IS `sh` ONLY, which is worth stating because the obvious generalisation is wrong. The same
test fails for the neighbouring digraphs: adjacent `gh` has `leghorn` (leg·horn) among its four
in-dict rows, and adjacent `kh` is almost entirely seams — `back·haus`, `bank·head`, `lock·hart`,
`monk·hood`, `stock·holm`, 15 rows of them. Moby's separator habit is consistent for this digraph and
not for those, so the rule is scoped to the one place it was verified.

    Moby — words the dict carries   26,639 → 26,651 (76.0%), +intentional 82.8%
    Moby — OOV                      17,455 → 17,464
    primary                         2,584 unmoved — this is a referee repair, not an engine change
    goldens 0 stale · parity 189 byte-identical · 6,076 tests

`dalmatian` also collapses from two referee readings to one, the `/S/` row and the `sh` row having
been the same reading written twice. Seam rows are untouched and verified by name: `mishap mɪshæp`,
`grasshopper ɡɹæshɑpɚ`, `household haʊshoʊld`, `foxhole fɑkshoʊl`, `dachshund dækshʊnd`,
`leghorn lɛɡhɔɹn`, `stockholm stɑkhoʊm`.

## Run 53 — 2026-09-19 12:37 — review of #1365: the partition holds, and it holds wider than claimed

Reviewed `fix/moby-bare-sh` (577402ce) against `origin/main` (17bc6a7e) from a detached worktree, with
the referees regenerated from `MOBY=/mnt/data/moby/mobypron.unc` on **both** trees before any number was
read. Verdict: **approve**. Every claim reproduced, one of them understated, and one exact-analogue class
left on the floor.

### The partition, re-derived independently

Rather than classify against our dictionary at all — the step that produced Run 52's four phantom
exceptions — I enumerated the raw Moby bodies directly: strip every `/…/` group to a sentinel, then scan
the surviving bare-letter stream for `s`+`h` adjacent versus `s,h`/`s'h` separated, over all 177,267 rows
rather than only the in-dict ones. Question: does the separator predict the reading with no reference to
our side of the comparison?

    sh  adjacent 48 occurrences (46 distinct rows)   separated 108 occurrences
    gh  adjacent 37   kh adjacent 37   ph adjacent 5   zh 1   wh 5
    th  adjacent  0   ch adjacent  0   ng adjacent 0

Then I read all 46 adjacent rows and all 108 separated rows by hand. **Every one of the 46 is ʃ. Every one
of the 108 is a seam.** No dictionary was consulted, so there is no position-versus-anywhere error
available to make. The claim is not just exception-free in-dict — it is exception-free over the whole file.

⚠ THE TWO ROWS THAT LOOK LIKE COUNTEREXAMPLES ARE THE PROOF. `gooseflesh 'g/u/s,fl/E/sh` and
`washhouse 'w/O/sh,h/&//U/s` each contain BOTH forms in one body: the compound seam written with the
comma, the ʃ written adjacent. Moby is not being inconsistent within a row — it is using the separator
exactly as the PR says. `sheepshead '/S//i/ps,h/E/d` is the same evidence from the other direction: `/S/`
for the ʃ and `s,h` for the seam, one row.

### The OOV tier, which Run 52 did not characterise

Asked for explicitly, and it is the right question — the rule changes both files but only the in-dict half
was measured. Of the 17 OOV rows the change touches, exactly two are seam-adjacent, and both get BETTER:

    washhouse   wɔshaʊs  →  wɔʃhaʊs      engine: wˈɔːʃhˌaᶷs   fail → PASS
    gooseflesh  ɡusflɛsh →  ɡusflɛʃ      engine: ɡˈuːsflˌɛʃ   fail → PASS

`washhouse` is the interesting one. Old converter: `sh` → S HH, then the separated `,h` → HH, and the
OOV-only `degeminate` **swallowed the second HH** — so the old referee reading had lost the seam /h/
entirely and read `wɔshaʊs`. The new rule restores it. A row that was wrong in two ways is now right.

No OOV row has an adjacent `sh` that is a genuine seam.

### All 18 in-dict lapse rows are ʃ in GenAm

Checked each against the shipped engine (`phonemizeAsync(w,"en")`); all 18 plus the 3 collapse rows come
out with ʃ at the position in question — `adulation ˌæd͡ʒəlˈeᶦʃən`, `predaceous pɹidˈeᶦʃəs`,
`shew ʃˈuː`, `qursh kʰˈɝʃ`, `washbasin wˈɔːʃbeᶦsn̩`, and so on. None is a /s/+/h/ word.

⚠ NO ROW CAN GO PASS→FAIL HERE, and this is structural rather than lucky: the old reading differed from
the new one ONLY by carrying a literal `s`+`h` where the new one has `ʃ`, so a row that passed before
required the engine to emit /sh/ at that spot. None of the 38 does. The +12/+9 is 38 rows changed, 21 of
them newly agreeing, 17 still failing for unrelated reasons (`machicolation` is ours: we drop the t͡ʃ
outright, `məˌɪkəlˈeᶦʃən`).

### The exclusions are right, and `th`/`ch`/`ng` are righter than stated

`th`, `ch` and `ng` have **zero** adjacent occurrences in the entire file — Moby never once lapses into
those spellings, so there is nothing to scope in or out. The three excluded by measurement:

  • `gh` — correctly excluded, but the stated reason undersells it. Of 37 adjacent rows only `leghorn`,
    `lughole` and `Barghoorn` are seams; the other 34 are a THIRD convention entirely, Moby spelling hard
    /ɡ/ before a front vowel in Romance names — `Giza 'gh/i/z/@/`, `Guillermo gh/i/'/E/rm/oU/`,
    `Genda 'gh/@/nd/A/`. Not a digraph lapse at all, and a rule modelled on `sh` would have wrecked them.
  • `kh` — correctly excluded: seams (`back·haus`, `lock·hart`, `monk·hood`, `stock·holm`, `Elk·hart`,
    `Lake·hurst`, `Pank·hurst`, `Durk·heim`) plus foreign /x/ (`Dachau`, `Heydrich`, `Khalifa`). No lapses.
  • `ph` — 5 adjacent: four seams (`mop·head`, `tap·house`, `up·heaped`, `Imphal`) and ONE lapse,
    `geomorphological ,m/O/rph/@/…`. 4-to-1 is not exception-free, so excluding it is the correct call.

⚠ AND ONE DIGRAPH NOBODY CHECKED: `wh`. **5 adjacent occurrences, 0 separated** — the same clean partition
as `sh`, and Moby has its own symbol for this sound (`hw` is in `M_C`), so the bare spelling is a lapse by
the file's own convention. Four of the five reach the shipped referees today carrying a spurious /h/:

    en.moby-lexicon.tsv:14624  guisewite  ɡaɪzwhaɪt
    en.moby-oov.tsv:38846      whap       whɑp
    en.moby-oov.tsv:38848      whapping   whɑpɪŋ
    en.moby-oov.tsv:38888      whippet    whɪpɪt

Four permanently-unwinnable rows, one of them in the lexicon file. Not this PR's job — the block is scoped
to where it was verified, which is the right instinct — but it is the identical argument on an identical
partition, and it should be the next one.

### `dalmatian`: a duplicate, not a lost variant

Confirmed at the source. The collapse is a case-pair where Moby wrote the same word both ways:

    Dalmatian d/&/l'm/eI//S//@/n      dalmatian d/&/l'm/eI/sh/@/n
    Swedish   'sw/i/d/I//S/           swedish   'sw/i/d/I/sh
    Vichy     'v/I//S//i/             vichy     'v/I/sh/i/

All three collapse, 466 → 463 multi-reading headwords. Nothing is lost: the two readings were the same
reading. These pairs are also the cleanest independent evidence for the lapse hypothesis there is — one
headword, one pronunciation, two spellings of it, four lines apart.

### Numbers, both trees, regenerated

    referee rows        35,048 / 39,484        unchanged on both trees
    regenerated output  byte-identical to what is committed, on BOTH main and the branch
    Moby in-dict        26,639 → 26,651 (76.0%)
    Moby OOV            17,455 → 17,464 (44.2%)
    primary wikipron    2,584/4,037 (64.0%) unmoved
    npx vitest run                              317 files, 6,076 passed, 5 skipped
    npx tsx tools/check-goldens.mts --jobs 8    189 languages, 36,495 rows, 0 stale
    dotnet run --project csharp/tools/parity    189 byte-identical, 0 differ, 5/5 accent variants

Every figure in the commit message reproduces exactly. Regenerating on `main` as well as the branch is
what makes the diff attributable — both were already in sync with their converters, so the 38 changed
referee rows are the change and nothing else.

### One reconciliation worth keeping

46 distinct adjacent-`sh` rows, minus 7 multi-word bodies (`attache_case`, `Rosh_Hashanah`,
`venetian_blind`, …) and 1 hyphenated (`papier-mache`) rejected by the headword filter, leaves **38** —
exactly the number of referee rows the diff touches. Nothing was dropped by the import filter, the
non-rhotic filter or `MOBY_DEFECTIVE` along the way, so the class is fully accounted for end to end.

## Run 54 — 2026-09-19 — Run 53's findings: `wh` taken, and `gh` excluded for a better reason

Run 53 re-derived the partition from the raw bodies alone — never consulting our dictionary, so the
position-versus-anywhere error that bit Runs 49 and 52 was not available to it — and got a stronger
result than Run 52 claimed: over all 177,267 rows, adjacent `sh` is 46 rows and **all 46 are ʃ**;
separated `s,h` is 108 occurrences and **all are seams**. Exception-free over the whole file, not just
the in-dict tier I measured. The two rows that look like counterexamples are the proof:
`gooseflesh 'g/u/s,fl/E/sh` and `washhouse 'w/O/sh,h/&//U/s` each carry BOTH forms in one body.

⚠ AND THE OOV TIER, WHICH RUN 52 DID NOT CHARACTERISE, CONTAINED THE BEST CASE FOR THE CHANGE.
`washhouse` was worse than a false disagreement: the old converter produced `S HH` for the spelling
and `HH` for the genuine separated seam, and the OOV-only `degeminate` then swallowed the second — so
the referee had LOST the seam /h/ entirely, reading `wɔshaʊs`. It now reads `wɔʃhaʊs` against our
`wˈɔːʃhˌaᶷs`. Two OOV rows are seam-adjacent and both improve; none is a genuine adjacent-`sh` seam.

⚠ `wh` IS THE SAME LAPSE AND IS NOW TAKEN. Moby HAS a `/hw/` symbol and uses it 1,088 times, so the
bare spelling is a slip by the file's own convention — 5 adjacent occurrences, 0 separated, the same
clean shape one digraph over. It maps to `W`, exactly where `M_C` already sends `hw`, because this
converter follows the wine–whine merger; gold reads `whippet` as `wˈɪpət`. Four rows shipped a
spurious /h/, `guisewite ɡaɪzwhaɪt → ɡaɪzwaɪt` among them — a word with no ⟨h⟩ in its spelling at all.
⚠ MY OWN `wh` MEASUREMENT SAID 2 ADJACENT AND 3 SEPARATED, and it was wrong. I tested for a mark
BEFORE the pair (`[,']wh`) rather than BETWEEN the letters (`w[,']h`), so a word-initial stress mark
read as a separator. The `sh` version of the same test was written correctly; the copy was not.

⚠ AND `gh` IS EXCLUDED FOR A BETTER REASON THAN RUN 52 GAVE. I wrote that it "has `leghorn` among its
four in-dict rows". Whole-file, it has 37 adjacent rows, of which only three are seams (`leg·horn`,
`lug·hole`, `Barg·hoorn`) — and the other 34 are a THIRD convention entirely: Moby spelling a hard
/ɡ/ before a front vowel in Romance names, `Giza 'gh/i/z/@/`, `Guillermo gh/i/'/E/rm/oU/`. Mapping it
to `G` would be right 34 times in 37, which is a real option and not the standard the two rules
above meet. Recorded as available rather than as refused.
Also corrected: `th`, `ch` and `ng` have ZERO adjacent occurrences — nothing to scope, rather than a
test they fail — and `kh` is seams plus foreign /x/ with no lapses at all.

    Moby — words the dict carries   26,651/35,048 (76.0%)
    Moby — OOV                      17,464 → 17,465
    primary                         2,584 unmoved
    goldens 0 stale · parity 189 byte-identical · 6,076 tests

Run 53's reconciliation is worth keeping as the shape a future sweep should produce: 46 adjacent rows
− 7 multi-word − 1 hyphenated = 38, exactly the referee rows the `sh` diff touches, with nothing lost
to the import, non-rhotic or defective filters.

## Run 55 — 2026-09-19 14:55

Taking the `gh` candidate Run 54 recorded as available. The question was whether "right 34 times in 37"
could be raised to the exception-free standard the `sh` and `wh` rules meet.

    python3 — enumerate every `gh` occurrence in the 177,267 raw bodies, and every `g[,']h`

⚠ THE 34-OF-37 FIGURE WAS MEASURED OVER ROWS THAT MOSTLY CANNOT REACH THE CONVERTER. Whole-file
there are 36 adjacent `gh` rows and 17 separated. Seventeen of the 36 are MULTI-WORD (`Antoine_Gizenga`,
`Guillain_Barre_Syndrome`) and `mobyToArpabet` rejects any body containing `_` before it reaches the
character loop. The reachable set is 19: sixteen hard-/ɡ/ and three seams. So the honest ratio was
16 of 19, not 34 of 37 — a WORSE ratio than I quoted, measured on the rows that actually matter.

⚠ AND THE SEPARATOR DISCRIMINATOR IS FALSE FOR `gh`, BY THE FILE'S OWN HAND. Moby writes

    Leghorn        'l/E/g,h/O/rn        (separated)
    leghorn        'l/E/gh/oU/rn        (adjacent)

THE SAME WORD, both ways. This is the mirror image of the `gooseflesh`/`washhouse` evidence that
supported the `sh` rule: there a single body carried both forms and they agreed with the rule, here
two bodies carry both forms and they contradict it. Had I ported the `sh` rule across, it would have
broken `leghorn` — an in-dict row that is currently correct and passing — to fix foreign proper names
in the OOV tier. That is the trade I would have made on Run 54's framing.

⚠ THE HEADWORD'S SPELLING ARBITRATES IT EXACTLY, and it is the same test that should have been used
for `guisewite` in Run 54. All three genuine seams spell the DIGRAPH ⟨gh⟩ (`leghorn`, `lughole`,
`Barghoorn`); not one of the 33 hard-/ɡ/ rows does. The 17 separated rows all spell it too
(`bighead`, `doghouse`, `froghopper`), so the spelling test and the separator agree wherever the
separator is present and only the spelling covers the rest. The one occurrence the rule misreads is
`Hayato_Ikeda h/I/gh'/j//A/t/A//@/`, which is neither a seam nor a hard /ɡ/ but a corrupt body — and
it is multi-word, so it never reaches the converter.

⚠ THE FIRST DRAFT OF THIS ENTRY STATED THE RULE AS "no ⟨h⟩ after its ⟨g⟩ anywhere in the spelling",
WHICH IS FALSE, and it is failure mode (a) again — the adjacency-versus-anywhere confusion, this time
inverted. `Gehrke`, `Gerhard` and `Gerhart` are hard-/ɡ/ rows with an ⟨h⟩ two characters after the
⟨g⟩. The IMPLEMENTED test was always the adjacent digraph (`!w.includes("gh")`) and is correct; the
PROSE described a weaker property that the data contradicts. Anyone reimplementing from that sentence
writes `/g.*h/` and flips `Gehrke` to a seam. Third occurrence of this failure mode in the audit
(Run 49's 293 phantom ⟨ph⟩ hits, Run 52's 4 phantom `sh` exceptions, now this) — and the first where
it reached a shipped comment rather than a measurement.

⚠ WHY "ANYWHERE IN THE HEADWORD" IS SAFE, which the first draft got for the wrong reason. I wrote
that it was safe "because the class is closed and small". That is an argument from having looked, not
a mechanism. The mechanism is that Moby writes ORTHOGRAPHIC ⟨gh⟩=/ɡ/ as a plain `g` WITHOUT EXCEPTION
— `ghetto 'g/E/t/oU/`, `spaghetti sp/@/'g/E/t/i/`, `Ghana 'g/A/n/@/`, `Ghiberti g/i/'b/E/Rt/i/`,
`Borghese b/O/R'g/E/z/E/`, `McGhaughey m/I/k'g/eI/h/i/` — so a word that spells ⟨gh⟩ anywhere never
writes a bare `gh` for a hard /ɡ/ somewhere else in the same body. The hyphen hole one would expect
to be the weak spot is also empty: every headword spelling ⟨g⟩+separator+⟨h⟩ (`big-headed`,
`gung-ho`, `jug-handle`, `fog-hidden`) carries `_` in its BODY and is declined before the character
loop. ⚠ AND THE MARGIN IS THINNER THAN THE ENUMERATION SUGGESTS: several ⟨gh⟩-spelled hard-/ɡ/ names
(`Ghiberti`, `Gheorghiu-Dej`) are declined today for UNRELATED reasons — Moby's French-scheme
capitals — so they are not evidence this rule handles them.

⚠ OUR ARPABET DICTIONARY CONFIRMS THE SPLIT INDEPENDENTLY, and "gold" was the wrong word for it. The
five strings are verbatim rows of `data/languages/english/g2p-dict.tsv`; gold is misaki's
`us_gold.json`, which is IPA. The independence claim needed a check the first draft never made —
`g2p-dict.tsv` contains 17,831 Moby-imported rows, and corroboration from one of those would be
circular. None of the five is among them. `leghorn` is `L EH1 G HH AO0 R N` WITH the /h/, and
`giza G IH1 Z AH0`, `guillermo G W IH0 L Y EH1 R M OW0`, `jauregui Y AW0 R EY1 G W IY0`,
`gehrke JH EH1 R K` are without it.
⚠ "FIVE FOR FIVE" OVERSTATES IT. Only `leghorn` confirms a SEAM. The other four confirm an ABSENCE
of /h/ on rows that disagree with Moby about other phones anyway — `gehrke JH EH1 R K` reads an
initial /d͡ʒ/ and has no final vowel, `jauregui` inserts a /w/ Moby lacks. Four absences and one
positive, not five independent confirmations.

⚠ AND THERE ARE TWO CORRUPT ROWS AMONG THE 37, NOT ONE. `Corporation 'b/U//N/gh/i/` transcribes
*bungee* and is counted inside the "33 hard-/ɡ/". The arithmetic survives because that `gh` genuinely
wants the hard-/ɡ/ reading FOR THE WORD THE BODY ENCODES — but it is 32 real words plus a row that
happens to agree.

A first attempt at a discriminator used the FOLLOWING VOWEL — hard /ɡ/ before front/central
(`/i/ /E/ /@/ /aI/ /[@]/`), seam before back rounded (`/O/ /oU/`). ⚠ I RECORDED IT AS "SAME COVERAGE,
DROPPED ON STYLE", AND THAT IS WRONG IN BOTH HALVES — failure mode (b), a parity claim measured over
a population of three. The vowel rule's seam side rests ENTIRELY on the three adjacent seams, which
happen to precede `/O/ /oU/ /oU/`. The file's SEVENTEEN SEPARATED seams — the same rows this entry
cites as corroboration for the spelling test — include ELEVEN whose following vowel is outside that
set: `bighead /E/`, `egghead /E/`, `jughead /E/`, `pigheaded /E/`, `Borghild /I/`, `legharness /A/`,
`froghopper /A/`, `bughouse /AU/`, `doghouse /AU/`, `draghound /AU/`, `staghound /AU/`. Four of them
sit squarely inside the stated HARD-/ɡ/ vowel set. Had any been written adjacent — exactly what
happened to `leghorn` — the vowel rule reads it hard /ɡ/ and the spelling rule gets it right. The
spelling rule is STRICTLY BETTER, not tied; I undersold the change I was making. "Also separates all
37" was wrong too: `Hayato_Ikeda`'s `gh` is followed by `'` then `/j/`, no vowel at all, so the vowel
rule does not classify it — the same row this entry charges the spelling rule with misreading.
On no reachable row do the two rules disagree.

"The reachable set is 19" is call-site-dependent and worth a word: 19 in `audit()`, 18 through the
import and referee filters, which drop `Garcia-inchaustegui` on its hyphen. The ratio is unaffected.

`mobyToArpabet` now takes the lowercased headword as a REQUIRED second argument. Required rather than
optional because a default would let a new call site silently pick the wrong branch for this one rule;
four call sites and six test calls, all of which had the headword in scope already.

⚠ THE SCORE MOVE IS ONE ROW. Fifteen referee readings lose a spurious /h/ — five lexicon rows and ten
OOV rows, `corporation`'s masked second reading among them, not in addition to them — and exactly one
begins to match. The other fourteen are words this engine gets wrong for unrelated reasons — `giza` is `ɡɪzə` against Moby's
`/i/`. So this is not a scoring change and should not be reported as one: it removes fifteen provably
wrong readings from a REFERENCE ARTIFACT, where a wrong reading is a hazard to every future
measurement taken against it, not just to today's.

    Moby — words the dict carries   26,651/35,048 (76.0%)  unmoved
    Moby — OOV                      17,465 → 17,466        (+1)
    primary                         2,584 unmoved
    goldens 0 stale · 6,077 tests

Still open, unchanged: the ~650 unstressed-vowel rows (the weak-vowel intentional classes need
revisiting, not new machinery) and the syllabic-l class (78 rows, `cycling saɪkəlɪŋ` against `saɪklɪŋ`).
The `corporation` caution from Run 54 stands and this run did not address it: its Bungee-derived second
reading is still corrupt, merely no longer corrupt AND misconverted. A defective READING is not
expressible in `MOBY_DEFECTIVE`, which drops whole headwords, so multi-reading rows remain the place
corruption hides from any all-readings test.

One forward consequence this run did not anticipate: a future `en_import_moby` run could newly ADMIT
`gizo`, `genda`, `heintges` and their neighbours if gold concurs, because their Moby readings are no
longer corrupt. That is an improvement rather than a risk, but it is a behaviour change in the import
path and not only in the referee.

## Run 56 — 2026-09-19 15:45

Taking the caution Runs 54 and 55 both recorded and neither acted on: `corporation` ships a correct
reading and a corrupt one, and no test can see the corrupt one because the row keeps passing.

    python3 — two detectors over the 659 headwords carrying more than one distinct raw body

⚠ `MOBY_DEFECTIVE` CANNOT EXPRESS THIS AND THAT IS WHY IT SAT FOR FOUR BLOCKS. It drops a HEADWORD.
Dropping `city` or `county` to be rid of one bad reading throws away a correct reading that is
scoring today, so the only available lever was one nobody would pull. The fix is a second table,
`MOBY_DEFECTIVE_READING`, that declares a (headword, body) pair.

⚠ KEYED ON THE RAW MOBY BODY, NOT THE IPA. This is the load-bearing design choice and the reason is
one block old: `corporation`'s bad reading was `bʊŋɡhi` until Run 55's bare-`gh` rule made it `bʊŋɡi`.
An IPA-keyed declaration would have silently stopped matching at that moment — no test failing, the
defect quietly back in the corpus. The body is source data and never moves. A test asserts every
declared body is 7-bit, since Moby's notation is ASCII and a stray IPA character is the signature of
exactly that mistake.

⚠ TWO DETECTORS, AND NEITHER ALONE WAS ENOUGH — the more useful half of this run. (Run 57 adds two
more and finds fourteen further declarations, so "the twelve that survived" below is a floor, not a
count. The `vineyard` explanation in this paragraph is also wrong; see Run 57.) The first compares a
row's readings TO EACH OTHER (consonant-skeleton Jaccard < 0.34) and flagged 21 pairs. The second
compares each reading TO THE HEADWORD'S SPELLING (60%+ of the body's consonants unaccounted for) and
flagged 21, mostly different ones. Detector 1 alone misses `luce d/@/'l/u/s` — "De Luce" with the
space lost, which looks unremarkable beside `luce l/u/s` until you ask what a ⟨d⟩ is doing in a word
spelled without one. Detector 2 alone misses `vineyard /dZ//u/'m/A/r/A/`, because "Jumara"'s
consonants happen to sit inside `vineyard`'s. Nine of detector 2's flags are false positives from my
own crude spelling→skeleton map (⟨j⟩, ⟨g⟩, ⟨ch⟩ before /d͡ʒ/ and /ʃ/), which is why every pair was read
by hand rather than thresholded.

Twelve declarations, in two classes. Nine are THE BODY IS A DIFFERENT WORD — the same corruption
`MOBY_DEFECTIVE` already collects, on rows whose other reading is sound:

    city         'b/oU//Z//[@]/r        boʊʒɚ           'Bougère'
    corporation  'b/U//N/gh/i/          bʊŋɡi           'Bungee'
    county       b/@/'l/A/h/i/          bəlɑhi          'Balahi'
    plateau      b/@/l'/oU/v/E/ns       bəloʊvɛns       'Bellovens'
    peak         k/oU/rk/oU/'v/A/d/oU/  kɔɹkoʊvɑdoʊ     'Corcovado'
    vineyard     /dZ//u/'m/A/r/A/       d͡ʒumɑɹɑ         'Jumara'
    bey          /A/zz/@/d'd/i/nb/eI/   ɑzzəddinbeɪ     'Azzeddin Bey', space lost
    luce         d/@/'l/u/s             dəlus           'De Luce', space lost
    soufriere    s/AU/                  saʊ             truncated, 2 phones for 9 letters

A LOST SPACE is a recognisable sub-shape worth naming: Moby's source held a multi-word entry and the
headword kept only its last word, so the body is a whole name and the headword is one word of it.
`bey` and `luce` are both this, and it is the same mechanism as `MOBY_DEFECTIVE`'s
"Surname, Firstname" family seen from the other side.

Three more are a DIFFERENT CLASS and declared anyway: not a displaced word but the right word
transcribed impossibly — `rouse r/O/ss` (ɹɔss; a word-final geminate /ss/ is not an English coda),
`toy t/oU//j/` (toʊj, OY written as GOAT+glide), `whitehead 'w/aI//T//E/d` (waɪθɛd, the ⟨th⟩ read
across the compound seam as θ). Same justification: the row passes on its good reading while
crediting a reading no speaker produces.

⚠ CASE DOES NOT PREDICT WHICH READING IS BAD, which rules out the cheap fix. The capitalised row is
the corrupt one for nine of the twelve — but `Toy t//Oi//` and `Whitehead '/hw//aI/t,h/E/d` are
CORRECT and their lower-case partners are the broken ones. A rule that dropped capitals would have
fixed nine and broken two. This is the same conclusion the builder already records for a different
reason, arrived at independently.

⚠ THE BUILD NOW FAILS IF A DECLARATION STOPS MATCHING. Every declared pair must fire exactly once;
otherwise the build throws. Without it a typo or a source change reads exactly like success — the
row simply comes back. Mutation-checked: corrupting one body gives
`MOBY_DEFECTIVE_READING: 12 declared, 11 matched`.

⚠ THE IMPORT PATH NEEDED THE SAME GUARD AND IS THE MORE DANGEROUS ONE. `en_import_moby.mts` is
first-wins and WRITES DICTIONARY ROWS. Moby lists `Corporation` before `corporation` and `City`
before `city`, so on those two the corrupt body is the one the importer would reach first. Nothing
bad has shipped only because `have.has(w)` already carries both words — an accident of coverage, not
a safeguard.

    Moby — words the dict carries   26,651/35,048 (76.0%)  unmoved
    Moby — OOV                      17,466/39,484 (44.2%)  unmoved
    primary                         2,584/4,037 (64.0%)    unmoved
    headwords emitting >1 reading   463 → 451   (→ 437 after Run 57)
    goldens 0 stale

⚠ EVERY NUMBER IS UNMOVED, AND THAT IS THE RESULT, not a disappointing one. Because the eval credits
ANY reading on a row, dropping a reading can only ever cost score — never gain it. Unmoved means our
engine was not matching any of the twelve, so they were latent rather than inflating anything. What
changes is that a future regression TOWARD one of those readings would now be caught instead of
silently credited. That is the entire value of this run and it is not visible in any score line.


## Run 57 — 2026-09-19 16:05

Review of the Run 56 block. The mechanism survived; the table was half a table and two of the guards
had holes.

⚠ THE BUILD GUARD RAN AFTER `writeFileSync`, WHICH IS THE WORST OF BOTH OUTCOMES. A non-matching
declaration threw — and left the corpus on disk with the defect restored. The build failed AND the
bad row shipped. The comment claimed it "fails the build instead of quietly restoring the defect";
it did both. Moved above the writes and verified: the failed build now leaves the file byte-identical.

⚠ AND IT COULD NOT SEE A DUPLICATE DECLARATION. `MOBY_DEFECTIVE_READING` is a Map of Sets, so the same
pair declared twice collapses — declared stays N, matched stays N, build passes with a silently
ignored row. Caught now at module load, where the duplicate still exists as an array element:
`DEFECTIVE_READINGS: duplicate declaration(s) luce	d/@/'l/u/s`.

⚠ A THIRD HOLE, NOT YET REACHABLE BUT MADE REACHABLE BY THIS VERY CHANGE. `imported.has(w)` short-
circuits above the count, so a declared word that later enters `moby-import.tsv` stops being counted
and trips the check with a misleading message. Run 56 itself makes these words newly importable —
the corrupt body no longer consumes their `seen` slot — so the next `en_import_moby --write` would
have walked into it. The count now excludes imported headwords.

⚠ FOURTEEN MORE DECLARATIONS, AND THE DETECTOR THAT FOUND THEM IS THE ONE I SHOULD HAVE WRITTEN FIRST.
Both of Run 56's detectors reason about ONE ROW. A fourth — does this exact raw body occur elsewhere
in the file as some other headword's body? — turns a guess about what a corrupt body says into a
CITATION, and it overturned four of Run 56's twelve reasons:

    county      b/@/'l/A/h/i/   not "Balahi" (a back-transliteration I invented) but Moby's own
                                `Bellaghy b/@/'l/A/h/i/`, byte-identical
    rouse       r/O/ss          not "a word-final geminate is not an English coda" but Moby's own
                                `Ross r/O/s` with a doubled ⟨s⟩ — a DISPLACED WORD, not a bad coda
    soufriere   s/AU/           not "truncated" but Moby's own `Sau s/AU/`, byte-identical
    cahill      k/eI/l          Moby's own `kale`/`kail k/eI/l`

Run 56 stated two guessed back-transliterations as fact. The declarations were right; two of the
reasons were fiction, and one ("a word-final geminate") was a phonological argument for what is
simply a different word.

The fourteen new ones: `wellington`, `college`, `junta`, `zed` (Zedekiah), `cahill`, `quoin` (Du
Coyne, space lost) as displaced words; `early`, `somali` (/l/ dropped), `began` (/ɡ/ dropped),
`crises`, `messieurs` (doubled ⟨rr⟩), `swaraj` (intrusive /r/), `watergate`, `duralumin` (stray
`d/dZ/` onset) as the right word transcribed impossibly.

⚠ "NINE OF TWELVE ARE CAPITAL-CORRUPT" WAS TEN OF TWELVE, and the error had reached a TEST HEADING.
`Rouse r/O/ss` is the capitalised row; Run 56's test block headed "the LOWER-CASE row is the corrupt
one" listed `rouse` among its members. The assertion was right and the heading was wrong, which is
the worse of the two — a reader trusts the heading. Failure mode (c). With the new members the split
is: most capital-corrupt, six lower-case-corrupt (`toy`, `whitehead`, `early`, `somali`, `crises`,
`watergate`).

⚠ AND THE `vineyard` EXPLANATION WAS FAILURE MODE (a) AGAIN. I wrote that detector 2 missed it
"because Jumara's consonants happen to sit inside `vineyard`'s". They do not — `d͡ʒumɑɹɑ` has {d͡ʒ, m, ɹ}
and `vineyard` is spelled v-n-y-r-d with NO ⟨m⟩. It missed because 1 of 3 unaccounted is 33%, under
the 60% threshold. I described a containment that does not hold instead of reading my own arithmetic.

⚠ THREE-OR-MORE READINGS IS PROVABLY A NON-ISSUE, which Run 56 never checked. Of 175,210 headwords,
174,516 have exactly one distinct raw body and 694 have exactly two. NONE has three. There is no
deeper tier of this problem. Also: "659 headwords" is the count after the builder's `[a-z]{2,20}`
filter; the population-level figure is 694.

⚠ `watergate` LEAVES THE CORPUS ENTIRELY, and that is the right outcome. Its capitalised reading is
non-rhotic RP (`wɑtəɡeɪt`) and its lower-case one metathesises the /r/ to before the ⟨t⟩
(`wɔɹtəɡeɪt`); declaring the second leaves only the first, which the non-rhotic filter then takes.
Neither reading could arbitrate a GenAm pronunciation. The lexicon is 35,048 → 35,047 for this one
word, with the numerator unmoved — so it was failing already, and the corpus simply stopped
pretending it could judge.

⚠ THE IMPORT-PATH CLAIM WAS OVERSTATED IN ONE DIRECTION AND UNDERSTATED IN THE OTHER. Run 56 said the
corrupt body ships "only because `have.has(w)`". There is a second independent gate: a body that
disagrees with misaki gold hits `disagree++`, and `bʊŋɡi` can never match gold's `corporation`. Two
gates, not one accident — the claim was alarmist. But the actual harm was under-claimed: `seen.add(w)`
fires on the CORRUPT body, so the good lower-case row never gets its turn and the word is dropped
from the import altogether. This table unlocks coverage rather than merely preventing damage. And an
independent check of all 17,820 `moby-import.tsv` rows found no shipped row taken from a corrupt
second reading — 59 are multi-body headwords and every one took the sound body.

⚠ TWO CLAIMS FROM THE REVIEW THAT DID NOT SURVIVE MEASUREMENT, recorded because taking them on trust
would have put a wrong rule in the converter:
  · `t/S/`-for-`/tS/` was reported as an eleven-row typo class wanting a converter rule. It is 271
    rows, and the majority are NOT typos — `aquaculture '/&/kw/@/,k/@/lt/S//@/r`, `arch-enemy
    /A/rt/S/'/E/n/@/m/i/`, `astrohatch '/&/str/@/,h/&/t/S/` are ordinary words where `t` + `/S/` is
    how Moby writes the affricate. Only 12 sit on a multi-reading headword. A converter fold is
    probably right and needs a seam discriminator like `sh`/`wh`/`gh` did — 271 rows makes it a
    block of its own, larger than any of the last four, not a footnote to this one.
  · `/oU//j/` was reported as a recurring error class with `toyon` as a second victim. It occurs 66
    times and is a LEGITIMATE notation in the large majority — `Amboina /&/m'b/oU//j/n/@/`,
    `actinouranium ,/&/kt/@/n/oU//j//U/'r/eI/n/i//@/`. `toyon` is at worst ambiguous (the plant is
    attested both ˈtɔɪ-ɒn and toʊˈjoʊn). `toy` is the one place the notation is misapplied. The
    notation recurring is not the same thing as the error recurring.

A LINE THE TABLE NOW DRAWS EXPLICITLY, because it is more useful than any entry: a CASE COLLISION IS
NOT CORRUPTION. `UP /j//u/'p/i/` is the correct reading of the initialism and `Piquet 'p/I/k/eI/` of
the surname; they merely share a lower-cased key with `up` and `piquet`. Those readings CAN be their
spelling — a different lexeme, not a defect — and the builder's header accepts that risk having
measured the alternative as worse. Declaring them here would be a policy change dressed as a fix.
The other structural limit: this table cannot reach a SINGLE-reading row, which belongs in
`MOBY_DEFECTIVE` instead.

    Moby — words the dict carries   26,651/35,047 (76.0%)  numerator unmoved, denominator −1
    Moby — OOV                      17,466/39,484 (44.2%)  unmoved
    primary                         2,584/4,037 (64.0%)    unmoved
    headwords emitting >1 reading   463 → 437
    declarations                    12 → 26

## Run 58 — 2026-09-19 16:10

Taking the `t/S/` class Run 57 recorded as "a block of its own, larger than any of the last four".
It is the largest, and the headline finding is that it is worth nothing — which is the useful part.

    python3 — every `t/S/` and `t[,']/S/` in the 177,267 raw bodies

Moby has `/tS/` and uses it 7,519 times. It also writes the two symbols separately 271 times, against
38 separated `t,/S/`.

⚠ THE SEPARATOR IS NECESSARY AND NOT SUFFICIENT HERE, which is where this class differs from `sh` and
`wh`. All 38 separated rows are genuine seams (`nightshade`, `hotshot`, `outshine`, `lightship`,
`assistantship`, `Dorsetshire`) — the separator never lies. But 14 MORE seams are written ADJACENT
(`courtship`, `nutshell`, `sweatshirt`, `Wiltshire`, `Flintshire`, `sweetshop`), so the adjacent side
is mixed and the Run 54 rule ported over would have folded fourteen real /t/+/ʃ/ boundaries into an
affricate. Three digraph classes, three different discriminators; the separator settled `sh` and `wh`,
the spelling settled `gh`, and this one needs both.

⚠ THE SPELLING FINISHES IT — WITH A TIGHTER PATTERN, NOT A POSITION. (Run 59 corrects this heading;
the shipped test is still "anywhere in the headword". What changed is the pattern, not the scoping.) `⟨sh⟩
anywhere in the headword` — the `gh` rule's shape, and my first draft — gets three of the fourteen
wrong: `pushchair 'p/U//S/t/S//(@)/r`, `shakuhachi ,/S//@/k/U/'h/@/t/S//i/` and `chafing-dish` each
spell ⟨sh⟩ somewhere ELSE while their `t/S/` is an ordinary affricate. Fifth occurrence of
anywhere-versus-position in this audit; the first I caught myself, by reading the flagged list
instead of trusting the count. The test is a ⟨t⟩ then at most a silent ⟨e⟩ or hyphen then the ⟨sh⟩,
which also reaches `associateship` and `Buteshire` — two real seams a plain ⟨tsh⟩ test misses.
Checked rather than assumed: no headword spells ⟨tesh⟩ AND carries a second adjacent `t/S/`, so
"anywhere" and "at this position" cannot diverge on this class today.

⚠ ⟨tsch⟩ WAS IN MY FIRST DRAFT AS A SEAM MARKER AND IS NOT ONE. German spells both sounds that way:
`Deutsche d//Oi//t/S//@/`, `putsch p/U/t/S/` and `kaffeeklatsch` are affricates, `Festschrift
'f/E/st,/S/r/I/ft` is a seam. It cannot arbitrate — and it needs no clause, because the three
affricates are adjacent and the seam is separated, so the separator already has them. I invented the
clause to cover a case the existing machinery handled.

⚠ THE CLASS IS SCORE-NEUTRAL BY CONSTRUCTION, AND I TOLD THE USER THE OPPOSITE LAST RUN. The backbone
strips tie bars — `config.ts:100`, `[/[͜͡]/gu, ""]` — so `t͡ʃ` and `tʃ` fold to the same string and
this distinction has never been visible to any score. 220 referee rows change and every total is
unmoved: 26,651/35,047, 17,466/39,484, 2,584/4,037. Run 57 called this "the largest converter class
found in this audit" and put it first in the queue on that basis. Largest by row count, worth zero.
The lesson is not about `t/S/`: I ranked a candidate by how many rows it touched without checking
whether the fold that makes the referee comparable at all can even see the difference. That check is
one grep and belongs BEFORE the measurement, not after the implementation.

⚠ NOR WAS IT REACHING THE SHIPPED DICTIONARY. All 9 `T SH` rows in `moby-import.tsv` are genuine
seams — `assistantship`, `countship`, `festschrift`, `hatshepsut`, `jugendstil`, `outshoot`,
`outshout`, `potsherd`, `presidentship`. The gold-agreement gate rejected every affricate written as
two phones, the same second gate Run 57 found guarding the `Corporation` case.

SHIPPED ANYWAY, for one reason that survives all of the above: the referee was rendering THE SAME
MOBY SOUND TWO DIFFERENT WAYS depending on which of Moby's two notations a row happened to use —
`t͡ʃ` for 7,519 of them and `tʃ` for 257. That is an internal inconsistency in a reference artifact,
independent of whether today's fold hides it, and it would surface the moment anyone compares
without the backbone. It also collapses five spurious multi-reading rows (`charlie tʃɑɹli t͡ʃɑɹli`
was two readings of one sound), and multi-reading rows are where Run 56 found corruption hiding.

    Moby — words the dict carries   26,651/35,047 (76.0%)  unmoved
    Moby — OOV                      17,466/39,484 (44.2%)  unmoved
    primary                         2,584/4,037 (64.0%)    unmoved
    headwords emitting >1 reading   437 → 432
    referee rows changed            220

WHAT THIS REPRIORITISES. The two remaining candidates should be checked against the backbone BEFORE
being measured: the ~650 unstressed-vowel rows turn on vowel QUALITY, which the fold does not touch,
so they are real; the syllabic-l class (`cycling saɪkəlɪŋ` against `saɪklɪŋ`) is a SEGMENT COUNT
difference, also not folded away, so it is real too. Both survive the test `t/S/` failed.


## Run 59 — 2026-09-19 16:20

Review of the Run 58 block. One real misclassification, one claim of mine that was self-congratulation
rather than fact, and a justification better than the one I shipped with.

⚠ `Altstoetter` IS A SEAM AND THE RULE FOLDED IT. German ⟨St⟩ is /ʃt/, so `Altstoetter
'/A/lt/S/t/E/tt/[@]/r` is Alt+Stötter — a /t/+/ʃ/ boundary spelled with NO ⟨h⟩ at all, which neither
the separator nor any ⟨sh⟩ test can see. Its siblings `Jugendstil`, `Landsturm` and `Waldstein` are
all written SEPARATED, so the separator had them and I concluded the German case was handled. It was
handled by luck: `Altstoetter` is the one Moby wrote adjacent. Run 58's ⟨tsch⟩ paragraph reasoned
about German and enumerated the wrong pattern.

The fix is a `ts[tp]` clause, and its width was measured rather than chosen: `ts[a-z]` would pull in
`putsch`, `kaffeeklatsch`, `Deutsche` and `tsarevich`, every one an affricate. It is inert on the 45
English ⟨tst⟩ words (`bootstrap`, `footstep`, `breaststroke`) because none writes an adjacent `t/S/`
— the rule fires only on the CONJUNCTION of spelling and body, which is what makes it safe rather
than lucky. `Ehrenbreitstein` is the same error and is declined upstream by the French-capital guard,
so it never reached the corpus; it is covered now anyway.
⚠ AND IT WOULD HAVE SHIPPED. `altstoetter` was among the 148 words a future `--no-gold` import would
newly admit, so the wrong seam would have entered the dictionary rather than merely the referee.

⚠ "THE RULE TESTS THE POSITION" IS FALSE, AND I WROTE IT FOUR TIMES. The shipped test is
`!/t[e-]?sh|ts[tp]/u.test(w)` — the WHOLE lowercased headword, exactly the scoping the `gh` rule uses
and exactly what the `gh` comment says is unavoidable ("nothing here aligns the body to the spelling,
so the test cannot ask about THIS position"). What changed between drafts is the PATTERN, from ⟨sh⟩
to ⟨t⟩+⟨sh⟩. Run 58 claimed this as the first time I had caught the anywhere-versus-position error
before shipping; what I actually did was fix the three wrong answers it gave and then describe the
fix in the vocabulary of a different one. The hedge I added in the same breath — "no headword spells
⟨tesh⟩ AND carries a second adjacent `t/S/`" — is precisely the admission that the test is NOT
positional, sitting directly under a heading saying it is. Failure mode (c) on top of an incomplete
(a) catch, which is worse than either alone.

⚠ "`t͡ʃ` FOR 7,519 OF THEM AND `tʃ` FOR 257" ATTRIBUTES A WHOLE-SOURCE COUNT TO THE ARTIFACT. Those
are counts of `/tS/` in the 177,267-row Moby file and of adjacent Moby ROWS. In the referee itself
the figures are 2,146 `t͡ʃ` against 252 bare `tʃ` — the inconsistency is 8.5:1, not 29:1. The claim
survives, the number does not. Failure mode (b), in a sentence that appeared in the commit message,
the PR body and this document; the code comment stated the same figure correctly because it said
"Moby has `/tS/` and uses it 7,519 times", which is the right population.

⚠ AND THE SCORE-NEUTRALITY MECHANISM I GAVE IS NOT THE OPERATIVE ONE for the whole eval. The backbone
strips tie bars, so every FOLDED comparison is blind to this — that part is right, and doubly so:
the combining-diacritic range already covers U+0361 before the explicit tie-bar rule reaches it. But
`raw exact` does NOT fold, so the distinction is visible there in principle. It is empirically blind
for an unrelated reason: raw exact is 0/4037 and 1/35047 because our readings carry stress marks the
referee does not. "Never visible to any measurement" is true; "because the backbone strips tie bars"
is only three quarters of why.

⚠ THE BETTER ARGUMENT FOR SHIPPING IS ONE I DID NOT MAKE, and "zero observable effect" was wrong.
Two consumers of `mobyToArpabet` are not folded at all:
  · `audit()` compares Moby to our dictionary and to gold. 55 words in the 40k frequency list change
    from `T SH` to `CH` — `congestion`, `riches`, `merchandise`, `saturation`, `watchman`,
    `aquaculture`. Our dict reads every one with `CH`, so Moby's reading could NEVER land in the
    `agree` bucket for them; they were forced into `split` on a pure notation difference.
  · `en_import_moby.mts` gains 148 candidates that previously failed the gold-agreement check on the
    affricate alone. A future `--write` admits a batch it used to reject.
Both measured here independently rather than taken from the review. So the honest framing is: score-
neutral in the REFEREE, and a real unblocking in the two unfolded paths. I led with artifact tidiness
when there was a measurable argument sitting one call site away.

Smaller corrections: `Wiltshire_cheese` carries `_` and is declined, so "14 seams written adjacent"
is 13 LIVE rows. Of the 38 separated rows 30 use `,` and 8 use `'`, so writing the class as `t,/S/`
names only 30 of them. The apostrophe branch of the regex was dead — zero headwords in the file match
`t'sh` — and is removed; the hyphen branch is also dead today (41 headwords match `t-sh`, none with
an adjacent `t/S/`) but is kept because the shape is plausible and it costs nothing. And the rule
contains no separator test at all: separated rows never reach it, because the `,` is consumed as a
stress mark and the `t` and `/S/` are no longer adjacent. A reader will look for that clause, so the
comment now says it.

    Moby — words the dict carries   26,651/35,047 (76.0%)  unmoved
    Moby — OOV                      17,466/39,484 (44.2%)  unmoved
    primary                         2,584/4,037 (64.0%)    unmoved
    referee rows changed            219 (220 less `altstoetter`, now retained as a seam)
    audit() frequency words freed   55
    import candidates unblocked     148

## Run 60 — 2026-09-19 16:45

The unstressed-vowel class, the largest thing left in the Moby residual. The answer is a REFUSAL plus
a lexical slice — the fold is not available, and the rows have to be arbitrated one at a time.

    npx tsx tools/referee-eval/eval.ts en --examples 12000

⚠ FIRST, THE SHAPE OF THE WHOLE RESIDUAL, which nothing in this audit had measured. Of the 8,396
in-dict failures: 4,811 (57%) differ in EXACTLY ONE SYMBOL at equal length, 1,025 in more than one,
and 2,560 differ in LENGTH. The single-symbol half is almost entirely vowels, and the class count is
nearly equal to the row count (8,261 classes for 8,396 rows) — these are one-off lexical
disagreements, not a few big patterns. That alone argues against any further fold.

Of the single-symbol rows, `ə`↔`ɪ` (2,031) is already declared intentional and `i`→`ɪ` before ɹ
(351) likewise. What is LEFT and uncovered is the SCHWA-versus-FULL-VOWEL class: `ə` against
`ɑ ɛ æ ʊ ɔ i` in both directions, 784 rows.

⚠ IT FAILS THE REPO'S OWN BAR FOR AN INTENTIONAL CLASS, TWICE. The bar (set by the `i`→`ɪ` entry) is
that the referee must NOT record the distinction — a one-sided notation choice — and that an
independent source must back us. Measured across both referee tiers:

    after /j/   jʊ  579   vs  jə  1043     records both -> lexical
    -man        mæn  70   vs  mən  444     records both -> lexical
    initial     ^æ  3073  vs  ^ə  2280     records both -> lexical
                ɛ  15680  vs  ə  47081     records both -> lexical
    before ɹ    ɔɹ 4025   vs  ɚ  15755     records both -> lexical

Moby writes both sides of every environment I could name. It is making per-word judgements, not
following a convention, so there is nothing here to fold.
⚠ MY FIRST VERSION OF THAT TABLE COMPARED `ɔɹ` AGAINST `əɹ` AND GOT 4,025 vs ZERO — which reads as a
perfect one-sided convention and would have justified a fold. It is an artifact of our own pipeline:
Moby's `/@/r` folds to `ɚ`, so `əɹ` CANNOT appear in the corpus and the zero says nothing about Moby.
Measuring a source against a form our own builder cannot emit is a new way to get a false positive
and worth naming; the corrected figure is 4,025 vs 15,755, which is lexical like the rest.

⚠ AND GOLD SPLITS, WITH NO ENVIRONMENT PREDICTING THE DIRECTION. Arbitrating all 784 against misaki:

    gold backs US           138
    gold backs MOBY          78
    gold differs from BOTH  275
    no gold entry           290

Gold can arbitrate only 216 of 784 (28%), and every sub-class is mixed in both directions — `æ`/`ə`
goes 9 for us and 15 for Moby, `ə`/`ʊ` goes 12 for us and 5 for Moby. That is exactly the ground the
velar nasal was refused on: a lexical disagreement where neither side has been shown right. THE
CLASS IS REFUSED as a fold. The 275 rows where gold agrees with neither are recorded and untouched —
a third of the class has a problem beyond the one being studied.

TAKEN INSTEAD, the 74 rows where TWO INDEPENDENT SOURCES agree against us. Minus `address` (already
in the heteronym table, correctly) and `and` (a function word whose reduced form is deliberate), and
minus 26 where gold's row differs from ours in more than one phone — those need fuller review than a
vowel swap — and 3 that already carry a curated row, which may not have a second. 43 applied, each
derived from gold through the repo's own `goldToArpabet` rather than by hand-mapping vowels.

⚠ ONE OF THE 43 WAS WRONG, AND ONLY THE GOLDENS COULD SEE IT. `batman` went `B AE1 T M AE2 N` →
`B AE1 T M AH0 N`, and a Hmong golden — an English loanword list — broke on `Batman los rau Joker`.
Gold and Moby both mean the ARMY SERVANT, ˈbætmən; running text overwhelmingly means the SUPERHERO,
ˈbætmæn. Two independent lexicons agreed and were both right about a lexeme that is not the one that
appears in text.
⚠ NO LEXICON TEST WOULD HAVE CAUGHT IT. I checked all 43 for words where gold carries both cases with
different readings: none, `batman` included — gold has a single entry and it is the rarer sense. The
goldens caught it because they are the only source here that reflects USAGE rather than lexicography.
That is an argument for running them before believing an arbitration, not only before merging.
Reverted; 42 stand.

    Moby — words the dict carries   26,651/35,047 (76.0%) → 26,693/35,047 (76.2%)
    Moby — OOV                      17,466/39,484 (44.2%)  unmoved
    primary                         2,584/4,037 (64.0%)    unmoved — no regression
    goldens 0 stale after the revert

WHAT IS LEFT OF THE RESIDUAL, now that it has been measured rather than estimated: 2,560 rows differ
in LENGTH (insertion or deletion of a phone), which is the syllabic-l class and its relatives and is
the next thing to look at; 1,025 differ in more than one symbol; and the single-symbol remainder is
one-off lexical work of the kind this run did 42 of. There is no large systematic class left in the
in-dict tier — the count of distinct classes being within 2% of the count of rows is the measurement
that says so.

⚠ AND TEN OF THE 42 ARE LIVE SPLITS, which the curation gate caught and I had not anticipated. A
curated row whose held-out OOV prediction equals the upstream shape means the engine answers one way
for the listed word and another for an unlisted word in the same environment. Sources, read from
`decompose().source` rather than guessed:

    N (n-gram)   adman chessman navarre sputnik      -> STRUCTURAL_GAP, the train/ship gap
    C (compound) dextran midland northland woodland  -> KNOWN_GAPS
    M (morph)    fistful shellacking                 -> KNOWN_GAPS

⚠ BEFORE WAIVING THE `-land` CLUSTER I CHECKED WHETHER IT SHOULD BE A RULE, because four of the ten
sharing a second element is exactly the shape that should be one. It should not. Our dict reduces
257 of 330 `-land` compounds and keeps 73 full; misaki gold on the same words splits 39 reduced
against 46 full. The line is COMPOUND TRANSPARENCY — `farmland`, `grassland`, `dreamland`,
`heartland` keep the full vowel, opaque place names `ashland`, `auckland`, `boland` reduce — and no
spelling predicts which a word is. A converter rule would be wrong about half the time.

⚠ AND THE EXISTING `lowland` WAIVER'S REASON WAS MADE STALE BY THIS RUN. It read "-land gives the
full vowel it keeps in woodland but not here" — and `woodland` is one of the three I just corrected
to the reduced vowel. The waiver was still CORRECT; its stated reason had quietly stopped being
true. That is the failure mode the gate's own header warns about from the other direction ("a row
JOINING it is a regression that must be argued for"), and it argues for re-reading the reason
attached to any waiver a change touches, not just the list membership.

## Run 61 — 2026-09-19 19:00

Review of the Run 60 block. The refusal held under attack; the 42 edits had a defect class I had not
looked for, and one of my measurements was distorted by a bug in the artifact I was measuring.

⚠ SIX PARADIGMS HALF-APPLIED — the real defect in the 42, and none of them is a `batman`-shaped
error. Each edit corrected one member of a paradigm whose other members are separate dict rows, so
the engine read them differently IN ONE SENTENCE:

    crouton kɹˈuːtʰˌɑːn   / croutons kɹˈuːt̬ənz
    midland mˈɪdlənd      / midlands mˈɪdlˌændz
    woodland wˈʊdlənd     / woodlands wˈʊdlˌændz
    sputnik spˈʊtnɪk      / sputniks spˈʌtnɪks
    infantryman ˈɪnfəntɹimən / infantrymen ˈɪnfæntɹimən
    shellacking ʃəlˈækɪŋ  / shellacked ʃɛlˈækd

Two are directly settled by this run's own rule rather than by consistency alone: Moby has `Midlands
'm/I/dl/@/ndz`, and BOTH sources reduce `shellac` (gold `ʃəlˈæk`, Moby `/S//@/'l/&/k`) — I corrected
the derived form and left its base. `infantrymen`'s `AE0` was wrong on its own terms, since
`infantry` is `IH1 N F AH0 N T R IY0`. Seven rows added. ⚠ THE LESSON IS THE PROCEDURE, NOT THE ROWS:
a per-word correction drawn from a lexicon has to be checked against the word's INFLECTIONS, because
the lexicon lists them separately and the engine reads them in the same sentence.

⚠ A SEPARATE FINDING, FIXED IN PASSING: four dict rows carried a phonetically impossible
voiceless-stop + `D` past tense against 2,981 correct `T` rows — `eloped`, `shellacked`, `uplinked`,
`yelped`. `shellacked` had to move anyway; the other three are the same one-character defect.

⚠ THE ARTIFACT I WAS MEASURING HAD A BUG, AND IT IS THE TRAP THIS AUDIT NAMED ONE RUN EARLIER.
`build-en-moby-referee.mts`'s `JOIN` entry `["AH","R","ER"]` was UNGUARDED, so the builder wrote `ɚ`
wherever Moby's `/@/r` fell before a stressed vowel — `around ɚaʊnd`, `arabia ɚeɪbiə`, `arise ɚaɪz`,
`aroma ɚoʊmə`, 317 rows. Its sibling `modernise` guards the identical fold and documents the guard as
load-bearing; the builder reimplemented the rule and dropped it, which is how two copies of one fold
drift apart.
⚠ SCORE-NEUTRAL, WHICH IS WHY IT SURVIVED: the eval folds `ɚ`→`əɹ` on both sides, so the rows still
matched. What it corrupts is any measurement taken by reading the TSV directly — which is exactly
what Run 60's refusal table did.
⚠ AND MY FIRST FIX FOR IT WAS WRONG IN THE OPPOSITE DIRECTION. I guarded on "followed by a vowel",
copying `modernise` verbatim, and broke the rule's own headline cases: `general` and `history` have
`/@/r` before a vowel too and there it IS our ɚ. The discriminator is the following vowel's STRESS,
which Moby marks itself — `/@/'r` when the `r` opens a stressed syllable, `/@/r` when it closes an
unstressed one. `modernise` can use the weaker guard because its input is CMUdict-shaped, where `ER`
is already one phone; the builder sees Moby's two symbols and has to read stress.

⚠ THE `ɔɹ` ROW OF RUN 60'S TABLE WAS A SYMPTOM OF THAT BUG, NOT A BAD COMPARISON. I recorded the
4,025-vs-zero as my own error — "measuring a source against a form our own pipeline cannot emit" —
and worked around it by comparing against `ɚ`. The design was right and the pipeline was broken: with
the join guarded, `əɹ` appears 2,641 times and the direct comparison reads 4,025 vs 2,641. Same
verdict, records both, lexical. Both the workaround and the original route now agree.

REFUSAL TABLE, RESTATED on the corrected artifact, all figures OCCURRENCES (Run 60's silently mixed
occurrence counts with row counts):

    after /j/, at j_l      86  vs   562
    final -man             70  vs   444
    word-initial ^æ/^ə   3073  vs  2402
    ɛ / ə anywhere      15680  vs 49722
    ɔɹ / əɹ              4025  vs  2641

⚠ THE `/j/` ROW WAS MEASURED ANYWHERE AFTER `/j/` AND SHOULD HAVE BEEN AT THE ENVIRONMENT. Every
disagreeing word in that sub-class is `j_l` — `accusation`, `amputate`, `amputee`, `oculist`. At the
environment it is 86 against 562, which still records both AND backs us. Failure mode (a), sixth
occurrence, and the conclusion is unchanged either way.

⚠ THE REFUSAL SURVIVED A DELIBERATE ATTEMPT TO BREAK IT. Scanning every (left-phone, right-phone)
environment with n≥25 across both tiers for strict one-sidedness: every strict zero is
phonotactically impossible rather than a convention, and the nearest approaches — `-ʃən` 1886/65,
`-zəm` 812/36, `-ʃəs` 349/11 — all record both sides and fail the bar. No environment justifies a
fold.

⚠ "EACH EDIT CHANGES EXACTLY ONE ARPABET PHONE" IS NOT TRUE AS WRITTEN. 18 of the 42 also change the
STRESS DIGIT on that slot, which for 17 is the mechanical `AH0` ↔ full-vowel-with-stress swap. The
exception is `ya  Y AA1 → Y AH0`, the only edit that strips a word's sole primary stress; checked
and harmless (`"Ya!"` → `jˈə`, the engine re-stresses an isolated stressless monosyllable), but it
is not the same kind of change as the other 41.

⚠ AND THE SKIP FILTER'S STATED REASON WAS WRONG FOR HALF THE BUCKET. I wrote that 26 rows were
skipped because "gold's row differs from ours in more than one phone". Re-measured: the filter tested
differing SLOTS, and a slot can differ by stress alone. Of the 26, only 14 differ in more than one
SEGMENT; the other 12 differ in exactly one segment plus a stress digit — `hasid`, `kenaf`,
`legroom`, `monadnock`, `mudra`, `orel`, `parliamentarianism`, `picturesque`, `primavera`, `qatar`,
`shellac`, `wahoo`. Failure mode (c). `shellac` is applied here because its derived form forced it;
the other 11 are deferred rather than swept in, because a stress change is a different kind of edit
from a vowel-quality change and deserves its own arbitration.

RECORDED, NOT TAKEN:
  · The 11 stress-digit rows above, plus the genuinely multi-segment ones the review flagged as clear
    defects — `flummox F L AH0 M AO1 K S` (we read fləˈmɔks), `sacramental` stressed on the wrong
    syllable, `legroom`, `reprobate`, `unalloyed`, `unalienable`. A stress-and-vowel block of its own.
  · `hellenic` is the one edit an in-repo source contradicts: en-GB wikipron has `həlɛnɪk`. KEPT,
    because both GenAm sources (Moby `h/E/'l/E/n/I/k`, gold `hɛlˈɛnɪk`) agree and en-GB is a
    different variety and out of scope. Recorded as the weakest of the 42.
  · en-GB emits a word-final `ɒ` for CMUdict `AA`, which RP does not permit — `dah dˈɒ`, `gaga
    ɡˈɒɡɒ`, `sabah sˈɒbɒ`. PRE-EXISTING and large: 362 of the 390 dict words ending in `AA*` already
    do it. This run adds three to that pile and fixes none of it; en-GB is out of scope.

⚠ THE RHOTIC-JOIN FIX IS FAR LARGER THAN MY FIRST ESTIMATE AND MOVES THE OOV TIER BY −2. I said 317
rows; the real figure is 2,184 in the OOV corpus alone, because my grep matched only row-INITIAL `ɚ`.
The eval folds `ɚ`→`əɹ` symmetrically, so most of those are score-neutral as expected — but 49 rows
newly FAIL and 48 newly PASS, and both halves are the referee becoming ABLE TO JUDGE rather than a
regression. The newly-failing rows are ones where our own reading is wrong and the referee could not
previously say so: `cerastes` is /sɪˈræstiz/, the corpus now reads `sɪɹæstiz`, and we say
`sˌɛɹəstˈɛs`. The newly-passing ones are the mirror: `derangement dɪɹeɪnd͡ʒmənt` against the old
`dɚeɪnd͡ʒmənt`. A net of −2 is the right shape for a referee correction and the wrong thing to report
as a loss.
⚠ AND IT CAUGHT A DICTIONARY DEFECT ON OUR SIDE IN PASSING, recorded not fixed: the OOV path reads
initial `ce-` before a stressed syllable as `t͡ʃɛ`/`sɛ` with odd stress — `cerography t͡ʃˌɛɹoᶷɡɹˌæfˈɪ`,
`ceroma t͡ʃˌɛɹoᶷmˈæ`. That is a separate class and belongs in its own block.

⚠ ONE TEST EXPECTATION WAS PINNING THE BUG. `en-moby-referee.test.ts` asserted `corporation
kɔɹpɚeɪʃən`; Moby writes `,k/O/rp/@/'r/eI//S//@/n`, whose own stress mark puts the `r` at the head of
the stressed syllable, so `kɔɹpəɹeɪʃən` is correct and the assertion had recorded the defect as the
expected value. Updated with the reason attached.

    Moby — words the dict carries   26,651/35,047 (76.0%) → 26,710/35,047 (76.2%)
    Moby — OOV                      17,466 → 17,464 (see above; 49 newly fail, 48 newly pass)
    primary                         2,584/4,037 (64.0%)    unmoved
    curated rows                    42 → 52

## Run 62 — 2026-09-19 20:15

The length-differing rows, the last large structural bucket. Classified first, then the one class
that turned out to be a REFEREE defect rather than a disagreement.

    npx tsx tools/referee-eval/eval.ts en --examples 12000

Of the 2,521 length-differing rows with an example, 639 are a single clean insertion or deletion and
1,882 need more than one edit. The single-edit half breaks down as:

    referee has a phone we lack      we have a phone the referee lacks
      88  +ə  academically/-ically     78  -ə  hour aʊəɹ vs aʊɹ
      41  +i  abbeville                58  -a  accessorize (-ize vs -ɪz)
      41  +j  avenue (the yod)         47  -ɹ  adversarial ædvəɹsɛɹiəl vs ædvəsɛɹiəl
      30  +a  anhydride                20  -t  blotch blɑttʃ vs blɑtʃ
      12  +t  betti (gemination)       19  -d  biagi

⚠ THE `-ɹ` CLASS IS NOT A DISAGREEMENT AT ALL — IT IS RP THE FILTER MISSED. `crackers kɹækəz`,
`overdrive oʊvədɹaɪv`, `weatherproof wɛðəpɹuf`, `superscript supəskɹipt`, `adversarial ædvəsɛɹiəl`:
every one
spelled with a post-vocalic ⟨r⟩, transcribed without it, surviving because a `ɹ` sits elsewhere in
the word before a vowel.

⚠ AND THE FIX WAS ALREADY WRITTEN, IN THE OTHER REFEREE. `en.jsonc` has THREE `excludeRows` rules;
the Moby builder implements two. Its own comment says "BOTH of the wikipron config's non-rhotic
rules" — accurate and the problem. The third rule was added for exactly `perchlorate` and
`weatherproof`, and `perchlorate` was sitting in the Moby corpus as a false disagreement the whole
time. Second time in two runs that a rule existed in one copy and not the other: the rhotic JOIN in
Run 61, the coda rule here. Two implementations of one idea, one of them maintained.

⚠ THE FIRST VERSION DROPPED THREE ROWS IT SHOULD NOT HAVE, and the cause is a silent letter.
`Berwick 'b/E/r/I/k`, `Norwich 'n/O/r/I//tS/` and `bladderwrack 'bl/&/d/@/,r/&/k` spell ⟨rw⟩ or ⟨wr⟩
with the ⟨w⟩ SILENT, so the ⟨r⟩ onsets the next syllable and `bɛɹɪk`/`nɔɹɪt͡ʃ`/`blædəɹæk` are ordinary
GenAm.
⚠ I WROTE THAT THE SPELLING CARVE-OUT WOULD BE UNSAFE AND IT IS EQUIVALENT. See Run 63: the two
produce byte-identical corpora, because the ⟨rw⟩ words the argument named are already dropped by
RULE 1 and rule 3's carve-out never sees them. The reading test is kept on the narrower ground that
it encodes the reason rather than the symptom.

⚠ THREE MORE ROWS THE RULE DROPPED FOR THE RIGHT OUTCOME AND THE WRONG REASON, now declared in
`MOBY_DEFECTIVE` instead: `photographer f/@/'t/A/gr/@/f` (the body is `photograph`, which Moby
carries separately), `quarsome 'kw/O/r/@/ls/@/m` (the body is `quarrelsome`), `sharecropper
/S//@/'r/E/t` (four phones for twelve letters). Leaving them to a rhotic rule means a later change to
that rule hands them back.

⚠ BOTH NUMERATORS ARE COMPLETELY UNMOVED, AND RUN 63 SHOWS THAT THIS PROVES FAR LESS THAN I CLAIMED.
In-dict 26,710 of 35,047 → 26,710 of 35,027; OOV 17,464 of 39,484 → 17,464 of 39,451, and all 53
removed rows were failing. What I wrote next — that an over-firing rule would have moved the
numerator, so "unchanged" verifies the carve-outs — is FALSE. See Run 63.

⚠ WHAT THE RULE STILL CANNOT REACH, pinned in the test rather than left to be rediscovered: a word
Moby transcribes with a MIXED rhotic profile. `undercover ʌndəkʌvɚ` drops the ⟨r⟩ of `under-` and
keeps the final one; `northern nɔɹðən` the reverse; `hindquarters haɪndkwɔɹtəz` likewise. All three
rules ask whether a reading holds a rhotic ANYWHERE, so any surviving rhotic saves the row. These are
still false disagreements and closing them needs a POSITIONAL test, which nothing here can do because
no alignment exists between the spelling's ⟨r⟩ and the reading's phones. Under-firing is the safe
direction and this is deliberate, not an oversight.

    Moby — words the dict carries   26,710/35,047 (76.2%) → 26,710/35,027 (76.3%)
    Moby — OOV                      17,464/39,484 (44.2%) → 17,464/39,451 (44.3%)
    primary                         2,584/4,037 (64.0%)    unmoved
    dropped as NON-RHOTIC           319 → 369
    MOBY_DEFECTIVE                  35 → 38

STILL OPEN in this bucket, and none of it is a referee defect: the `-ically` schwa (88 rows), the
`-ə`-before-ɹ class (78, `hour aʊəɹ` against `aʊɹ`), the conservative yod (41, already refused once
on measurement), and `blotch blɑttʃ`, which IS a dictionary defect and is
characterised here so the next block can start from it.

⚠ `T CH` IN THE DICTIONARY: 21 ROWS, AND THE SPLIT IS A MORPHEME BOUNDARY AGAIN. `blotch` is
`B L AA1 T CH` where every sibling is plain `CH` — `botch B AA1 CH`, `crotch K R AA1 CH`,
`notch N AA1 CH` — and Moby agrees with the siblings (`bl/A//tS/`). ⟨tch⟩ is a DIGRAPH for /t͡ʃ/, so
a `T CH` on a word spelled ⟨tch⟩ is redundant. But 8 of the 21 are genuine /t/+/t͡ʃ/ SEAMS where the
⟨t⟩ and the ⟨ch⟩ belong to different elements: `chitchat`, `shortchange`(+2 inflections), `hatcheck`,
`christchurch`, `westchester`, `whitchurch`. The same discriminator as the bare-digraph work of
#1365–#1368, applied to our own dictionary rather than to Moby's notation.
⚠ AND THE TRIAGE IS 13 DEFECTS, NOT 10 — `antczak AE1 N T CH AE0 K`, `witczak V IH1 T CH AE0 K` and
`goettsch G OW1 T CH` are Slavic and German ⟨cz⟩/⟨tcz⟩/⟨tsch⟩ spellings of a plain /t͡ʃ/, the same
defect reached by a different spelling. The first pass partitioned on ⟨tch⟩ IN THE SPELLING and so
could not see them: 18 + 3 = 21, and the three that fall outside the partition are not the residue,
they are more of the same class. Failure mode (a) again, in a paragraph written to set up the next
block.
The remaining defects are `blotch` AND ITS SIX INFLECTIONS — `blotched`, `blotches`, `blotchier`,
`blotchiest`, `blotching`, `blotchy` — plus the surnames `bettcher`, `bottcher`, `hutchins`. ⚠ THE
INFLECTIONS ARE LISTED DELIBERATELY: Run 61 shipped six half-applied paradigms because a lexicon
lists inflections separately and the engine reads them in one sentence. Ten rows, and the paradigm
is the unit.

## Run 63 — 2026-09-19 21:30

Review of the Run 62 block. The rule is right and the corpora are unchanged by any of this; both of
the ARGUMENTS I gave for it were wrong, and one of them was wrong in a way worth keeping.

⚠ "NUMERATOR UNMOVED IS THE VERIFICATION" IS FALSE, AND MY OWN THREE FALSE POSITIVES REFUTE IT. I
argued that because both numerators held while the denominators fell, no legitimate row could have
been dropped. Scored against the base corpora:

    berwick       ours bɝwɪk      ref bɛɹɪk     FAIL
    norwich       ours nɔɹwɪt͡ʃ    ref nɔɹɪt͡ʃ    FAIL
    bladderwrack  ours blædɚɹæk   ref blædəɹæk  FAIL

All three were FAILING rows. Had the first version of the rule shipped — the one that wrongly dropped
them — both numerators would have been exactly unmoved and the score identical. The test I cited as
having ruled out those three false positives cannot see them.

⚠ AND THE ASYMMETRY IS STRUCTURAL, NOT AN ACCIDENT OF THESE THREE. The numerator only moves when a
PASSING row is removed. A row where the referee is right and WE are wrong — a true divergence, the
most valuable thing in the corpus — can be destroyed with no numerator movement at all. That is
precisely the class a rhotic filter is most likely to mis-drop, because a correct GenAm reading we
get wrong looks exactly like an RP row from the filter's side. So "numerator unmoved" licenses only
"no passing row was removed", which is the weaker and less interesting half.
⚠ THE REAL VERIFICATION IS THE ONE I ALSO DID AND DESCRIBED AS SECONDARY: reading all 53 dropped rows
against the raw Moby bodies by hand. That is what found the three silent-⟨w⟩ rows, and it is what
found the two corrupt ones below. A score that cannot move is not evidence; the reading was.
⚠ THIS GENERALISES PAST THIS RULE. Any change that REMOVES rows from a referee is invisible to the
score in the direction that matters, and this audit has made three of them (`MOBY_DEFECTIVE`,
`MOBY_DEFECTIVE_READING`, and now the coda rule). Each needs its dropped set read, not measured.

⚠ THE SECOND ARGUMENT WAS EMPIRICALLY BACKWARDS. I wrote that a spelling-based silent-⟨w⟩ carve-out
would be "the opposite of safe" because ⟨rw⟩ matches 205 headwords including `afterwards` and
`airway`. Rebuilt with `!SILENT_W.test(w)` in place of the reading test: **byte-identical corpora**,
369 dropped either way, ZERO rows readmitted. The ⟨rw⟩ words the argument named are already dropped
by RULE 1, so rule 3's carve-out never reaches them. The 205 is the population of headwords MATCHING
the pattern, not of the rows the rule drops — failure mode (b), and it was load-bearing: a paragraph
each in the code comment, the commit message and Run 62 rested on it.
The reading test is KEPT, on the narrower and honest ground that it encodes the reason (the ⟨w⟩ is
silent) rather than the symptom, and so would survive a change to rule 1 that the spelling test would
not. That is a much smaller claim than the one I made.

⚠ TWO MORE CORRUPT BODIES AMONG THE 53, BY MY OWN STANDARD. `Nornis 'n/O/r/I/s` is `Norris` with a
phone lost; `pardalote 'p/A/dr/@/,l/oU/t` transposes its ⟨rd⟩ to /dr/, so its rhotic is in the wrong
syllable rather than absent. Neither is RP, and the coda rule drops them only as an accident of the
corruption — the exact situation I declared `photographer`, `quarsome` and `sharecropper` for one
paragraph earlier. Declared in `MOBY_DEFECTIVE`; non-rhotic 369 → 367, defective 38 → 40, corpora
unchanged.

⚠ THE COMMENT NAMED TWO WORDS THE RULE DOES NOT CATCH as its headline examples. `undercover` and
`northern` led the list of rows rule 3 reaches — and the test fifteen lines below asserts both
SURVIVE, because their profile is mixed. Worse for `northern nɔɹðən`, which IS transcribed with a
post-vocalic ɹ, so the stated mechanism ("a ɹ elsewhere before a vowel") is wrong for it twice over.
Also stale in that comment: "44 rows" where the marginal is 50.

⚠ AND TWO OF THREE CARVE-OUT EXAMPLES DID NOT EXERCISE THE CARVE-OUT. I replaced en.jsonc's four
worked examples with three of my own; `greensboro` and `colouring` have their ⟨r⟩ followed by a vowel
LETTER, so the BASE lookahead rejects them and the ⟨r⟩ exclusion never runs. Only `underrate` was a
real example. Restored to en.jsonc's own — `arrange`, `narrow`, `Barrett`, `terracotta`, `gonorrhea`
— which are correct and were already argued.

⚠ THE `T CH` TRIAGE FOR THE NEXT BLOCK IS 13, NOT 10. `antczak`, `witczak` and `goettsch` are Slavic
and German ⟨cz⟩/⟨tcz⟩/⟨tsch⟩ spellings of a plain /t͡ʃ/ — the same defect reached by a different
spelling. I partitioned on ⟨tch⟩ IN THE SPELLING and reported the three that fell outside as a
separate residue, when they are more of the same class. Failure mode (a), in the paragraph written to
set up the next block, where an error propagates instead of sitting still.

⚠ A DUPLICATION I INTRODUCED WHILE FIXING ONE. Run 61 added a local `VOWEL_SET` to the builder with
the same fifteen members as `VOWELS` in `en_source_compare.mts` — a second copy of one fact, added in
the commit that fixed a bug caused by two copies of one fact. `VOWELS` is now exported and imported.
A symbol-level sweep of the two modules finds no other shared NAME (only `REPO`), so the remaining
overlap is all conceptual: the builder's `JOIN`/`fold` against the comparator's `modernise`, which
now guard the same AH+R fold differently — justified, documented, and the third instance of this
shape.

CHECKS OUT, verified independently: the `CODA_RHOTIC` regex is byte-identical to en.jsonc's rule-3
`ipaLacks` with no drift, and every vowel in the corpora's character inventory is in its lookahead
set (the `ː`/`ˑ` members are inert here — zero occurrences — since the backbone strips length). The
mixed-profile limit is real and its size is ~45–55 rows of 74,478, the same order as the 50 this
block closes; that number belongs in the record rather than the adjective "safe".

    Moby — words the dict carries   26,710/35,027 (76.3%)  unchanged by this run
    Moby — OOV                      17,464/39,451 (44.3%)  unchanged by this run
    primary                         2,584/4,037 (64.0%)    unmoved

## Run 64 — 2026-09-19 22:15

The `T CH` dictionary defect Run 62 characterised and Run 63 corrected the count of. 13 rows, and
the evidence turned out to be better than the spelling argument I had been going to use.

⚠ THE DICTIONARY IS ITS OWN BEST WITNESS HERE, which I had not thought to ask. Rather than argue from
⟨tch⟩ being a digraph, count how the SAME SPELLING CLASS is treated elsewhere in `g2p-dict.tsv`:

    ⟨cz⟩    205 rows   153 plain CH   2 with T CH   → antczak, witczak
    ⟨tsch⟩   91 rows    80 plain CH   1 with T CH   → goettsch
    ⟨ttch⟩    3 rows     1 plain CH   2 with T CH   → bettcher, bottcher vs boettcher
    ⟨tch⟩   397 rows   379 plain CH  17 with T CH   (the blotch family plus the real seams)

⚠ AND THE SHARPEST ROW IS AN INTERNAL CONTRADICTION: `boettcher B OW1 CH ER0` is plain, while
`bettcher B EH1 T CH ER0` and `bottcher B AA1 T CH ER0` are not — the same German name, three
spellings, two disagreeing with the third. `betsch B EH1 CH` sits beside `bettcher` with the same
first syllable and no T. No external source was needed for those.

Three tiers of evidence, kept apart rather than pooled:
  · `blotch` + 6 inflections — gold `blˈɑʧ`/`blˈɑʧi`, Moby `bl/A//tS/`, the en-GB referee `blɒtʃ`,
    and the siblings `botch B AA1 CH`, `crotch K R AA1 CH`, `notch N AA1 CH`.
  · `hutchins` — Moby `'h/@//tS//I/nz` and en-GB `hʌt͡ʃɪnz`, two independent sources.
  · `antczak`, `witczak`, `goettsch`, `bettcher`, `bottcher` — NO external source at all; they rest
    entirely on being 2-of-155, 1-of-81 and 2-of-3 outliers within their own spelling class.

⚠ AND THE OOV PATH "CONFIRMED" TWO OF THEM — BUT SEE RUN 65, WHERE THIS ARGUMENT IS WITHDRAWN AS
CIRCULAR. Held out, the engine predicts
`antczak AE1 N CH AE0 K` and `goettsch G OW1 CH` — EXACTLY the corrected forms. The n-gram trains on
the curated dict, so it has learned the ⟨cz⟩/⟨tsch⟩ pattern from the 153 and 80 rows that were
already right, and the two dict rows were the outliers it was arguing against. That is a genuinely
independent check and it was free; it is worth running on any correction whose only evidence is
internal consistency.

⚠ THE SEAMS ARE CONFIRMED FROM THE OTHER SIDE, not merely left alone. Moby marks them with its own
separator — `chitchat '/tS//I/t,/tS//&/t`, `Christchurch 'kr/aI/st,/tS//[@]/r/tS/`, `hatcheck
'h/&/t,/tS//E/k` — and gold keeps the /t/ in all of them (`ʧˈɪtʧˌæt`, `kɹˈIstʧˌɜɹʧ`, `hˈætʧˌɛk`,
`ʃˌɔɹtʧˈAnʤ`). `westchester` is confirmed twice over: Moby `'w/E/st/tS//E/st/@/r` and en-GB
`wɛstt͡ʃɛstə` both carry the /t/.
⚠ ONE SEAM LEFT ALONE HERE AND CORRECTED IN RUN 65, WHERE IT TURNS OUT TO HAVE SOURCES I DID NOT
LOOK FOR: `whitchurch W IH1 T CH ER2 CH`. It has
the same ⟨-church⟩ shape as the confirmed `christchurch`, but no source carries it, and unlike
Christchurch its cluster would be /ttʃ/ rather than /stʃ/ — which usually reduces. Recorded as the
one row in the seam group resting on analogy.

⚠ ONLY THREE OF THE THIRTEEN ARE LIVE SPLITS, and which ones is the instructive part. `blotch` and
`blotchy` are source N; `hutchins` is source C — surprising for a surname, and read from
`decompose().source` rather than assumed. The five `blotch` INFLECTIONS are not splits at all: they
decode through the stem (source M) and closed themselves the moment `blotch` was corrected, which is
exactly what `STRUCTURAL_GAP`'s header predicts for a correction with a morphological handle. Nor
are the five surnames, because the OOV path already agreed with the correction.

    Moby — words the dict carries   26,710/35,027 (76.3%) → 26,713/35,027 (76.3%)
    Moby — OOV                      17,464/39,451 (44.3%)  unmoved
    primary                         2,584/4,037 (64.0%)    unmoved
    goldens 0 stale · curated rows 65

+3 on a 13-row fix is the expected shape: most of the thirteen are surnames Moby does not carry, so
they cannot score. The `blotch` family is where the movement is.


## Run 65 — 2026-09-19 23:10

Review of the Run 64 block. The thirteen corrections stand; one row I DECLINED to correct was wrong
to decline, one of my three arguments was circular, and three claims about which rows the gate saw
were false.

⚠ `whitchurch` SHOULD HAVE BEEN FIXED, AND I HAD ASKED TO BE TOLD. Run 64 left it as a seam on
analogy with `christchurch`, recording "no source carries it" — true of Moby, gold and the two
wikipron referees, and I looked no further. Three lines of evidence exist:
  · The dictionary's own nearest neighbour is plain: `whitcher W IH1 CH ER0`, the same ⟨whitch⟩
    onset, four rows away in the same file.
  · The en-GB referee carries `whitechurch waɪtt͡ʃɜːt͡ʃ` — the TRANSPARENT compound, which keeps its
    /t/ — against an opaque `whitchurch` that does not. That is the minimal pair.
  · External: /ˈwɪtʃɜːrtʃ/.
⚠ AND THE DISCRIMINATOR ACROSS ALL EIGHT SEAMS IS COMPOUND TRANSPARENCY, NOT CLUSTER TYPE. `chitchat`,
`hatcheck`, `shortchange`, `Christchurch`, `Westchester` are all still analysable; nobody parses
`whit`. I had the right mechanism in the run — I wrote that /ttʃ/ "usually reduces" — and then used
it as a reason NOT to act. An argument for a correction, deployed as an argument against it.
⚠ THE SAME NEIGHBOURHOOD HELD ONE MORE: `splotch S P L AA0 CH`, a monosyllable carrying no stress
where `blotch`, `botch`, `crotch`, `notch`, `scotch` all have `AA1`. Fixed.

⚠ THE OOV-CONFIRMATION ARGUMENT IS CIRCULAR AND IS WITHDRAWN. I presented the held-out engine
predicting `antczak AE1 N CH AE0 K` and `goettsch G OW1 CH` as "a genuinely independent check". The
shipped model trains on a CMUdict-format re-emission of `g2p-dict.tsv` (#1341), so this reduces to
"an n-gram fitted to this dictionary reproduces this dictionary's majority pattern" — the
class-count argument again with smoothing in between, not a second witness. It is still worth
running, because it says the majority outvoted the outlier row even in training; it is corroboration
of internal consistency and must not be listed as a separate tier.
⚠ AND IT FAILS ON THE TWO ROWS WITH THE LEAST OTHER EVIDENCE. Held out, `bettcher` predicts
`B IH1 T CH ER0` and `bottcher` `B AA1 T SH EH2 R` — both KEEP the T. The control is worse: the
uncorrected anchor `boettcher` OOV-predicts `B OW1 T CH EH1 R`, so the n-gram gets even the row I
cited as the witness wrong. I quoted the two cases that agreed.

⚠ "NOR ARE THE FIVE SURNAMES LIVE SPLITS, BECAUSE THE OOV PATH ALREADY AGREED" IS FALSE FOR THREE OF
THEM. The gate's criterion is `prediction == upstream`. `witczak` differs from upstream in the
INITIAL (W against our V), `bettcher` only in the VOWEL — it has the T CH and would have been a live
split contradicting a correction that rests on nothing else — and `bottcher`'s prediction is
unrelated. Three of five dodge the gate on segments that have nothing to do with the T. Failure mode
(e): a check cited as verification when it cannot see the failure mode in question.

⚠ "THE FIVE INFLECTIONS CLOSED THEMSELVES" — ONLY TWO WERE EVER OPEN. Against the pre-fix dict,
`blotched` and `blotching` predicted the upstream shape and closed through the corrected stem;
`blotches`, `blotchier` and `blotchiest` never matched upstream at all, for schwa and vowel reasons
unrelated to the T. The claim reached the commit, the PR, this document AND a new `STRUCTURAL_GAP`
comment. The behaviour I described is real and two rows show it; five was the number of rows in the
paradigm, not the number that demonstrated anything.

⚠ THE ⟨tcz⟩ ARGUMENT WAS CONFOUNDED, EXACTLY AS I SUSPECTED WHEN ASKING. The narrow class ⟨tcz⟩ has
TWO members in the dictionary and both are the rows being changed, so "2 of 155 ⟨cz⟩ rows are
outliers" is circular — they are outliers because they are the only members. The comparanda I cited
(`adamczak`, `barczak`) are ⟨mcz⟩/⟨rcz⟩ spellings with no ⟨t⟩ letter to account for. Polish ⟨tcz⟩ is
genuinely a long affricate, so the source language does not rescue it either.
Both rows are still right, on evidence I did not use and have now substituted:
  · `antczak` was the ONLY `N T CH` row in the whole 135k dictionary, against `lunch`/`bunch`/`hunch`
    and the four sibling names `franczak`, `fronczak`, `janczak`, `stanczak`, all `N CH`.
  · `witczak` against `witch W IH1 CH` and `wilczak V IH1 L CH AE0 K`.
⚠ AND `goettsch` HAD A NEAR-MINIMAL PAIR I WALKED PAST. The narrow ⟨ttsch⟩ class is SEVEN rows and
six of them are plain — `gottsch G AA1 CH`, `gottschalk`, `gottschall`, `brettschneider`,
`kruttschnitt` — against `goettsch` alone. `gottsch` differs from `goettsch` by one vowel letter and
is worth more than the 80-row bare-⟨tsch⟩ count I quoted instead.

⚠ THE CLASSES DO NOT PARTITION, WHICH RUN 64 DID NOT SAY. Of 205 ⟨cz⟩ rows, 153 are plain CH, 2 were
T CH — and 50 have no CH at all: `czar Z AA1 R`, `eczema EH1 K S AH0 M AH0`, `balcerowicz`, the
`szcz-` names. ⟨cz⟩ is not uniformly /t͡ʃ/ in this dictionary, and a table with two columns implied
it was. (The counts themselves reproduce: 153 + 2 = the "155" the curated rows cite.)

⚠ "MOBY MARKS THEM WITH ITS OWN SEPARATOR" IS WRONG ABOUT THE MECHANISM. The `,` in `chitchat
'/tS//I/t,/tS//&/t` is Moby's SECONDARY STRESS mark, as in `elevator '/E/l/@/,v/eI/t/@/r`. The tell
was in my own paragraph: I cited `Westchester 'w/E/st/tS//E/st/@/r`, which has no comma, as evidence
in the same breath. The real evidence is that Moby spells the segments `/t/` then `/tS/` — which is
sound, and is what I should have written.

Smaller: "gold keeps the /t/ in every one" of the eight seams — gold carries FOUR of the eight.
"Curated rows 65" was this PR's 13 plus #1369's 52, labelled as a file total; the file has 2,324.
And the running-text check I quoted shows `bˈoᶷt͡ʃɚ`, which is the unchanged `boettcher`, not
`bottcher`.

    Moby — words the dict carries   26,713/35,027 (76.3%)  unmoved by Run 65's two rows
    Moby — OOV                      17,464/39,451 (44.3%)  unmoved
    primary                         2,584/4,037 (64.0%)    unmoved
    rows corrected                  13 → 15

## Run 66 — 2026-09-19 23:55

The missing-schwa class, 88 rows — the largest of the length-differing buckets. Same outcome shape as
Run 60: no fold available, a lexical slice taken. Two things in it were new.

⚠ IT IS FOUR CLASSES, NOT ONE. `-ically` (`academically ækədɛmɪkli` against `ækədɛmɪkəli`), the
`aɪə`/`aʊə` smoothing before ɹ (`desirable`, `dower`), pre-rhotic SYNCOPE (`several`, `emerald`,
`temperament`), and a handful of one-offs (`elbe`, `brea`).

⚠ TWO OF THEM LOOKED LIKE CLEAN CONVENTIONS AND WERE MEASUREMENT ARTIFACTS — THE THIRD TIME THIS
AUDIT. `aʊəɹ`/`aʊɹ` read 2 against 44, and the syncope environment read a PERFECT 0 against 3,787,
either of which would have justified a fold. The referee TSV stores `ɚ`; the eval's printout shows
`əɹ`; I counted the printed form against the stored file. Re-measured after expanding `ɚ`→`əɹ` — the
space the eval actually compares in — they are 81 against 44 and 1,362 against 3,832. All four
sub-classes record both sides. Lexical, no fold.
⚠ THE FIX IS PROCEDURAL AND IS NOW WRITTEN DOWN: any environment count over the referee must fold
`ɚ`→`əɹ` FIRST. A perfect zero in a rhotic environment is evidence of this bug, not of a convention;
it has now produced a false positive in Run 60 and twice here. (⚠ Run 62 is NOT an instance and
Run 67 removes it from this list: that block's false positive was a missing `excludeRows` rule, a
different bug entirely. Two occurrences across two runs, not three.)

Arbitrating all 88 against misaki gold: 52 gold-differs-from-both, 15 gold-backs-Moby, 12 no gold,
9 gold-backs-us. The 15 are almost all the SYNCOPE sub-class.

⚠ AND THE DICTIONARY CONTRADICTS ITSELF ON FIVE STEMS, which is better evidence than the two external
sources and is what turned 15 rows into 18:

    differ D IH1 F ER0 / difference … ER0 / different … ER0   BUT  differently D IH1 F R …
    indifference … ER0 …                                      BUT  indifferent … F R …
    livery L IH1 V ER0 IY0                                    BUT  liveried L IH1 V R IY0 D
    devil D EH1 V AH0 L                                       BUT  devilish D EH1 V L IH0 SH
    surreal S ER0 IY1 AH0 L                                   BUT  surrealistic S ER0 IY2 L …

The paradigm sweep that found those also caught rows the arbitration alone would have missed.
⚠ AND THE SWEEP WAS ITSELF INCOMPLETE — see Run 67, which adds six more and corrects this
paragraph's arithmetic. `severally` was never a sweep-only find: Moby carries it, so it was in the
arbitrated set all along.

⚠ ONE ROW FROM THE 15 WAS REFUSED — AND A SECOND WAS DROPPED BY MISTAKE, see Run 67: `tandoor T AE0 N D UW1 R`, where gold gives `tændˈʊəɹ`. The `ʊə`
centring diphthong is an RP shape, GenAm has /tænˈdʊr/, and this is the one row in the set where
gold and Moby could plausibly share a British-source error rather than independently agree. Left.

⚠ THE OOV PATH CAME IN ON THE RIGHT SIDE THIS TIME, unlike Run 64 where I had to withdraw the
argument. `several` and `differently` are NOT live splits because the path already predicted the
corrected form, and `differently` is source M — it decodes through `different`, whose row already
carried the schwa. So the dict row was an outlier against our own MORPHOLOGY as well as against the
two external sources. That is not the circular check Run 64 made: the morph path reads a different
dict row, it does not re-derive this one.

⚠ FOUR GOLDENS MOVED AND WERE RE-RECORDED DELIBERATELY, across en, en-GB and en-IN — all `several`
and `differently`. This needed a reason rather than a shrug, because both words are genuinely
two-form in GenAm and Merriam-Webster lists the SYNCOPATED `ˈsev-rəl` first. ⚠ THE REASON GIVEN HERE IS THE WRONG ONE AND RUN 67 REPLACES IT: "gold is what the downstream model
was trained on" is scoped in `eval.ts` to a divergence measured to be a NOTATION CHOICE, and a
syllable-count difference is not one.

    Moby — words the dict carries   26,713/35,027 (76.3%) → 26,725/35,027 (76.3%)
    Moby — OOV                      17,464/39,451 (44.3%)  unmoved
    primary                         2,584/4,037 (64.0%)    unmoved
    rows corrected                  18 · live splits 2 (`elbe`, `indifferent`, both source N)


## Run 67 — 2026-09-20 00:40

Review of the Run 66 block. The rows are right; the sweep I claimed to have pre-empted was itself
incomplete, one row was dropped without being declared, and the justification for the golden
re-record was borrowed from a clause that does not cover it.

⚠ THE PARADIGM SWEEP MISSED SIX ROWS AND THE CHANGE CREATED THE CONTRADICTION IT WAS JUSTIFIED BY.
Run 66's whole argument was that the dictionary disagreed with itself across a stem; after it,
`impoverish` said `ER0` while `impoverished` and `impoverishment` still said `R`, in one sentence:

    ɪndˈɪfɚənt … ɪndˈɪfɹəntli
    ɪmpˈɑːvɚɪʃ , ɪmpˈɑːvɹɪʃt , ɪmpˈɑːvɚɪʃᵻz , ɪmpˈɑːvɚɪʃɪŋ , ɪmpˈɑːvɹɪʃmənt
    tʰˈɛmpɚəmənt  tʰˈɛmpɹəmənts  tʰˌɛmpɚəmˈɛntɫ̩  tʰˌɛmpɹəmˈɛntəli

Before Run 66 the `impoverish` family was at least MUTUALLY CONSISTENT. Six rows added:
`impoverished`, `impoverishment`, `indifferently`, `temperaments`, `temperamentally`, `surrealisms`.
This is the third block in which a per-word correction shipped without its paradigm; the sweep has
to be driven from the STEM FAMILY, not from the arbitration output, because the arbitration only
surfaces words the referee happens to carry.
⚠ `surrealism's` HAS NO DICT ROW AT ALL — it is an accent-lexicon passthrough — so the apostrophe
form is not fixed by any of this and is recorded rather than chased.

⚠ `impoverished` WAS IN THE ARBITRATED FIFTEEN AND I DROPPED IT SILENTLY. Moby
`/I/m'p/A/v/@/r/I//S/t`, gold `ɪmpˈɑvəɹɪʃt`, en-GB `ɪmpɒvəɹɪʃt | ɪmpɒvɹɪʃt` with the full form first
— identical evidence to `impoverish`, which I did apply. "One row refused" was wrong: one was
refused and one was lost. The arithmetic gives it away and I did not check it — 15 − 1 + 6 = 20, not
the 18 I shipped. The true accounting is 15 arbitrated − `tandoor` refused − `impoverished` lost =
13, plus 5 paradigm-only rows = 18. FIVE, not six: `severally` is in Moby and was in the arbitrated
set all along.

⚠ A FALSE CITATION IN A SHIPPED FILE. The curated note for `surrealistic` read "both Moby and misaki
gold keep this schwa" — MOBY DOES NOT CARRY THE WORD, nor `surrealist`/`surrealists`. The row is
still right (gold `səɹˌiəlˈɪstɪk`, and our own `surreal S ER0 IY1 AH0 L`), but the evidence line was
invented by copying a sibling's. A curated row's reason is the only thing a later reader has.

⚠ THE GOLDEN RE-RECORD IS RIGHT AND MY REASON FOR IT WAS NOT. I cited "gold is what the downstream
model was trained on", which `eval.ts` scopes explicitly to *a divergence measured to be a NOTATION
CHOICE rather than an error*. `ˈsɛvrəl` against `ˈsɛvərəl` is a lexical variant with a different
SYLLABLE COUNT, not a notation choice. Borrowing the clause was a category shift, and as written it
reads as a rationalisation.
The justification that actually holds is measured over our own dictionary in the same environment:

    keep the pre-rhotic schwa (13)   every, general, federal, camera, memory, average, liberal,
                                     reference, beverage, nursery, grocery, favorite, history
    syncopate (3)                    interest, temperature, laboratory

and GOLD MAKES THE SAME PER-WORD SPLIT — `ˈɛvəɹi`, `ʤˈɛnəɹəl`, `kˈæməɹə` full against `ˈɪntɹəst`,
`tˈɛmpɹəʧəɹ`, `lˈæbɹətˌɔɹi` syncopated. That it is per-word and not a blanket convention is what
makes it evidence at all; a convention would have made it worthless. Two further supports I had not
cited: the en-GB referee lists `several sɛvəɹəl | sɛvɹəl` and `differently dɪfəɹəntli | dɪfɹəntli`
with the FULL form first, and the n-gram already predicts the corrected `several`.
⚠ AND THERE IS A COUNTER-EXAMPLE I OMITTED. The PRIMARY referee — wikipron GenAm, the highest tier
we have — gives `temperament t ɛ m p ɚ m ə n t`, syncopated, disagreeing with the new reading on one
of the eighteen. `temperamental` is weaker still: MOBY ACTIVELY SYNCOPATES IT
(`,t/E/mpr/@/'m/E/nt/@/l`), so that row rests on gold alone. Recorded rather than buried.
⚠ THE MISSING EVIDENCE IS A LISTEN, not another lexicon. Both words are high-frequency and
genuinely two-form, Merriam-Webster orders the syncopated form first, and this repo's own standing
rule is that a TTS change wants A/B audio. The re-record stands on the lexical measurement above;
the audio check is the thing that would settle it and has not been done.

⚠ AND THE `ɚ` PROCEDURAL RULE WAS WRITTEN IN THE WRONG PLACE — a 4,000-line run log. It now sits in
`en.jsonc` beside the `ɚ`→`əɹ` fold it is about, where anyone measuring against this referee will
meet it. ⚠ ITS CLAIM IS ALSO NARROWED: Run 66 said the mistake had produced false positives in
#1369, #1370 and here. #1370's false positive was a MISSING `excludeRows` RULE, a different bug
entirely. Two occurrences across two runs.

⚠ THE `tandoor` REFUSAL IS SOUND AND I ARGUED IT BADLY. "An RP centring diphthong, and the two
sources could share a British-source error" is speculation. The checkable version: `ʊə` appears in
51 of 90,201 gold entries and essentially all are `u`+`ə` hiatus (`influence`, `Papua`) — every CURE
word is plain `ʊɹ` (`poor pˈʊɹ`, `tour tˈʊɹ`, `sure ʃˈʊɹ`, `cure kjˈʊɹ`). GOLD CONTRADICTS ITSELF ONE
ROW LATER with `tandoori tændˈʊɹi`. And the two sources do not independently agree anyway: Moby has
`'t/&/nd/U//@/r` with INITIAL stress against gold's final. The "two sources agree" test that
qualified the other fourteen never held for this row.

RECORDED, NOT TAKEN — and the reason is a gap in the method rather than a judgement. `opera
AA1 P R AH0` and `desperate D EH1 S P R IH0 T` are the same class in the other direction (gold
`ˈɑpəɹə`, `dˈɛspəɹət`; the en-GB referee lists `dɛspəɹət` first). They did not reach the arbitrated
set because it matched WHOLE READINGS: Moby and gold both keep the schwa but differ on a DIFFERENT
segment, so the row fell into "gold differs from both". An arbitration that compares whole strings
cannot see two sources agreeing about the one thing at issue.

    Moby — words the dict carries   26,725/35,027 (76.3%) → see below
    rows corrected                  18 → 24  (14 arbitrated, 10 paradigm)

## Run 68 — 2026-09-20 01:30

The extra-schwa class, 77 rows — the mirror of Run 66, where WE have a schwa the referee lacks. It
is mostly a class where we are RIGHT, and the named syllabic-l candidate resolves the opposite way
from the one I predicted.

⚠ THREE ROWS, AND THAT IS THE HONEST YIELD. Whole-reading arbitration against gold: 57
gold-differs-from-both, 16 no gold, 3 gold-backs-us, 1 gold-backs-Moby. Applying the POSITIONAL test
Run 67 recorded as owed — compare only the segment at issue, in the same consonant frame, via the
repo's own `goldToArpabet` — recovers one more, not the flood I expected: `serenely`,
`motorcyclist`, and `motorcyclists` by paradigm.
⚠ THE POSITIONAL TEST IS WORTH HAVING ANYWAY, and its first hand-rolled version was wrong in the
usual way: I folded gold with my own regex and 50 of 77 came back "ambiguous" because gold writes
`O`, `I` and `ɾ` in its own shorthand. Running it through `goldToArpabet` instead — the converter
built for this — collapsed the ambiguity. Hand-folding a source the repo already has a converter for
is the same class of error as measuring against a form the pipeline cannot emit.
⚠ AND IT THREW A FALSE POSITIVE I NEARLY TOOK: `legged L EH1 G AH0 D` against gold `L EH1 G IH0 D`
is a vowel-QUALITY difference, not a missing schwa; my test counted `AH0` only and so read one fewer
reduced vowel.

⚠ THE SYLLABIC-L CANDIDATE, CARRIED SINCE #1365, RESOLVES — AND NOT AS PREDICTED. I expected it to
"fall the same way as the yod one", i.e. be refused because we are wrong to have the schwa. The
opposite: GOLD HAS THE SCHWA TOO, written `ᵊ` — `babbling bˈæbᵊlɪŋ`, `juggler ʤˈʌɡᵊləɹ`, `fiddler
fˈɪdᵊləɹ`, `cycling sˈIkᵊlɪŋ`. Moby is the outlier here, not us.
⚠ WHAT IS REAL IS AN INCONSISTENCY ON OUR SIDE, IN THE OTHER DIRECTION. In the obstruent + L +
`-er`/`-ing` environment our dictionary is split almost evenly — 503 rows WITH `AH0 L`, 576 with a
bare `L` — while gold writes `ᵊ` throughout, including for the ones we leave bare (`tumbler
tˈʌmbᵊləɹ`, `rambler ɹˈæmbᵊləɹ`, `sprinkler spɹˈɪŋkᵊləɹ`).
⚠ AND IT IS NOT COSMETIC, which was the first thing I checked after #1368. The two encodings produce
DIFFERENT OUTPUT: `juggler d͡ʒˈʌɡə̆lɚ` against `tumbler tʰˈʌmblɚ`. The reduced-slot machinery in
`englishArpabet.ts` marks the schwa we have and can do nothing for the rows where CMUdict wrote a
bare `L`, so the inconsistency reaches the audio.
⚠ AND THE CODA/ONSET RULE DOES NOT SAY WHAT THIS PARAGRAPH CLAIMS — Run 69 retracts that too. What
is true is only the per-word evidence:
`motorcycle mˈOɾəɹsˌIkᵊl` keeps it because the L is word-final, `motorcyclist mˈOɾəɹsˌIklɪst` does
not because the L onsets `-list`. Our `cyclist S AY1 K L IH0 S T` already had it right and
`motorcyclist` did not — which is the third row taken here.

RECORDED, NOT TAKEN — ⚠ AND RUN 69 SHOWS THIS FINDING IS WRONG AS STATED. It is not ~576 rows where
gold marks `ᵊ`; It is not a Moby question at
all — Moby sides against gold here — so it cannot be arbitrated by the two-source method this audit
has been using, and at 576 rows it is a policy decision about aligning CMUdict's encoding with the
training data rather than a defect sweep. The coda/onset rule above is the discriminator it would
need, and `englishArpabet.ts` already implements that rule for the rows that carry the slot.

    Moby — words the dict carries   26,726/35,027 (76.3%) → 26,728/35,027 (76.3%)
    Moby — OOV                      17,464/39,451 (44.3%)  unmoved
    primary                         2,584/4,037 (64.0%)    unmoved

STILL OWED from Run 67 and not done here: an A/B listen on `several`. No `kokoro` package is
installed in any venv in this tree, so producing the WAVs is a setup task in the parent repo rather
than something this block could fold in. Recorded rather than quietly dropped — and the judgement is
the user's in any case, not mine.


## Run 69 — 2026-09-20 02:40

Review of Run 68. The three rows are right and the sweep for them is complete; the LARGE CLAIM the
block recorded for the next one to build on is wrong, and so is the rule I cited for it.

⚠ "GOLD WRITES `ᵊ` THROUGHOUT" IS FALSE, AND IT WAS THE LOAD-BEARING SENTENCE. Re-derived over the
word-final population, checking gold POSITIONALLY (does the string end `ᵊləɹ`/`ᵊlɪŋ`) rather than
for a `ᵊ` anywhere:

    our `AH0 L`  454 rows · gold covers 131 · gold HAS ᵊ 107 · gold LACKS it  24
    our bare `L` 497 rows · gold covers 113 · gold HAS ᵊ  45 · gold LACKS it  68

On the very population the finding is about, GOLD SIDES WITH OUR BARE `L` on 60% of the rows it
covers — `butler`, `antler`, `angler`, `seedling`, `duckling`, `sibling`, `burglar`, `chandler`,
`cobbler`. The three words I quoted as proof (`tumbler`, `rambler`, `sprinkler`) are the 40%. Failure
mode (b), on the largest claim in the audit: a sweep driven by it would have inserted a schwa into
`butler` and `sibling` against gold.

⚠ THE MORPHOLOGICAL DISCRIMINATOR OFFERED IN ITS PLACE ALSO FAILS, which is worth recording so the
next attempt does not start there. "Gold marks when the L comes from a `-le` stem" is the obvious
repair and it does not survive: every one of `tumbler ᵊ`, `juggler ᵊ`, `fiddler ᵊ` and `cobbler` no-ᵊ,
`bungler` no-ᵊ, `coupler` no-ᵊ, `assembler` no-ᵊ is a `-le` deverbal. GOLD IS SIMPLY INCONSISTENT IN
THIS ENVIRONMENT, and the honest statement of the finding is that OUR dictionary is split 454/497,
gold covers only 244 of those rows and is itself split both ways, and NO DISCRIMINATOR TESTED
SURVIVES. The class is not arbitrable by the two-source method at all — not because Moby sides
against gold, which is what Run 68 said, but because gold does not have a position.

⚠ AND THE CODA/ONSET RULE DOES THE OPPOSITE OF WHAT I CITED IT FOR. `englishArpabet.ts:404` says
`ᵊ` IS A REDUCED SCHWA, NOT A SYLLABICITY MARK — both branches KEEP the schwa, one as a syllabic
diacritic and one as an extra-short `ə̆`; neither deletes anything. Its onset test is
`VOWELS.has(P[son+1])`, and in every row of this population the L is followed by `ER0` or `IH0`, so
it classifies ALL of them as onsets and has zero discriminating power here. Applied as Run 68
proposed it would strip the schwa from `juggler`, `babbling`, `cycling` and `fiddler` — the four rows
that block cites as proof gold keeps it. Failure mode (c), and the curated note for `motorcyclist`
carried the same false principle into a shipped file; it now states the three sources instead.
⚠ GOLD UNDERCUTS THE ABSOLUTISM ANYWAY: `bicyclist bˈIsəkᵊlɪst` HAS the `ᵊ` where `cyclist`,
`unicyclist` and `tricyclist` do not. The three rows taken are still right — on gold, Moby and our
own `cyclist`, which is what the note should have said in the first place.

⚠ A FOURTH CONSECUTIVE INCOMPLETE SWEEP, AND THIS TIME THE CAUSE IS DIAGNOSABLE. `determinedly
D AH0 T ER1 M AH0 N AH0 D L IY0` is the one clean unarbitrated row left in this class
dictionary-wide — gold `dətˈɜɹməndli`, Moby `d/I/'t/[@]/rm/I/ndl/i/`, and our own `determined
D IH0 T ER1 M AH0 N D` contradicts it. It was missed because the arbitration iterates
`g2p-common.txt`, the 40k FREQUENCY LIST, not the dictionary. Run 67 said the sweep must be driven
from the stem family; the deeper fix is that it must be driven from `dict ∩ moby ∩ gold`. Taken.

⚠ THE 77/57/16/3/1 TALLY IS NOT REPRODUCIBLE and I did not state its population or predicate. Three
independent reconstructions over the repo's own converters give gold-backs-us at 80–90% and
gold-backs-Moby at ZERO in every one. The reported tally UNDERSTATES this block's own conclusion.
Worse, `serenely`, `motorcyclist` and `motorcyclists` are not in `g2p-common.txt` at all, so they
cannot be members of a 77-row class derived from that audit — whatever population produced the 77 is
not the one `audit()` uses. The qualitative finding ("mostly a class where we are right") stands and
is stronger than reported; the numbers do not, and are withdrawn rather than patched.

CHECKS OUT, verified independently: the three applied rows and their paradigms (`serene`/`serenely`
complete, `-cyclist` family complete, `motorcycle` correctly untouched); "not cosmetic"
(`d͡ʒˈʌɡə̆lɚ` against `tʰˈʌmblɚ` reproduces, and the pair is fair as evidence about OUR inconsistency
even though it is not evidence about gold); and no regression — primary unmoved, in-dict 26,728,
goldens 0 stale, 317 files / 6,087 tests.

ONE ADJACENT GAP, pre-existing and not from this block: `motorcycling` and `bicycling` have no dict
row and no syllabic slot, so we emit a full `ə` (`mˈoᶷt̬ɚsˌaᶦkəlɪŋ`) where gold has `ᵊ` and our own
`cycling` correctly gets `sˈaᶦkə̆lɪŋ`.

    Moby — words the dict carries   26,728/35,027 (76.3%)  unmoved by Run 69's row
    rows corrected                  3 → 4

## Run 70 — 2026-09-20 03:30

Infrastructure, not lexicon. Run 69 diagnosed why four consecutive blocks shipped incomplete sweeps;
this fixes it, and the size of what was hidden is larger than the diagnosis suggested.

    MOBY=… GOLD=… npx tsx tools/english/en_source_compare.mts     (before and after)

⚠ THE AUDIT WAS COMPARING 42% OF ITS POPULATION AND SEEING A THIRD OF ITS CANDIDATES.
`audit()` ended in `freq.forEach(...)` — it iterated `g2p-common.txt`, the 40,004-word FREQUENCY
LIST, and every triple-sourced word outside that list was invisible.

    before   19,439 words compared   258 candidates
    after    46,062 words compared   784 candidates

526 rows where gold AND MOBY AGREE AGAINST OUR DICTIONARY had never been visible to the audit. Runs
60, 64, 66 and 68 each searched for precisely that shape and could not see two thirds of it.

⚠ THE BUG IS INVISIBLE FROM THE OUTPUT, which is why it survived. A smaller population reports
smaller counts and a HIGHER agreement rate — 79.9% before against 81.4% after — so the report reads
like a cleaner dictionary, not like a truncated search. Nothing in the numbers says rows are
missing. That is the general shape worth remembering: a population bug does not look like an error,
it looks like good news.

⚠ THE FREQUENCY LIST IS A RANKING AND WAS BEING USED AS A POPULATION. Those are different jobs and
the fix separates them: the loop is now over `dict ∩ gold ∩ moby` and the rank is LOOKED UP.
A word off the list ranks `-1`, not 0 — zero would sort it above every real word in the report,
which is how an off-list row would be mistaken for the commonest word in English.

⚠ PINNED WITH A TEST, and mutation-checked. The test builds four tiny fixture files with one on-list
and one off-list word, both triple-sourced and both disagreeing with us, and asserts BOTH are
compared and the off-list one ranks -1. Reverting the loop to the frequency list fails it with
`expected 1 to be 2`. Behaviour, not report — because the report is exactly what cannot see this.

WHAT THE 526 CONTAIN, characterised for the next block rather than swept here — 784 rows is a
lexical sweep of its own and deserves a separate review:

    one phone, segment   209      abrade AE0 B R EY1 D → AH0 …, anhydride … R IH0 D → R AY2 D
    two phones           142
    length differs       124
    three phones          42
    four phones            9

⚠ AND ONLY FIVE PARADIGM PAIRS SIT INSIDE THE SET (`deprave`/`depraved`, `wizen`/`wizened`,
`creolize`/`creolized`, `ribald`/`ribaldry`, `phoenicia`/`phoenician`). That is the warning for
whoever takes them: almost every one of the 526 has its inflections OUTSIDE the candidate list, so
applying them straight from the audit output reproduces the half-applied-paradigm defect of #1369,
#1371, #1372 and #1373 five hundred times over. The sweep has to be driven from the stem family —
which is now possible, because the population is finally the dictionary.

    Moby — words the dict carries   26,728/35,027 (76.3%)  unmoved — no dictionary row changed here
    Moby — OOV                      17,464/39,451 (44.3%)  unmoved
    primary                         2,584/4,037 (64.0%)    unmoved
