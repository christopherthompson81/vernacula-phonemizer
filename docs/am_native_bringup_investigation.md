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

## Run 5 — 2026-07-16 — the ɨ-epenthesis PHONOTACTIC rule (80.1 → 86.4%)

Run 4's heuristic ("keep only the word's first-vowel ɨ, delete the rest") OVER-deleted: the referee keeps medial ɨ
that breaks illegal clusters (አምስት→amɨst, እግር→ɨɡɨɾ, አርመንኛ→aɾmənɨɲa). Replaced it with a principled phonotactic rule
(`deleteEpenthetic`) that deletes ɨ EXCEPT where the resulting cluster is illegal:
- **word-initial ɨ** is kept (ɨɡɨɾ);
- a **word-FINAL** cluster of ≥3 consonants is illegal → keep (አምስት→amɨst; but MEDIALLY the cluster resyllabifies,
  so አምስተኛ→amstəɲa keeps NO ɨ — the same letters, opposite outcome, was the key insight);
- an illegal **2-cluster** is kept: a STOP + ɾ (ɡɨɾ, bɨɾ; a fricative + ɾ like sɾ is legal), or a nasal + nasal
  (nɨɲ, mɨn; a nasal + a homorganic stop like nb/nd/nɡ is legal).

Processed RIGHT-TO-LEFT so an earlier ɨ sees the clusters a later deletion created. The other +4 came from **phoneme
tokenization** (`toPhonemes`): an affricate d͡ʒ (3 codepoints) was being counted as 3 consonants, so ልጅ wrongly kept
its final ɨ (lɨd͡ʒɨ). Counting phoneme UNITS fixed it. **80.1/78.3 → 86.4/83.3%** across both human referees.

## Result — 🟡
**86.4% / 83.3%** across two human referees — strong for a new script model, with the ɨ-epenthesis now a principled
phonotactic RULE (Run 5), not a heuristic. The syllabary segmental core is essentially exact. The residual is now:
- **vowel-quality / fidel-table edges** — the guttural-1st-order ə~a (አዝማሪ→əzmaɾi vs our azmaɾi) and the labiovelar
  1st-order vowel (አንጐል→anɡʷəl vs anɡʷel) are partly lexical;
- **gemination** — unwritten, folded, but the referee's tie-bar geminates leak a little;
- a **lexical ɨ tail** — the few clusters the phonotactic rule can't adjudicate (h_j: ahja~ahɨja; some medial 3-runs)
  where even the two referees disagree.

🟡: a pronunciation lexicon could close the lexical tail, but the referees are TINY (478 / 437 words) and share the
Wiktionary source, so a mined lexicon would be near-fully circular — the honest signal is the rule engine's 86.4%.
