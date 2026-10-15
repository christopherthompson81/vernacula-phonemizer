# `bn-g2p-tagger.int8.onnx` — provenance

**What it is.** A word-level structural tagger (grapheme BiLSTM) that labels each Bengali grapheme with an
IPA chunk. It is the neural OOV tier for Bengali. `bn-g2p-tagger.meta.json` holds its maps and the
consonant-consistency mask.

**Training data.** Google [`language-resources/bn`](https://github.com/google/language-resources), about 60k
Bengali words, **CC BY 4.0**. Its phone codes are mapped to this repo's IPA by
`tools/bengali/googlePhoneMap.ts`, and a monotone EM aligner derives the per-grapheme tags.

**Licence.** CC BY 4.0, with attribution in NOTICE (`LICENSES/PROVENANCE.md` §2).

**Regenerate.**

```
curl -sL https://raw.githubusercontent.com/google/language-resources/master/bn/data/lexicon.tsv -o /tmp/google_bn_lexicon.tsv
npx tsx tools/bengali/build_tagger_data.ts /tmp/bn_tagger_train.tsv
python tools/bengali/train_bn_tagger.py /tmp/bn_tagger_train.tsv src/languages/bengali
python tools/bengali/export_bn_tagger_onnx.py src/languages/bengali
```

Build notes and measurements: `docs/investigations/bn/bn-g2p-tagger_build_notes_investigation.md`.
