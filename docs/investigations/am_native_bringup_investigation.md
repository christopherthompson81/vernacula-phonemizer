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

## Run 6 — 2026-07-16 — can we get a MORE ROBUST referee for a ✅ push? (No — searched, dead-end)

The 🟡→✅ blocker is confidence: the ɨ-epenthesis + gemination residual sits on a TINY referee (wikipron 478 + kaikki
437), and the two sources are both Wiktionary (correlated), so a kaikki-mined lexicon would be near-fully circular.
Searched for a larger and/or INDEPENDENT Amharic IPA referee:
- **wikipron `amh_ethi_broad`** — the full upstream scrape is **478 lines**: our committed file IS the whole set.
  No `amh_ethi_narrow` exists.
- **kaikki `Amharic`** — the full dump is 2425 entries but only **~441 unique have IPA** (we already have 437; the
  4 extra are multi-word phrases like ዶሮ ወጥ). Wiktionary Amharic is exhausted.
- **ALFFA Amharic ASR lexicon** (getalp/ALFFA_PUBLIC, `ASR/AMHARIC/data/lexicon.txt`) — **51,361 entries**, but it
  is **GRAPHEMIC**: the "pronunciation" is the word's own Fidel glyphs (ሀሂሪህ → ሀ ሂ ሪ ህ) and the phone set is the
  glyphs themselves — NO IPA, no ɨ-deletion, no gemination. Amharic ASR is graphemic *because* the Fidel is
  transparent, so it can't referee the two UNWRITTEN features. Converting its glyphs via our own table is circular.

**Conclusion:** there is no readily-available robust referee for the exact features that limit Amharic. The segmental
Fidel core is transparent (near-trivially verifiable); the ɨ-epenthesis is genuinely VARIABLE (the two human referees
disagree with each other — a careful/colloquial continuum, not one ground truth), and gemination is unrecoverable
from the script. So Amharic stays **🟡** honestly: a ✅ would need a hand-adjudicated running-speech gold (which no
public resource provides), and a Wiktionary-mined lexicon ✅ would be circular. Recorded so a future ✅ attempt does
not re-run this search.

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

## Run N — 2026-07-18 — ɨ-epenthesis RULE refinement is a DEAD END (negative result)

Re-examined whether the ɨ tail is rule-fixable (the "authoritative-phonology" treatment). The referee misses are
71% ɨ-placement-only (oracle ceiling 96%), so it looked tractable — but every phonotactic policy change is
NET-NEGATIVE against BOTH referees:
- KEEP-ALL medial ɨ (conservative citation) → 86.4→**59.4%** (referee deletes far more ɨ than a keep-all predicts).
- break ALL C+ɾ (drop the fricative exception, from ዐሥር→asɨɾ) → 86.4→**85.1%** / kaikki 83.3→81.2% (sɾ deletes
  elsewhere too).
- word-final ɨ kept after a 2-cluster (≥2 not ≥3, from እናንት→ɨnantɨ) → 86.4→**79.7%** / 76.4%.
The ɨ realization is NOT cluster-predictable — the SAME cluster type keeps ɨ in one word and drops it in another,
so it is genuinely LEXICAL, not phonotactic. Confirmed lexical (not free-variation): the two referees agree 100%
on the ɨ of all 388 shared words. But they share the Wiktionary tradition (the 100% agreement itself flags this),
and at ~500 words a mined lexicon is both circular and near-zero OOV coverage. **The only real path to higher am
maturity is a LARGER, INDEPENDENT Amharic pronunciation corpus (better tail data), not rules or a tiny-referee
lexicon.** 86.4% stands as the honest rule ceiling. Current policy (delete-in-legal-cluster, ≥3 final coda) is
already the best-tested — left unchanged.
