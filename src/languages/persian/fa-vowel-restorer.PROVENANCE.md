# `fa-vowel-restorer.{enc,dec}.onnx` provenance

A char-level **seq2seq** (BiLSTM encoder + attention decoder) that maps a Persian **abjad** word directly to
**IPA** — the OOV neural tier for short-vowel restoration (the lexicon covers seen/frequent words). Targets IPA,
not harakat: the harakat intermediate can't express ezafe / final ه / و (it discarded 59% of the cross-script
training data). Two graphs (encoder + decoder-step) run autoregressively (beam-5) from TS via the optional
`onnxruntime-node`; int8-quantized (~5 MB total). Output is post-normalized classical→Iranian (short i→e, u→o,
final ه→e).

**Training data (permissive):** wikipron `fas_arab` broad (human, CC-BY-SA) abjad→IPA + a Tajik-derived
cross-script silver (tools/persian/fa-tg-silver.tsv; wikipron/tgwiki CC-BY-SA, IPA ours). Trained offline on
the GPU (`/mnt/data/ar-diac-venv`, torch+cuda) via `tools/persian/export_s2s_onnx.py`.

**Measured (held-out UNSEEN words, vs the fold-normalised wikipron reference):** 45.8% exact — ≈3× the fa g2p
default-[a] baseline (16%). See docs/investigations/fa_shortvowel_restoration_investigation.md.
