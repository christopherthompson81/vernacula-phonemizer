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

## Run 8g — the loanword PALM class, and two large buckets that turn out to be the house rules

### AE1→AA1: foreign ⟨a⟩ as PALM (38 applied, 17 refused)

`Ghana` ɡˈɑːnə, `kanji`, `Bhutan`, `Pravda`, `Napoli`, `Agra`, `Esperanto`, `Calabria`, `Malaga`, `drachma`,
`padre`, `dal`, `babka`, `Anasazi`, `Nablus`, `Sami`, `Kandahar`, `zaftig`, `graben`, `Caen`, `Montmartre`.

⚠ **The en-GB referee did the arbitration and it split the bucket exactly along naturalisation.** It gives
our `æ` as the first or only reading for every word that has become an ordinary English one, and is silent or
agrees on the genuine loans:

    aqueduct ækwɪdʌkt   aquifer ækwɪfə   aquaculture ækwəkʌlt͡ʃə   anna ænə   malacca məlækə
    scallop skæləp (US too)   barry bæɹi   ab æb   americana lists əmɛɹɪkænə BEFORE əmɛɹɪkɑːnə

Also refused: `mineralogist` (/ˌmɪnəˈrælədʒɪst/ — gold's ɑ is simply wrong) and **`palay`, which would have
REVERTED a two-referee correction made earlier in this same run** — both wikipron files say `pæleɪ`. A bucket
applied wholesale would have undone it silently.

### ⚠ IH0→IY0 (77 rows) IS THE `isBarredI` RULE, NOT A DEFECT CLASS

It looks like a clean class — gold writes a tense `i` where we write `ɪ`/`ᵻ` — and most of it is this repo's
own documented rule, in `englishArpabet.ts`:

    // Latinate reduced prefix be/de/re/se/pre + consonant (believe, decide, review, security → ᵻ)
    if (ni === 0 && /^(be|de|re|se|pre)[^aeiouy]/.test(word)) return true;

`december`, `debunk`, `decentralize`, `deforest`, `denature`, `desegregate`, `destabilize`, `precede`,
`precise`, `precipitating` — all of it is that rule firing correctly. The remainder (`economy`, `ecology`,
`equality`, `egalitarian`, `bailiwick`, `bandicoot`) is free variation: /ɪˈkɑːnəmi/ and /iːˈkɑːnəmi/ are
both ordinary GenAm. **Nothing to fix. Skipped whole.**

### ±AH0 (210 rows) is the syllabic notation plus gold noise

`-AH0` is gold writing the syllabic consonant unmarked — `button` bˈʌt̬ən vs gold `bˈʌtn`, `cotton`,
`certain`, `beaten` — the same axis #1319 and the `preFolds` entry already handle for the referee. `+AH0` is
largely gold being wrong: `athlete` → ˈæθəlˌiːt is the stigmatized "ath-a-lete", and the `-ically`/`-fully`
rows (`chemically` → kʰˈɛməkəli) are the unsyncopated variant where ours is the commoner one. **Skipped.**

### Where the audit stands

    gold agreement 79.9% (start of Run 8b) → 81.81%
    folded 59.8%   ONNX-less 53.4%   dict rows corrected across Run 8: ~990

The single-op buckets are now either taken or classified. What remains is 1,918 two-op and 632 three-op rows,
which are mostly COMBINATIONS of the classes already ruled convention (weak vowel + reduction + syllabic), plus
the declared ones: IH0→AH0 (1,457), IY0/OW0/AE0/AA0→AH0 (~370), R→ER0 (65, decided the other way by #1289),
SH→CH (47, gold's /nʃ/→/nʧ/ affrication). **The productive single-word work on this instrument is done**; what
is left needs either a decision (marry–merry) or a retrain (the 174-word structural gap).

## Run 9 — reviewing the run, and four defects the review found

Reviewing ~950 dictionary corrections. Every finding below was in work already committed.

### 1. ⚠ A DUPLICATE CURATED ROW, from my own apply tooling

`chillicothe` was corrected twice (LOT/THOUGHT, then the loanword final `-e`) and the apply script APPENDS
rather than merges, so the file had two rows whose `upstream` columns chained — the second row's upstream was
the first row's output. `test/en-curation-gap.test.ts` reads the FIRST match, so it compared the shipped dict
against a superseded value and failed with a message about the wrong thing.

A duplicate also makes the file's central claim false: it is "the record that makes an `--emit` recoverable",
and replaying rows in order stops being well-defined once a word has two. **A `no word has two curated rows`
test was added** — the old gate caught this by accident, not by design.

### 2. ⚠ THE STEM FILTER HAD A LENGTH FLOOR, AND SHORT STEMS SLIPPED THROUGH

Run 8e's family check required a dict-word stem of **≥4 characters**, so `on` (2) and `dog` (3) were never
tested. Six families were left internally inconsistent by the LOT–THOUGHT pass:

    on AO1        but  online AA1, onslaught AA1        dog AO1   but  dogbane/dogberry AA1
    resolve AA1   but  resolved AO1                     squash AA1 but  squashed/squashy AO1
    ebonic AO1    but  ebonics AA1                      unabom/unabomb AO2 but unabomber AA2 (cf. bomb B AA1 M)

All made consistent with the base form. `cost`/`costly`/`costlier`/`costliest` were also split — three ways —
and are now uniformly AO1; Run 8e's "leave BOTH alone" rule had preserved a pre-existing inconsistency rather
than fixing it.

### 3. ⚠ THE en-GB CONSEQUENCE: 119 RP REGRESSIONS THE SUITE COULD NOT SEE

This is the big one. A CLOTH word at `ɑː` was converted to RP `ɒ` by the LOT rule (`ɑː(?!ɹ)` → `ɒ`). Moving it
to `ɔː` for GenAm takes it **out of that rule's reach**, and it then needs membership in `en-gb-cloth.tsv`
(`ɔː` → `ɒ`) or RP silently regresses. 124 moved words were CLOTH-shaped and not in the set; the en-GB suite
had a test for exactly two of them (`cost`, `sorry`).

⚠ **Two successive attempts to decide the list were WRONG, and the third is the one to copy:**

1. A spelling heuristic (⟨o⟩, not au/aw/ough) — wrong: `snowfall`'s moved slot is `-fall`, which is THOUGHT.
2. A distance test against the en-GB referee — wrong in a subtler way: it compared RAW strings, so `əᶷ` vs
   `əʊ` and dark `ɫ` vs `l` made the before AND after readings both distance-1 and the test could not
   discriminate. It kept `snowfall`. It also called `toRP(..., lex: undefined)`, i.e. with the lexical sets
   switched off, so it was not measuring the shipped pipeline at all.
3. **Write the candidates into the file, run the REAL `phonemizeWord`, and fold with the en-GB referee's own
   folds.** 119 added; 5 rejected — `snowfall`, `thorium`, `waldo`, `mekong` (the referee has `ɔ` there) and
   `quahog` (the referee's `ɒ` is on the SECOND syllable, `kwɑhɒɡ`, and the cloth rule replaces the FIRST `ɔː`).

The same first-`ɔː` limit is why `forgone` fɔːɡˈɔːn, `sorbonne`, `waterlog` and `waterlogged` are excluded:
their first `ɔː` is NORTH, and the rule would change the wrong vowel.

    cost kʰˈɒst   sorry sˈɒɹi   coffee kʰˈɒfi   soft sˈɒft   dog dˈɒɡ   long lˈɒŋ      ← CLOTH, ɒ
    caught kʰˈɔːt   law lˈɔː   snowfall snˈəᶷfˌɔːɫ   thorium θˈɔːɹiəm                 ← THOUGHT, ɔː

### 4. ⚠ MY OWN REVIEW DELETED 28 CURATED ROWS

While resyncing the curated record after fix #2, the second version of the script dropped its `if w in pre`
guard. For a PRE-EXISTING curated row the shipped dict already holds the curated value, so the test
"dict equals the pre-PR dict → this row is obsolete, drop it" fired on **every one of them** — `acc`, `gdp`,
`gps`, `beyond`, `research`, `was`, the whole `-ative` family, all 28 silently deleted.

The gate caught it, and caught it precisely: `KNOWN_GAPS` still listed `collaborative`, `research` and `was`
while the live set no longer did, because their rows were gone. Restored, and the invariants now checked
explicitly: 948 changed dict rows, 976 curated records, no duplicates, every `want` equal to the shipped dict,
every changed row recorded, every PR-added row's `upstream` equal to the pre-PR dict.

⚠ **Both #1 and #4 are the same underlying mistake** — writing a data file with a script that reasons about
"what should be here" instead of merging into what IS here. The lesson the file itself should carry.

### Final state

    tests 5,971 pass / 308 files      goldens 0 stale      package fence ok
    folded 59.8%   ONNX-less 53.4%    en floor 0.50, en-GB 0.44 (measured 59.8% / 47.5%)
    948 dict rows corrected, 976 curated records, 119 en-gb-cloth additions

## Run 10 — a dropped /r/ is a well-formedness defect, and it has its own gate now

Second round on the dict-vs-gold audit, after #1334 merged.

### ⚠ THE FINDING: 30 dictionary rows were missing an /r/ the spelling puts there

The audit's `+R` bucket looked unpromising — 25 rows — and split into two things that are not alike:

    20 rows   gold writing a GEMINATE ɹɹ      irrelevant ɪɹɹˈɛləvənt, irrevocable, forerunner
     5 rows   a genuinely DROPPED /r/          housewarming hˈaᶷswɔːmɪŋ, marjoram mˈɑːd͡ʒɚəm

English has no geminate consonants, so the first 20 are gold's error and our single `ɹ` is right. But the
second group prompted a dict-wide sweep, and the right query took two tries:

    rows with FEWER R/ER than spelled ⟨r⟩        1,898   ← useless: ⟨rr⟩ legitimately maps to ONE /r/
    rows spelled with ⟨r⟩ and NO rhotic AT ALL      45   ← the real signal

Of the 45, **16 are legitimately r-less and each names an orthographic rule**: French ⟨-ier⟩ is /jeɪ/
(`dossier`, `olivier`, `bouvier`, `gaultier`), Polish ⟨rz⟩ is a single /ʒ/ (`andrzejewski`, `drzewiecki`),
and `mrs` is an abbreviation gloss for "missus". The other **29 are CMUdict simply dropping the /r/**:

    backstreet  B AE1 K S T IY2 T          housewarming HH AW1 S W AO2 M IH0 NG
    forgings    F AO1 JH IH0 NG Z          kardashian   K AA1 D AH0 SH EY2 N
    chandeliers SH AE2 N D AH0 L IH1 Z     pleomorphic  P L IY2 AH0 M AO1 F IH0 K
    centrality  S EH0 N T AE1 L IH0 T IY0  commissars   K AA1 M IH0 S AA0 Z

8 are confirmed by misaki gold and were applied from the round-trip-verified candidates; the other 22 are
repaired from the SPELLING, which fixes the insertion point exactly — the ⟨r⟩ says where the phone goes.
This is a well-formedness repair, not a choice of reading, which is why it needs no reference.

⚠ **`test/en-missing-rhotic.test.ts` makes it a permanent gate**, written as an ALLOW-LIST rather than a
count: every exception names the rule that licenses it, and a new r-less row is a defect until someone
argues it onto the list. The list is also checked for rot, the failure mode #1334's waivers demonstrated.

### The French -age/-ige class: the en-GB referee split it, 4 of 10

Gold disagrees with us in BOTH directions on ʒ~dʒ, and the en-GB referee settles each:

    backs OURS  barrage bæɹɑːʒ, camouflage kæməflɑːʒ, doge dəʊdʒ, luge luːdʒ, prestige pɹəstiːdʒ
    backs GOLD  beijing beɪdʒɪŋ, fuselage fjuːsəlɑːʒ, loge ləʊʒ   (+ taj, uncovered but unambiguous)

### ⚠ AND A CLASS WHERE THE en-GB REFEREE MUST NOT BE USED

`AA1→AE1` (31 rows: `nevada`, `khaki`, `samba`, `soprano`, `dramatize`) is PALM-vs-TRAP in loanwords, and
British and American genuinely differ there — en-GB says `nɪvɑːdə` and `kɑːki` where GenAm says `nəvædə`
and `kæki`. Using it as an arbiter here would import the wrong variety, so its verdicts were discarded for
this class. The US wikipron file is silent on nearly all 31.

That leaves gold alone, on exactly the kind of word where gold's error rate is demonstrated (`majority`,
`nematode`, `barry`, `malacca` were all caught earlier). **Only 11 were applied** — the common words where
the US reading is not in doubt (`dramatize`, `nevada`, `soprano`, `quadratic`, `xanadu`, `consonantal`,
`nano`, `rando`, `swanky`, `wank`, `wanker`). The other 20 are recorded as gold-only and unarbitrable.

### Tooling change carried forward from the #1334 review

`apply.mts` now MERGES into the curated record instead of appending: a word corrected in two passes keeps
ONE row whose `upstream` stays the ORIGINAL CMUdict value. That is the defect the review found, fixed in
the tool rather than only in the data.

    gold agreement 81.91% → 81.97%     dict rows this round: 45
    tests 5,973 pass / 309 files   goldens 0 stale

## Run 11 — a THIRD source, and what it says about the ~1,000 corrections already made

Asked whether the remaining divergences are unfixable for lack of a source, or fixable and being left. The
answer turned out to be both, in different proportions than I had been reporting — and the search for a third
source found one.

### The survey: almost every open English lexicon is circular with something we already use

| candidate | verdict |
|---|---|
| ipa-dict (open-dict-data) | its README: en_US is "based on a modified version of **cmudict-ipa**" — circular with our dict |
| falkreon/ipa-dictionary | "adapted from Wikipedia" — circular with our referee |
| HuggingFace pronunciation sets | Wiktionary dumps or audio corpora |
| espeak-ng | rule-based, GPL, deliberately excluded by this engine's cleanroom posture |
| **Moby Pronunciator II** | **177,267 words, independent of both, and public domain** |

⚠ **THE LICENSE NEEDED CHECKING TWICE.** The GitHub mirror bundles the ORIGINAL 1993 readme — *"licensed,
not sold … may not be copied in whole or part"* — which is superseded. The Gutenberg edition (eBook #3205)
carries the author's later grant: **"Public Domain material by grant from the author, January, 2001."**
Nearly proceeded on the mirror's text without reading it. ⚠ That Gutenberg package also BUNDLES cmudict 0.3
separately; only `mobypron.unc` is used, or the "third source" would have been our own dictionary.

### Validating the converter before trusting it

Moby's notation is its own (`/@/ /[@]/ /oU/ /dZ/`, `'`/`,` stress, `//Oi//` for OY). The mapping is validated
by measuring agreement with CMUdict on the 35,227 shared words — a wrong mapping would score near zero:

    raw segmental                                  56.4%
    + modernised (FORCE/NORTH merger, yod coalescence)   57.8%

⚠ **Moby is a PRE-MERGER, CONSERVATIVE lexicon** and the validation is what showed it: 694 rows where it
writes `OW R` against CMUdict's `AO R` are `aboard`, `adore`, `airport`, `afford` — it keeps FORCE distinct
from NORTH, which GenAm merged. It also keeps the conservative `s/i/z/j//u/r` for `seizure`. Both are folded
before it is allowed to arbitrate.

### ⚠ THE PAYOFF: re-checking every correction in #1334 and this branch against an independent source

    curated rows Moby covers:              723
      Moby backs what we changed TO:       319
      Moby backs the UPSTREAM we changed:  166
      matches neither exactly:             238

The 166 sort almost entirely into classes where Moby is EXPECTED to differ — 76 are the unstressed-vowel axis
(a 1990s lexicon writes full vowels where modern GenAm reduces) and 3 are the weekday `-di` reading. But two
classes needed real examination.

**LOT–THOUGHT (54 flags) — the third source CORROBORATES the biggest change in the PR.** Moby distinguishes
the merger, so its opinion counts here. On a 28-word control set it agrees with gold on 23:

    cloth off cost lost soft coffee cross loss broth moth dog long song wrong   AO in BOTH
    boss frog fog golf on                                                       Moby AA, gold AO

Five genuinely-variable words, and the rest of the class independently confirmed. Left as gold has them —
gold is internally consistent and is the lexicon the downstream model was trained on — but recorded.

### ⚠ AND IT CAUGHT FIVE REAL ERRORS OF MINE, IN A CLASS I APPLIED WITHOUT A FAMILY CHECK

The S→Z pass ran no morphological-family check, because I had only been running those on VOWEL classes.
Moby flagged 14 of the 49, and five are genuinely wrong:

    adhesive  Z   but `-sive` is S across the family: cohesive, explosive, corrosive, abrasive, decisive,
    plosive   Z        expensive, massive, passive, persuasive — and `plosive` is the STEM of `explosive`
    maltose   Z   but the sugars are S: glucose, fructose, lactose, sucrose, dextrose, cellulose
    mucosa    Z   but mimosa is S
    otiose    Z   but the `-ose` adjectives are S: bellicose, comatose, grandiose, morose

All five reverted, and `jocose` — a PRE-EXISTING outlier in the same `-ose` family — corrected with them.

⚠ **The ones Moby flagged that are NOT errors matter too, because they show the sweep needs judgement:**
`rouse`/`dowse` are Z and correct — `arouse`, `carouse`, `espouse` are all Z, a real sub-family distinct from
`house`/`mouse`/`blouse`; `diesel` is Z with `easel`/`weasel`; `coyotes` is Z because it is the plural of a
vowel-final stem; and the four `trans-` rows follow a real voicing rule (`translate`/`transmit` Z before a
voiced segment, `transfer`/`transport` S before a voiceless one).

### Coverage, and therefore what Moby cannot do

    recorded divergences            264/331   80%   ← where it did the work above
    all OOV divergences             338/1079  31%
    the 730 currently unarbitrable   93/730   13%

A 1990s lexicon has no `Gitmo`, no `AIgiarism`. It validates the past far better than it extends the future.

    tests 5,973 pass / 309 files   goldens 0 stale   gold agreement 81.98%

## Run 12 — reviewing #1335, and the allow-list that excused a defect

### 1. The data invariants hold, measured against the PRISTINE baseline

The first check used the wrong baseline and flagged the five S→Z reverts as "changed but unrecorded". They
are reverted to the ORIGINAL CMUdict value, so they correctly have NO curated row — the invariant is about
pristine CMUdict, not about the previous PR's shipped state. Against the right baseline:

    dict rows changed vs pristine: 1,000    all recorded    no duplicates
    curated rows that are now no-ops: 0     every `want` equals the shipped dict

### 2. ⚠ THE en-GB CONSEQUENCE CHECK, which #1334's review made mandatory

Measured before AND after the branch rather than reasoned about:

    en-GB referee coverage of this branch's 64 changed words: 34
      matching BEFORE: 7      matching AFTER: 17      → then 19

Ten words were FIXED by the branch. Three regressed, and two were repairable: `dramatize` and `nevada` are
transatlantic splits (US `æ`, RP `ɑː`) and the transform has a set for exactly that mapping — added to
`en-gb-bath.tsv`, both now match.

The third, `maltose`, is NOT a regression on inspection. The en-GB referee lists BOTH `/s/` and `/z/` for
`glucose`, `fructose`, `lactose` and `sucrose`, and only `/z/` for `maltose`; our `/s/` is consistent with
all five siblings and correct for GenAm. The word went from matching by accident to being consistent with
its family, which is the right direction.

### 3. The 22 spelling-derived rhotic repairs, checked against Moby

Those were derived from the SPELLING with no reference, so they needed an independent look. Moby covers 8:

    agree exactly: 5
    differ:        3 — and all three differ only on an UNSTRESSED VOWEL, never on the /r/
                       (`expresso` IH/EH, `centrality` AH/IH, `marjoram` ER vs AH R)

Every Moby-covered repair carries the rhotic. Confirmed.

### 4. ⚠ AND THE ALLOW-LIST ITSELF WAS WRONG — it excused a real defect

`test/en-missing-rhotic.test.ts` lists the words permitted to be r-less, each with the rule licensing it.
Checking THAT list against Moby confirmed `dossier`, `dossiers`, `olivier`, `boucher` and `mrs` as genuinely
r-less — and broke `croissant`:

    ours       K W AA2 S AA1 N T          no /r/
    Moby       K R AO0 S AA1 N            has it
    gold       kɹwˌɑsˈɑnt                 has it
    en-GB      kwæsɒ̃ / kɹwæsɒ̃            lists both

I had excused it as "French, /kwɑː-/ attested in English" — which is true, it is the en-GB referee's first
variant — but two independent sources carry the /r/ and the third calls it a variant. **A defect wearing an
exception's clothes.** `croissant`/`croissants` corrected to `K R W AA2 S AA1 N T`.

⚠ This is the argument for writing that gate as a list of NAMED RULES rather than a count: a count cannot be
audited, but "French ⟨-ier⟩ is /jeɪ/" can be checked against a third source and found not to apply.

### 5. Moby recorded in PROVENANCE §5

Added as §5.3, the section for sources whose role is adjudication rather than shipped bytes (where Wiktionary
and epitran already sit). Nothing from Moby is redistributed. Both traps are written down: the mirrored 1993
readme that is superseded by the 2001 public-domain grant, and the cmudict 0.3 bundled beside it in the same
Gutenberg package — taking that file would have made the "independent third source" a copy of our own dict.

    tests 5,973 pass / 309 files   goldens 0 stale   package fence ok
    en 60.0% (floor 0.50)   en-GB 47.5% (floor 0.44)

## Run 13 — the marry–merry merger, taken, and the en-GB half it required

Deferred in Run 8f as "a dialect choice, not a defect — our dict is internally consistent (æ throughout)".
**That claim was wrong**, and the owner supplying their own dialect ("where I'm from, marry–merry are
pronounced the same") prompted the check that showed it.

### ⚠ THE DICTIONARY WAS NOT CONSISTENT. I had only looked at the divergence bucket, not the minimal pair

    marry  M EH1 R IY0      merry  M EH1 R IY0      mary  M EH1 R IY0     ← already MERGED
    carry  K AE1 R IY0      barrel B AE1 R AH0 L    arrow AE1 R OW0       ← not

In the unambiguous ⟨arr⟩+vowel environment the dict is **208 AE against 147 EH**, and the same stem goes
both ways:

    arrogate   AE      but   arrogance / arrogant   EH
    arrow      AE      but   arrowroot              EH
    character  EH      but   characters (its own PLURAL)  AE

That is the LOT–THOUGHT shape exactly, and it settles the question the same way: where a dictionary is
incoherent, any consistent choice is an improvement and the reference decides which.

### What each source says, and which ones cannot arbitrate

| source | verdict |
|---|---|
| misaki gold | **merged, 66 of 66 covered words, zero counterexamples** |
| our dict | incoherent, 208/147, same-stem contradictions |
| US wikipron | **itself split — 60 merged against 27 unmerged** (`Garrett` beside `Barrett`) |
| Moby | unmerged — but PRE-MERGER on every axis tested (FORCE/NORTH, the `seizure` yod) |
| the owner | merged |

⚠ The US referee cannot arbitrate this, exactly as it could not arbitrate cot–caught (it writes `dawn` as
`dɑn` in a file where it distinguishes elsewhere). Applied: **404 rows**, `AE`→`EH` before an intervocalic
`R`. The net effect on that referee is −2 rows, which is noise from its own 27 unmerged entries.

### ⚠ AND THE en-GB HALF, WHICH IS NOT OPTIONAL — RP DOES NOT HAVE THE MERGER

Measured immediately after applying it: en-GB fell from **53 matching referee rows in the class to 3**. SSBE
keeps `marry` /ˈmæri/ apart from `merry` /ˈmɛri/, so the parent's merger has to be mapped back.

A new lexical set, `en-gb-marry.tsv` (`ɛɹ` → `æɹ`), built the same way as the cloth additions in #1334 —
trial the membership, measure against the referee, prune what does not improve:

    the 404 the parent moved                     → 3 dropped (`ara`, `arabs`, `multivariate`: the
                                                   referee shows those as genuinely ɛ/ɛə in British)
    + 121 words ALREADY merged before this change  ← a pre-existing en-GB defect this set also fixes:
                                                   `character`, `apparent`, `caramel`, `Arizona`, `asparagus`
    = 522 rows;   en-GB back to 49 in the class, and marry/merry correctly distinct again

⚠ **A WORD LIST AND NOT A RULE**, deliberately: a blanket `ɛɹ`→`æɹ` would wrongly convert `merry`, `very`,
`ferry`, `error`, `America`, which are genuinely `ɛ` in both varieties.

⚠ **Ordering checked, not assumed.** The lexical block runs BEFORE the SQUARE rule, so a marry word's
prevocalic `ɛɹ` is still spelled `ɛɹ` when this fires while a preconsonantal one still becomes `ɛə`
(`care` kʰˈɛə, `caretaker` kʰˈɛəteᶦkə are untouched). And the first-occurrence limit was audited: exactly
one member has two `ɛɹ` (`lariviere` lˈɛɹɪviʲɛɹ) and its FIRST is the marry one, so the rule picks right.
Pinned in the test rather than left to luck.

    en 59.9% (floor 0.50)   en-GB 47.5% (floor 0.44)
    tests 5,979 pass / 310 files   goldens 0 stale   regex parity 0 differ

## Run 14 — reviewing #1336: the lexical sets can fight, and two of mine did

### ⚠ FOUR WORDS ARE IN BOTH `marry` AND `bath`, AND I SHIPPED THEM BROKEN

`barry`, `clara`, `dara`, `scarry` were already in `en-gb-bath.tsv`. The chain that used to work:

    parent æ  →  BATH lifts it  →  RP ɑː        klˈæɹə → klˈɑːɹə  ✓

After the merger the parent says `ɛ`, which BATH cannot see, so BATH became a no-op and `marry` mapped
`ɛ`→`æ` and stopped there: `klˈæɹə` where the referee says `klɑːɹə`.

⚠ **I had the evidence and did not chase it.** The development note says "en-GB back to 49 in the class
(was 53)" — those missing four ARE these words. A net number that moves the right way can still hide a
regression, and "49, was 53" was a finding I wrote down and walked past.

Fixed by ORDER, not by editing either set: `marry` now runs BEFORE `bath`, so a word in both chains
`ɛ → æ → ɑː` and each set does what it is for. A `marry` word that is *not* in `bath` still stops at `æ`
(`carry` kʰˈæɹi), which the test pins alongside — an over-applied chain would look identical on the four
and wrong everywhere else.

    en-GB referee coverage of the marry set: 196 words, 173 matching

### The rest of the review

    curated rows 1,432, no duplicates, every `want` equal to the shipped dict
    dict rows changed vs pristine 1,404, all recorded
    words left in the AE + R + vowel environment: 0   ← the merger is exhaustive, not partial

⚠ The "no-op curated rows" check flagged `acc`, `associative`, `backfiring`, `beyond` for the second time
this session, and it is the same false positive both times: the pristine baseline ALREADY has the
pre-existing curation applied, so those rows correctly look unchanged against it. The check is only
meaningful for rows this work added.

    tests 5,979 / 310 files   goldens 0 stale   regex parity 0 differ

## Run 15 — the frequency audit, phase 2: the top two bands

Working the 50 candidates in the top 5,000 words, reading each.

    top 1k   10 → 4        1k–5k   40 → 18        triple-source agreement 68.6% → 68.9%

### What was applied (17 single fixes + 77 in one class)

    without  W IH0 TH AW1 T → DH     a voiceless θ in /wɪˈðaʊt/
    vehicle  V IY1 HH IH0 K… → no HH we pronounced the silent h
    really   2 → 3 syllables          suggest  S AH0 JH → S AH0 G JH
    poor     P UW1 R → P UH1 R        schedule S K EH1 JH UH0 L → UW2
    tissue   T IH1 S Y UW2 → T IH1 SH UW0   bankruptcy  …P S IY → …P T S IY
    casual · semi · sri · finland · africa · indonesia · costa · boston

### ⚠ THE `re-` CLASS, AND THE PRIOR DECISION IT RAN INTO

40 rows where our tense `R IY0` meets a reduced prefix in BOTH sources. The dictionary had **three values
for one prefix** — `reduce` R AH0, `reward` R IH0, `review` R IY0 — and only the first two reach the
weak-vowel rule, so `reduce` read `ɹᵻdˈuːs` while `review` read `ɹiːvjˈuː`.

⚠ **`test/english-reported-misreadings.test.ts` already records a REJECTED attempt at this** — a rule
reducing any `IY2` Latinate prefix, which moved 896 rows and wrongly reduced the PRODUCTIVE prefix
(`reconstructed`, `redesign`, `relocate`). That work fixed three rows in the DICTIONARY instead. This change
is the same shape and extends it: 40 dictionary rows chosen by two independent sources agreeing, never a
rule, and the productive prefix verified untouched (`reacquire` ɹiʲəkwˈaᶦɹ, `react` ɹiʲˈækt, `realign`).

Of the 683 `R IY0` rows in the dictionary, the two-source filter selected 36 in the first pass and **not one
was a productive `re-`** — they are all Latinate (`report`, `release`, `republic`, `revenge`, `repose`,
`rebuke`, `replenish`). That is the filter doing exactly the job the rejected rule could not.

⚠ **AND THE PARADIGMS WERE SPLIT, WHICH THE TESTS CAUGHT.** `report` was IY0, `reported` IY2, `reporting`
IY0, `reports` IH0 — four spellings of one prefix in one paradigm, exactly the `replace` defect this repo
fixed once before. 37 more siblings completed so each paradigm agrees with itself.

Two pins moved and one was REVERTED:
- `report` left the "productive prefix is untouched" test — it is Latinate and never belonged there; the
  line described it as "an unstressed IY0 prefix" rather than claiming the reading was right. The four
  genuine controls stay.
- `report` also left `onset-r.test.ts`, where it was the CONTRAST ("its first vowel resolves to `i`, not
  `ᵻ`") — a contrast that existed only because the paradigm was split.
- ⚠ **`cafe` was REVERTED.** Both sources said `K AE0`, but /kæˈfeɪ/ and /kəˈfeɪ/ are both attested and the
  existing value was a considered pin from a previous fix. Two-source agreement does not outrank a
  deliberate decision on a genuine variant.

### ⚠ A LIMITATION OF THE INSTRUMENT, found by chasing `reroute`

`reroute` renders `ɹɪɹˈuːt` where gold has `ɹiɹˈut` — and it is NOT an audit candidate, because its
dictionary row is IDENTICAL to gold's. The difference is introduced by the RENDERER: the manifest's
`"IY": { "beforeR": "ɪ" }`, which is right for tautosyllabic NEAR (`beer`, `beard`) and wrong when the `ɹ`
is the onset of the next syllable (`copy|right`, `re|route`, `de|regulation`).

**The audit compares ARPABET, so it is blind to renderer defects.** Worth stating plainly: it can only find
bad dictionary rows.

Measured before reaching for a rule change, and it rules one out:

    ɹ is a CODA    gold says ɪ  28 / 28      ← our rule is right, unanimously
    ɹ is an ONSET  gold says i  14, ɪ  20    ← MIXED

The 20 are NEAR stems with a suffix (`career|ism`, `dreari|ness`, `endear|ing`); the 14 are compound or
prefix boundaries (`copy|right`, `pre|record`). The discriminator is morphological, which the converter
cannot see — so this needs a lexical exception list, not a rule, and is left as the next piece of work.
`copyright` is rank #150, so it is worth doing.

    tests 5,989 / 311 files   goldens 0 stale   en 59.9%   en-GB 47.5%

## Run 16 — reviewing #1337: paradigm completeness, and a cloth row the branch needed

### The re- paradigms: 0 introduced, 13 pre-existing closed

    split re- paradigms found:                            49
      the tense member is STRESSED IY1/IY2                20   ← legitimate noun/verb (`recall`
                                                               ˈriːkɔːl beside `recalled` rɪˈkɔːld)
      the tense member is UNSTRESSED IY0 — a true split   29
        INTRODUCED by this branch                          0   ← the phase-2 completion was correct
        closed here                                       13

The 13 are backed either by two sources or by the repo's own documented precedent — `replace` was fixed
because "replace's own inflections contradict it", so the paradigm MAJORITY wins. ⚠ **One of them is
`replacements`**, a direct sibling of the rows that fix touched, left behind at the time.

The other 16 are left alone: no source covers them and their paradigm majority does not settle it, so
choosing would be guessing.

### ⚠ THE en-GB CONSEQUENCE CHECK CAUGHT ONE, AND THE SET LOOKED LIKE IT ALREADY HAD IT

`boston` moved AA1 → AO1 in this branch and needed `en-gb-cloth` membership, exactly as 119 words did in
#1334. ⚠ A `grep -c boston` on the cloth file returns 1 and that is **`bostonian`** — the word itself was
absent. A substring check answered a membership question, which is the same shape of mistake as the
onset-`r` blind spot. Added; `boston` now reads `bˈɒstən` and en-GB matching on this branch's changed words
went 46 → 47 of 59.

⚠ Checked in BOTH directions: `costa` moved AO1 → AA1 and needs NO cloth row, because at `ɑː` the plain LOT
rule already gives `kʰˈɒstə`. A set that is right for one direction can be wrong for the other.

The remaining 12 misses are variety differences, not defects — British `semi` /ˈsɛmi/ against US /ˈsɛmaɪ/,
`suggest` /səˈdʒɛst/ without the /ɡ/, `really` /ˈrɪəli/ with NEAR.

### Invariants

    curated rows 1,538, no duplicates, every `want` equal to the shipped dict
    93 dict rows changed on this branch, all recorded
    tests 5,989 / 311 files   goldens 0 stale   package fence ok (368 data files)
    en 59.9%   en-GB 47.5%   triple-source agreement 68.9%

## Run 17 — 2026-09-17 19:05

Working the 5k–20k frequency band of the triple-source audit. Two instrument defects and one negative
result; the instrument defects were worth more than the band.

### The audit could not see any word ending in -er/-or/-ar

    MOBY=… GOLD=… npx tsx tools/english/en_source_compare.mts

⚠ **Moby writes every unstressed `-ər` as TWO symbols, `/@/r`** — `ocular` is `'/A/k/j//@/l/@/r`. The
converter rendered that `AH0 R`, while this repo and gold both write the single phone `ER`. So Moby could
never be seen to agree with gold on any such word, and the entire class fell into "split".

This was found by chasing why `ocular`, `mandibular`, `ventricular`, `monument`, `permutation` and
`incubation` were absent from the candidate list when gold plainly disagreed with us — `grep` on Moby
showed it agreeing with gold exactly. ⚠ The first `grep -aiP "^ocular "` returned NOTHING, which briefly
looked like "Moby does not have it": the file is **CR-delimited**, so `^` never matches. Same trap as the
original 0-words-compared bug, hit a second time from a different direction.

Folded in `modernise`, with a consonant lookahead so prevocalic `AH R` (`around` = ə-ɹaʊnd) is untouched:

    agreement  68.9% → 78.3%    split  28% → 18.4%    candidates  587 → 644

Over 9 points of the headline was instrument error, not dictionary error — the third time on this branch
that a measured "defect rate" was mostly the measuring device.

### Declared heteronyms are not comparable and were being compared

8 candidates (`accent`, `address`, `concrete`, `detour`, `egress`, `lead`) are in english.jsonc
`heteronyms`, and **all 8 already carry the correct default there**. The dict row the audit was comparing
is the fallback the engine does not consult. Skipped now, for the same reason the audit already skips
gold's 789 POS-conditioned entries. `and` and `your` remain and are correct: those are de-accented at the
phrase layer, so the dictionary's citation form is right.

### ⚠ NEGATIVE RESULT: the compound-seam geminate. Two measurements, opposite answers, sample bias.

`roommate` was corrected to `R UW1 M M EY2 T` (gold `ɹˈummˌAt`, Moby `'r/u/m,m/eI/t`, and our own dict
geminates `bookkeeper` B UH1 K K IY2 P ER0, `misspell`, `coattail`, `lamppost`, `nighttime` — 93 rows).
It then failed the curation gate at `source=C`, because `collapseGeminates` removes the seam geminate on
the compound path. Its comment claims "CMUdict has no consonant geminates", which is false.

Measuring whether to stop collapsing on the compositional paths:

    sample = the 93 geminate rows + a 1-in-40 control
    collapse on  →  C 21.0% exact, M 71.0%
    collapse off →  C 25.4% exact, M 72.8%      +42 rows, no regressions

⚠ **THAT MEASUREMENT IS WORTHLESS AND THE SAMPLE IS WHY.** It is dominated by 93 rows selected for having
the feature under test. On an unbiased 1-in-10 sweep of the whole dict:

    keeping the geminate matches the dict:  7   barroom goddamned misspells misstates molelike notetaker suddenness
    collapsing matches the dict:           36   artificially brazenness cynically legally locally painfully partially …

Collapsing wins 36 to 7. Every row it wins is a `-ly` suffix seam — `legally` really is /ˈliɡəli/ — and
every row it loses is a compound. So the split is by PATH, not by principle. Re-measured with the collapse
kept on M and N and dropped only on C:

    keeping:  3   barroom molelike notetaker
    collapsing: 4 gentlelady granddad roddick spacesuit

⚠ A WASH, so the change is **NOT** made and the engine is reverted. The reason is that the dictionary is
itself inconsistent at compound seams: it geminates `bookkeeper`/`misspell`/`coattail` and collapses
`granddad`/`spacesuit`. The OOV path cannot be made to agree with a target that disagrees with itself, and
no variant is measurably better. `roommate` is recorded as a C-path gap with that as its reason.

The dict-side corrections stand on their own evidence (`teammate` was an outlier against its own plural
`teammates`, `earring` missing the geminate gold has) — what is rejected is the engine change.

### ⚠ `dis-` looked like the same class and is NOT

`dissatisfied`/`dissatisfaction` also want `S S` from both sources. But our dict is internally consistent
at a single S across the whole prefix — `dissimilar`, `dissuade`, `dissolve`, `dissatisfy` — so family
consistency wins and they are skipped, the same call as `syrup` and the `di-` class.

### Two classes where the sources are UNANIMOUS

Both were found the same way: take a suspicious row, ask what SHAPE it is, then score that shape over the
whole dict rather than over the frequency band.

    npx tsx .scratch/class.mts "AY[0-2] R($| [^AEIOU])"   agree 0, both-against-us 28, unsourced 139
    npx tsx .scratch/class.mts "[DTN] Y UW[0-2] [^AEIOU]" agree 0, both-against-us  4, unsourced  50

⚠ **`agree 0` is the finding.** Not one sourced row in either shape is confirmed by either source. For the
`-ire` rhyme gold covers 42 of them and reads `Iəɹ` on **42 of 42**, and our own dict already agrees on the
words that matter — `fire`, `hire`, `tire`, `wire`, `desire`, `entire`, `require`, `choir`, `sire`,
`ireland`, `tireless` are all `AY ER0`, 96 rows against 41. 126 rows corrected.

⚠ AND NEITHER SHAPE IS THE WHOLE REGEX, which is why each was scoped before it was applied:

  * `[DTN] Y UW` is mostly PREVOCALIC and mostly CORRECT — `annual` /ˈænjuəl/, `menu`, `danube`, `unusual`,
    `used`, `utility` keep a real yod. The defect only exists before a CONSONANT (`duplication`, `tupelo`,
    `tutelage`, `nubian`), and there the family settles it: `duplicate` has no yod while `duplicates` and
    `duplication` do, `dude` has none while `dudes` does, `tube` none while `youtube` does.
  * County-name `-shire` is NOT the `-ire` rhyme. Our dict reduces it in `berkshire`, `cheshire`,
    `hampshire`, `yorkshire` and Moby agrees (`'/j//O/rk/S//i/r`), so the six that read `SH AY2 R` were
    brought to `SH ER0` rather than to `SH AY ER0`. Personal names in `-ire`/`-mire`/`-guire` DO take the
    rhyme and were included.

⚠ The `-shire` split was found by the GOLDEN GATE, not by the audit: `nan.tsv` carries
`Buckinghamshire` and moved to `ʃˌaᶦɚ` when `shire` was corrected. Five non-English goldens (`hak`, `hmn`,
`nan`, `pcm`, `sat`) went stale on this branch and every one of them is embedded English text —
`government`, `hogan`, `hon`, `indonesian`, `Buckinghamshire`. They are a consequence check the English
work does not otherwise get.

⚠ AND ONE OF THOSE "FINDINGS" WAS MY OWN TOOL. A scratch script that walked several languages in one
process reported `Ch.` in `hmn` regressing from `ʃ` to a letter spelling. It does not: `check-goldens.mts`
calls `clearForeignOov()` between languages and says in a comment that the clear is load-bearing, and the
scratch script did not. Run correctly the row matches. The diagnostic was wrong, not the engine.

### Invariants

    curated rows 1,806, no duplicates, every `want` equal to the shipped dict
    275 dict rows changed on this branch, all recorded
    tests 5,991 / 311 files   goldens 0 stale   C# parity 189 byte-identical   regex-diff 0 differ
    en-GB 47.5% → 48.6% (the dict corrections reach it through the shared lexicon)
    en 59.9% / 65.1% +intentional (unmoved: the wikipron referee is 4,046 rows and 64% of them sit
      outside the 50K frequency list, so band-3 work barely touches it — this is the known skew)
    triple-source agreement 68.9% → 78.9%   candidates 536 (was 587, and 644 once the Moby
      -ər fold exposed the class it had been hiding)
