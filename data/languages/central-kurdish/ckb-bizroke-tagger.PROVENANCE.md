# `ckb-bizroke-tagger.int8.onnx` — provenance

**What it is.** A BiLSTM tagger that places Sorani's unwritten short /ɪ/ (the bizroke) on Central Kurdish
words the lexicon does not cover.
- Its input is this engine's own rule output, not the orthography.
- Each symbol is labelled either as itself or as itself + ɪ, so it cannot change a consonant.
- `ckb-bizroke-tagger.meta.json` holds its maps and mask.

**Training data.** 9,387 of the 10,041 pairs in the **AsoSoft Kurdish-G2P-dataset** (Aso Mahmudi), Zenodo
doi:10.5281/zenodo.4399769, declared "Other (Open)". Only the pairs whose target differs from this engine's
rule output by inserted /ɪ/ alone are used. Mandatory citations:
- **Veisi et al. 2020** (the top-5K frequency list);
- **Ahmadi 2019** (the Wergor list).

**Licence.** `LICENSES/LicenseRef-AsoSoftKurdishG2P.txt` holds the terms, the fence and the good-faith
undertaking to remove the artifact on request (`LICENSES/PROVENANCE.md` §2b). The source lists are not
redistributed here.

**Regenerate.** Clone the source repository, then run `tools/central-kurdish/train_ckb_bizroke.py --src <clone>`.

Build notes and measurements: `docs/investigations/ckb/ckb-bizroke-tagger_build_notes_investigation.md`.
