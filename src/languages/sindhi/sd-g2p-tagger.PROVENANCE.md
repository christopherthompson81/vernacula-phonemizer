# `sd-g2p-tagger.int8.onnx` provenance

A per-letter **STRUCTURAL TAGGER** (BiLSTM sequence-labeller) that restores the Sindhi abjad's UNWRITTEN SHORT
VOWELS on OOV words — the neural OOV tier for Sindhi (`phonemizeSdNeural`; inference in `sindhiTagger.ts`).
Each Perso-Arabic letter is labelled with an IPA-chunk tag (the consonant, *copied*, plus whatever short vowel
follows it, or none), so output length == input length: it cannot degenerate, and a per-letter
consonant-consistency mask limits each letter to the tags it produced in training.

## Why a tagger, and why here
Sindhi's short vowels are unwritten; the rule g2p defaults every one to [ə]. That default is only **48.6%**
correct, and **81.4% of word-FINAL slots are something else** — overwhelmingly the retained grammatical -ʊ
(masculine nominative), which Urdu lost. That is morphologically conditioned, hence learnable, which is why
Sindhi succeeds where the Urdu tagger failed (Urdu's always-ə prior is 71.5% and its tagger LOST to it.)

## Architecture
Letter embedding (128) → 2-layer **bidirectional** LSTM (hidden 256) → linear → tag logits.
Input `chars` int64 `[1, L]`; output `logits` float32 `[1, L, nTags]`. Masked argmax + tag concatenation happen
in TS from `sd-g2p-tagger.meta.json` (`src` symbol→id, `tags` id→IPA chunk, `charTags` symbol-id→permitted tags).
51 symbols, 168 tags. One int8 ONNX graph, **2.49 MB**.

## Training data — CC BY, cross-script derived
9,274 vocalized Sindhi words, aligned per-letter by exact DP (a word is kept only if some path consumes the
whole word AND the whole gold IPA). Vowels come from the **Devanagari** sister-script, read as an abugida and
gated on the consonant skeleton matching what the Perso-Arabic rule g2p independently produces.

Sources: **Sindhi Open Lexicon Master Dataset** — published at SindhiLanguage.org, prepared and curated by
**Amar Fayaz Buriro (امر فياض ٻرڙو)** (attribution mandatory); plus kaikki Sindhi (Wiktionary, CC BY-SA 4.0).
See `tools/sindhi/PROVENANCE.md`.

**Inherent-vowel masking (important).** Devanagari's inherent vowel is अ = ə, so an unmarked consonant means
"default vowel", not "ə" — measured against an independent mine, ə→ʊ/ɪ disagreements outnumber the reverse
**61:12**. Those slots (28% of the data) are emitted as `ᵊ` by the miner and trained with label `-100` (ignored).
**Consequence: this model must NOT be used to fill inherent slots** — measured 11.4% vs 76.5% for simply leaving
ə (Phase 10). It has no gradient there by construction. Its job is the OOV path only.

## Measured (5-fold CV)

⚠ **RETRAINED 2026-08-19 WITH PACKED SEQUENCES — the largest gain in the fleet, and predictably so.** Training
ran the BiLSTM over padded batches without `pack_padded_sequence`, so its backward direction crossed the
padding before reaching each word's last letter, while serving (`sindhiTagger.ts`) is batch=1 and unpadded.
The damage lands at the END of the word — and Sindhi's entire signal is word-final: **81.4% of word-final
slots** are the retained grammatical -ʊ, which is the whole reason this tagger beats always-ə. Same 5-fold
split, same seed:

| 5-fold CV mean | unpacked training | **packed training** |
|---|---|---|
| slot accuracy | 78.3% | **80.3%** |
| word-exact | 68.3% | **69.8%** |

⚠ The historical 77.0%/67.4% below were measured on a "trustworthy labels" subset, so they are NOT the same
denominator as this pair and the comparison to make is 78.3 → 80.3 within it. See investigation Runs 41, 43.
| | |
|---|---|
| **tagger slot-accuracy** | **80.3%** |
| tagger word-exact | 69.8% |
| next-letter bigram baseline | 71.4% |
| per-letter + is-final | 67.9% |
| per-letter majority | 66.2% |
| always-ə | 44.5% |

Beating a next-letter bigram by +5.5pp is the whole-word bidirectional context the BiLSTM is for.
On the unmasked (mixed-label) evaluation the same model scores 68.4% slot vs a 58.8% one-line final-ʊ rule.

On 3,000 OOV FLEURS `sd_in` word types: 15.1% DECLINED (an unseen letter → falls back to rules, no throw),
86.4% of tagged words preserve the rule path's consonant skeleton; the 13.6% that differ are almost entirely
و/ي glide↔vowel reinterpretations (چيو rule `t͡ʃiːʋ` → neural `t͡ʃjoː`), where the model is often the better read.

## Build
`tools/sindhi/export_sd_tagger_onnx.py` — trains 40 epochs (Phase 10 measured 200 and found held-out accuracy
flat 75–78% from epoch 30, so longer is pure overfit), exports fp32 ONNX, verifies argmax parity vs PyTorch
(**400/400 words exact**), int8 dynamic-quantizes (**400/400 word-level argmax agreement with fp32**), and writes
the meta sidecar. Run under a torch≤2.6 venv — torch 2.12's default dynamo exporter needs `onnxscript`.

## Serving
`onnxruntime-node` is an OPTIONAL dependency, imported lazily. Absent model or runtime → `createSindhiTagger()`
resolves to `undefined` and `phonemizeSdNeural` is exactly the sync path. Precedence: **lexicon → tagger →
default-ə rules**; the sync `phonemize(text, "sd")` is untouched.
