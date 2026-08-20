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
| unigram Viterbi (`segment.ts`) | 60.1% | 75.3% | 66.8% |
| **BiLSTM tagger (this model)** | **86.0%** | **95.6%** | **90.5%** |

## 2026-08-19 — retrained with PACKED sequences

Training ran the BiLSTM over padded batches without `pack_padded_sequence`, so the backward direction crossed
the padding before reaching each word's last symbol, while serving is batch=1 and unpadded — damage at the END
of the word. Same corpus, same split, same seed; see `tools/bilstm_training/tagger.py` and investigation Runs
41, 43, 47.

| (same split, unigram Viterbi control 66.7 F1 in BOTH arms) | P | R | F1 |
|---|---|---|---|
| unpacked training | 81.8% | 96.3% | 88.5 |
| **packed training (this model)** | **86.0%** | **95.6%** | **90.5** |

⚠ **REBUILT ON A NEWER DUMP, so this is not a reproduction of the 82.3/96.8/89.0 above.** A `latest` kmwiki
pull gives 187,369 paragraphs against the original 180,782, and the tell is that the unigram Viterbi CONTROL
moved too (66.7 vs 66.8) — the data changed, not the model. Compare the two arms above, which share a dump and
a split; do not compare either against the historical row.


⚠ These are measured against the DICTIONARY-EXPANDED labels (layer 4 below). The earlier label set gave
78.1/97.5/86.7 for this model and 53.5/75.5/62.6 for the baseline — both moved, because a change to the labels
changes what every model is scored against. Numbers are comparable WITHIN a label set, never across two.

End-to-end on 3,000 writer-marked junctions (`tools/khmer/eval_km_segmenter.mts`) — agreement between the IPA and
the boundary-aware reading, which is the quantity that actually matters:

| | matches the boundary-aware reading |
|---|---|
| sync engine, no segmentation | 44.7% |
| **with this model** | **83.5%** |

1,380 junctions fixed against 218 broken (6.3:1), net **+38.7%**. The boundary lands on the human's exact position
82.3% of the time.

### Against INDEPENDENT human gold

`tools/khmer/referee_km_segmenter.mts`. Gold is wikipron's human transcriptions; the input is REAL writer-marked
junctions from the corpus, kept only where both words have a referee entry — natural text and independent gold at
once. Scored on the folded segmental backbone with the fleet's own `makeFold`, applied PER WORD.

| | agreement with the referee's two readings |
|---|---|
| each word read in ISOLATION (the ceiling) | 83.4% |
| concatenated, NO segmentation | 36.4% |
| concatenated + perceptron (sync) | 80.4% |
| **concatenated + BiLSTM (async)** | **81.3%** |

Share of the recoverable gap closed: perceptron **93.6%**, BiLSTM **95.4%**.

⚠ **THREE EARLIER VERSIONS OF THIS MEASUREMENT WERE WRONG, AND ALL THREE READ TOO LOW** (~47%, then ~55%, then
~63/70%). Recorded because each flaw is easy to reintroduce:
  1. **Unnatural fixtures.** The pairs were built by combining referee ENTRIES rather than harvesting real text —
     first alphabetically adjacent ones (which in Khmer share a mean 3.11-character prefix, with 729 pairs where
     one word was literally a prefix of the other: `កង`+`កងពលតូច` → `កងកងពលតូច`), then randomly. Both feed models
     trained on running prose strings no Khmer writer would produce, so the score described out-of-distribution
     behaviour. This was the dominant error.
  2. **The fold was applied to the wrong unit.** The km folds are WORD-anchored (`[ptkc]$ → ʔ` glottalises a
     word-final stop), so folding two referee entries separately but the engine's whole output as one string
     guarantees a mismatch whenever the first word ends in a stop — common in Khmer. Cost ~16 points: the boundary
     was placed correctly (exactly one, right position) 72.2% of the time while the reading matched only 55.8%.
  3. A **contamination worry that turned out not to be measurable, and not a problem.** The label dictionary and
     this referee overlap 86.6%, so a "clean" subset was added to exclude the shared vocabulary — but on natural
     text that subset contains **8 junctions**, because words in wikipron yet absent from a 62,101-form dictionary
     barely occur in running prose. Which is the answer: the dictionary covers the vocabulary real text uses, and
     teaching a model the words of the language is the intent rather than a leak.

The corrected referee number (81.3%) now AGREES with the corpus eval (83.5%) instead of contradicting it, which is
the outcome that should have been expected: two independent references on the same natural input.

## The linear baseline, and what it says about where the gain came from

An averaged perceptron over the standard character-window features, trained on the same labels and scored on the
same split (`tools/khmer/train_km_perceptron.py`, which replicates the split rather than re-drawing it):

| model | P | R | F1 | end-to-end | dependency |
|---|---|---|---|---|---|
| unigram Viterbi | 53.5% | 75.5% | 62.6% | — | none |
| averaged perceptron | 80.1% | 91.8% | 85.5% | 79.2% | **none** |
| **BiLSTM (this model)** | 82.3% | 96.8% | **89.0%** | **83.5%** | onnxruntime-node |

The perceptron uses features a segmenter could have used in 2007, so **66.8 → 85.5 is the LABEL CLEANING, not the
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
are 348 of 97,811 = **0.36%**. True precision lies between 82.3% and ~99%; the corpus cannot settle it without
annotation, so it is quoted as the floor.

**What it genuinely misses** are junctions between two frequent known words — មហា|ក្សត្រ, ជា|មួយ, ដឹក|នាំ,
មិន|មែន — i.e. lexicalised collocations, where "one word or two" is contested. 97 of the 301 misses are contested
by the writers themselves (<90% split them).

## Training data, and the label cleaning that makes it usable

Source: a `km.wikipedia.org` dump converted by `tools/normalization/wikidump-to-text.py` — 180,782
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
4. **An INDEPENDENT dictionary** — `tools/khmer/km-lexicon-words.txt`, 62,101 Khmer forms from
   [google/language-resources](https://github.com/google/language-resources) `km/data/lexicon.tsv` under
   **CC BY 4.0** (© 2018 Google Inc.; attribution recorded in that file's header). 57,577 were absent from our
   ZWSP-harvested table. Layers 1-3 all derive from the same wiki text, so their blind spots are correlated — an
   error analysis found 98.8% of this model's scored precision errors on positions layer 3 had merely DEFAULTED to
   zero. A word list answers a different question: not "did a writer mark a boundary" but "is this a word at all".
   A listed token needs no internal boundary (zeros CONFIRMED); an unlisted token that divides into two listed
   words hides a real one. The `not listed` guard is what makes the split rule safe — `លើក` divides into two real
   words but is itself listed, so it is never split. Yield: **+205,862 recovered boundaries** and **2,259,271
   newly-confirmed zeros**, with undecidable masking falling 119,400 → 12,847.

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


