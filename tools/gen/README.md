# Data generators

One-off tools that BUILD shipped data files (not eval). They read source corpora from external paths
(`/mnt/data/*`, pypinyin) and emit committed artifacts under `src/languages/<lang>/`:

- `build-cmn-pinyin.mjs` — Mandarin Hanzi→pinyin (chars.tsv / phrases.tsv) from pypinyin (MIT).
- `pt-gen-lexicon.mts` — European Portuguese correction lexicon from wikipron por.
- `ru-gen-lexicon.mts` — Russian stress lexicon from kaikki rus.

These are provenance/reproducibility records; the corpora they read are not committed. For eval (does our
output agree with independent referees?), see `../referee-eval/`.
