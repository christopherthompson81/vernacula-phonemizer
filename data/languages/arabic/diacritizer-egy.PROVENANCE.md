# `diacritizer-egy.onnx` — provenance (Egyptian Arabic)

**What it is.** The Egyptian counterpart of `diacritizer.onnx`. It has the same architecture, alphabet and
inference code, and restores Egyptian rather than MSA short vowels for `variety:"egyptian"` (arz).
`diacritizer-egy.meta.json` holds its character and label maps.

**Training data.** Teacher-to-student distillation, silver-only.
- **Teacher (offline only, not shipped):**
  - the CAMeL Tools `calima-egy-r13` Egyptian morphological analyzer, whose database is **GPL-2.0**;
  - the `disambig-bert-unfactored-egy` in-context disambiguator, **MIT** (NYU Abu Dhabi / Habash).

  They were used only to silver-label the training text, and are neither shipped nor part of the
  distributed model.
- **Text:**
  - **Masri (Egyptian) Wikipedia** (`arzwiki-latest-pages-articles`), **CC BY-SA 4.0**, all 2.67M lines;
  - the Egyptian subset of **arabic-dialect-corpus** (dataflare), **MIT**.
- No Wiktionary data is in the model. The kaikki-derived `egyptian-lexicon.tsv` is a separate file.

**Licence posture** (`LICENSES/licencing_posture.md`; the project author's reasoned posture, not legal
advice). A model trained on silver labels retains none of the teacher's or the corpus's selection and
arrangement, only the orthographic regularities of Egyptian Arabic, which are facts (*Feist*). GPL is a
copyright licence on the teacher database. Training a distinct model on its outputs is a use, not the
distribution of a derivative. The corpora are permissive by their own terms. The model is listed in
`LICENSES/PROVENANCE.md` §3 (training-as-use) and §4 item 5 (calima-egy, offline only).

**Regenerate.** Retrain with:

```
tools/arabic/train_ar_diacritizer.py --pausal 1 --cosine 1 --cosine-lr 5e-4 --epochs 37 --patience 99 --batch 128 --resume <v2 checkpoint>
```

Then export with `tools/arabic/export_ar_diacritizer_onnx.py --basename diacritizer-egy`. The upstream
silver pipeline (calima-egy labelling, filtering, the v2 training run) is described in the build notes.

Build notes and measurements: `docs/investigations/ar/diacritizer-egy_build_notes_investigation.md`.
