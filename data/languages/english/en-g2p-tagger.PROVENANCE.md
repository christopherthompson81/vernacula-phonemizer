# `en-g2p-tagger.int8.onnx` — provenance

**What it is.** A per-grapheme BiLSTM tagger that maps an OOV English word to ARPABET chunks, which the shared
converter turns into IPA. It is the neural OOV tier for English. `en-g2p-tagger.meta.json` holds its maps and
the consonant-consistency mask.

**Training data.** This repo's own `g2p-dict.tsv`, not raw CMUdict. That is:
- CMUdict (public domain);
- the Moby Pronunciator II rows imported into it (`moby-import.tsv`; Grady Ward, public domain by the
  author's grant, `LICENSES/PROVENANCE.md` §5.3);
- the curated corrections in `g2p-curated.tsv`.

Graphemes are aligned to ARPABET chunks by hard EM (`tools/norwegian/nb_tagger_parallel.py`, `SEP=" "`).

**Licence.** Public domain (`LICENSES/PROVENANCE.md` §1).

**Regenerate.** This trains the held-out split model, then the full model, and writes the int8 export.

```bash
EN_PRODUCTION=1 EN_FREQ=data/languages/english/g2p-common.txt \
  .venv/bin/python -u tools/english/en_g2p_bilstm.py
```

The current weights were trained with torch 2.6.0+cu124, CUDA 12.4, onnx 1.22.0, onnxruntime 1.27.0 and
Python 3.12.3 on an RTX 3090. The pins are in `tools/english/requirements-bilstm.txt`. A cuDNN LSTM's
backward pass is not bit-deterministic, so a retrain may differ slightly.

Build notes and measurements: `docs/investigations/en/en-g2p-tagger_build_notes_investigation.md`.
