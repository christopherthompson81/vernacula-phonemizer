# `af-stems.txt` — provenance

**What it is.** A 53,344-word Afrikaans stem inventory, one word per line, used as membership data by the
compound splitter in `morphology.ts`.

**Sources** (union, rebuilt 2026-07-29):
1. **Afrikaans Wikipedia** (`afwiki-latest-pages-articles.xml.bz2`, dumps.wikimedia.org): lowercase letter
   runs with frequency ≥ 25, 47,476 words. CC BY-SA 4.0.
2. **hermitdave FrequencyWords** `af_full.txt` (OpenSubtitles 2018), frequency ≥ 2, 9,044 words. Treated as
   CC BY-SA, on the same basis as the Danish and Norwegian frequency filters.
3. **kaikki.org Afrikaans** (Wiktionary via wiktextract): headwords split on space and hyphen, 8,612 words.
   CC BY-SA.

**Licence.** The derived list inherits CC BY-SA 4.0.

**Licence history.** It replaces an earlier 42,743-word list from the Leipzig Corpora Collection, whose
CC BY-NC licence (non-commercial) was incompatible with this repo's licensing.

Build notes: `docs/investigations/af/af-stems_build_notes_investigation.md`.
