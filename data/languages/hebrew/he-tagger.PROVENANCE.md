# `he-tagger.int8.onnx` — provenance

**What it is.** A sentence-level per-consonant BiLSTM nakdan that restores niqqud on unvocalized Hebrew. The
deterministic Phase-1 g2p then reads the vocalized words.

**Training data.** The **Nakdimon `hebrew_diacritized`** collection (<https://github.com/elazarg/nakdimon>,
<https://github.com/elazarg/hebrew_diacritized>), **MIT**. Only the permissively licensed subset is used:
- the public-domain pre-modern texts (Bialik d. 1934, Tchernichovsky d. 1943, …);
- CC BY-SA `modern/wiki`;
- `validation`.

That is about 830k words. The copyrighted modern news, blogs and lyrics are excluded from training.
`tools/hebrew/build_tagger_data.ts` turns each vocalized clause into its skeleton plus per-consonant niqqud,
oversamples the modern subsets ×5, and masks pre-modern readings that the modern subset never uses.

**Licence.** The majority tier is public domain (`LICENSES/PROVENANCE.md` §1). The `modern/wiki` slice is
share-alike and is covered by the training-as-use posture (§3).

**Regenerate.** The corpus pin is in `tools/CORPORA.md`. It records the upstream HEAD at the time of the
retrain, not a record of the original training snapshot.

```
git clone https://github.com/elazarg/hebrew_diacritized /tmp/hebrew_diacritized
npx tsx tools/hebrew/build_tagger_data.ts /tmp/hebrew_diacritized /tmp/he_tagger_train.tsv
python tools/hebrew/train_he_tagger.py /tmp/he_tagger_train.tsv src/languages/hebrew
python tools/hebrew/export_he_tagger_onnx.py src/languages/hebrew
```

Build notes and measurements: `docs/investigations/he/he-tagger_build_notes_investigation.md`.
