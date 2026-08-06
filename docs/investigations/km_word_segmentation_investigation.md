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

## Run 7 — 2026-08-05 18:20 · the perceptron baseline, and it changed how the BiLSTM's score reads

Averaged perceptron, standard character-window features (the pre-neural segmentation feature set: characters
either side of the candidate boundary, their bigrams, one jump bigram, the straddling trigram). The split is
REPLICATED from the BiLSTM trainer rather than re-drawn — same filtering, same seed, same shuffle — so the
comparison is one experiment. Confirmed identical: 829,998 runs, 8,032,436 supervised positions.

| model | P | R | F1 | end-to-end reading match | dependency |
|---|---|---|---|---|---|
| unigram Viterbi | 53.5% | 75.5% | 62.6% | — | none |
| averaged perceptron | 76.5% | 90.2% | 82.8% | 76.7% | **none** |
| BiLSTM | 78.1% | 97.5% | 86.7% | 80.4% | onnxruntime-node |
| _(sync engine, no segmentation)_ | | | | 44.7% | |

**Where the gain actually came from.** The perceptron uses features a segmenter could have used in 2007, so the
jump from 62.6 → 82.8 F1 is almost entirely THE LABEL CLEANING, not the architecture. The BiLSTM adds 3.9 F1 /
3.7pp end-to-end on top. Worth stating plainly: the expensive part of this work was deciding which zeros to
believe.

## Run 8 — 2026-08-05 18:25 · which cases do we lose on — and the reported precision is a floor

Error analysis over 97,811 held-out positions (`tools/khmer/errors_km_segmenter.py`), bucketing every mistake.

**The headline is that 93% of the BiLSTM's errors are over-splits** — 3,959 spurious against 301 missed — and they
are concentrated: 87% inside tokens that are NOT in `km-wordfreq.tsv`, and 95% inside tokens of 7-13 characters,
against a typical Khmer word of 4-5.

That distribution was suspicious enough to test, by asking where each gold `0` came from:

    real model errors (the label was verified)        47   =  1.2%
    label never verified at all                    3,912   = 98.8%

**98.8% of the scored precision errors are positions layer 3 defaulted to 0** because the token was too rare to
estimate and short enough (≤13 chars) to be a plausible word. So the metric penalises the model for splitting
compounds nobody ever labelled. Checking whether those splits look real:

    both sides are known words   33.7%     e.g. និង(40204)|ជញ្ជាំង(158), ចូល(3641)|រួម(1517), បន្ទាប់(981)|គ្នា(5185)
    one side known               59.7%
    neither side known            6.6%

**So P 78.1% is a FLOOR, not an estimate.** Verified errors are 301 missed + 47 spurious = 348 of 97,811 positions
= 0.36%. The true precision lies somewhere between 78.1% (if every unverified zero is right) and ~99% (if the
model is right wherever it splits between two known words); the corpus cannot settle it without annotation, and
this is stated as a range rather than resolved in the model's favour.

**What we genuinely lose on** — the 301 missed boundaries, which are the errors that matter because a missed
boundary leaves the corrupted joined reading:

    មហា|ក្សត្រ (king)   ជា|មួយ   ដឹក|នាំ   មិន|មែន   ជុំ|វិញ   ទាំង|ឡាយ   ពិត|មែន   ទី|នេះ

Every one is a junction between two FREQUENT KNOWN words (144 of 301 have a known-frequent left side, 159 a
known-frequent right side) — i.e. LEXICALISED COLLOCATIONS, exactly where "one word or two" is genuinely contested.
**97 of the 301 are contested by writers themselves** (<90% of them split it), so roughly a third of the misses
are not clearly errors.

**Where the perceptron actually loses.** It misses 1,216 boundaries against the BiLSTM's 301 — **4x more** — and
the misses concentrate in the same place (775 with a known-frequent left side). Its spurious count is slightly
LOWER (3,665 vs 3,959). So the BiLSTM's entire advantage is RECALL on lexicalised collocations, which is what the
recurrence buys: it can see the whole run, while the perceptron sees a 5-character window. End-to-end this shows
as the same broke count (239 vs 240) and 110 more fixes. The two models agree on 97.2% of positions.

**The decision this sets up, not taken here.** The perceptron captures 90% of the BiLSTM's end-to-end gain
(+32.0pp of +35.6pp) with NO optional dependency, so it could serve `phonemize` itself rather than only
`phonemizeAsync`. Promoting either into the sync path changes every Khmer reading and still needs the referee
before/after pass `segment.ts` names. Both models and both eval paths are committed so that pass can be run.

## Run 9 — 2026-08-05 18:50 · shipped both tiers, and the referee comparison against HUMAN gold

Perceptron wired into the SYNC path (`createKhmer({ segment })`, default on); BiLSTM stays async and passes
`segment: false` so the two cannot compound each other's splits. The no-model fallback in `khmerNeural.ts` had to
be fixed to use a SEGMENTING engine — falling back to `segment: false` would have made the async path the worst of
the three.

**A decode guard was needed, and measuring it was the point.** Wiring the perceptron into sync broke `បូកដក`
("plus-minus", a word the NORMALIZER emits with a sourced reading): it came out `បូក|ដ|ក` → *ɓouk ɗɑː kɑː* instead
of *ɓoukɗɑːk*. Contrast the splits that are harmless — `ភាគរយ` → *pʰiək rɔːj* for *pʰiəkrɔːj* and
`ដុល្លារអាមេរិក` → *ɗollaː ʔaːmeːrək*, identical phonemes with an added word space. The difference is the
one-character fragment, so both decoders now refuse to emit a piece shorter than 2 characters. Cost is bounded and
measured: one-character words are **0.46%** of the 2,852,732 labelled gold words.

Blast radius on the suite: 3 of 3,017 tests, all Khmer, and all three were expectations rather than defects —
two were `toContain` on a joined form that is now word-spaced with identical phonemes, and one had pinned the sync
DEFECT (`kʰaehpʰiə`) which the sync path now fixes.

### The referee comparison — independent gold, and a soberer number

`tools/khmer/referee_km_segmenter.mts` replaces the self-referential reference. Gold is 7,062 usable **human**
wikipron transcriptions; pairs are concatenated to construct the situation Khmer presents, then scored on the
folded segmental backbone with the fleet's own `makeFold`:

| | agreement with the referee's two readings |
|---|---|
| each word read in ISOLATION (the ceiling) | 93.5% |
| concatenated, NO segmentation | **27.3%** |
| concatenated + perceptron (sync) | 46.2% |
| concatenated + BiLSTM (async) | **47.8%** |

Gap closed against the ceiling: perceptron 28.6%, BiLSTM 31.1%.

**⚠ THIS IS MUCH LOWER THAN THE CORPUS EVAL'S 44.7% → 80.4%, AND BOTH NUMBERS ARE HONEST.** They measure different
things. `eval_km_segmenter.mts` compares against `phonemize(a) + phonemize(b)` — the engine's OWN boundary-aware
output — so a correct segmentation matches it by construction and any word-level error cancels on both sides. The
referee eval has independent gold, and it also builds ARBITRARY dictionary-word pairs rather than the natural
collocations a corpus supplies, which is a harder input distribution. The corpus number is the better estimate for
real text; the referee number is the better estimate of absolute quality. Neither supersedes the other, and the
gap between them is the value of having both.

The word-level referee gate is unaffected by all of this, because it calls `phonemizeWordRules` directly and never
sees `text()`.

## Run 10 — 2026-08-05 18:55 · an additional, PERMISSIVELY-LICENSED source for the labels

Searched for more segmentation data. The two obvious corpora are both unusable here:

  · **khPOS** (12,000 manually word-segmented sentences) — **CC BY-NC-SA 4.0**, verified from the repository
    itself after a search summary wrongly reported Apache-2.0.
  · **ALT Khmer tokenised data** (NICT/NIPTICT, Zenodo 3937914) — the ALT *parallel corpus* is CC BY 4.0, but the
    Khmer tokenised portion says CC BY-NC-SA 4.0 in its description while its Zenodo Rights field says CC BY 4.0.
    An ambiguous licence reads as the restrictive one.

NonCommercial is already excluded by precedent in this tree: `af-stems.PROVENANCE.md` calls CC-BY-NC "incompatible
with this repo's licensing goals" and the Arabic diacritizer rejected a CC-BY-NC corpus by name.

**What IS usable: `google/language-resources` `km/data/lexicon.tsv`** — the same project that supplied Bengali's
gold, and the file's own header declares **CC BY 4.0**. 69,430 lines, of which **62,101 pure-Khmer word forms**,
and **57,577 are new** against our 7,145-entry frequency table (8.7x).

⚠ It is a WORD LIST, not segmented text — which turns out to be worth MORE for this problem than more text would
be, because it attacks the two known limitations directly. Of the 8,059,105 interior positions currently sitting
inside all-zero tokens (the unverified negatives that 98.8% of the model's scored precision errors land on):

    token IS a dictionary word → the zeros are CONFIRMED     4,894,141   60.7%
    token is NOT a word but splits into two → BOUNDARY       1,239,472   15.4%
    still unresolved                                         1,925,492   23.9%

Validated on the cases both earlier heuristics got wrong, and it settles all of them: `លើក` and `ជាមួយ` are
dictionary words (so the frequency heuristic's `លើ|ក` was wrong), `ទីក្រុង` is a word (so my pipeline's abstention
at 11.3% can be resolved), while `ខែមករា`, `ព្រះអង្គ`, `បូកដក` and `មហាក្សត្រ` are not words and split cleanly into
two that are. The `tok not in lex` guard is what makes the split test safe — it is why `លើក` is not split.

Note `ជាមួយ` and `ដឹកនាំ` are dictionary words yet appear in the model's MISSED list, i.e. the ZWSP labels said
split and the dictionary says not. Two independent sources disagreeing is the signature of a genuinely contested
lexicalisation, which matches the finding that 97 of the 301 misses are contested by writers themselves.

**Not implemented.** Adopting it means rebuilding the labels, retraining both models and re-running both evals,
and it incurs a CC BY 4.0 attribution obligation (the PROVENANCE convention already handles that). It is also a
pronunciation dictionary, so it could separately feed the Khmer g2p exceptions lexicon.
