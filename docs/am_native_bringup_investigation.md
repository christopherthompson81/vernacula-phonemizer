# Amharic / አማርኛ (am) native bring-up

Ethiopian Semitic, ~57M speakers, written in the **Ge'ez/Fidäl script** — a genuinely NEW model for the project:
a **syllabary-abugida** where each codepoint is a whole CV syllable (the vowel is baked into the glyph shape), with
NO separate matras or virama. So the generic Brahmic engine does not apply — the g2p is a **flat fidel→CV lookup**.

## The syllabary table
The Fidel is 33 consonants × 7 vowel "orders" (ə u i a e ɨ o) + labialized forms. `fidel.tsv` (306 entries) is
derived from the **epitran amh-Ethi map** (Apache-2.0 — a complete, correct codepoint→CV table that also handles
the irregular labiovelar rows), with one authored fix: the **guttural 1st-order → [a]** (ሀ/ሐ/ኀ→ha, አ/ዐ→a; the
gutturals take /a/ in the 1st order, not the default /ə/ — wikipron ሀሎ→halo). Ejectives kʼ tʼ t͡ʃʼ pʼ t͡sʼ; /r/=ɾ.

## Two UNWRITTEN features (the hard part)
Neither is marked in the script:
1. **Gemination** — phonemic but never written (ሁለት = [hulətː] with a long t). We render single consonants; the
   referee's geminates are folded (degemination + the backbone's length strip).
2. **The 6th-order [ɨ] (sadis)** — epenthetic: it surfaces only to break a word-initial cluster and is deleted
   elsewhere (ሆስፒታል→hospital, not hosɨpital). Heuristic: keep the FIRST ɨ only if it is the word's first vowel;
   delete every other. This is the analog of Hindi's schwa deletion.

## Runs — 2026-07-15
- **Run 1** — fidel→CV lookup + guttural fix. First measure **44.1% / 43.5%** — the 6th-order ɨ was retained
  everywhere (hosɨpital).
- **Run 2** — the ɨ-deletion heuristic (keep only the first-vowel ɨ) → **66.1% / 55.1%.**
- **Run 3** — /r/→tap ɾ in the map (wikipron writes ɾ) + the Ethiopic wordspace ፡ as a word boundary → **74.9%.**
- **Run 4** — folds for kaikki's conventions (plain r, the optional-glottal parens (ʔ)) → **80.1% / 78.3%.**

## Result — 🟡
80.1% / 78.3% across two human referees — strong for a new script model. The residual is the **ɨ-epenthesis tail**
(amst~amɨst, ahja~ahɨja — partly lexical, like schwa deletion, and the referees disagree with each other on it),
plus a few compound-with-wordspace referee entries. The syllabary segmental core is essentially exact; 🟡 for the
two documented unwritten-feature tails (gemination + ɨ epenthesis). A lexicon would close the ɨ tail; gemination
needs a lexicon or morphology (unrecoverable from the script).
