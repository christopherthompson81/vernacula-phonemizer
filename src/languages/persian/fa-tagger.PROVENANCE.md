# `fa-tagger.int8.onnx` provenance

A sentence-level **STRUCTURAL TAGGER** (BiLSTM sequence-labeller) that maps a whole Persian ABJAD sentence to
canonical IPA — the **DEFAULT** modern fa restorer (`phonemizeFaNeural`, per clause; inference in `faTagger.ts`). It
**replaces** the former `fa-context-modern` seq2seq. Instead of freely generating an IPA string, it labels each
abjad char with one IPA-chunk **tag** (the char's consonant, *copied*, plus its following short vowel / ezafe) and
assembles the tags into words on the space chars. Because output length == input length, it **cannot degenerate**
and **cannot break the consonant skeleton** — a single forward pass, no beam, no autoregressive decode loop, no
degeneration guard.

**Architecture:** char embedding (128) → 2-layer **bidirectional** LSTM (hidden 256) → linear → 1209 tag logits.
Input: abjad char-ids `[1, L]`. Output: tag logits `[1, L, 1209]`. The per-char **consonant-consistency mask**,
argmax, and tag-assembly happen in TS (`faTagger.ts`) from `fa-tagger.meta.json` (char→id, id→tag, and per-char
permitted tag-ids). Char vocab 42, tag vocab 1209. One int8 ONNX graph, **~3 MB** (vs the seq2seq's ~5 MB two-graph
enc/dec).

**Training data:** [HomoRich](https://huggingface.co/datasets/MahtaFetrat/HomoRich-G2P-Persian) — **CC0**, ~528k
modern homograph-rich Persian sentences — the same source and same cleaning as the former modern seq2seq
(`build_homorich_ipa.py`: train on the `Phoneme` column, keep the glottal onset `?`→ʔ, gheyn-condition ق/غ back to
the fa `q`/`ɣ` split, ZWNJ→concatenate so word-counts align). A **monotonic char→IPA-chunk aligner** then derives
the per-char training tags (each abjad char ↦ its consonant + trailing short vowel/ezafe); it round-trips ~91% of
words. The ی/و candidates include the **vowel+glide hiatus realization** (`iːj`/`uːv`, e.g. نیاز→niːjaːz, زیاد→
ziːjaːd) — one written char producing two IPA units; without these, every hiatus word failed to align and was masked
out of training (7185 words, 1.8%; the tagger then dropped the glide — Run 28). Non-alignable words (colloquial
fusions/elisions, rare anomalies) are **masked out of the loss, not dropped** — the whole sentence is kept for
context and only the alignable words carry a gold tag, so training uses ~all of the corpus while the aligner's
canonical convention defines the target.

**Consonant-consistency mask:** each char may only emit tags whose consonant it *produced in training* (ص→s, never
ʃ; غ→ɣ, never the colloquial ɡ). The char fixes the consonant; the model only picks the vowel decoration. Applied at
both training and inference, so the output is **always canonical** — it will not reproduce the colloquial consonant
values that appear in a minority of the gold.

**Training:** 12 epochs from scratch, Adam 1e-3, cross-entropy with `ignore_index=pad` (masked words contribute no
loss). `FA_WARM=1` warm-starts from a saved checkpoint for 4 epochs when iterating a single vocab-preserving change.
Built offline (GPU) by `tools/fa-restoration/train_tagger.py` (writes `fa_tagger.pt`) →
`export_tagger_onnx.py` (writes this int8 ONNX + meta). Held-out = a 1500-sentence slice excluded from training by a
skeleton-level leakage guard.

**Measured** (on the *shipped int8 ONNX*, argmax + consonant mask as in `faTagger.ts`; int8 ≈ pytorch, quantization
lossless):

| gold | tagger | (former seq2seq, same subset) |
|---|---|---|
| **HomoRich canonical held-out** (the fair self-measure) | **93.7%** per-word | 92.5% |
| all held-out words | 87.9% | 90.6% |
| catastrophic degeneration | **0% (structural)** | ~1.4% |

**Independent referee** (non-circular): vs GE2PE Kasre+Homograph (tools/referee-eval/referees/fa.ge2pe-ezafe-
homograph.tsv; modern Iranian, MIT, Sharif — adversarial hard-case sets), word-level **80.2% full / 88.4% backbone**
(consonants + long vowels). The ~90% plain-word backbone independently corroborates the segmental skeleton; the
ezafe/homograph gap is the sense/context residual (see the investigation doc). The hiatus retrain lifted this from
79.4%/87.8%.

The **canonical** subset is the fair measuring stick: the ~11% of held-out words the aligner rejects are colloquial
fusions/elisions (e.g. کاغذهای gold `kaːɡaʒaːje`, fusing ذه→ʒ and dropping the h) — forms a *careful/canonical*
phonemizer should never produce. On all words the seq2seq scores higher only because it *fit* that colloquial gold
noise; on the words with a well-defined canonical answer the tagger wins, and it emits clean canonical IPA
(کاغذهای → `kaːɣazhaːje`) rather than the gold's colloquial form. So the tagger is better on every axis that matters
for a canonical TTS front-end — accuracy on canonical gold, degeneration-safety, output convention, and size.

**Limitations:** the ~6.4% residual on the canonical held-out is the abjad **short-vowel / ezafe wall** — a genuine
information-floor error (the vowels are unwritten and not always recoverable from context), NOT degeneration. These
misses are **graceful** (a wrong short vowel; consonants and skeleton intact), never a runaway string. The eval is
in-distribution HomoRich gold, not an independent human referee, so fa remains **🟡** in `language-maturity.md`; the
tagger raises the floor and removes the degeneration risk but does not substitute for external validation.
