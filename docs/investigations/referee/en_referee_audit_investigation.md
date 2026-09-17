# Auditing the English referee score: 40.9% is mostly instrument, not engine

`tools/referee-eval/eval.ts en` reports **40.9% folded backbone / 81.8% symbol accuracy** against
wikipron eng_latn_us. Every other reasonably-sized language sits in the 90s. That gap was taken as a
statement about English G2P quality; this audits whether it is one.

## Run 1 — 2026-09-17 — four independent measurement faults, worth ~39 points together

| step | folded agreement |
|---|---|
| as reported | **40.9%** |
| on a referee with RP-contaminated rows dropped and two-source agreement required | 67.1% |
| …scoring the path that actually SHIPS (neural, not the n-gram) | 71.6% |
| …with the three convention folds the config is missing | **79.5%** |

### 1. The corpus is 25× more OOV-heavy than running text

    referee corpus   4,558 rows    54.6% OOV     19.0% capitalized
    running text     8,860 tokens   2.2% OOV      ~7% capitalized

Scored by slice, the headline is a 45/55 blend of two very different things:

    in the dictionary   2,069 rows   61.3% folded   91.2% symbol
    OOV                 2,489 rows   23.9% folded   75.5% symbol

Weighted the way real text is composed (98/2 rather than 45/55) the same engine reads ~60.5%. The
headline is dominated by a slice that is 2% of the product's actual input.

### 2. The eval scores the n-gram, not the neural path that ships

`PATH_OF` records this honestly — "for en not the neural OOV path" — but the consequence had not been
measured. On the OOV slice: **n-gram 23.9%, neural 32.3%**. The weaker of the two is the one graded.

### 3. Three house conventions are counted as always-wrong

#1282 established the principle for `ᵻ` — a symbol with no referee counterpart maps to always-wrong
and becomes a uniform penalty on a documented convention, so it must be folded. Three more were never
added, and together they are **27.8% of in-dictionary disagreements (223 of 801)**:

| convention | share | example |
|---|---|---|
| the palatal glide `ʲ` | 6.9% | `Albania` `ælbeɪniʲə` vs `ælbeɪniə` |
| syllabic `n̩ l̩ m̩` → referee's `ən əl əm` | 7.5% | `Anglican` `æŋɡləkn` vs `æŋɡlɪkən` |
| the weak vowel `ə`/`ɪ` | 4.6% | `Alice` `æləs` vs `ælɪs` |
| NURSE `ɝ` (`ɚ` is folded, `ɝ` is not) | 8 rows | `advert` `ædvəɹt` vs `ædvɝt` |

⚠ **THE SYLLABIC ONE MEANS #1319 LOWERED THIS SCORE BY BEING RIGHT.** That PR added the reduced slot
— the syllabic consonants misaki writes and Kokoro was trained on — and every word it touched became
a referee mismatch, because the fold list has no entry for the mark.

### 4. A "US broad" referee that is 10.7% RP

    əʊ  RP GOAT       112 rows      ɪə  RP NEAR       82 rows
    ɒ   RP LOT        186 rows      ʊə  RP CURE       32 rows
    ɑː  RP PALM       108 rows      ɛə  RP SQUARE     14 rows
    ⇒ 488 rows (10.7%) carry at least one RP-only marker; 45 more are non-rhotic

`Amazonia` is transcribed `æməzəʊniə` in a corpus labelled GenAm. The config's header admits the
referee is "noisy (proper nouns, British variants, letter-name entries) → a modest floor"; this is
the size of that floor.

## The referee is wrong about twice as often as we are

Of the 801 in-dictionary disagreements, 223 are the conventions above and 31 more are the cot–caught
merger or the `ɝ` fold gap. The remaining **344 were arbitrated against a third source** (misaki
gold):

    gold agrees with the REFEREE → we are wrong      67
    gold agrees with US → the referee is noise      127
    gold has no entry                               150

`amber` is transcribed `eəmbəɹ`, `ankle` `eɪŋkəl`, `acts` `æks`, `adjudication` `əddʒudɪkeɪʃən`.
These are not variants; they are errors in the reference.

## Why other languages are in the 90s, and why that is not a comparison

    it 97.8   pl 98.2   cs 97.0   fi 96.0   id 94.9   tr 93.7   sw 93.5   es 92.5
    de 78.7   nl 67.0   en 40.9

The ordering tracks **orthographic depth**, not data quality. Every language in the 90s has a
phonemically shallow orthography and is scored on `word — the bare word g2p`: spelling determines
pronunciation, so a rule engine is near-deterministic and needs no lexicon at all. German and Dutch
are intermediate and score intermediate. English is the deep end of that scale — it is why the
CMUdict lexicon and the BiLSTM tagger exist. A 40.9% here and a 97.8% for Italian are not measuring
comparable tasks.

## Recommendation: build the constructed referee

A two-source-agreement set is buildable from data already in the repo: drop the RP rows, keep only
words where **wikipron-US and misaki gold agree after folding** — **1,357 rows**, 61.9% of their
overlap. Against it, the shipped path with correct folds scores **79.5%**.

⚠ **AND IT MUST BE LABELLED PARTLY CIRCULAR.** Six merged PRs in this series tuned English toward
misaki gold, so our score on rows gold helped select is inflated relative to an untuned engine.
Filtering by AGREEMENT BETWEEN TWO SOURCES does not bias toward *our* output — it selects rows where
the truth is well established — and future changes are not pre-tuned, so it works as an ongoing
instrument. But the absolute number is not comparable to the fleet's.

Order of work, cheapest first:

1. **Add the three missing folds** (`ʲ`, syllabic sonorants, `ɝ`). Pure instrument fix, no engine
   change, worth ~8 points, and it stops penalising #1319 for being correct.
2. **Score the neural path for `en`.** Worth ~4.5 points and removes a known "we grade the wrong
   path" footnote.
3. **Drop the RP-contaminated rows**, or split them into an `en-GB` referee where they are correct.
4. **Build the two-source set** as a second, high-confidence referee alongside the noisy one — not
   replacing it, since the noisy one has 3× the coverage.
5. Only then read the residual as engine defects.

## Run 2 — 2026-09-17 — steps 1 and 2 taken: 40.9% → 50.6%, with no engine change

| | folded backbone | symbol accuracy |
|---|---|---|
| before | 40.9% | 81.8% |
| + the three missing folds | 45.0% | 83.5% |
| + scoring the neural tier, which is what ships | **50.6%** | **87.3%** |

**+9.7 points of folded agreement and +5.5 of symbol accuracy, and not one line of the engine moved.**
Every English number in this repo's history was read through that distortion.

### The folds

`preFolds` for the syllabic sonorant, because the backbone strips combining marks and the mark has to
become a vowel BEFORE that rather than be deleted — `(\S)̩` → `ə$1`, the same rule as
`KokoroFormat`'s `SyllabicRe`. Then `ʲ` → nothing and `ɝ` → `əɹ` among the ordinary folds.

⚠ `ɝ` IS NOT A NEW CONVENTION, IT IS AN ASYMMETRY: `ɚ` was already folded to `əɹ` and `ɝ` was not, so
the pair differed only by a stress the segmental backbone has already stripped (`advert`, ours
`ædvəɹt` against the referee's `ædvɝt`). Folding both makes the distinction invisible on BOTH sides
instead of on one.

### The path

`en` now scores `phonemizeEnNeural`, which calls the same `E.text()` underneath and only fills the
OOV tail — so it is still the engine's own `text()`, with no `romanPass`/`foldPass`/`withHost`, and
the new `engine-text-neural` label says exactly that. **The label is DERIVED from the source like the
other two, not hand-kept**: without a derivation rule `en` falls through to `"word"` — "the bare word
g2p" — which is the wrong answer on the one field whose job is to prevent that.

⚠ `en-GB` IS NOT REPOINTED and must not be. It is scored on `rules` deliberately, because its lexicon
shares a source with its referee; that is a circularity decision, not a path oversight. It does get
the two folds that apply to it (no `ɝ` — RP is non-rhotic): **45.6% → 47.3%**. Smaller than en's gain
because the rules-only path reaches fewer syllabic slots.

### What did not change, checked

es 92.5%, it 97.8%, de 78.7%, nl 67.0% — identical, as they must be: the folds are in `en.jsonc` and
`en-GB.jsonc` and the path label is derived per-language. `en` goldens are byte-identical (0 stale)
because no engine code moved. The weak-vowel survey's shape is intact — `ᵻ` still sits between `ɪ`
and `ə` (74.1% referee-`ɪ`), which is the invariant #1282 left that tool to protect.

### Still open, in the order recommended

3. Split the 488 RP-contaminated rows out of a corpus labelled GenAm — or move them to `en-GB`, where
   they are correct rather than wrong.
4. Build the two-source-agreement referee (1,357 rows; we score 79.5% on it) as a second,
   high-confidence instrument ALONGSIDE the noisy one, which has 3× the coverage. It must carry the
   PARTLY CIRCULAR label: six merged PRs tuned English toward misaki gold, so our score on rows gold
   helped select is inflated relative to an untuned engine.
5. Only then read the residual as engine defects.

### Review — the syllabic fold is bidirectional, and deliberately NOT fleet-wide

Two things checked on review rather than assumed.

**It normalises both sides.** The referee writes the syllabic mark itself — 60 of 4,558 US rows, 1,196
of 76,284 UK rows — so the fold is not a concession to our notation. Their `zm̩` and our `zəm` meet at
`zəm`, and so do their `zəm` and our `zm̩`. Under the bare backbone strip the first pair met at `zm`
against `zəm` and missed.

**And the obvious generalisation is wrong.** 43 referee files carry `U+0329`, which makes this look
like a `BACKBONE` fix for the whole fleet — Serbian alone has it in 54.6% of rows. Measured:

    sr  26,048 → 25,529      cs  17,254 → 17,144
    mk  62,375 → 62,314      de   3,732 →  3,711

**Worse everywhere.** In those languages BOTH sides write `r̩`/`n̩`, so deleting the mark already aligns
them, and turning it into a vowel exposes a mere presence/absence difference instead. English is the
reverse case: its referee spells the same syllable with a real vowel. The right fold is
language-specific, and a fleet-wide `BACKBONE` entry would have cost ~700 rows across four languages
to gain 60 on English.

## Run 3 — 2026-09-17 — step 3: the RP rows are out, 50.6% → 56.1%

| | folded | symbol accuracy |
|---|---|---|
| originally reported | 40.9% | 81.8% |
| + the three missing folds | 45.0% | 83.5% |
| + the neural tier (what ships) | 50.6% | 87.3% |
| **+ the RP rows excluded** | **56.1%** | **89.1%** |

**+15.2 points of folded agreement and +7.3 of symbol accuracy, cumulative, with no engine change.**

### The detector, and the false positive in the first draft

    RP-only vowels  əʊ ɒ ɪə ʊə ɛə      390 rows
    non-rhotic      post-vocalic r in the spelling, no rhotic in the IPA     98 rows
                                                                      union 488 (10.7%)

⚠ **`ɑː` WAS IN THE FIRST DRAFT AND IS NOT A MARKER.** The backbone strips `ː`, so `ɑː` folds to `ɑ` —
the GenAm vowel — and 108 rows would have been dropped for a length mark that never reaches the
comparison. The earlier "488 rows" figure in Run 1 happened to land on the same total by a different
route (it counted `ɑː` and missed the non-rhotic rule); this one is the composition that survives.

⚠ **NON-RHOTICITY NEEDS BOTH FIELDS.** It is a word SPELLED with a post-vocalic r whose transcription
has no rhotic at all (`Dunkirk` `dʌŋkɜːk`, `Gentner` `ɡɛntnə`). Neither half says it alone, so the
rule is a conjunction — `spelling` ∧ `ipaLacks` — not a regex.

### Validated against the other referee, not asserted

Of the flagged rows, the ones the en-GB referee also has carry a **byte-identical** reading:
**92% of the RP-vowel rows (347/376) and 98% of the non-rhotic rows (93/95)**. These are not noisy US
transcriptions; they are UK transcriptions in the wrong file.

### Excluded, not moved, and the file is left intact

There is nothing to move them to — the en-GB referee already has them. And the referee files are
provenance-tracked CC-BY-SA imports, so editing one in place would make it unreproducible from its
source. The exclusion is declared in `en.jsonc`, and the dropped count is **printed on every run**,
because a silently shrinking denominator is how a score improves for no reason.

### Two mechanism bugs found while building it

⚠ **THE PATTERN MATCHED NOTHING AND LOOKED LIKE IT WORKED.** Under `segmentJoin` the referee stores one
space-separated phoneme per position, so `əʊ` is on disk as `ə ʊ`, and a pattern written the way a
reader writes IPA silently matches nothing. Only the single-character `ɒ` rule fired — 298 of 488
rows, a plausible-looking number. Fixed by testing the JOINED form, exactly as the scorer sees it.

⚠ **AND `g` IS THE WRONG FLAG FOR A MEMBERSHIP TEST.** These regexes are reused across thousands of
rows and a `g` regex carries `lastIndex` between `.test()` calls, so every other row would have passed
the filter. Compiled with `u` only, and pinned by a test.

### The symmetric case is real but NOT taken here

The UK referee has the mirror problem — 2,249 rows (2.95%) where every variant carries a US marker
(`ɚ`/`ɝ`, `oʊ`, `ɑɹ`). Probed: en-GB **47.3% → 48.8%**, 2,532 dropped.

**Not shipped, because that probe over-excluded.** en-gb is **21.4% multi-variant, up to 24 readings
per row**, and the scorer credits ANY of them — so a row whose first reading is US but whose second is
RP is still usable evidence. The probe dropped 2,532 where only 2,249 qualify. The mechanism now
requires **every** variant to match before a row is dropped (identical on a single-variant file — the
en referee is strictly one reading per row — and load-bearing on a multi-variant one), so the en-GB
exclusion can be built correctly on top of it. Left as its own change.

### Also observed

The referee eval is **single-threaded**: en-GB is 76,284 words through the rules path on one core,
with seven idle. Nothing in this run depends on fixing that, but it is the reason a fleet sweep is
slow, and it is a different kind of work from the audit.

### Review — the two claims that needed narrowing

**"Nothing to move them to" was 96.5% true.** 471 of the 488 excluded rows are already in the en-GB
referee; **17 are in neither file afterwards** — `vampire`, `Syriac`, `hydrochloric`, `coefficient`,
`Deleuzoguattarian` — 0.37% of the corpus, genuinely lost coverage. That is still the right trade: an
RP reading scored against a rhotic engine is worse than no reading, because it is wrong in a direction
the engine cannot fix. But it is a cost, not a free move.

**The non-rhotic rule has one false positive, found by reading all 98.** `dossier` = `dɑsieɪ` is
correct GenAm — the final `-r` really is silent, because the word is a French loan. The other 97 are
unambiguous (`ticker` `tɪkə`, `whisker` `wɪskə`, `voucher` `vaʊt͡ʃə`, `avenger` `əvɛndʒə`). Left in
rather than special-cased: a one-word exception to a 97/98 rule costs more machinery than the row is
worth. Recorded so it is not rediscovered as a bug.

Checked and clean: 39 of the 98 carry no RP length or quality tell (`ɜː`/`ɑː`/`ɔː`) and were read
individually in case the rule was firing on something other than non-rhoticity. It was not — they are
final `-er` → `ə` and `-or` → `ə`, which is the same phenomenon without the length mark.

## Run 4 — 2026-09-17 — review: the floor had stopped being a gate

Raising the measurement 40.9% → 56.1% left `en`'s referee floor at **0.35, twenty points below the
number it guards**. A floor that far under the measurement catches nothing: the engine could lose a
third of its agreement and the gate would still be green. Raised to **0.47**.

    en     sampled 54.9%  (1118/2035)   floor 0.47   margin 7.9pp
    en-GB  sampled 46.5%  (1365/2934)   floor 0.44   margin 2.5pp

⚠ **0.47 IS BELOW THE DEGRADED-PATH SCORE ON PURPOSE.** `en` is now scored through
`phonemizeEnNeural`, which falls back to the sync engine when onnxruntime is unavailable — and that
fallback measures **50.0%** on the full referee against the neural path's 56.1%. A floor above 50
would turn every ONNX-less environment into a red gate that looks like a regression. Below it, the
gate still passes, and **a result near 50% rather than 55% is itself the signature of the fallback** —
which is worth more than a failure, because this session already lost a whole finding to a harness
that had silently degraded to the wrong path.

`en-GB` was NOT raised: it is scored rules-only, so it has no degraded-path question, and 2.5pp is
already the tight margin this repo sets floors at. `en`'s was raised because 20pp is not a margin.

### Both floor comments described the old instrument

`en`'s said "measured 41.8%" and `en-GB`'s "measured 45.4%" — the pre-#1327 numbers. Corrected, with
the reason each moved. This matters more than it looks: those comments are the only record of WHY a
floor sits where it does, and #1327/#1328 changed the measurement without touching them.

### ⚠ The "transient failure" was a missing timeout, and it was NOT transient

It reproduced as soon as the floor was raised, and the reporter had been lying about what it was:

    × en backbone ≥ 47% … 5079ms  →  Test timed out in 5000ms.

**Not a score failure at all.** `en` measures 2.2s alone and exceeds 5s inside a full parallel run.
`referee-eval.test.ts` — the file this one was carved out of, "for wall time only, same gate" —
passes **120000** as a per-test timeout, for the reason documented beside it: these tests sit 8× under
the default when idle, and a loaded machine eats exactly that headroom. **Carving out the two English
cases took the floors and the `evaluate` call and left the timeout behind**, so this file has been
running on vitest's 5s default ever since.

Two things this got wrong before it was chased properly:

⚠ **IT WAS CALLED A FLAKE AND ALMOST LEFT THERE.** One occurrence, passing on re-run, with an existing
flakiness investigation to point at — every reason to file it and move on. Raising the floor is what
made it reproduce, which was luck rather than method.

⚠ **AND THE DIAGNOSIS WAS WRONG TWICE.** First "ONNX degradation under worker pressure", then "the
floor I just raised is unsafe". Both were plausible, both were built on the reporter's line rather
than on the error text, and the error text said `Test timed out` the whole time. The degraded-path
measurement that came out of it (sync 50.0% against neural 56.1%) is still worth having and still
shapes where the floor sits — but it was not the answer to this question.

## Run 5 — 2026-09-17 — working the classified table: one fold taken, one rejected, the rest not fixable

The 43.9% was classified into named classes. This works each line and records the verdict, so nobody
re-derives them.

| class | n | verdict |
|---|---|---|
| weak vowel `ə`/`ɪ` | 205 | **intentional** — Run 1; both referees back us (82%/72%) |
| `i`/`ɪ` tense-lax | 57 | mixed 39:19, no rule — mostly OOV proper nouns |
| **`ʌ`/`ə` STRUT–schwa** | **42** | **FOLDED — taken, +1.1pp** |
| cot–caught `ɑ`/`ɔ` | 38 | **fold TESTED AND REJECTED** |
| `æ`/`ɑ` | 32 | mixed 18:14, OOV foreign names — not rule-shaped |
| j-glide | 28 | mixed; partly yod-retention, partly my test catching syllabics |
| initial `æ`/`ə` | 28 | bidirectional |
| final `-s`/`-z` | 11 | 9 of 11 are the tagger adding `z` to classical names (`Mimas`, `Patras`) |
| different reading, in dict | 371 | 71 ours · 119 referee · 181 no verdict |
| different reading, OOV | 1,011 | 129 ours · 49 referee · 833 no verdict |

### Taken: `ʌ` → `ə`

**STRUT and schwa are one phoneme in English, in complementary distribution by stress — and this
engine derives them that way**: `english.jsonc` maps `AH` to `ʌ` when stressed and `ə` when not, from
the same ARPABET symbol. The backbone already strips stress, so leaving the pair unfolded smuggles a
STRESS claim back into a comparison that is meant to be segmental.

42 rows differ by nothing else, 37 of them the referee writing `ʌ` where we write `ə` (`bugsona`
`bʌɡsoʊnə`, `decussation` `dɛkʌseɪʃən`, `buttinski` `bʌtɪnski`).

    en     56.2% → 57.3%      en-GB  47.3% → 48.2%

⚠ It hides nothing contrastive: English has no `ʌ`/`ə` minimal pair independent of stress — and that
was checked on the data rather than left as a linguistic argument. Folding `ʌ` to `ə` collapses **zero**
referee readings onto each other and **zero** of ours: no two words anywhere in either side become
indistinguishable. A fold that erased a real contrast would show up as a collision, and there is none.

### ⚠ Rejected: cot–caught `ɔ` → `ɑ`

38 rows, skewed 31:8 toward the referee writing `ɑ` where we write `ɔ` — which looks like a merged
referee against an unmerged engine, and therefore like a fold.

**It is not.** The referee writes `ɔ` in **312 of its 4,558 rows (6.8%)** against `ɑ` in 610 (13.4%).
It records the distinction; it just assigns ~38 words differently from us. Folding would hide a
genuine LEXICAL disagreement — which word belongs to which set — behind a notational one.

⚠ The lexical sets could not be tested directly, which is worth recording: `caught`, `bought`, `law`,
`cot`, `pot`, `hot` are not in this referee at all. Of 40 THOUGHT-set probes, **one** was present.
A 4,558-row corpus of rare and proper words cannot answer a question about the common core, and the
overall `ɑ`:`ɔ` ratio had to stand in for it.

### The rest are not rule-shaped

`i`/`ɪ` (39:19), `æ`/`ɑ` (18:14) and initial `æ`/`ə` go both ways on OOV proper nouns and foreign
names — the tagger guessing, not a convention gap. The `-s`/`-z` eleven are the tagger voicing a final
`s` on classical names (`Mimas` → *maɪməz); real, but eleven rows and no discriminator short of a
name lexicon.

## Run 6 — 2026-09-17 — marking the intentional classes, and why the marker must be DIRECTIONAL

The classified table left several classes verdicted "intentional" in a document, which is where they
stayed: the tool kept printing them under *"residual divergence classes … investigate"*, so every
re-reading of the output re-opened a question that was already closed.

`RefLang.intentional` declares them, and the eval reports a **second number** beside the first:

    folded backbone: 2331/4070 (57.3%)   — after the config folds
      +intentional:  2401/4070 (59.0%)   — plus 70 rows in a declared-intentional class

⚠ **THE BARE NUMBER STAYS BARE.** `folded` is what every floor and every measurement in this repo is
set against; moving it would silently restate the history. The second line answers a different
question — how much of the residual is known-not-a-defect — and both are printed so neither can be
mistaken for the other.

### ⚠ It is NOT a fold, and the reason is worth the mechanism

A fold rewrites BOTH sides, so it asserts the two notations mean the same thing. For the weak vowel
that is **true in one direction and false in the other**:

    referee `ə` / ours `ɪ`    UK 82.3%  US 72.3%  back US      ← intentional
    referee `ɪ` / ours `ə`    UK 87.0%  US 82.4%  back the REF  ← a real defect

Measured on this referee, the two directions are **70 and 137 rows**. A `ə`↔`ɪ` fold would have
credited us for **137 of our own errors** — the class #1326 and #1330 exist to fix — and raised the
score for it. So each entry rewrites the REFEREE's string only, and the reverse pairing stays a miss.

### ⚠ And positionwise, not a global replace

The first implementation rewrote every `ə` in the referee's string. That also rewrites the ones where
we *also* have `ə`, breaking rows that would otherwise match: it credited **34** rows where the honest
test credits **70**. The rule is that every position where the two DIFFER must be a declared pair, and
every position where they agree is left alone.

### What is NOT declared

`ɔ`/`ɑ` was tested for this and refused — see Run 5. Declaring it would have been the same error as a
bidirectional fold, in a different costume: marking a lexical disagreement, where neither side has
been shown right, as a thing we meant to do.

### What this leaves

    1,739 disagreements
       70  declared intentional — closed
      137  the reverse weak-vowel pairing — REAL, and the class #1326/#1330 have been shrinking
    1,532  everything else, of which ~57% is OOV vocabulary no third source can adjudicate


### Review of the mechanism — two fixes

⚠ **THE DECLARATION WAS COMPILED TO A `RegExp` AND ONLY ITS `.source` WAS READ.** That worked for `ə`
by accident and would have failed silently for anything else — a `refHas` of `[əɐ]` would have compiled,
loaded, matched nothing, and reported an empty class, which is indistinguishable from a class that
turned out not to exist. Now plain strings, **validated at load to be one character on each side**, with
a throw rather than a silent pass: the positionwise comparison cannot honour anything longer.

⚠ **AND THE SEMANTICS ARE PINNED BY TEST, not by prose** — that the pair is declared one way only, that
the reverse is absent, that `ɔ`/`ɑ` is absent, that every entry is a single character, and that `en` is
the only language declaring any. The failure this guards is silent and flattering: a bidirectional
version credits 137 of our own errors and raises the reported number for it.

## Run 7 — 2026-09-17 — ten undetermined divergences, diagnosed one at a time

**913 of the 1,736 disagreements (53%) have no gold entry at all**, so no third source can adjudicate
them and they had been left as a single undifferentiated bucket. Ten were taken by deterministic
stride (not chosen) and diagnosed individually. They do not all have the same cause, and one of them
was a bug in this repo's own instrument.

| | word | referee | ours | diagnosis |
|---|---|---|---|---|
| 1 | `ACOG` | `eɪkɑɡ` | `əkʰˈɔːɡ` | **our dict row is wrong**: `AH0 K AO1 G` reads "uh-KOG"; it is an initialism said "AY-kog". Belongs in `acronymLetters` or as a curated row |
| 2 | `Francesca` | `fɹænsɛskə` | `fɹænt͡ʃˈɛskə` | **we are right.** The dict has `CH` (`F R AE0 N CH EH1 S K AH0`) and fran-CHES-ka is the English reading of the Italian name; the referee's `s` is a spelling pronunciation |
| 3 | `Ortiz` | `ɔɹtis` | `ɔːɹtˈiːz` | **both attested.** `AO2 R T IY1 Z` gives /z/, which is the usual American reading; the referee's /s/ is Spanish-faithful |
| 4 | `Yauch` | `jaʊk` | `jˈɔːt͡ʃ` | **we are wrong**, and it is the dict row: `Y AO1 CH`. German ⟨au⟩+⟨ch⟩ is /aʊk/ |
| 5 | `atishoo` | `ətɪʃuː` | `ˈæt̬ɪʃˌuːˌuː` | ⚠ **a real defect — the tagger emitted a DOUBLED `uː`.** Malformed, not a variant |
| 6 | `crowner` | `kɹaʊnə` | `kɹˈaᶷnɚ` | ⚠ **AN RP ROW THE EXCLUSION MISSED — a bug in #1328**, fixed in this run. See below |
| 7 | `gasahol` | `ɡæsəhɑl` | `ɡˈæsəhˌɔːɫ` | cot–caught, the class Run 5 refused to fold because it is lexical |
| 8 | `mecamylamine` | `mɛkəmɪləmiːn` | `məkʰˈæmɪlˌæmˌaᶦn` | the tagger on a drug name — stress and two vowels wrong. OOV letter-to-sound, no rule |
| 9 | `projectivize` | `pɹɑdʒɛktɪvaɪz` | `pɹəd͡ʒˈɛktəvˌaᶦz` | the declared weak-vowel convention plus initial-vowel reduction. Not work |
| 10 | `suevite` | `sweɪvaɪt` | `sˌuːvˈaᶦt` | **we are wrong**: ⟨ue⟩ as /weɪ/ in a German loan. OOV, lexical |

    we are right                     1      the referee is odd or Spanish/spelling-faithful
    both attested                    1
    we are wrong, lexically          3      Yauch, suevite, mecamylamine — OOV or a bad dict row
    a real malformedness defect      1      atishoo's doubled uː
    an INSTRUMENT bug                1      crowner
    already-declared convention      2      gasahol, projectivize
    a dict row to curate             1      ACOG

**The bucket is not one thing.** A third of it is us being wrong on loanword letter-to-sound with no
rule available; a fifth is convention already accounted for; and one in ten was the measuring
apparatus rather than the engine.

### ⚠ The instrument bug: an onset `r` masked a non-rhotic coda

`crowner` is transcribed `kɹaʊnə` — non-rhotic, an RP row in a file labelled GenAm, exactly what
#1328's second rule exists to drop. It survived because that rule's `ipaLacks` scans the WHOLE string,
and `kɹaʊnə` contains a `ɹ` — the onset of `crowner`. The test asked "is there a rhotic anywhere" when
it meant "is there one where the spelling puts it".

Fixed with a companion rule: spelling ends in a word-final `r` (a silent `e` or an `-ed` allowed) and
the IPA has **no rhotic in its last three symbols**. 18 further rows, **17 of which the en-GB referee
carries with a byte-identical reading** — the same validation standard as #1328.

⚠ `-s`/`-es` after the `r` is deliberately NOT allowed. There the `r` is usually the onset of the next
syllable and is pronounced, so `Pescadores` `pɛskədɔːɹiːz` — correct GenAm — would have been dropped.
Measured: allowing it adds one row and one false positive.

    excluded 488 → 506      folded 57.3% → 57.6%      +intentional 62.4% → 62.7%

## Run 8 — 2026-09-17 — working the divergences serially, and finding the defect is in the DICTIONARY

Instruction: go through the wikipron divergences one at a time and fix each — correct the data, change the
rule, mark it intentional, or add a lexical entry, whichever is right — fixing a whole class when one turns up.

    npx tsx .scratch/ref7/dump.mts     # reproduces eval.ts's scorer exactly, per-row, + gold arbitration
    total 4052  folded 2334 (57.6%)  intentional 205  divergent rows 1718

### The first three rows bought a rule, and it was score-neutral

`A` / `a` / `x` are single-character headwords. The referee has six of them and **does not have a fixed
semantics for the class**: `m` ɛm, `p` piː, `q` kjuː, `a` eɪ are the letter's NAME, while `x` ks is the
letter's SOUND. A row whose meaning is not constant within the file cannot arbitrate a reading, so all six
are excluded. Three of the six were already passing, so `folded` moved by 0.01pp — which is the honest sign
this was not score-hunting. What it removes is three PERMANENT divergences: `x` we read `ɛks` and gold agrees
(the referee is simply wrong), and `A`/`a` we read as the reduced article DELIBERATELY, because a bare capital
`A` in running text is overwhelmingly sentence-initial and a determiner.

### Then the queue was split, because copying a referee row into our dict is CIRCULAR

    divergent rows      1,714
      in g2p-dict.tsv     429   ← we have an answer and still disagree: a real defect, or a referee error
      OOV                1,080  ← genuine letter-to-sound error on unseen words

For an OOV rare proper noun the referee is the ONLY source, so "add it to the lexicon" would copy the
instrument into the engine and then score against the instrument. The 429 recorded rows are the non-circular
slice and were worked first.

### ⚠ THE FINDING: `ours` == `dictIPA` in essentially every recorded row

Enriching each row with its ARPABET and rendering that row through our own converter shows our rules
reproducing the dictionary faithfully. **The divergences are not rule defects. They are bad upstream CMUdict
rows.** Arbitrated against misaki gold (independent of wikipron, and the lexicon Kokoro was trained on):

    gold backs US, referee is wrong        185   43%   nothing to fix
    gold backs the REFEREE, we are wrong    81   19%   ← a verified correction each
    three-way disagreement                  80   19%
    no gold entry                           83   19%

Each of the 81 was produced by a converter (gold IPA → ARPABET) and then **verified by round-trip**: the
candidate is rendered back through this repo's own `makeArpabetToIpa` and required to fold-equal BOTH gold and
wikipron. Nothing was guessed. Examples: `writhe` ɹˈɪθ → ɹˈaᶦð, `herbaceous` ɚbˈeᶦʃəs → hɚbˈeᶦʃəs (no `h`),
`interpolate` ɪtʰˈɝpəlˌeᶦt → ɪntˈɝpəlˌeᶦt (no `n`), `segue` sˈɛɡ → sˈɛɡwˌeᶦ, `laugher` lˈɑːkɚ → lˈæfɚ.

### Three of the 81 were REJECTED, and the reason generalises

- **`majority`** AO1→AA1. Two sources agreed, and it is still wrong: gold's OWN `-ority` family is
  `ɔ` in all five other members (`minority`, `authority`, `priority`, `sorority`, `seniority`). Gold is the
  outlier here, not us. **Family consistency beats two-source agreement on a single row.**
- **`gluttonous`** → `G L AH1 T N AH0 S` renders a VOWELLESS `tn` with no syllabic mark — worse for a TTS
  than the 3-syllable reading we already had, referee agreement notwithstanding.
- **`exploit`** is in the POS-gated heteronym block. Its bare-word citation correctly defaults to the noun;
  the referee gives the verb. Not a defect.

### And the accepted ones are backed by a THIRD line of evidence: our own dict contradicts itself

Every low-vowel swap was checked against its morphological family, and in every case **our row was the
outlier and the correction makes our dictionary self-consistent**:

    meritocracy  AO1 → AA1    every other -ocracy in our dict is AA1 (democracy, autocracy, theocracy)
    astronaut    AA2 → AO2    juggernaut, argonaut, aeronautics are AO2
    tongs        AA1 → AO1    tong, long, song, wrong, prong, thong are AO1
    snowfall     AA0 → AO2    rainfall, football, waterfall, windfall are AO2
    foreskin     OW1 → AO1    forehead, forecast, foresee, forearm, foreword are AO1 R
    seaworthy    AO2R → ER2   noteworthy, trustworthy, praiseworthy, worthy are ER
    caudal       AA1 → AO1    audit, caudle are AO1

⚠ **The corrections go in BOTH directions** (AA→AO and AO→AA), which is what says this is per-word CMUdict
error rather than a systematic bias one fold could absorb.

### The family check then found more instances the referee never covered

    Wednesday  W EH1 N Z D IY0 → D EY2   and gold is UNANIMOUS across all 12 `-day` words (`dˌA`)
      → our dict was SPLIT: thursday/sunday/yesterday/birthday/holiday/someday/doomsday already EY2,
        monday/tuesday/friday/saturday still IY0. Four more corrected. High-frequency words.
    writhed    R IH1 TH D → R AY1 DH D   (`writhing` was already right — the dict contradicted itself)
    virulence  missing the Y that `virulent` has;  insularity missing `insular`'s;  debriefing vs debrief
    annul      AE1 N AH0 L → AH0 N AH1 L — and THIS is why `annulled` could not propagate

`test/english.test.ts` was asserting `wˈɛnzdi` on one line and `θˈɝzdˌeᶦ` on the next — both halves of
CMUdict's own split, pinned as if both were intended.

### Total, and the measured effect

    88 dict rows corrected + 1 acronym row (acog EY1 K AA0 G, "AY-kog" not "uh-KOG")
    folded 57.6% → 59.6%      +intentional 62.7% → 64.6%

## Run 8b — the full dict-vs-gold audit, and two instrument bugs in it

Having found the defect class is dictionary rows, the obvious next instrument is to stop waiting for wikipron
to cover a word. `.scratch/ref7/audit.mts` compares EVERY g2p-dict.tsv row gold also carries, rendering **both
sides through our own converter** so house conventions (ᵻ, syllabics, ʲ, flaps, ɝ) cancel:

    compared 36,036 dict rows against gold
    agree (folded): 28,804 (79.93%)      disagree: 7,232

⚠ **~2,244 of the 7,232 is DECLARED CONVENTION, not defect**, and reporting the raw number would repeat
exactly the error Run 1 was about:

    unstressed X→AH0 (the weak-vowel / reduction convention)   2,109
    R→ER0   (the -ire class, decided the OTHER way by #1289)       65
    SH→CH   (gold's /nʃ/→/nʧ/ affrication)                         47
    +HH     (wh-: the wine/whine merger; ours is mainstream GenAm)  23

⚠ **AND THE AUDIT ITSELF HAD THE #1334 BUG AGAIN.** The en config folds OUR `ʲ` away (it has no referee
counterpart) but gold writes the same hiatus glide as a full `j`, which survived — so `hawaiian`, `tortilla`,
`flamboyant`, `reunion` all scored as a MISSING `Y` when we already emit the glide. Fixed by folding a
POST-VOCALIC `j` only: a `j` after a consonant is a real yod (`pjuːmə`, `mjuː`) and folding that would have
hidden the one genuine defect in the bucket. 21 phantom rows.

### The `+Y` bucket was three unrelated things, and gold is WRONG in the largest

| slice | verdict |
|---|---|
| hiatus glide (`hawaiian`, `tortilla`, `flamboyant`, `reunion`) | the fold artifact above — not a difference |
| yod after a CORONAL (`pursued`, `issued`, `subduing`, `dueled`, `maneuvered`, `nucleonic`) | **gold is wrong for GenAm** |
| yod after a LABIAL (`puma`, `mu`, `barbuda`) | **ours to fix** — 3 rows, applied |

⚠ **Gold contradicts itself on the coronal slice, which is what settles it.** The BASE forms drop the yod
exactly as GenAm requires — `pursue` pəɹsˈu, `issue` ˈɪʃu, `subdue` səbdˈu, `duel` dˈuəl, `maneuver` mənˈuvəɹ,
`student`, `tuna`, `nude`, `news` — and only the INFLECTED forms carry it. Yod-dropping after coronals is the
defining GenAm feature; we are right and gold's inflected rows are its own defect.

The labial slice is the mirror image: **every** labial+UW word in our own dict already has the `Y` (music,
mute, beauty, bugle, fuel, cube, pew, mule, computer, putrid, pubic, humid, fume) and only those three lacked it.

### What the audit is FOR, and what it is not

It is the map for non-circular work on the 1,080 OOV rows — a word absent from wikipron can still be
arbitrated by gold plus its own morphological family. It is NOT a licence to apply 7,232 edits: `majority`
and the coronal yods are both cases where a bulk apply would have written a defect in. The remaining large
classes, each needing the family/merger treatment before anything is touched:

    AA↔AO both directions   ~370   cot–caught/PALM; lexical, per-word (Run 5 refused to fold it)
    ±AH0 syllable           ~209   mixed: real epenthesis vs gold's syllabics
    AE1→EH1                   48   the marry–merry merger — a DIALECT DECISION, not 48 silent edits
    S→Z                       54   lexical voicing (-sive/-sic)
    Y→IY0 / +IY0              43   the Bayesian/Macedonian class, partly real
    AE1→EY1                   24   real
    EH1→IY1                   20   real

### Structural consequence for the curation gate

`test/en-curation-gap.test.ts` went from 3 known gaps to 17. That is not rot: the model trains on UPSTREAM
CMUdict, so a corrected word with no morphological handle has only the n-gram, and the n-gram learned the row
we corrected. Four words LEFT the list during this run by having their stem corrected too (`annulled`,
`writhed`, `insularity`, `debriefing`) — the list working as designed. The remedy is named in the test and is
NOT "add to the list": train the model on the curated dict. Deliberately not bundled here, because it is a
model regeneration that moves held-out accuracy, the parity goldens and the referee floors.

## Run 8c — the single-source bucket, and a categorical rule CMUdict violates

### 83 recorded divergences have no gold entry — so the SECOND referee file was used as the second source

wikipron US alone is one source, and this repo's standard is ≥2. `en-gb.wikipron-uk.tsv` is an independent
file, already used in #1328/#1334 to validate row exclusions. Of 15 candidates read individually, **all 15
were corroborated there**:

    Aba       EY2 B IY2 EY1 → AA1 B AA0      ⚠ our row SPELLED IT OUT, "A-B-A", for a Nigerian city
    Acuff     AH0 K AH1 F   → EY1 K AH0 F
    Crichton  K R IH1 CH T AH0 N → K R AY1 T AH0 N    a spelling pronunciation
    Dagenham  …N HH AE2 M   → …N AH0 M       British placename -ham is /əm/
    Der       D ER1         → D EH1 R        the German article
    Eamon     IY1 M AH0 N   → EY1 M AH0 N
    FIDE      F AY1 D       → F IY1 D EY0
    Hulme     HH AH1 L M    → HH Y UW1 M
    ideal(s)  AY0 D IY1 L   → AY0 D IY1 AH0 L    a syllable was missing outright
    bridie, gaz, inga, honda, doldrum(s)

And the family check kept paying: `honda` was `AO1` while `hondas` was `AA1` **and** ended in `S`;
`ideal`/`ideals` were both short a syllable; `doldrum`/`doldrums` both had `OW1`.

### ⚠ THE PLURAL-VOICING CLASS: a categorical rule, and 96 candidate violations

`hondas` ending in `/s/` is not a variant — English plural `-s` is `[z]` after any voiced segment, with no
dialect that does otherwise. Searching the dict for it needed two tries:

- **First attempt found 2,137 rows and was nearly all false positives.** The filter was "final `S` after a
  voiced segment, spelled `-s`", which catches `abacus`, `acropolis`, `aegis`, `alias`, `adventurous`,
  `acrimonious` — Greek/Latin stems where the `s` is not a morpheme at all.
- **The real test is morphological**: the word minus `-s` must itself be a dict row AND its phones must be
  our phones minus the final `S`. That gives **96**.

Those 96 then split on a distinction no phonological test can make — is the `-s` an English plural, or part
of a Spanish/Greek name? Gold covers only 10 of them, and **the 7 it keeps as `/s/` are exactly the names**
(`atlas`, `dallas`, `kiwanis`, `pallas`, `salinas`, `santos`, `vegas`), which is a clean confirmation that the
distinction is real and that gold tracks it. 23 unambiguous English common-noun plurals were corrected
(`gerbils`, `synonyms`, `orbitals`, `tubers`, `marsupials`, `persecutions`, `replicators`, `cads`, …);
every `-os`/`-as` row where name-vs-plural was a judgement call was LEFT ALONE.

### Where this leaves the numbers

    folded         57.6% → 59.9%        +intentional 62.7% → 65.0%
    ONNX-less path 50.0% → 53.4%        (lexicon-level, so BOTH paths move — see the floor comment)
    dict rows corrected: 330

⚠ The `en` floor was RAISED 0.47 → 0.50, for the Run 4 reason: 0.47 against a 59.8% sampled measurement is
not a margin. It cannot track the shipped number — 0.59 would fail every ONNX-less checkout — so it is set
3.4pp under the degraded path, which is the property the floor exists to have.

### A note on what the EH0 class cost, and why it was not declared

Correcting the unstressed prefix lost ~6 wikipron rows, because on this class the two references genuinely
differ: for `enhance`, `extravagance`, `forceps`, `existence` our output is now **byte-identical to gold**
and it is wikipron that writes the full `ɛ`. That is an honest trade (187 gold-and-family-consistent rows for
6 wikipron rows) and it is deliberately NOT hidden behind an `intentional` declaration. A positionwise
`ɛ`→`ɪ` entry would credit 10 rows, and **3 of them are not this class at all** — `armet`, `handegg`,
`pomerium`, where the `ɪ` is in a non-initial syllable and is simply wrong (`handegg` is hand+egg and we read
`hˈændɪɡ`). The `intentional` mechanism is single-character and cannot see position or stress, so declaring
it would mark three of our own errors correct — the exact trap the config's cot–caught note warns about.

⚠ `handegg` is a real finding from that check and is NOT fixed here: a compound whose second element lost
its vowel quality. Left for the compound-decomposition pass.

## Run 8d — the doubled-vowel malformedness: the fix that was obviously right and wasn't

Run 7 reported `atishoo` → `ˈæt̬ɪʃˌuːˌuː` as "a real defect — the tagger emitted a DOUBLED `uː`". Taken here.

### First: it is NOT in the dictionary path at all

    accent-lexicon.tsv    124,931 rows    doubled adjacent identical segment: 0
                                          rhotic doubling (ɚɹ/ɹɚ/ɝɹ):          0

Completely clean. So the class is purely an OOV artifact. Over the whole referee:

    4,558 words (2,489 OOV) — doubled segment 13, rhotic doubling 3

Small (0.35%), and the 16 rows sort themselves immediately: ~11 malformed, 5 legitimate. The legitimate
ones are real cross-morpheme clusters — `shortchange` ʃɔːɹtt͡ʃeᶦnd͡ʒ (`T` then `CH`), `interrelationship`
ɪntɚɹileᶦʃənʃɪp and `unterrific` (`ER0` then `R`, "inter"+"rel", "un"+"terrific"). Those must not move.

⚠ And **every one of the 11 malformed is a VOWEL DIGRAPH**: `anteroom`/`atishoo`/`Botwood` ⟨oo⟩,
`gaywad`/`sinamay` ⟨ay⟩, `Yenisei` ⟨ei⟩, `goddaughter` ⟨au⟩, `bourgeoisify` ⟨ou⟩, `sulliage` ⟨ia⟩. The
tagger emits one ARPABET chunk **per character** with no global constraint, so both letters of a digraph can
be tagged with the vowel. Not a compound-seam problem at all — the first hypothesis, and wrong.

### ⚠ THE OBVIOUS FIX IS WRONG, AND THE DICTIONARY IS WHAT SAYS SO

`collapseGeminates` already runs on this path and exempts vowels:

    if (out[out.length - 1] !== p || vowels.has(dropStress(p))) out.push(p);

The exemption is what lets the doubling through, and removing it looked correct — especially because
**`tools/english/en_g2p_ngram.ts` HAS ITS OWN COPY WITH NO EXEMPTION**, whose comment asserts the collapse is
*"Lossless vs CMUdict"*. So the change was made. Then the claim was checked:

    dict rows an unrestricted collapse would change: 186   — the trainer's comment is FALSE
      of those, adjacent identical CONSONANT pairs:    91   — correctly collapsed (barroom R R, bookcase K K)
      adjacent identical VOWEL pairs:                  95   — and 89 of them are `ER0 ER0`

`ER0 ER0` is the **`-erer` agentive**: `acquirer` AH0 K W AY1 ER0 ER0, `adventurer`, `gatherer`, `deliverer`,
`emperor`, `conqueror`. There the stem's /ər/ meets the suffix's /ər/ and collapsing **deletes a syllable** —
`acquirer` becomes `acquire`. The original author's one-line reasoning ("that would delete a nucleus/syllable")
was exactly right, and the change was reverted.

⚠ **This also means the trainer and the shipped engine disagree about post-processing** — the model's
held-out numbers were measured against a chain that does not ship. Recorded in the test and NOT fixed here,
because closing it means retraining.

### The fix that works, and the test that distinguishes the two classes

The guard belongs in the tagger, where the alignment still exists, and keys on the one thing that separates a
digraph from an agentive: **the two copies must come from ADJACENT VOWEL LETTERS.** `-erer`'s two `ER0`s come
from letters two apart with a consonant between them, so it can never fire; ⟨oo⟩'s come from k−1 and k.

⚠ **It had to match the vowel BASE, not the whole phone.** A digraph's two copies usually carry DIFFERENT
stress digits — `gaywad` tags EY2 then EY0, `Yenisei` EY2 then EY1 — so byte-equality (what the shared
collapse uses) caught only 4 of the 11. Base-matching catches all of them, and the **stronger** of the two
marks is kept, or `Yenisei` loses its primary and `enforceSinglePrimary` then puts the tonic somewhere
arbitrary.

    anteroom   ˈæntɚˌuːˌuːm → ˈæntɚˌuːm       gaywad   ɡˌeᶦeᶦwˈɑːd → ɡˌeᶦwˈɑːd
    atishoo    ˈæt̬ɪʃˌuːˌuː → ˈæt̬ɪʃˌuː       Yenisei  jˌɛnɪseᶦˈeᶦ  → jˌɛnɪsˈeᶦ
    doubled segments over the referee: 13 → 4

The 4 left are the 3 legitimate ones plus `goddaughter`, where the model put the vowel chunk on the second
⟨d⟩ — a consonant letter — so the guard correctly declines. Relaxing it to "at least one vowel letter" would
collapse `acquirer`, so the residue is accepted and named.

⚠ **THE REFEREE SCORE DOES NOT MOVE** (59.9% before and after) and that is the point: these words differ from
the referee in other ways too, so the metric cannot see the repair. A doubled vowel is an audible stutter in
a TTS. This is the case for not letting the instrument decide what counts as a defect.

### False-positive check, since the guard is heuristic

Every word where adjacent vowel letters are LEGITIMATE was read and is untouched, because in all of them the
two letters produce two DIFFERENT vowels, which base-matching never fires on:

    cooperate koᶷˈɑːpɚˌeᶦt   reelect ɹiʲɪlˈɛkt    preeminent pɹiʲˈɛmənn̩t   zoology zoᶷˈɑːləd͡ʒi
    Hawaii həwˈaᶦiː          Kauai kʰˈaᶷˌaᶦ       continuum kəntˈɪnjuːəm    vacuuming vˈækjuːmɪŋ

And a real acronym never reaches the tagger — `IEEE` is spelled out by the initialism pass into four tokens
(`aᶦ ˈiː ˈiː ˈiː`) before G2P. The only fleet movement was 8 Arabic-variant goldens sharing one embedded
English token: `Eee` (the ASUS Eee PC), `ˌiːʲˌiːʲəˈiː` → `ˌiːʲəˈiː` — one fewer spurious syllable in a
3-letter brand name.

## Run 8e — LOT–THOUGHT: the engine was neither accent, and the convention note said so wrongly

Working the AA↔AO class (the largest left in the dict-vs-gold audit) started as 293 single-op rows and turned
into a design finding.

### The documented convention was false

`english.jsonc` declared `"merge": "LOT–THOUGHT → ɔː"`. The engine does not merge and never did: `AA` renders
`ɑː`, `AO` renders `ɔː`, two distinct outputs. So whether a given word merged depended entirely on which of the
two CMUdict happened to write — and CMUdict is not consistent:

    cot   kʰˈɑːt      caught  kʰˈɑːt      ← IDENTICAL (both AA): merged
    lot   lˈɑːt       law     lˈɔː        ← DISTINCT
    don   dˈɑːn       dawn    dˈɔːn       ← DISTINCT

**Neither accent.** A merged speaker says `cot`=`caught` AND `don`=`dawn`; a distinguishing speaker says
neither pair alike. We did one of each, per word, by lottery.

### misaki gold is consistent, and it distinguishes

    cot kˈɑt / caught kˈɔt    don dˈɑn / dawn dˈɔn    lot lˈɑt / law lˈɔ    stock/stalk
    odd ˈɑd / awed ˈɔd        hock/hawk               tot/taught           — 7 of 7
    PALM stays ɑ: father fˈɑðəɹ, spa spˈɑ, calm kˈɑm, bra bɹˈɑ

And our dict already agreed with it on **93.1% of the 7,317 AA/AO rows gold covers**. The disagreement was
504 rows — 6.9%, the CMUdict lottery — and aligning them makes the engine a coherent distinguishing GenAm,
which is also the system the downstream Kokoro model was trained on.

⚠ **THE WIKIPRON REFEREE CANNOT ARBITRATE THIS.** It writes `dawn` as `d ɑ n` — merged — in the same file where
it distinguishes elsewhere. That is exactly why Run 5 refused an ɔ/ɑ fold, and it is why **the referee score
does not move at all** (59.9% before and after). Gold agreement moved 80.5% → 81.5%.

### ⚠ 37 rows were dropped, because gold contradicts ITSELF across a family

The `majority` lesson, mechanised. A containment test (one dict word inside another, ≥4 chars, gold's ɑ/ɔ
compared at the shared slot) found gold disagreeing with its own stem:

    cost kˈɔst   but  costlier kˈɑstliəɹ        gloss / glossier      call / callable
    water wˈɔɾəɹ but  waterborne …AA…           wall / footwall       dog / watchdog

⚠ **BOTH members are left alone, not just the derived one.** Rejecting only `costlier` would have CREATED an
inconsistency — `cost` AO beside `costlier` AA — where today they at least agree. 466 rows applied.

### The change had a consequence in en-GB that the parent could not see

`sorry` moved from ɑː to ɔː, and `test/english-gb.test.ts` caught it: RP is /ˈsɒri/ and the accent transform
produced `sˈɔːɹi`. The transform has a set for exactly this class — `lotr`, "LOT before intervocalic r" — but
it matched only `ɑːɹ`, so **7 of its 13 words silently stopped being handled** while the set still listed them.
Widened to `[ɑɔ]ːɹ` in both TS and C#. US /ˈsɔːri/ vs RP /ˈsɒri/ is a real transatlantic split where both
varieties are right and only the mapping between them was missing.

Four other tests pinned the old AA reading and were updated, each confirmed against gold first:
`on` ˌɔn, `coffee` kˈɔfi, `Washington` wˈɔʃɪŋtən, and `palled` (OOV, decodes from `pall`, correctly AA1→AO1).

### The curation gate is now a MEASURE, not a waiver pile

`STRUCTURAL_GAP` is 133 words. Every one is a curated row the model cannot reproduce because it trained on the
row we corrected. The list is meant to COLLAPSE when the trainer is pointed at the curated dict — that collapse
is the test that the retrain worked — and to grow only if curation and the OOV path drift apart.

    folded 59.9% (unchanged — the referee cannot see this axis)
    gold agreement 80.5% → 81.5%      dict rows corrected this run: 466
    C# parity: 189 languages byte-identical, 0 differ

## Run 8f — two more classes taken, and one DELIBERATELY NOT TAKEN

### S→Z (49 rows applied, 4 refused)

Intervocalic and voiced-context /s/→/z/: `diesel`, `Joseph`, `adhesive`, `Medusa`, `mausoleum`, `whimsy`,
`fundraising`, `forensic`, `clumsily`, `plosive`, `masochist`, `Pisa`. Unambiguous.

⚠ **Four were refused because gold produces a PHONOTACTICALLY IMPOSSIBLE cluster**, and they are worth
recording as a demonstrated defect class in gold rather than a one-off:

    installation   ˌɪnztəlˈAʃən      /nzt/
    obstacle       ˈɑbztəkᵊl         /bzt/
    obstetrician   ˌɑbztətɹˈɪʃən     /bzt/
    transcript     tɹˈænzkɹˌɪpt      /nzk/

English does not permit a voiced sibilant before a voiceless stop inside a syllable. ⚠ A general phonotactic
FILTER was considered and rejected: `groundskeeper` ɡɹˈWndzkˌipəɹ, `kingsport`, `williamsport` have exactly
that shape and are CORRECT, because there the /z/ is a plural or possessive morpheme. No test available to
the audit separates them, so the four were excluded by name after reading them.

### Tense vowels AE1→EY1 / EH1→IY1 (41 applied, 3 refused)

`aphid` ˈeᶦfəd, `babel`, `caliph`, `calyx`, `arcana`, `gala`, `status`, `strata`, `stratum`, `instantaneous`,
`acetic`, `amenable`, `egret`, `betel`, `allelic`, `angeleno`, `leisure`, `vegan`, `splenic`, `hematite`.

⚠ **The en-GB referee caught three that gold gets wrong or cannot settle**, which is the argument for always
consulting it even on a GenAm question:

    nematode   gold nˈimətˌOd   but en-GB nɛmətəʊd — and US is /ˈnɛmətoʊd/. Gold is wrong.
    gena       gold ʤˈinə       but en-GB dʒɛnə — genuinely ambiguous as a name. Ours kept.
    lead       gold lˈid        — a HETERONYM, and `lead` is already in the POS-gated block. Not the dict's call.

### ⚠ THE marry–merry MERGER (48 rows) IS NOT TAKEN, AND THAT IS A DECISION FOR THE OWNER

`AE1→EH1` before intervocalic ⟨r⟩: `arrow`, `baron`, `barrel`, `barrier`, `carrot`, `carry`, `carriage`,
`carrier`, `charitable`, `arid`, `arab`, `apparel`, `barricade`, `caraway`.

This looks like the LOT–THOUGHT class and **is not the same case at all**:

| | LOT–THOUGHT | marry–merry |
|---|---|---|
| our dict | **internally inconsistent** (cot=caught but lot≠law) | **internally consistent** — æ throughout |
| gold | internally consistent | internally consistent — ɛ throughout |
| therefore | any coherent choice is an improvement | two coherent systems, and picking one is a DIALECT CHOICE |

There is no defect to point at. Both are real GenAm: the merged system (gold's, and the majority) says
`marry`=`merry`=`Mary`; the unmerged one keeps them apart. It affects very common words and would be plainly
audible. Taking it silently on the strength of "gold says so" would be changing the product's accent under
cover of a data-cleaning pass, so it is left for an explicit decision.

⚠ And one member of the bucket is NOT the merger at all and must not ride along with it if it is ever taken:
`catch` kʰˈæt͡ʃ → kʰˈɛt͡ʃ is the regional "ketch" reading, not a merry-merger effect.

    gold agreement 81.45% → 81.70%     folded 59.8% (flat, as expected on these axes)
