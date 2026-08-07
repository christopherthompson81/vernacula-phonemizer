# `silver.tsv` provenance

Silver training data for the shared Arabic-script short-vowel restorer (see
).

## Source
[**wikipron**](https://github.com/CUNY-CL/wikipron) — the Arabic-script (`*_arab_broad`) scrapes of Wiktionary
pronunciations. wikipron data is distributed under **CC-BY-SA 4.0** (it derives from Wiktionary). This TSV is a
derived work and inherits **CC-BY-SA 4.0** — keep this attribution with any redistribution.

## Build
`python3 tools/perso-arabic/build_silver.py` — fetches the `broad` transcription for every abjad-beneficiary
language, strips the orthographic diacritics to the undiacritized **skeleton** (the model's runtime input), pairs
it with the IPA (the vowel-bearing target), and dedups. Raw downloads cache under `cache/` (gitignored). Excludes
Uyghur (a fully vocalized alphabet — nothing to restore) and single-letter headwords (letter-name spellout noise).

## Format
`skeleton <TAB> lang(ISO 639-3) <TAB> ipa(space-separated phones)` — one row per unique triple.

## `silver.kaikki.tsv` — harmonized second-source augmentation
Extra `(skeleton, lang, ipa)` pairs from **kaikki** (Wiktionary, CC-BY-SA) — a larger extraction than wikipron —
for words NOT already in `silver.tsv`. `build_kaikki.py` fetches a kaikki dump and **harmonizes** its narrow IPA to
our g2p's convention BEFORE inversion (per language: Persian strips aspiration/dental, ɒ→ɑ, æ→a, w→v; Urdu keeps
aspiration/dental). Without harmonization a second source's conventions regress the eval; with it,
Persian gains (+0.7 held-out). `invert_harakat.ts` labels it alongside wikipron; the eval_set stays wikipron-only.
Inherits CC-BY-SA. The raw dumps (~30–85 MB) are not committed; regenerate with the URLs in `build_kaikki.py`.

## `silver.hindiurdu.tsv` — Hindi→Urdu cross-script COVERAGE source (lexicon, not neural training)
Real Urdu spellings paired with gold IPA, from **kaikki Hindi** (Wiktionary, CC-BY-SA): a Hindi (Devanagari, voweled)
entry carries the actual Urdu spelling as a form. `build_hindi_urdu.ts` takes that spelling as the skeleton and the
IPA from our `hi` g2p (harmonized aː→ɑː), for words NOT in wikipron. 5,014 new Urdu words; inversion mines ~3,286
GOLD vocalizations. It is a different VOCABULARY distribution than wikipron, so it does NOT improve wikipron-held-out
neural generalization (measured flat) — it's a COVERAGE win for the LEXICON layer (exact-match at inference). Kept
OUT of the neural training manifest. Inherits CC-BY-SA; the raw Hindi dump (~160 MB) is not committed.

## `lexicon.<lang>.tsv` — the shippable production lexicon (COVERAGE layer)
`invert_harakat.ts --lexicon` mines ALL sources (wikipron + harmonized kaikki + Hindi→Urdu real spellings), one
vocalization per skeleton → `skeleton⇥lang⇥vocalized`. The Arabic `restore.ts`/`diacritization.tsv` analogue for the
riders: at inference, look up a word; if present, use its exact vocalization → g2p → IPA; else fall to the neural
model. Urdu: 8,120 words = **66.4% of production tokens** (measured by `coverage_eval.py` on OpenSubtitles frequency
lists). Inherits the CC-BY-SA of its sources. This is the axis the held-out neural eval can't see.

## Role: EVALUATION reference (not the training target)
The shared model's TARGET is **harakat** (short-vowel diacritics) → each language's existing deterministic g2p turns
the vocalized text into IPA. These wikipron IPA pairs
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
would miss). Coverage is bounded by what the g2p can reproduce; the misses are dominated by long-vowel ambiguity the
g2p doesn't resolve (و→oː/uː, ی→iː/eː), not by the labeler. Yields (`invert_harakat.ts all`):

| lang | words | labeled | % |
|---|---:|---:|---:|
| `fa` Persian | 10,235 | 6,916 | 67.6% |
| `ps` Pashto | 1,303 | 575 | 44.1% |
| `ur` Urdu | 7,614 | 3,144 | 41.3% |
| `pa` Punjabi Shahmukhi | 1,260 | 294 | 23.3% |
| **total** | | **10,929** | |

Persian's high yield reflects its leaky abjad (long vowels written → fewer ambiguous slots) + a mature g2p; Punjabi's
low yield reflects its و/ی long-vowel ambiguity + tonogenesis. Derived from wikipron (CC-BY-SA) via the deterministic
g2p — inherits CC-BY-SA.
