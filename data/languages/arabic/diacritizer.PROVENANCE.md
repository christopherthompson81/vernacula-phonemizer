# `diacritizer.onnx` — provenance (Arabic, MSA)

**What it is.** A sentence-level character BiLSTM (int8 ONNX, 19-label pausal scheme) that restores short
vowels on bare Arabic before the g2p. `diacritizer.meta.json` holds its character and label maps.

**Training data.** Silver-only, with no warm start:
- **Teacher:** CATT, the Character-based Arabic Tashkeel Transformer (AbjadAI, arXiv:2407.03236,
  <https://github.com/abjadai/catt>), **Apache-2.0**. It was used offline to label the training text.
- **Text:** **Arabic Wikipedia** (`arwiki-latest-pages-articles`), **CC BY-SA 4.0**, about 320k clean
  sentences.

**Licence posture.** The model is trained on CATT-labelled public Wikipedia text. It retains none of any
source corpus's selection or arrangement, only the orthographic regularities of the language, which are
facts (*Feist*). The inputs are permissive by their own terms in any case. It is listed with the models that
have share-alike training inputs under the training-as-use posture (`LICENSES/PROVENANCE.md` §3;
`LICENSES/licencing_posture.md`).

**Regenerate.** `tools/arabic/train_ar.sh` reproduces the shipped model. Data and licences are in
`tools/CORPORA.md`.

Build notes and measurements: `docs/investigations/ar/diacritizer_build_notes_investigation.md`.
