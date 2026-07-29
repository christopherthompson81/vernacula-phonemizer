# af-stems.txt — provenance

**Artifact:** `src/languages/afrikaans/af-stems.txt` — 53,344-word Afrikaans stem inventory
(one word per line, membership-only: loaded into a `Set` by `morphology.ts` as the compound
splitter's isWord/isConstituent gate; ordering is irrelevant, no comments supported by the loader).

**Sources (union, rebuilt 2026-07-29):**
1. **Afrikaans Wikipedia** (`afwiki-latest-pages-articles.xml.bz2`, dumps.wikimedia.org) —
   tokenized to lowercase letter-runs (incl. ê ô û î ë ï é è á à ó ú ü and internal apostrophe),
   frequency ≥ 25 → 47,476 words. License: **CC-BY-SA 4.0** (Wikipedia text).
2. **hermitdave FrequencyWords** `af_full.txt` (OpenSubtitles 2018), freq ≥ 2, same charset filter
   → 9,044 words. Treated as **CC-BY-SA**, same basis as the Danish/Norwegian frequency filters.
3. **kaikki.org Afrikaans** (Wiktionary via wiktextract) — headwords, split on space/hyphen →
   8,612 words. License: **CC-BY-SA** (Wiktionary).

Derived work inherits **CC-BY-SA 4.0**.

**History:** the previous 42,743-word list came from the Leipzig Corpora Collection (afwiki-based),
whose license is **CC-BY-NC** — NonCommercial, incompatible with this repo's licensing goals
(docs/PROVENANCE.md §4.4). Replaced by this rebuild from NC-free sources covering 89.7% of the old
list; the af referee eval is UNCHANGED at 74.7% folded backbone / 23.1% raw exact (symbol accuracy
93.1% vs 93.2%), afrikaans unit tests green.
