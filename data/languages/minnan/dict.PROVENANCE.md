# `dict.tsv` + `dict-chars.tsv` — provenance (Min Nan / Taiwanese Hokkien, nan)

**What it is.** Han → Tâi-lô readings: `dict.tsv` holds 63,561 word entries and `dict-chars.tsv` 6,974
single-character entries. Built by `tools/gen/build-nan-chhoetaigi.mts` and
`tools/gen/build-nan-kaikki-chars.mts`.

**Sources.**

| Source | Used for | Licence |
|---|---|---|
| 台華線頂對照典 (2002+, 楊允言), via [ChhoeTaigi](https://github.com/ChhoeTaigi/ChhoeTaigiDatabase) — priority | words; explicit and alignment-derived characters | **CC BY-SA 4.0** |
| iTaigi 華台對照典 (2016+), via ChhoeTaigi | words; explicit and alignment-derived characters | **CC0** |
| kaikki.org Wiktionary Hokkien citation readings (General Taiwanese Tâi-lô), from `kaikki.org-dictionary-Chinese.jsonl` | 2,124 characters the above do not cover | **CC BY-SA** |

Word rows are taken where the written form (`HanLoTaibunKip`) is pure Han with exactly one reading syllable per
character. Character rows are tiered: explicit ChhoeTaigi entries first (overridden by the running-text
reading when the aligned word data contradicts them with ≥ 5 votes and ≥ 60% majority), then per-character
majority votes over all aligned rows, then kaikki, then single-attestation alignments.

**Licence.** The combination inherits CC BY-SA 4.0; the CC0 component imposes nothing
(`LICENSES/PROVENANCE.md` §3).

**Licence history.** Rebuilt on 2026-07-29 from these sources. The previous layer could not be shipped:
the MOE 臺灣閩南語常用詞辭典 is CC BY-ND 3.0 TW (no derivatives), and the ChhoeTaigi priority sources it used,
甘字典 and 台日大辭典, are CC BY-NC-SA 3.0 TW (non-commercial). That layer has been fully replaced.

Build notes and validation: `docs/investigations/nan/minnan-dict_build_notes_investigation.md`.
