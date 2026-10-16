# `km-segmenter.int8.onnx` — provenance

**What it is.** A per-character boundary tagger (BiLSTM) that restores the word boundaries Khmer does not
write, re-inserting them as U+200B. It serves the async Khmer path. `km-segmenter.meta.json` holds its
character map.

**Training data.**
- **Khmer Wikipedia.** A `km.wikipedia.org` dump, converted by `tools/normalization/wikidump-to-text.py`.
  Wikipedia text is CC BY-SA. The supervision is the U+200B that Khmer writers already type, cleaned by
  `tools/khmer/build_km_segmenter_data.py`.
- **An independent word list.** `tools/khmer/km-lexicon-words.txt`, 62,101 Khmer forms from
  [google/language-resources](https://github.com/google/language-resources) `km/data/lexicon.tsv`,
  **CC BY 4.0** (© 2018 Google Inc.; attribution in that file's header). It confirms or recovers boundaries
  inside listed and unlisted tokens.

No other model or annotation is used.

**Licence.** A model with share-alike training input, held under the training-as-use posture with the arabic
diacritizers (`LICENSES/PROVENANCE.md` §3); the Google word list is attributed under §2 and in NOTICE.

**Regenerate.**

```
.venv/bin/python tools/khmer/build_km_segmenter_data.py <km-paragraphs.txt> /tmp/km_seg.tsv
.venv/bin/python tools/khmer/train_km_segmenter.py /tmp/km_seg.tsv src/languages/khmer
.venv/bin/python tools/khmer/export_km_segmenter_onnx.py src/languages/khmer
```

Build notes and measurements: `docs/investigations/km/km-segmenter_build_notes_investigation.md`.
