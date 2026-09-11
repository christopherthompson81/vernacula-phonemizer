# en: should the referee eval fold `ᵻ` → `ɪ`?

Issue #1282, which I filed myself while working #1275 — on a premise the measurement has since corrected.

## The premise I filed it on, and why it was wrong

The issue says `ᵻ`/`ɪ` is "a notation difference between two conventions for the same weak vowel", citing a
bucket-by-what-we-wrote survey: our `ᵻ` slots draw referee `ɪ` 70.4%, our `ə` slots 10.6%. That contrast is
real, but it is the wrong pair to compare — it shows the referee separates our `ᵻ` from our `ə`, not that
it conflates our `ᵻ` with our `ɪ`.

## Run 1 — 2026-09-11 17:01 — the control the issue did not run

Add the bucket that settles it: what does the referee write where we wrote a FULL `ɪ`?

```
we wrote      slots     ref ɪ   ref ə   ref i
ᵻ                89     71.9%   20.2%    5.6%
ɪ               509     93.1%    3.9%    2.4%
ə               684     10.1%   82.3%    0.9%
```

**The referee partially resolves `ᵻ`.** Our `ᵻ` and our full `ɪ` draw measurably different rates — 71.9%
against 93.1% `ɪ`, and a fivefold difference in the `ə` column. Our `ᵻ` sits BETWEEN `ɪ` and `ə`, which is
exactly what a weak vowel should look like to a transcription convention that has no symbol for one.

So `ᵻ` is a real category here, not merely our spelling of the referee's `ɪ`, and the house rule bites:
**a fold must not delete an axis.** Folding `ᵻ → ɪ` gives up catching an `ᵻ` written where a full `ɪ`
belongs — which was catchable before.

## What decides it anyway

The referee's inventory contains **no `ᵻ` at all**. Our `ᵻ` must map to something for scoring to mean
anything, and unfolded it maps to ALWAYS-WRONG: every one of 5,580 lexicon rows carrying it is a
guaranteed mismatch, regardless of whether the placement is right. That is not a measurement of the axis —
it is a uniform penalty on a documented house convention, and it distorted real decisions (the correct
`-es` change in #1275 scored **−7 words for being right**).

Any mapping beats always-wrong, and the table says `ɪ` is the best-supported single choice by a wide
margin: 71.9% against 20.2% `ə` and 5.6% `i`.

⚠ **So the fold is taken WITH its cost, not by pretending it has none.** The axis it hides is kept visible
outside the headline by `tools/english/en_weak_vowel_survey.mts`, which prints the table above. Run it when
`isBarredI` changes: an `ᵻ` class placed wrongly shows as a bucket whose `ɪ`-rate has moved toward the `ə`
column. That is the honest version of "we accepted the tradeoff".

## Run 2 — 2026-09-11 17:05 — the measurement

```
             before          after           delta
en           1822/4558       1903/4558       +81 words    40.0% → 41.8%   symbol 81.6% → 82.0%
en-GB      33554/76284     35382/76284    +1,828 words    44.0% → 46.4%   symbol 83.9% → 84.4%
```

**en-GB is the convincing half.** 76,284 rows against `en`'s 4,558, so +1,828 is far harder to attribute
to sampling than +81 would be alone. Both are scored on their usual paths (`en` engine-text, `en-GB`
rules-only — the non-circular one, since its lexical sets share a source with the referee).

For scale: #1275's `-es` change cost **−7 words for being correct**, and that was ONE `ᵻ` environment. The
+81 is the same artifact across all of them at once.

### Floors

Both were stale independently of this change — `en` said "measured 36.1%" and `en-GB` "39.2%", predating
several unrelated improvements. Raised to `en: 0.35` and `en-GB: 0.45`, each keeping roughly the margin its
author had chosen (6pp and ~1.5pp respectively), with the new measurement and the fold's cost recorded in
the comment rather than only here.

### What this does NOT license

⚠ The fold makes `ᵻ` scoreable; it does not make it *verified*. A systematically misplaced `ᵻ` — a whole
`isBarredI` environment pointed at the wrong slot — now scores as correct. The only instrument that can
still see it is the survey. If a future change to `isBarredI` is justified by "the eval went up", that is
now a weaker argument than it was this morning, and the survey table is the one to show instead.

## Run 3 — 2026-09-11 17:30 — review: the instrument was worse than the thing it was auditing

Eight findings. The fold itself survived untouched; everything else did not. The pattern is that the
survey — the tool whose entire job is to keep the folded axis honest — was the least trustworthy artifact
in the change.

**It was running on 63% of the available evidence, and not at random.** `VOWEL` omitted our superscript
offglides, so our one-character `eᶦ` counted as one nucleus while the referee's `e ɪ` counted as two, and
every FACE/GOAT/PRICE/MOUTH/CHOICE word failed the count check. 626 of 756 skips went for that reason
alone. Fixed by MERGING THE REFEREE'S DIPHTHONGS rather than counting our offglides — our `eᶦ` is one
nucleus and the referee writes it as two phones, so the merge is the semantically correct direction and
matches what the eval's own offglide folds already do.

```
            aligned words   skipped   ᵻ slots
before             1,309       756        89
after              1,908       157       118
```

**And 34 words were passing the count check while MISALIGNED.** A second asymmetry — the referee's
non-syllabic `n` where we write `ən` — cancelled the offglide's extra nucleus, restoring the count and
shifting every slot after the diphthong by one. `disqualification` scored our `-tion` schwa against the
referee's FACE offglide. Contaminated rows, in the one table meant to be the honest instrument.

**The en-GB half had no instrument at all.** The note in `en-GB.jsonc` was a copy of `en`'s: it attributed
US-referee numbers to "this referee", claimed `ᵻ` has no counterpart there (the UK file has 13 rows that
carry it), and pointed at a tool with no en-GB mode. So the half the measurement actually rests on — 76,284
rows, +1,828 words — was unaudited. Now `--gb`, with its own measured numbers:

```
en-GB      slots     ref ɪ   ref ə          en          slots     ref ɪ   ref ə
ᵻ           1,925     81.4%   13.4%         ᵻ             118     72.9%   19.5%
ɪ           9,437     93.7%    2.4%         ɪ             659     91.2%    4.2%
ə          18,821     10.2%   78.4%         ə             953      9.1%   82.5%
```

The shape holds on 16x the sample, which is the first time this claim has had volume behind it.

⚠ **And it reads the ENGINE, not the lexicon file.** en-GB is an accent delta applied on top of the GenAm
lexicon, so reading `accent-lexicon.tsv` would have compared American vowels against a British referee and
called it an en-GB survey.

**The floor was set against the wrong number.** `0.45` was chosen against the full-referee 46.4%, but the
gate samples 3,000 rows for the neural languages and measures 45.4% there — 13 words of headroom. Now
`0.44`, with the sampled figure recorded beside the full-run one so the next person sets it against the
right measurement.

**Two count errors, one of them pointed.** "~4,525 lexicon rows" was wrong — it is 5,580 rows / 5,777
occurrences, and 4,525 is suspiciously close to the referee's own row count, i.e. the wrong denominator.
In a repo where every fold note is an audit trail of measured figures. Also stale: `en`'s published
36.1%/78.1% in `docs/language-maturity.md` and `tools/referee-eval/README.md`, and two figures inside the
rewritten en-GB comment itself.

⚠ **The name collision deserves its own line, because the guard caught it.** Renaming the survey's
parameter to `ours` shadowed the outer map of our readings, so the loop iterated a STRING's characters and
every bucket reported zero. The `slots === 0` guard — added in this same round for finding 5 — printed
`⚠ NO SLOTS` instead of a row of `NaN%`. Without it the table would have rendered as plausible-looking
data. That is the argument for loud failure in a monitoring tool, made by the tool on itself within an
hour of being written.

## Run 4 — 2026-09-11 18:00 — review again: the fix to the instrument was itself US-shaped and one-sided

Six findings. The fold is still untouched; the survey needed a second pass, and the two headline findings
compound in a way that matters:

**`REF_DIPHTHONG` was US-shaped.** It merged `eɪ oʊ aɪ aʊ ɔɪ` — the GenAm set — and omitted `əʊ`, which is
RP GOAT and therefore one of the three symbols the en-GB survey BUCKETS ON. 2,369 en-GB words were dropped
and 67 passed while shifted by one (the referee's syllabic `n̩`/`l̩` against our `ən`/`əl` cancelling the
extra nucleus): `broken`, `boastful`, `cobblestone` scored a `-en`/`-ful` schwa against the referee's GOAT
offglide. In the survey that exists to keep this fold honest, on the variety that carries its evidence.

**And the merge was ONE-SIDED**, which is why adding `əʊ` alone would have made things worse rather than
better. Run 3 merged only the REFEREE's pairs; our `əᶷ` stayed a bare `ə`, so every recovered GOAT slot
compared `ə` against the merged token `əʊ` and could never match — the `ə` bucket would have fallen from
78.4% to 70.6% on 22,216 slots. A one-sided fold is not a fix; it is a different bug with better coverage.

Both sides are now normalised the same way — our superscript offglides mapped to the referee's plain
spelling, then ONE `nuclei()` applied to both:

```
              aligned   skipped      ᵻ slots
en   Run 3      1,908       157          118
en   Run 4      1,929       136          118
en-GB Run 3    27,953     4,617        1,925
en-GB Run 4    30,248     2,322        1,988
```

```
en-GB      slots     ref ɪ   ref ə          en          slots     ref ɪ   ref ə
ᵻ           1,988     81.2%   13.3%         ᵻ             118     72.9%   19.5%
ɪ           9,841     93.6%    2.4%         ɪ             659     91.2%    4.2%
ə          19,122     10.7%   80.8%         ə             963      9.0%   82.5%
```

**The survey was also on the CIRCULAR path for en-GB.** `phonemize(word, "en-GB")` goes through
`phonemizeWord`, which applies BATH/CLOTH/PALM word lists MINED FROM THIS REFEREE — the exact reason the
eval scores `phonemizeWordRules` for this variety. An auditing instrument on the circular path is a worse
version of the problem it was built to check. Now on the rules path.

**And Run 3's own numbers had already gone stale in three places** — `en.jsonc`, the floor comment, and the
published en-GB row in `docs/language-maturity.md` (still `39.1% (.38)`, a floor that no longer exists).
The en-GB note was refreshed in Run 3 and `en`'s was not, so the fold's justification was citing figures
that Run 3 itself had invalidated.

⚠ The recurring shape across Runs 3 and 4 is worth naming: **every error was in the instrument, not the
change.** The fold has survived three reviews untouched. What kept failing was the thing measuring it, and
each failure was of the same kind — a correction applied to one side, one variety, or one file, and not
carried to its mirror.

## Run 5 — 2026-09-11 18:35 — third review: no correctness bug, and the same mirror error again

Six findings, all in the documentation and instrument layer. The reviewer verified the fold, the jsonc
wiring, `en.jsonc`'s per-slot figures, the 5,580/5,777 counts, the "13 of 76,284" UK figure, both floors on
the sampled path, and confirmed `phonemize(w,"en")` is byte-identical to the eval's `createEnglish().text(w)`
on all 2,065 surveyed words. **No correctness bug in the code.**

**The survey measured a different object than the gate it justifies.** It read only the referee's FIRST
variant, while the eval credits a word when ANY variant matches — and 16,337 of the UK file's 76,284 rows
carry more than one. A word whose second variant writes `ə` where the first writes `ɪ` was counted as pure
`ɪ`-support. Now every aligning variant contributes, each weighted `1/n` so a word cannot outvote another
purely by having been transcribed twice:

```
en-GB       aligned   skipped     ᵻ slots     ᵻ: ɪ / ə
Run 4        30,248     2,322       1,988     81.2% / 13.3%
Run 5        31,120     1,450       2,019     84.2% / 11.7%
```

**The published pre-fold figure was wrong by 3x.** `docs/language-maturity.md` said en-GB was "39.1% before
#1282", crediting the fold with +7.3pp — while the `en` row one line above said +2.4pp, and +1,828 words on
76,284 rows IS 2.4pp. 39.1% was the previously PUBLISHED number, already stale before the fold; the measured
pre-fold value is 44.0%. Two contradictory claims one line apart, the larger one flattering this change.

⚠ **AND THE en-GB FOLD NOTE WAS LEFT STALE AGAIN.** Run 4's commit message named "a correction applied to
one side, one variety, or one file and not carried to its mirror" as the recurring failure — and that same
commit refreshed `en.jsonc`'s numbers while leaving `en-GB.jsonc` on Run 3's. **Fourth instance, one of them
in the commit that named it.** Anyone auditing the fold would get a mismatch and be unable to tell whether
the engine had moved or the instrument had.

Two smaller asymmetries with the gate, both fixed: `VOWEL` omitted `ɐ ʉ ɵ`, which the narrow UK referee
writes and `en-GB.jsonc` folds (46/18/7 rows — too few to move a percentage, but they were dropping out of
the `ə` baseline rather than landing in it); and the sample-cap rationale still argued from the floors this
PR replaced.

⚠ **And a blind spot the guards cannot catch**, now in the header: the survey reads each word back through
the engine, which resolves an in-lexicon word from the flat file — so after an `isBarredI` change it reports
the OLD placement until `en_rebuild_lexicon.mts --write` runs. The `slots === 0` guard cannot see this,
because the slots are all still there. "Rebuild the lexicon first" is now the first line of the usage note.
