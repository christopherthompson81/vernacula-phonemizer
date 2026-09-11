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
anything, and unfolded it maps to ALWAYS-WRONG: every one of ~4,525 lexicon rows carrying it is a
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
