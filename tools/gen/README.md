# Data generators

One-off tools that BUILD shipped data files (not eval). They read source corpora from external paths
(`/mnt/data/*`, pypinyin) and emit committed artifacts under `src/languages/<lang>/`:

- `build-cmn-pinyin.mjs` — Mandarin Hanzi→pinyin (chars.tsv / phrases.tsv) from pypinyin (MIT).
- `pt-gen-lexicon.mts` — European Portuguese correction lexicon from wikipron por.
- `ru-gen-lexicon.mts` — Russian stress lexicon from kaikki rus.
- `build-sv-lexicon.mts` — Swedish pitch-accent + stress lexicon (accent-stress.tsv) from the CC0 NST
  Pronunciation Lexicon (abstract features only: accent 1|2 + stress ordinal — not the NST segments).
- `build-ca-midvowels.mts` — Catalan stressed mid-vowel HEIGHT (mid-vowels.tsv) from the espeak-ng 1.52
  Central shim over the 50k corpus (abstract feature only: is the stressed ⟨e⟩/⟨o⟩ close or open).

These are provenance/reproducibility records; the corpora they read are not committed. For eval (does our
output agree with independent referees?), see `../referee-eval/`.
