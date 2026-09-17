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
