# `dict.tsv` + `dict-chars.tsv` provenance — Min Nan / Taiwanese Hokkien (nan)

Rebuilt 2026-07-29 from PERMISSIVELY-licensed sources (docs/PROVENANCE.md §4.6). The previous
layer — MOE 臺灣閩南語常用詞辭典 (CC BY-**ND** 3.0 TW) words + a ChhoeTaigi extraction whose
priority sources 甘字典/台日大辭典 are CC BY-**NC**-SA 3.0 TW — was unshippable (NoDerivatives /
NonCommercial) and has been fully replaced. Builders:
`tools/gen/build-nan-chhoetaigi.mts` + `tools/gen/build-nan-kaikki-chars.mts`.

## `dict.tsv` — 63,561 word entries (was 14,970)

Han word → Tâi-lô, from rows whose written form (`HanLoTaibunKip`) is pure Han with exactly one
reading syllable per character:

| Source (via [ChhoeTaigi](https://github.com/ChhoeTaigi/ChhoeTaigiDatabase)) | Rows used | License |
|---|---|---|
| 台華線頂對照典 (2002+, 楊允言) — priority | 80,687 | **CC BY-SA 4.0** |
| iTaigi 華台對照典 (2016+) | 17,656 | **CC0** |

## `dict-chars.tsv` — 6,974 single-char entries (was 8,050), tiered

1. **Explicit ChhoeTaigi single-char entries** (台華 > iTaigi), with a **usage-weighted citation
   override**: when the aligned word corpus contradicts the explicit entry with ≥5 votes and ≥60%
   majority (292 chars), the running-text reading wins — 一 reads tsi̍t, not the literary i̍t; a
   TTS's standalone citation should be the reading the char actually takes in text.
2. **Alignment-derived** (1,551): per-char majority vote over ALL rows, including mixed Han-Lo
   forms (á無 ↔ á-bô) where the romanized runs anchor an exact alignment.
3. **kaikki Wiktionary Hokkien citation readings** (2,124 chars; **CC BY-SA**, same fence as the
   gan/hakka/jin/xiang dicts) — General-Taiwanese-preferred Tai-lo, extracted by
   `build-nan-kaikki-chars.mts` from `kaikki.org-dictionary-Chinese.jsonl`.
4. Sole-attestation alignment fallback (last resort).

Derived work inherits **CC BY-SA 4.0** (the CC0 component imposes nothing).

## Validation

- Referee eval (wikipron Hokkien, 5,535 single chars): **95.3% folded backbone / 97.4% symbol
  accuracy** vs the encumbered baseline's 90.7% / 93.0% — better on both, plus 4.2× word coverage.
- **Circularity caveat, stated:** tier-3 chars share Wiktionary parentage with the wikipron
  referee, so referee numbers for those chars are not independent. Independent-tiers-only
  (ChhoeTaigi 1+2+4) scores 73.0% — the honest independent floor. Quality assurance for tier 3 is
  the ChhoeTaigi cross-validation: 75.1% tone-insensitive agreement on 4,184 overlap chars, with
  most disagreement being literary/colloquial (文/白) reading variants, both valid.
- Within-word tone sandhi now applies inside newly-covered words (食飯 tsia̍h-pn̄g); the minnan
  test expectations were updated accordingly. Full suite 1504/1504.
