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

**Register-balancing the sources (the data lever, two mechanisms).** The permissive corpus is ~89% pre-modern by
token count (258k clause rows) vs only ~7% CC-BY-SA `modern/wiki` (9.9k rows) — but the deployment target is MODERN
running text (full ktiv-male spelling). Residual-miss mining showed the biggest buckets are modern-OOD (vav/yod
mater, reduced-vowel/dagesh) and that on the **~20% of skeletons shared by both registers the modal reading
CONFLICTS** (שנים = *šnayim* / *šanim*, ביום = *bjom* / *bajom*) — so a 12:1 pre-modern majority drags the net's
prior toward the archaic reading. The g2p is uniform across both registers, so the conflict is purely in the human
niqqud labels (genuine register/sense homographs). `build_tagger_data.ts` applies two complementary fixes:

1. **Oversample** `modern/wiki` + `validation` **×5** (→ 334k rows, modern share ~7%→23%), no pre-modern discarded
   — adds modern weight. Alone: 84.5%→85.6%. (Downsampling pre-modern instead REGRESSED to 81.5% — data loss
   dominates; ×10 oversampling overfit `modern/wiki` at 85.2% — ×5 is the sweet spot.)
2. **Targeted suppression** (the third mask column): on the pre-modern source, a word whose reading is ABSENT from
   the modern reading-SET for its skeleton (a genuinely-archaic vocalization modern never uses) is masked out of the
   loss — pre-modern still trains context, agreeing words, and the rare vocab it uniquely covers, but casts no vote
   on obsolete readings (3.6% of consonants). The *absent-from-modern* test (not merely "≠ the modern MODAL") spares
   the valid MINORITY reading of a real homograph: an earlier "≠ modal" mask lifted the aggregate but REGRESSED the
   homograph bucket 131→152; the set-based mask keeps it at 138 (≈ the 131 baseline).

Stacked (oversample ×5 + suppression): **84.5% → 86.4% word-exact** on held-out modern running text (+1.9pp over
baseline, +0.8pp over oversample-alone); per-consonant 94.0%→95.6%.

**Training:** 15 epochs, Adam 1e-3, cross-entropy `ignore_index=pad`, seed 0 (GPU). `train_he_tagger.py` (writes
`he_tagger.pt`) → `export_he_tagger_onnx.py` (int8 ONNX + meta; `dynamo=False`).

**Measured:**
- **Diacritization: 95.6% per-consonant niqqud** on the corpus held-out (the standard nakdan metric).
- **End-to-end on held-out MODERN RUNNING TEXT** (news/blogs/test_modern/dictaTest — none in training) vs the
  ground-truth vocalization: **86.4% word-exact**. The residual (mined): ~19% sheva/reduced-vowel free variation
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

## 2026-08-19 — retrained with PACKED sequences, on a harness that had to be rebuilt first

⚠ **THE EVAL THAT EVERY EARLIER DECISION USED WAS NEVER COMMITTED.** The 72.1 → 84.4 → 85.6 → 86.4 progression
in `he_native_bringup_investigation.md` Runs 3–6 is modern-holdout running-text word-exact, and no commit in
this repo has ever contained the harness that produced it (verified: no deletion in `git log --diff-filter=D`,
and no such file in any commit's tree). Reconstructed as `tools/hebrew/eval_modern_holdout.ts` from Run 3's
description plus PR #422 — sources `modern/news`, `modern/blogs`, `test_modern`, `dictaTestCorpus`, the
copyrighted subdirs the permissive-data policy EXCLUDES from training, which is what makes them a clean
holdout. It scores the SHIPPED model at 87.9% against its recorded 86.4%: same metric, same ballpark.

| modern-holdout word-exact | |
|---|---|
| shipped incumbent | 87.9% |
| rebuild, unpacked training | 87.7% |
| **rebuild, packed training (this model)** | **88.7%** |

The unpacked arm landing on the incumbent is what validates the rebuild; the packed arm then beats what is
deployed. Corpus-held-out per-consonant moved 93.9% → **95.6%** and clause-exact 46.0% → **61.6%**.

⚠ **The trainer's own numbers are a POOR PROXY and are different metrics.** Run 5 moved per-consonant 94.0 →
95.9 for a word-exact gain of only 84.5 → 85.6. And the trainer's "word-exact" is CLAUSE-exact (~5 words per
clause); comparing it against the 86.4% headline reads as collapse and means nothing. Both mistakes were made
and corrected while producing this table.

⚠ The corpus pin (`1211c8f`, upstream dated 2022-05-04) is HEAD as of 2026-08-19, **not** a record of what the
shipped model trained on — that was never captured. See `tools/CORPORA.md`.
