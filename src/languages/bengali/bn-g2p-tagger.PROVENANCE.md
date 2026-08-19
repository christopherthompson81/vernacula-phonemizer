# `bn-g2p-tagger.int8.onnx` provenance

A word-level **STRUCTURAL TAGGER** (BiLSTM sequence-labeller) that maps a bare Bengali word to canonical IPA — the
neural **OOV** tier for Bengali (`phonemizeBnNeural`; inference in `bengaliTagger.ts`). Instead of freely generating
an IPA string, it labels each Bengali **grapheme** with one IPA-chunk **tag** (the grapheme's consonant, *copied*,
plus the following inherent vowel ɔ/o or its deletion) and concatenates the tags. Because output length == input
length, it **cannot degenerate** and **cannot break the consonant skeleton** — a single forward pass, no beam, no
autoregressive decode loop, no degeneration guard.

**Why a tagger, not a seq2seq.** Bengali's hard problem is the inherent vowel: whether a consonant carries [ɔ], raises
to [o], or deletes — a **non-local, whole-word** decision (the মন[mon]/কম[kɔm] minimal pair proves it is lexical, not
rule-derivable). That is exactly a **per-grapheme labeling** task, and a BiLSTM's bidirectional pass supplies the
whole-word context. On the seed-0 20% held-out (OOV) split the three architectures measured:

| model | held-out ɔ/o | full-word | degeneration | ship weight |
|---|---|---|---|---|
| joint n-gram (Bisani-Ney) | 59.3% | 55.7% | — | light |
| seq2seq (BiLSTM enc + attn dec) | 86.1% | 79.4% | possible (এক→ækok) | enc+dec, decode loop |
| **BiLSTM tagger (this model)** | **90.5%** | **86.7%** | **impossible** | one graph, one pass |

⚠ **RETRAINED 2026-08-19 WITH PACKED SEQUENCES, AND THE OLD NUMBER WAS ALSO MEASURED WRONG.** Training ran the
BiLSTM over padded batches without `pack_padded_sequence`, so the backward direction crossed the padding before
reaching each word's last grapheme, while serving (`bengaliTagger.ts`) is batch=1 and unpadded — damage at the
END of the word. ⚠ The HELD-OUT pass was padded and unpacked too, so the published figure did not describe the
served model either. Decomposed on the same seed-0 split, with the held-out pass made serving-faithful in both
arms:

| | held-out ɔ/o | full-word |
|---|---|---|
| unpacked training (the old model, measured honestly) | 89.6% | 85.5% |
| **packed training (this model)** | **90.5%** | **86.7%** |

So the training fix is worth **+0.9pp ɔ/o and +1.2pp full-word** — and the historical 90.5%/86.4% was ~0.9pp
optimistic, because it scored the old model under a padding condition serving never presents. The naive
before/after (86.4% → 86.7%) conflates the two changes and understates the fix; it is recorded here as the
reason to decompose rather than to trust an unpaired comparison. See investigation Runs 41 and 43.

The n-gram is left-to-right and cannot see whole-word structure, so it drops non-locally-determined inherent vowels
(−27pp). The tagger *beats* the seq2seq because the monotone one-tag-per-grapheme constraint is a correct inductive
bias — it spends all capacity on the vowel decision instead of re-learning that output tracks input length. For the
rule engine the same OOV ɔ/o is 62.6%.

**Architecture:** grapheme embedding (128) → 2-layer **bidirectional** LSTM (hidden 256) → linear → 158 tag logits.
Input: grapheme char-ids `[1, L]`. Output: tag logits `[1, L, 158]`. The per-grapheme **consonant-consistency mask**,
argmax, and tag concatenation happen in TS (`bengaliTagger.ts`) from `bn-g2p-tagger.meta.json` (grapheme→id, id→tag,
per-grapheme permitted tag-ids). Grapheme vocab 61, tag vocab 158. One int8 ONNX graph, **~2.4 MB**.

**Training data:** Google [`language-resources/bn`](https://github.com/google/language-resources) — **CC-BY-4.0**,
~60k Bengali words, **non-Wiktionary** (independent of the wikipron/kaikki referees), retroflex-correct. Its phone
codes are mapped to our canonical IPA by `tools/bengali/googlePhoneMap.ts` (shared with the consensus-lexicon
builder). A **monotone 1-grapheme→0..2-IPA-unit EM aligner** (`tools/bengali/train_bn_tagger.py`) then derives the
per-grapheme training tags (each grapheme ↦ its consonant + trailing inherent vowel, or ∅ for a deleted inherent /
virama). Google's convention is Dhaka-leaning; at runtime the authoritative **Kolkata gold + cross-source consensus
lexicon** (`bengali-lexicon.tsv`) take **precedence** (lexicon → tagger → rule engine), so the tagger's convention
only affects the OOV tail — where 90.5% beats the rule engine's 62.6%.

**Consonant-consistency mask:** each grapheme may only emit tags whose consonant it *produced in training* (ক →
k/kɔ/ko, never ʃ; ষ → ʃ). The grapheme fixes the consonant; the model only picks the vowel decoration. Applied at
both training and inference, so the consonant skeleton is **always** correct and the model's entire job is the ɔ/o
decision.

**Training:** 20 epochs from scratch, Adam 1e-3, cross-entropy with `ignore_index=pad`, seed 0. Built offline (GPU,
RTX 3090) by `tools/bengali/train_bn_tagger.py` (writes `bn_tagger.pt`) → `export_bn_tagger_onnx.py` (writes this
int8 ONNX + meta; `dynamo=False` legacy exporter to keep the length axis dynamic). Held-out = the seed-0 20% slice
excluded from training; the shipped model is the 80%-trained model that was measured, so the 90.5% is honest for the
words it will actually be asked to tag.

**Reproduce:**

```
curl -sL https://raw.githubusercontent.com/google/language-resources/master/bn/data/lexicon.tsv -o /tmp/google_bn_lexicon.tsv
npx tsx tools/bengali/build_tagger_data.ts /tmp/bn_tagger_train.tsv
python tools/bengali/train_bn_tagger.py /tmp/bn_tagger_train.tsv src/languages/bengali
python tools/bengali/export_bn_tagger_onnx.py src/languages/bengali
```

**Runtime contract:** `onnxruntime-node` is an OPTIONAL dependency (lazy import). If it or this model is absent,
`createBengaliTagger()` resolves to `undefined` and `phonemizeBnNeural` returns exactly the sync `phonemize(text,
"bn")` (no throw). The tagger fills only OOV words; numbers, punctuation, clause assembly, Latin, and lexicon-covered
words are the **sync** engine's, byte-identical to the sync path. This is a SEPARATE async path — the sync engine and
its C# parity are untouched.
