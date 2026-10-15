# `fa-tagger.int8.onnx` — provenance

**What it is.** A sentence-level structural tagger (char BiLSTM) that labels each Persian abjad character
with an IPA chunk. It is the default modern Persian restorer. `fa-tagger.meta.json` holds its maps and the
consonant-consistency mask.

**Training data.** [HomoRich](https://huggingface.co/datasets/MahtaFetrat/HomoRich-G2P-Persian), about 528k
modern Persian sentences, **CC0**.
- It is cleaned by `build_homorich_ipa.py`: the `Phoneme` column, glottal onset `?`→ʔ, ق/غ restored to the
  `q`/`ɣ` split, ZWNJ joined.
- A monotonic char→IPA-chunk aligner then derives the per-character tags. Words that do not align are masked
  out of the loss.

**Licence.** CC0 (`LICENSES/PROVENANCE.md` §1).

**Regenerate.** `tools/persian/train_tagger.py` (writes `fa_tagger.pt`), then `export_tagger_onnx.py`.

Build notes and measurements: `docs/investigations/fa/fa-tagger_build_notes_investigation.md`.
