# Kyrgyz (ky) native bring-up

Turkic (Kipchak), Kyrgyzstan (~5M), Cyrillic. Sibling of Kazakh (kk, already in the repo). Goal: an espeak-independent
canonical-IPA rule g2p. Kyrgyz Cyrillic is a shallow near-1:1 orthography with STRICT vowel harmony that is *spelled*,
so no harmony needs predicting — the interesting part is the allophony Kyrgyz does NOT write.

## Run 1 — 2026-07-24 — referee + the velar/uvular harmony lever

**Referee:** wikipron `kir_cyrl_broad` — only **888** HUMAN entries (narrow is 246), proper-noun-heavy. Read off the data:
- vowels а→ɑ, о→o, у→u, ы→ɯ (back); е→e, ө→ø, ү→y, и→i (front). LONG vowels via doubling (тоо→toː, Айсулуу→ɑjsuluː).
- **⟨ж⟩→[d͡ʒ]** (affricate, жол→d͡ʒol — not [ʒ] like Kazakh), ⟨ң⟩→ŋ.
- **the velar/uvular harmony** — Kyrgyz does NOT spell it (unlike Kazakh's ⟨қ⟩/⟨ғ⟩): ⟨к⟩→[q]/⟨г⟩→[ʁ] with back vowels
  (кыз→qɯz, ак→aq), [k]/[ɡ] with front (китеп→kitep, көз→køz).

Authored the module (Cyrillic scan mirroring `kk`: vowel/consonant tables + long-vowel doubling + к/г/л harmony).
**First measurement: 62.7% folded.**

**Two structural fixes drove the climb:**
- **The к/г harmony is CODA-vs-ONSET, not just "the following vowel".** Акмечит→referee ɑq (к is a *coda* governed by the
  *preceding* back а) but Баткен→batken (к is an *onset* governed by the *following* front е, though the word has back
  а). Rule: a vowel directly before + none directly after ⇒ the preceding vowel governs; else the nearest following.
  → **72.0%** (+9.3pp).
- **Referee notation folds** (all one-phoneme allophony the referee writes inconsistently): the dark-l ɫ~l (Аалым→ɑːlɯm
  plain ~ Балык→bɑɫɯq dark), the low vowel ɑ~a (дарыс→dɑɾɯs ~ жатыш→dʒatɯʃ), the rhotic r~ɾ, narrow ʂ~ʃ / t͡ɕ~t͡ʃ, and —
  the last real lever — the front-velar palatalisation **c~k / ɟ~ɡ** (the productive -лик/-лык suffix class:
  эстелик→estelic ~ китеп→kitep). Plus one real rule: **intervocalic ⟨б⟩→[β]** lenition (добулбас→doβulbas, обон→oβon).
  → **86.6%** (folds+lenition) → **90.7%** (front-velar c/ɟ folds).

**Result: 90.7% folded, real-word 91.9%.** The residual is (a) single-letter/letter-name entries (~37 rows — each
Cyrillic letter with its "name" pronunciation, e.g. Б→w, Ж→ʒ — unmodelable), and (b) foreign place names (Malmö→mɑlmœ,
Düsseldorf, the compound Карасуубазар where б→β wrongly crosses the morpheme seam).

**Verdict: 🔷 single-source, rule g2p at 90.7%.** The wikipron kir referee is Wiktionary-derived AND small (888) — a
larger/2nd referee (kaikki ky) would tighten the one loose end: the back-⟨г⟩ ɡ~ʁ~ɢ notation (the referee mixes the
velar stop, uvular fricative, and uvular stop for back г; we emit ʁ). Floor 0.89. Wired: registry (`case "ky"`), eval
PHON, `langs/ky.jsonc`, `test/kyrgyz.test.ts` (5 tests), catalogue row, maturity row.
