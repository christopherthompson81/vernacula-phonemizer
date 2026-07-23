# `he-tagger.int8.onnx` provenance

The Hebrew **PHASE-2** neural **nakdan** — a SENTENCE-LEVEL per-consonant **BiLSTM** that restores the **niqqud**
of everyday UNVOCALIZED Hebrew; the deterministic Phase-1 g2p (`hebrew.ts`) then converts the reconstructed
vocalized words to Modern Israeli IPA (`phonemizeHebrewNeural`; inference in `hebrewTagger.ts`).

**Architecture — why niqqud, why sentence-level (the design decision).** Two axes:
1. *Sentence-level vs word-level.* Homographs (ספר = sefer/safar/siper, ילד = jeled/jaled, אוהב = ohav/ohev, היא =
   hi) are only resolvable from CONTEXT. So the tagger runs over a whole CLAUSE (words joined by single spaces, a
   space char = a word-boundary tag) — the fa `faTagger` pattern — and its bidirectional pass sees the cross-word
   context. This is the dominant lever: word-level → sentence-level lifted held-out running text 72.1% → **84.4%**
   word-exact (jeled not jlad, ohev not ohav, hi not ha).
2. *Predict niqqud (ar/nakdan) vs predict IPA directly (fa).* We predict the **niqqud**, then reuse the
   already-validated Phase-1 g2p. The net learns ONLY the context-dependent diacritization; the deterministic g2p
   rules (bgdkpt, patach genuvah, mater lectionis) stay in Phase 1 rather than being relearned by the net. This
   trains on the REAL human niqqud annotation (clean labels), gives a standard comparable diacritization metric,
   and decouples restoration from g2p (fixable independently). Rejected: seq2seq (degenerates), a pretrained
   transformer (no fleet Hebrew encoder; heavy). Future SOTA option: wrap Nakdimon's own MIT model.

Because output length == input length it **cannot degenerate**; a per-consonant consonant-consistency **mask**
constrains each letter to only the niqqud it took in training. Shares `core/onnx.ts` + `core/structuralTagger.ts`
(maskedArgmax) with the fa/bn taggers.

**Architecture:** char embedding (128) → 2-layer **bidirectional** LSTM (hidden 256) → linear → 74 tag logits.
Input: clause char-ids `[1, L]` (letters + space). Output: tag logits `[1, L, 74]`. The masked argmax +
reconstruction (consonant + predicted niqqud → vocalized word → Phase-1 g2p) happen in TS. Char vocab 30, tag vocab
74 (the niqqud classes + `∅` bare + space). One int8 ONNX graph, **~2.4 MB**.

**Training data:** the **Nakdimon `hebrew_diacritized`** collection (github.com/elazarg/nakdimon, MIT) — the
**permissively-licensed subset only**: PUBLIC-DOMAIN pre-modern (Bialik d.1934, Tchernichovsky d.1943, …) +
CC-BY-SA `modern/wiki` + `validation` (~830k words). Copyrighted modern news/blogs/lyrics EXCLUDED from the shipped
model (the permissive-data policy; the licensed modern corpus is the remaining lever for a follow-up). Each
vocalized clause → the unvocalized skeleton + the per-consonant niqqud, via `tools/hebrew/build_tagger_data.ts`.
No aligner needed.

**Register-balancing the sources (the data lever).** The permissive corpus is ~89% pre-modern by token count
(258k clause rows) vs only ~7% CC-BY-SA `modern/wiki` (9.9k rows) — but the deployment target is MODERN running
text (full ktiv-male spelling). Residual-miss mining showed the two biggest buckets are modern-OOD: vav/yod mater
(ktiv-male) and reduced-vowel/dagesh on modern vocabulary. Crucially, on the **~20% of skeletons shared by both
registers the modal reading CONFLICTS** (שנים = *šnayim* / *šanim*, ביום = *bjom* / *bajom*) — so a 12:1 pre-modern
majority drags the net's prior toward the archaic reading. `build_tagger_data.ts` therefore **oversamples
`modern/wiki` + `validation` ×5** (→ 334k rows, modern share ~7%→23%) WITHOUT discarding pre-modern coverage.
Measured **+1.1pp** on held-out modern running text (84.5%→85.6%); per-consonant 94.0%→95.9%. Downsampling
pre-modern instead lost data and REGRESSED (81.5%); ×10 oversampling overfit `modern/wiki` (85.2%) — ×5 is the
sweet spot. The g2p is uniform across both registers, so the conflict is purely in the human niqqud labels
(genuine register/sense homographs), which the bidirectional context pass is built to disambiguate.

**Training:** 15 epochs, Adam 1e-3, cross-entropy `ignore_index=pad`, seed 0 (GPU). `train_he_tagger.py` (writes
`he_tagger.pt`) → `export_he_tagger_onnx.py` (int8 ONNX + meta; `dynamo=False`).

**Measured:**
- **Diacritization: 95.9% per-consonant niqqud** on the corpus held-out (the standard nakdan metric).
- **End-to-end on held-out MODERN RUNNING TEXT** (news/blogs/test_modern/dictaTest — none in training) vs the
  ground-truth vocalization: **85.6% word-exact**. The residual (mined): ~19% sheva/reduced-vowel free variation
  (the gold itself is inconsistent) + ~10% context-free homographs + modern-vocab mater/dagesh — all data- or
  ambiguity-bound, none rule-tractable (prefix-particle and glottal misses are already ~0). The sync engine alone
  gives only a vowel-less consonant skeleton (ʃlvm ʔvlm) → this makes unvocalized Hebrew phonemizable.

**Reproduce:**

```
git clone https://github.com/elazarg/hebrew_diacritized /tmp/hebrew_diacritized
npx tsx tools/hebrew/build_tagger_data.ts /tmp/hebrew_diacritized /tmp/he_tagger_train.tsv
python tools/hebrew/train_he_tagger.py /tmp/he_tagger_train.tsv src/languages/hebrew
python tools/hebrew/export_he_tagger_onnx.py src/languages/hebrew
```

**Runtime contract:** `onnxruntime-node` is OPTIONAL (lazy). If it or this model is absent, `createHebrewTagger()`
resolves to `undefined` and `phonemizeHebrewNeural` returns exactly the sync Phase-1 path (no throw). Separate async
path; the sync engine + its tests are untouched.
