# `riderDiacritizer.onnx` — provenance

**What it is.** A shared multilingual character-level BiLSTM (int8 ONNX) that restores short-vowel harakat on
a bare skeleton for the Perso-Arabic riders: Urdu, Persian, Pashto and Punjabi-Shahmukhi. `riderDiacritizer.meta.json`
holds its character, label and language-token maps.

**Training data.** Harakat labels mined by g2p inversion (`tools/perso-arabic/invert_harakat.ts`). For each
skeleton and reference-IPA pair, the miner searches for the vocalization whose output from this repo's g2p
reproduces the reference. The reference IPA comes from **wikipron** and **kaikki** (Wiktionary, CC BY-SA 4.0).

**Warm start.** The model is fine-tuned from the Arabic diacritizer checkpoint, a permissively sourced model
(CATT teacher on Arabic Wikipedia; see `data/languages/arabic/diacritizer.PROVENANCE.md`).

**Licence.** The weights are a derived work and are declared CC-BY-SA-inheriting (`LICENSES/PROVENANCE.md` §3).

**Regenerate.**
- Train with `tools/perso-arabic/train_multilingual_harakat.py`, then export with
  `tools/perso-arabic/export_onnx.py` (fp32 export, argmax parity check, int8 quantization).
- The train and eval manifests are committed; the Arabic warm-start checkpoint is not. See `tools/CORPORA.md`.

Build notes and measurements: `docs/investigations/core/riderDiacritizer_build_notes_investigation.md`.
