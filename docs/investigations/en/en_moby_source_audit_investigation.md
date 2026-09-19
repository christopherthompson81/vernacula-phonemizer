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
