# `ckb-bizroke-tagger.int8.onnx` provenance

A **BIZROKE TAGGER** (BiLSTM sequence-labeller) placing Sorani's one UNWRITTEN VOWEL — the short /ɪ/ — on the
Central Kurdish words the AsoSoft-derived lexicon does not cover. The neural OOV tier for `ckb`
(`phonemizeCkbNeural`; inference in `centralKurdishTagger.ts`).

## The input is our own rule output, not the orthography
Unusual among the fleet's taggers and load-bearing twice. `preprocess` is `phonemizeWordRules`, so the model
labels each code point of the IPA this engine already produces with either **itself** or **itself + ɪ**.

1. **It cannot break anything.** The consonant-consistency mask in `core/structuralTagger.ts` limits every
   symbol to the tags it emitted in training, and no symbol ever emitted anything but those two. Altering,
   deleting or reordering a consonant is structurally impossible — the only decision the model can make is
   where the bizroke goes. `test/ckbNeural.test.ts` asserts the round-trip: strip ɪ from any tagger reading
   and you get `phonemizeWordRules` back, exactly.
2. **The referee stays non-circular.** The rules path is the tagger's input rather than the lexicon path, so
   `tools/referee-eval` still measures the rule engine alone.

## Why a model and not more lexicon, or a rule
The AsoSoft source is 10,041 words and **exhausted**. The lexicon built from it reaches 6.4% of FLEURS ckb
word *types* (9.2% of tokens — it catches frequent words), while the source's own rate says **26.8%** of the
words this engine otherwise transcribes correctly are missing a bizroke. Roughly 2,000 corpus types are left.

A fixed epenthesis rule was measured at every quality and is net negative (ɪ 52/500, i 133/419, e 160/392,
ə 106/446 closer/further against the audio), because the class is **lexical**: سفر is *safar*, a two-vowel
word written with neither, and one insertion after the first consonant is right that a vowel is missing and
wrong about how many and which. A model conditioned on the whole skeleton is a different instrument.

## Architecture
Symbol embedding (64) → 2-layer **bidirectional** LSTM (hidden 256) → linear → tag logits.
Input `chars` int64 `[1, L]`; output `logits` float32 `[1, L, nTags]`. Masked argmax + concatenation happen in
TS from `ckb-bizroke-tagger.meta.json` (`src` symbol→id, `tags` id→chunk, `charTags` symbol-id→permitted tags).
**No `<unk>`**: an unseen symbol has no `src` entry, so the shared factory declines the word and the rule
reading stands. Unlike sd/bn there is no tag here worth guessing. One int8 ONNX graph, **2.30 MB**.

## Training data
9,387 of the 10,041 AsoSoft pairs — those whose target differs from this engine's **rule** output by inserted
/ɪ/ and nothing else. 6,870 need no insertion (the negatives, and the reason the model learns *not* to insert)
and 2,517 carry at least one. The 654 that differ on some other axis are excluded: they are not this model's
business, and training on them would teach it to reproduce disagreements we have our own position on.

Source: **AsoSoft Kurdish-G2P-dataset** (Aso Mahmudi), Zenodo doi:10.5281/zenodo.4399769, declared
"Other (Open)". Mandatory citations: **Veisi et al. 2020** (the top-5K frequency list) and **Ahmadi 2019**
(the Wergor list). Terms, the fence, and the good-faith removal undertaking:
`LICENSES/LicenseRef-AsoSoftKurdishG2P.txt`. The source lists are **not** redistributed here — clone the
repository to rebuild. Rebuild: `tools/central-kurdish/train_ckb_bizroke.py --src <clone>`.

## Measured
| | |
|---|---|
| **tagger word-exact (stem-blind held-out)** | **95.1%** |
| never-insert baseline, same split | 73.8% |
| tagger word-exact, random split | 96.5% |
| fp32 ONNX argmax parity vs torch | 400/400 |
| int8 vs fp32 word-level agreement | 400/400 |

⚠ **The split is stem-blind — grouped by the first 5 characters of the Kurdish word — because Sorani's
inflected families would otherwise straddle it** (ئابووری / ئابوورییان / ئابوورییەوە). The random split reads
1.4pp higher and means less.

⚠ **Neither the referee nor the audio can score this tier.** `tools/referee-eval/langs/ckb.jsonc` folds
`[əɪ]` to nothing on *both* sides, because its two human referees agree the vowel exists and where it goes but
disagree on its QUALITY (wikipron writes ɪ, kaikki ə) — the referee is blind here by design. And the ASR
recognizer under-transcribes Sorani: 0.929 of our folded phone count, against 0.987 for German and 0.998 for
French, so it charges us for phones it never emits. The held-out split above is the entire instrument, which
is why it is reported honestly rather than favourably. See
`docs/investigations/asr_align_qc_investigation.md` Runs 37–39.
