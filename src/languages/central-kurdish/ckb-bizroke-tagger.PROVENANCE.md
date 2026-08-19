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
| **tagger word-exact (stem-blind held-out)** | **96.6%** |
| never-insert baseline, same split | 73.8% |
| tagger word-exact, random split | 98.2% |
| fp32 ONNX argmax parity vs torch | 400/400 |
| int8 vs fp32 word-level agreement | 400/400 |

⚠ **The split is stem-blind — grouped by the first 5 characters of the Kurdish word — because Sorani's
inflected families would otherwise straddle it** (ئابووری / ئابوورییان / ئابوورییەوە). Measured the same way,
a random split reads 98.2% against the stem-blind 96.7% — 1.5pp of leakage, which is the size of the lie a
random split would tell here.

### Confirmed externally, once the referee fold was fixed
`tools/referee-eval/langs/ckb.jsonc` used to fold `[əɪ]` **to nothing** on both sides. That deletes the vowel
from our reading and the referee's alike, so it scores the vowel's *presence* as free and every tier — rules,
lexicon, tagger — reads identically. It was put there because the two referees disagree on the vowel's
QUALITY (wikipron ɪ, kaikki ə), but the fold that disagreement justifies is *normalise the quality*, not
*delete the vowel*. Under `[əɪ] → ə`:

| ckb tier (folded backbone) | wikipron ckb_arab_broad | kaikki ckb |
|---|---|---|
| rules only | 72.3% | 71.2% |
| + bizroke lexicon | 74.8% | 73.6% |
| **+ bizroke tagger** | **85.2%** | **85.0%** |

Both referees are independent of AsoSoft, so this is external confirmation of a tier the internal split could
only self-report. The tagger is worth 4.4× the lexicon because the lexicon is 2,517 words and most of the
referee vocabulary falls outside it.

⚠ **The two referees are not independent of each other.** All 972 wikipron headwords also appear in kaikki and
the two agree on 964 of them (99.2%) after folds; both scrape en.wiktionary. kaikki is a near-superset adding
65 words, not a second opinion. Read the two columns as one source measured twice.

### What the residual is made of
Classifying the 144 / 154 remaining misses by whether the consonant skeleton matches:

| | wikipron | kaikki |
|---|---|---|
| bizroke-only (skeleton exact, vowel differs) | 103 | 110 |
| — we omit a vowel the referee has | 43 | 49 |
| — we add one it does not | 57 | 57 |
| — same count, different slot | **3** | **4** |
| skeleton differs (not this tier's business) | 41 | 44 |

Two things worth noting. **Omission and over-insertion are near-balanced** (43 vs 57, 49 vs 57) — a
systematically over-eager model would be lopsided, so what is left is placement, not bias. And **3–4 misses
put the right NUMBER of vowels in the wrong SLOT**: when the model knows a vowel belongs, it nearly always
knows where. The skeleton-differs remainder is pharyngeal ħ/ʕ~h, uvular χ~x, long-vowel quality, and kaikki
letter-name rows (⟨و⟩ → *waw*) — all outside the bizroke question.

⚠ These counts are for the SHIPPED (packed) model with the split `c → k` / `ɟ → ɡ` fold. Measured before
either fix they read 92/105 bizroke-only with 6 wrong-slot each, so both fixes moved real words and the
wrong-slot class halved.

⚠ **The audio still cannot score this tier.** The ASR recognizer under-transcribes Sorani: 0.929 of our folded
phone count, against 0.987 for German and 0.998 for French, so it charges us for phones it never emits. See
`docs/investigations/asr_align_qc_investigation.md` Runs 37–40.
