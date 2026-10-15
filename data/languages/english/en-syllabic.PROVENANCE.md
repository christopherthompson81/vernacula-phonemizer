# `en-syllabic.tsv` — provenance

**What it is.** For 4,835 English dictionary words, which `AH0`/`IH0` phones before `L`/`N`/`M` are reduced
slots (a syllabic consonant or an extra-short schwa). CMUdict does not mark this.

**Source.** misaki `us_gold.json`, [hexgrad/misaki](https://github.com/hexgrad/misaki), **Apache License 2.0**.
Only the slot positions are taken. No phoneme strings are copied, and only words already in this repo's
CMUdict-derived dictionary get a row. This is a convention import: it matches misaki's choice of where to
write a syllabic consonant.

**Regenerate.** `tools/english/en_build_syllabic.mts`, which is the whole extraction.

Build notes and measurements: `docs/investigations/en/en-syllabic_build_notes_investigation.md`.
