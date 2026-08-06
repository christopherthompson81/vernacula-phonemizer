# Data generators

One-off tools that BUILD shipped data files (not eval). They read source corpora from external paths
(`$DUMPS/*`, pypinyin) and emit committed artifacts under `src/languages/<lang>/`:

- `build-cmn-pinyin.mjs` — Mandarin Hanzi→pinyin (chars.tsv / phrases.tsv) from pypinyin (MIT).
- `pt-gen-lexicon.mts` — European Portuguese correction lexicon from wikipron por.
- `ru-gen-lexicon.mts` — Russian stress lexicon from kaikki rus.
- `build-sv-lexicon.mts` — Swedish pitch-accent + stress lexicon (accent-stress.tsv) from the CC0 NST
  Pronunciation Lexicon (abstract features only: accent 1|2 + stress ordinal — not the NST segments).
- `build-ca-midvowels.mts` — Catalan stressed mid-vowel HEIGHT (mid-vowels.tsv) from the espeak-ng 1.52
  Central shim over the 50k corpus (abstract feature only: is the stressed ⟨e⟩/⟨o⟩ close or open).
- `build-ca-geminate.mts` — Catalan bl/gl-gemination lexicon (bl-gl-geminate.tsv) from the same espeak run
  (abstract feature only: does intervocalic ⟨bl⟩/⟨gl⟩ geminate — popular — or spirantize — learned).

- `build-my-dict.ts` / `build-my-segwords.ts` / `build-my-voicing.ts` — Burmese exact-word correction dict,
  multi-syllable segmentation words, and voicing lexicon, mined from the kaikki mya gold (CC-BY-SA).
- `build-el-synizesis.ts` — Greek synizesis lexicon: words where the wikipron ∩ kaikki referees AGREE that
  the vowel sequence fully synizes (a lexical fact verified by two independent referees).
- `build-za-sawndip.ts` — Zhuang Sawndip readings from the kaikki Zhuang dump.
- `build-nan-chhoetaigi.mts` / `build-nan-kaikki-chars.mts` — Min Nan word + single-char dictionaries from
  ChhoeTaigi's permissive components (CC BY-SA 4.0 / CC0) and kaikki Hokkien citations.
- `build-cs-kaikki-dict.mts`, `build-cy-kaikki-dict.mts`, `build-da-lexicon.mts`, `build-de-*.mts`,
  `build-ga-lexicon.mts`, `build-km-lexicon.mts`, `build-th-kaikki-dict.mts`, `fix-fr-lexicon-loi.mts`,
  `extract_kaikki_de.py` — the remaining per-language lexicon/feature builders.

These are provenance/reproducibility records; the corpora they read are not committed. Regenerating a
committed artifact should be a NO-OP diff — if it is not, the upstream or the engine changed.

For the systematic eval harness (does our output agree with independent referees?) see
`../referee-eval/`; for one-off per-language validation against an external benchmark, `../eval/`.
