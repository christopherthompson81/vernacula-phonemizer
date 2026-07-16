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

## Role: EVALUATION reference (not the training target)
The shared model's TARGET is **harakat** (short-vowel diacritics) → each language's existing deterministic g2p turns
the vocalized text into IPA (see `docs/arabic_script_restorer_investigation.md`, Run 4). These wikipron IPA pairs
are the **end-to-end eval reference**: run skeleton →[model] harakat →[deterministic g2p] IPA and score against the
IPA here. Training data (skeleton→harakat) is built separately from diacritized corpora.

## Files
- `silver.tsv` — the raw skeleton→IPA pairs (wikipron transcription, verbatim) — the eval reference.
- `silver.normalized.tsv` — the eval reference with a **harmonized IPA notation** (so scoring compares phonology,
  not per-editor notation). `normalize_ipa.py` collapses it to one canonical phone alphabet (**252 symbols**,
  `inventory.txt`): strips non-contrastive notation (tone letters, epenthetic ᵊ, ultrashort breves, tone accents,
  half-long, non-syllabic/unreleased/voiceless diacritics; ä→a, ɒ→ɑ, ɫ→l) while PRESERVING every real contrast
  (Arabic emphatics ˤ, aspiration ʰ/ʱ, dental ̪, retroflexes, nasal vowels ̃, labialization ʷ). Tone is dropped — not
  recoverable from the abjad and marked erratically.
- `inventory.txt` — the canonical phone alphabet with occurrence counts (the eval's IPA symbol set).

## Contents (50,799 rows)
- **anchors** 35,303 — `ara` `fas` `urd`
- **Arabic dialects** 10,304 — `arz apc afb acm ary acw ajp ayl`
- **riders** 5,192 — `pus pan ckb kas snd skr gwc ota`

Silver, not gold: Wiktionary transcriptions vary in quality/narrowness and carry per-editor convention drift; this
is training data, not an evaluation reference. Hold out a curated per-language slice for eval rather than trusting
these labels as ground truth.

## `harakat.<lang>.silver.tsv` — mined harakat labels (g2p-inversion)

The riders have no diacritized corpus, so their harakat training labels are MINED from the wikipron reference by
`invert_harakat.ts`: for each `(skeleton, IPA)` pair it searches the harakat vocalization of the skeleton whose full
deterministic phonemizer output reproduces the reference IPA (under the referee-eval fold). The winning vocalization
is the label. Format `skeleton <TAB> lang(phonemizer code) <TAB> vocalized`. High precision (the fold preserves vowel
QUALITY, so a match pins down the actual short vowel — e.g. اسر→اسُرَ recovers the damma /ʊ/ that a default schwa
would miss). Coverage is bounded by what the g2p can reproduce: Punjabi Shahmukhi yields **294 / 1,260 (23.3%)**;
the misses are dominated by long-vowel ambiguity the g2p doesn't resolve (و→oː only, never uː; ی→iː only, never eː),
not by the labeler. Derived from wikipron (CC-BY-SA) via the deterministic g2p — inherits CC-BY-SA.
