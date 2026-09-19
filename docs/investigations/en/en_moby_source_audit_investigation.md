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

### And the defective list was 25, not the 29 the last PR claimed

Four rows were identified in that session (`anderson`→Sulam, `millimeter` truncated, `oder`→Odessa,
`piker`→pikestaff) and never added — the edit was described and not made. Found by this sweep, because a
row whose body is a different word often also loses the ⟨r⟩ its headword is spelled with, so the r-less
detector catches corruption the rhotic rules were not looking for. With `flayer` (`ɛfwʌn`, i.e. "F one")
the list is now 30.
