# `silver.tsv` provenance

Silver training data for the shared Arabic-script short-vowel restorer (see
`docs/arabic_script_restorer_investigation.md`).

## Source
[**wikipron**](https://github.com/CUNY-CL/wikipron) — the Arabic-script (`*_arab_broad`) scrapes of Wiktionary
pronunciations. wikipron data is distributed under **CC-BY-SA 4.0** (it derives from Wiktionary). This TSV is a
derived work and inherits **CC-BY-SA 4.0** — keep this attribution with any redistribution.

## Build
`python3 tools/arabic-restorer/build_silver.py` — fetches the `broad` transcription for every abjad-beneficiary
language, strips the orthographic diacritics to the undiacritized **skeleton** (the model's runtime input), pairs
it with the IPA (the vowel-bearing target), and dedups. Raw downloads cache under `cache/` (gitignored). Excludes
Uyghur (a fully vocalized alphabet — nothing to restore) and single-letter headwords (letter-name spellout noise).

## Format
`skeleton <TAB> lang(ISO 639-3) <TAB> ipa(space-separated phones)` — one row per unique triple.

## Contents (50,799 rows)
- **anchors** 35,303 — `ara` `fas` `urd`
- **Arabic dialects** 10,304 — `arz apc afb acm ary acw ajp ayl`
- **riders** 5,192 — `pus pan ckb kas snd skr gwc ota`

Silver, not gold: Wiktionary transcriptions vary in quality/narrowness and carry per-editor convention drift; this
is training data, not an evaluation reference. Hold out a curated per-language slice for eval rather than trusting
these labels as ground truth.
