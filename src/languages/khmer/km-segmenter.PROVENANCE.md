# `km-segmenter.int8.onnx` provenance

A per-character **BOUNDARY TAGGER** (BiLSTM sequence-labeller) that restores the word boundaries Khmer does not
write. Inference in `khmerSegmenter.ts`; the async entry is `phonemizeKmNeural` (`khmerNeural.ts`). Each character
gets one label — "a word starts here" or not — and boundaries are re-inserted as U+200B, which `khmer.ts`'s
tokeniser already treats as a run break. Output length == input length, so it **cannot lose or invent a
character**: the worst failure is a boundary in the wrong place. One forward pass, no beam, no autoregressive
decode.

## Why it exists

Khmer writes no inter-word space, so the engine tokenises a maximal Khmer run as ONE unit and the syllabifier
re-parses across boundaries it cannot see. Measured on 4,000 junctions where a Khmer writer actually typed U+200B
— human labels, not inference — **joining the two words corrupts the reading 54.6% of the time**:

| written | joined | with the boundary |
|---|---|---|
| នៅ + សតវត្ស | `nɨwhtɑʋɑt` — ស collapsed to a coda, a syllable gone | `nɨw sɑtɑʋoət` |
| ខែ + កុម្ភៈ | `kʰaekom` — truncated | `kʰae kompʰeəʔ` |
| ខែ + ឧសភា | `kʰaehpʰiə` | `kʰae ʔosɑpʰiə` |

9 of the 12 month names degrade this way, and ខែ alone precedes a word 14,391 times in the mined corpus.

## Why not the unigram segmenter that already ships

`segment.ts` is a unigram Viterbi over ZWSP-harvested word frequencies (`km-wordfreq.tsv`). It recovers **0 of 12**
month compounds, and the reason is structural rather than a tuning failure: everything is in the vocabulary —
ខែ 2,576, មករា 620, **and ខែមករា 505** — and splitting always pays an extra −log(p) term, so a compound that is
itself frequent wins outright. **Frequency data cannot fix a problem caused by frequency.** The obvious repair
("split when a compound is rarer than both parts") would split 37.2% of the vocabulary and breaks real words
(`លើក` 2,318 → `លើ | ក`). That module keeps its narrower remit: the one boundary the ៗ reduplication rule needs.

## Results

Seed-0 20% held-out split, 165,999 runs / 2.02M supervised positions. The unigram Viterbi is **reimplemented
inside `train_km_segmenter.py`** so both models are scored on the identical split with the identical metric rather
than quoting two different experiments:

| model | P | R | F1 |
|---|---|---|---|
| unigram Viterbi (`segment.ts`) | 53.5% | 75.5% | 62.6% |
| **BiLSTM tagger (this model)** | **78.1%** | **97.5%** | **86.7%** |

End-to-end on 3,000 writer-marked junctions (`tools/khmer/eval_km_segmenter.mts`) — agreement between the IPA and
the boundary-aware reading, which is the quantity that actually matters:

| | matches the boundary-aware reading |
|---|---|
| sync engine, no segmentation | 44.7% |
| **with this model** | **80.4%** |

1,309 junctions fixed against 240 broken (5.5:1), net **+35.6%**. The boundary lands on the human's exact position
78.0% of the time.

**⚠ F1 and the downstream metric disagreed, and the downstream one was a tie.** A positive class weight of 2.0
scores F1 84.9 and 80.7% end-to-end; weight 1.0 scores F1 86.7 and 80.4%. The 0.3pp gap is nine utterances out of
3,000 — noise. The shipped model is weight 1.0, chosen on the tie-breakers: 3.5pp more precision, and it stops
shredding real words (`ថ្ងៃទីមករា` → `ថ្ងៃ|ទី|មករា` rather than `ថ្ងៃ|ទី|មក|រា`). Text outside this test
distribution holds far more ordinary words than compound junctions, so precision is the safer side to err on.
Recorded because F1 alone would have picked the other model.

## The linear baseline, and what it says about where the gain came from

An averaged perceptron over the standard character-window features, trained on the same labels and scored on the
same split (`tools/khmer/train_km_perceptron.py`, which replicates the split rather than re-drawing it):

| model | P | R | F1 | end-to-end | dependency |
|---|---|---|---|---|---|
| unigram Viterbi | 53.5% | 75.5% | 62.6% | — | none |
| averaged perceptron | 76.5% | 90.2% | 82.8% | 76.7% | **none** |
| **BiLSTM (this model)** | 78.1% | 97.5% | **86.7%** | **80.4%** | onnxruntime-node |

The perceptron uses features a segmenter could have used in 2007, so **62.6 → 82.8 is the LABEL CLEANING, not the
architecture**; the BiLSTM adds 3.9 F1 on top. Its advantage is specifically RECALL on lexicalised collocations —
it misses 301 boundaries where the perceptron misses 1,216, at the same spurious rate — which is what seeing the
whole run buys over a 5-character window.

## ⚠ The reported precision is a FLOOR, not an estimate

Error analysis over 97,811 held-out positions (`tools/khmer/errors_km_segmenter.py`): 93% of this model's errors
are over-splits, 87% of them inside tokens absent from `km-wordfreq.tsv` and 95% inside tokens of 7-13 characters
(a typical Khmer word is 4-5). Testing where each gold `0` came from:

    real model errors (label verified)      47   =  1.2%
    label never verified at all          3,912   = 98.8%

Those 3,912 are positions the label pipeline's layer 3 defaulted to 0 because the token was too rare to estimate,
and 33.7% of them split between two KNOWN words — `និង(40204)|ជញ្ជាំង(158)`, `ចូល(3641)|រួម(1517)`. Verified errors
are 348 of 97,811 = **0.36%**. True precision lies between 78.1% and ~99%; the corpus cannot settle it without
annotation, so it is quoted as the floor.

**What it genuinely misses** are junctions between two frequent known words — មហា|ក្សត្រ, ជា|មួយ, ដឹក|នាំ,
មិន|មែន — i.e. lexicalised collocations, where "one word or two" is contested. 97 of the 301 misses are contested
by the writers themselves (<90% split them).

## Training data, and the label cleaning that makes it usable

Source: a `km.wikipedia.org` dump converted by `tools/normalization/wikidump-to-text.py` (#585) — 180,782
paragraphs. **No external lexicon, no annotation, no other model**: the supervision is the U+200B that Khmer
writers already type.

**⚠ And that supervision is ONE-SIDED**, which is the whole difficulty. A typed ZWSP is a positive a human placed;
its absence means either "no boundary" or "the writer did not bother". Training on raw lines teaches the model
that most real boundaries are non-boundaries. `tools/khmer/build_km_segmenter_data.py` cleans it in three layers:

1. **Density filter** — mean characters-per-token per line proxies annotation completeness, and the corpus is
   sharply bimodal on it (p10 = 4.9 vs p50 = 17.4). Lines averaging ≤6 characters per token have nearly every
   boundary marked: 15,501 of 180,782. This is the **calibration set, not the training set**.
2. **Per-split-point rate**, measured on layer 1 and applied to the whole corpus. Over raw text this signal is
   confounded by document annotation habits and collapses — month compounds score 13-19%, indistinguishable from
   noise. Restricted to dense lines they score **67-82%** while `លើក` stays at 0.9%, and the histogram splits into
   two modes with a valley at 40-50%. Rate ≥60% → the boundary is real, relabel **every** occurrence including the
   ~85% no writer marked; ≤10% → trust the zero; **otherwise abstain**, masking the position out of loss and score.
3. **Length guard** for sequences below 10 observations: a token longer than the dense subset's own p99 (13
   characters) is a suspected unmarked compound and is masked rather than fed as a negative.

Yield: 1,504,641 runs / 32.7M characters, of which 1,202,385 typed boundaries plus **145,706 recovered** ones and
10.05M supervised interior positions (32.2%). Abstention is what makes this sound rather than merely bigger —
`ទីក្រុង` at 11.3% is a real question about a lexicalised compound that the corpus does not answer, and its label
is `?` rather than a guess.

**Known limitation:** layer 3 masks 64.7% of positions, nearly all long unannotated runs from sparse lines, because
a long run's full concatenation never appears in the split table. Those runs contribute context but not
supervision. A local longest-word lookup at each cut would unlock them; not done.

## Architecture and shipping

Character embedding (96) → 2-layer **bidirectional** LSTM (hidden 256, dropout 0.2) → linear → 3 logits
(0 = pad/ignore, 1 = no boundary, 2 = word starts here). Input `chars` int64 `[1, L]`, output `logits`
`[1, L, 3]`, both dynamic in L. Character vocab 86. One int8 ONNX graph, **~2.3 MB**. Decode (argmax between
classes 1 and 2, then U+200B insertion) happens in TS from `km-segmenter.meta.json`.

**⚠ It ships as the ASYNC tier and the sync engine is untouched.** Segmentation moves every reading in the
language — which lexicon entries hit, how the syllabifier parses — so `phonemize` behaves exactly as before and
`phonemizeAsync` reads better Khmer. `onnxruntime-node` is an optional dependency; absent it or the model,
`createKhmerSegmenter()` resolves to `undefined` and the path IS the sync engine, with no throw.

Rebuild:

    .venv/bin/python tools/khmer/build_km_segmenter_data.py <km-paragraphs.txt> /tmp/km_seg.tsv
    .venv/bin/python tools/khmer/train_km_segmenter.py /tmp/km_seg.tsv src/languages/khmer
    .venv/bin/python tools/khmer/export_km_segmenter_onnx.py src/languages/khmer
    npx tsx tools/khmer/eval_km_segmenter.mts <km-paragraphs.txt> 3000

See `docs/investigations/km_word_segmentation_investigation.md`.
