# `fa-context-restorer.{enc,dec}.onnx` provenance

A char-level SENTENCE-level seq2seq (BiLSTM encoder + attention decoder) that maps a whole Persian ABJAD hemistich
to IPA — the CONTEXT restorer. Unlike the word-level `fa-vowel-restorer` (which sees one word), this reads the
whole sentence, so it resolves the homograph / ezafe / connector ambiguities that only context fixes (Run 5). Two
int8 graphs, autoregressive; output is already Iranian (trained on the Iranian-normalised corpus).

**Training data:** the aligned-Shahnameh parallel corpus (tools/fa-restoration/parallel/, 39k hemistichs; Ferdowsi
PD + Tajik CC-BY-SA + our Tajik-derived silver IPA). Trained offline on the GPU
(tools/fa-restoration/export_context_onnx.py).

**Measured:** IN-DOMAIN (Shahnameh) it beats the word-level model by **+18.8pp** on held-out sentences (Run 15) and
nails ezafe (به نام خداوندِ جان و خرد → ba nɒme χodɒwande d͡ʒɒno χerad). ⚠ OUT-OF-DOMAIN (short/modern text) it can
HALLUCINATE (خانه بزرگ → repetition) — it is **CLASSICAL-Persian scoped**, an OPTIONAL path that does NOT touch the
default modern runtime. See docs/investigations/fa_shortvowel_restoration_investigation.md.
