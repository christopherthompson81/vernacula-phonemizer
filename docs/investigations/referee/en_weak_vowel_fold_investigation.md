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
