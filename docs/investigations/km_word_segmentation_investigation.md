# Khmer word segmentation — restoring the boundaries the script omits

Khmer writes no space between words. `khmer.ts` therefore tokenises a MAXIMAL run of Khmer letters as one unit,
and the syllabifier re-parses across boundaries it cannot see. This log is the investigation into whether that
costs anything, what the cheap fixes can and cannot do, and the neural model built when they could not.

## Run 1 — 2026-08-05 17:05 · does the missing boundary actually cost a reading?

Started from a concrete complaint: `ខែឧសភា` ("May") read as *kʰaehpʰiə* while `ឧសភា` alone reads *ʔosɑpʰiə*.

Compared joined against spaced for all 12 month names, using the isolated reading as the reference:

| written | joined (the normal spelling) | isolated / spaced |
|---|---|---|
| ខែកុម្ភៈ | `kʰaekom` — truncated | `kompʰeəʔ` |
| ខែឧសភា | `kʰaehpʰiə` | `ʔosɑpʰiə` |
| ខែកក្កដា | `kʰaekkkɑɗaː` — three k's | `kɑkɑɗaː` |

**9 of 12 months degrade when joined; spacing fixes every one.** ថ្ងៃ+weekday degrades 3 of 7, ឆ្នាំ+zodiac 1 of 4.
Those prefixes precede a word 14,391 / 15,133 / 8,283 times in the mined corpus.

Then measured PREVALENCE properly rather than extrapolating from dates, using human labels: 4,000 junctions where
a Khmer writer actually typed U+200B, comparing `phonemize(a+b)` against `phonemize(a) + phonemize(b)`.

    joining CORRUPTS the reading: 2,185 / 4,000 = 54.6%

Caveat stated once and it holds for everything below: the isolated reading is a REFERENCE, not gold, so some part
of that 54.6% may be legitimate compound pronunciation. But the examples are not subtle — `នៅ|សតវត្ស` →
*nɨwhtɑʋɑt* against *nɨw + sɑtɑʋoət*, where ស collapses into a coda and a whole syllable disappears.

**Implication:** not a date bug. Over half of all word junctions in Khmer are read wrong.

## Run 2 — 2026-08-05 17:10 · can the segmenter that already ships do it? No, and the reason is structural

`segment.ts` is a unigram Viterbi over `km-wordfreq.tsv`, harvested from writer-typed ZWSP. Tested on the 12
month compounds:

    recovers the boundary in 0/12

The mechanism, which is the useful part: everything is in the vocabulary — ខែ 2,576, មករា 620, **and ខែមករា 505**.
Splitting always pays an extra −log(p) term, so a compound that is itself in the vocabulary wins outright.
**Frequency data cannot fix a problem caused by frequency.** `segment.ts`'s header claims frequency weighting
avoids preferring compounds; that claim only holds when the compound is rare, and it has been corrected there.

Tried the obvious repair — split when a compound is rarer than both its parts:

    2,661 of 7,145 vocabulary entries (37.2%) would split, including លើក (2,318) → លើ | ក

`លើក` is a real single word. The heuristic is a misfire generator; abandoned.

## Run 3 — 2026-08-05 17:20 · the label problem, and the cleaning method

ZWSP supervision is ONE-SIDED. A typed ZWSP is a positive a human placed; its absence means either "no boundary"
or "the writer did not bother". Training on raw lines teaches the model that most real boundaries are
non-boundaries.

**Layer 1 — which lines' zeros can be believed.** Mean characters-per-token per line proxies annotation
completeness, and the corpus is sharply bimodal: p10 = 4.9 against p50 = 17.4. Khmer words run 4-5 characters, so
≤6 means nearly every boundary is marked. 15,501 of 180,782 lines qualify (8.6%). In dense lines, boundaries are
carried by ZWSP 969,482 times against 162,153 ordinary spaces and 32 ZWNJ.

**Layer 2 — per-split-point rate, and it MUST be measured on layer 1.** The same sequence recurs thousands of
times, split by some writers and not others. Over the raw corpus that signal is confounded by document annotation
habits and collapses; restricted to dense lines it separates cleanly:

| sequence | all lines | dense lines only | reading |
|---|---|---|---|
| ខែ + 12 months | 13–19% | **67–82%** | a real boundary, marked ~15% of the time |
| នៅឆ្នាំ "in year" | 38% | **93.5%** | two words |
| ទីក្រុង "city" | 6.2% | 11.3% | lexicalised compound — genuinely unclear |
| លើក (one word) | 0.9% | **0.9%** | never a boundary |

Over dense lines the histogram is two modes — 5,060 types at 0-10%, 12,719 at 90-100% — with a valley at 40-50%.
So: rate ≥ 60% → the boundary is real, relabel EVERY occurrence including the ~85% no writer marked; rate ≤ 10% →
trust the zero; **otherwise abstain**, masking the position out of loss and score. Abstention is what makes this
sound rather than merely bigger: `ទីក្រុង` at 11.3% is a real question the corpus does not answer.

**Layer 3 — a length guard** for sequences below 10 observations: a token longer than the dense subset's own
token-length p99 (13 characters) is a suspected unmarked compound and is masked rather than fed as a negative.

**A bug this caught, worth recording.** The first implementation looked up `rate[token[:cut] + token[cut:]]` —
which is just `rate[token]`, identical for every cut — so every interior position of a frequently-split token was
labelled a boundary and `ខែមិថុនា` came out as `||||||||`, all eight positions. Found by printing label strings
for known words instead of trusting the summary counters. The table is now keyed by the PAIR a human produced.

After the fix, on 1,504,641 runs / 32.7M characters:

    typed boundary                    1,202,385
    RECOVERED boundary                  145,706   (0.12x the typed ones)
    kept 0 (measured non-boundary)    2,756,757
    kept 0 (rare, plausible word)     5,948,416
    masked (undecidable)                119,400
    masked (rare, long token)        21,056,940

Labels verified by inspection: `ខែមករា` → `|.|...`, `នៅឆ្នាំ` → `|.|....`, and `ទីក្រុង` → `|.?....` — the
ambiguous position masked, exactly as designed.

**Known limitation:** layer 3 masks 64.7% of positions, nearly all of it long unannotated runs from sparse lines,
because a long run's full concatenation is never in the split table. 10.05M supervised interior positions survive
(32.2%), which is ample, but the sparse half of the corpus contributes context rather than supervision. A local
longest-word lookup at each cut would unlock it and is not done here.

## Run 4 — 2026-08-05 17:25 · the BiLSTM, and the baseline measured on the same split

Per-character tagger: char embedding (96) → 2-layer BiLSTM (256, dropout 0.2) → 3 logits (pad / no boundary /
word starts here). 830k runs after dropping fully-unsupervised ones, 8.03M supervised interior positions, 13.4%
positive, char vocab 86, 6 epochs on a 3090.

The unigram Viterbi baseline is **reimplemented inside the trainer** rather than quoted from `segment.ts`'s header.
Its 54.7% figure was measured on a different split with a different metric (last-word exact), and putting that
number beside a neural F1 would be comparing two experiments. Same split, same metric:

| model | P | R | F1 |
|---|---|---|---|
| unigram Viterbi | 53.5% | 75.5% | 62.6% |
| BiLSTM (weight 2.0) | 74.6% | 98.6% | 84.9% |
| **BiLSTM (weight 1.0, shipped)** | **78.1%** | **97.5%** | **86.7%** |

## Run 5 — 2026-08-05 17:32 · the end-to-end metric, which disagreed with F1

F1 is the model's accuracy at its own task, not the thing we want. Built `eval_km_segmenter.mts`: for 3,000
junctions a writer marked with U+200B, does the IPA of the joined run match the IPA of the two words read
separately?

| | matches the boundary-aware reading |
|---|---|
| sync engine, no segmentation | 44.7% |
| neural segmentation | **80.4%** |

1,309 fixed against 240 broken (5.5:1), net +35.6%. Boundary on the human's exact position 78.0%.

**⚠ The two metrics ranked the models differently.** Weight 2.0: F1 84.9, end-to-end 80.7%. Weight 1.0: F1 86.7,
end-to-end 80.4%. The higher-F1 model is marginally worse downstream — but 0.3pp of 3,000 is nine utterances, so
downstream is a tie and the decision fell to the tie-breakers: weight 1.0 has 3.5pp more precision and stops
shredding real words (`ថ្ងៃទីមករា` → `ថ្ងៃ|ទី|មករា`, not `ថ្ងៃ|ទី|មក|រា`; `ព្រះរាជាណាចក្រកម្ពុជា` keeps រាជាណា
whole). Ordinary text has far more plain words than compound junctions, so precision is the safer error. Recorded
because F1 alone would have shipped the other model.

**What the 240 "broke" cases are.** Almost all over-splits relative to the human's tokenisation — `ទីកន្លែង` →
`ទី|កន្លែង`. Worth noting the reference is not an authority: the model's `tiː kɑnlaeŋ` may well be a better reading
of កន្លែង than the reference's `knlɛːŋ`, but that is a g2p question and this metric cannot settle it. The number is
reported as-is rather than argued down.

## Run 6 — 2026-08-05 17:36 · shipped as the async tier

`phonemizeKmNeural` registered in `neuralRegistry.ts`. The sync engine is untouched: segmentation changes which
lexicon entries hit and how the syllabifier parses every Khmer run, so `phonemize` behaves exactly as before while
`phonemizeAsync` reads better Khmer. Same shape as Hebrew's nakdan — restore what the script omits, then read.
Absent `onnxruntime-node` or the model the path IS the sync engine, no throw. int8 ONNX 2.3 MB; the torch
checkpoint is gitignored as a regeneratable intermediate, matching the sindhi/danish convention.

Corrected `segment.ts`'s header while here: it claimed frequency weighting avoids preferring compounds over their
parts. That holds only while the compound is rare, and `ខែមករា` (505) disproves it — 0 of 12 month boundaries
recovered.

**Still open:** the perceptron/n-gram baseline the data now makes nearly free (same labels, same split, same
`eval_km_segmenter.mts`); whether to promote segmentation into the sync path, which needs a referee before/after
pass; and layer 3's 64.7% masking, which a local longest-word lookup would reduce.
