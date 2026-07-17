# Marathi (mr) native bring-up — investigation log

Marathi in Devanagari — REUSES the generic Hindi abugida engine (makeNativeHindi) with a Marathi data file
(marathi.jsonc). A near data-only bring-up. Referees: wikipron mar_deva broad (human, 4872) + a 20-word gold.

## Run 1 — 2026-07-15 — Hindi-engine reuse + Marathi phonology → 🟡 (folded 68.3%, gold 100%)

Copied hindi.jsonc → marathi.jsonc and adapted the Marathi-distinctive facts (everything else — retroflex/dental,
aspirates, schwa deletion, weight stress — is shared with Hindi):
- **ळ → ɭ** (retroflex lateral, absent in Hindi); **ष → ʂ** (retroflex, KEPT — Hindi merges it to ʃ).
- **च/छ/ज/झ → DENTAL affricates [t͡s t͡sʰ d͡z d͡zʱ] before a back/central vowel** (चार→t͡saːɾ, जन→d͡zən), palatal
  before front i/e/y — implemented as postRules.
- **ऐ → [əi], औ → [əu]** (Marathi keeps the diphthong; Hindi has monophthong ɛː/ɔː): दैव→d̪əiʋ, नौदल→nəud̪əl.
- **ऋ/ृ → [ɾu]** (कृपा→kɾupaː), not Hindi's ɾɪ.
- Removed the Hindi finalRules (और-offglide, əɦə→ɛɦɛ) — Marathi keeps शहर→ʃəɦəɾ. Marathi number spellings.

Fold ladder (each justified): the referee doesn't mark the ɪ/i or ʊ/u lax split (short ि=[ɪ] ours vs [i] referee)
→ fold ɪ~i, ʊ~u (+19% — the single biggest lever); alveolo-palatal ɕ/t͡ɕ/d͡ʑ = our ʃ/t͡ʃ/d͡ʒ (notation); the च/ज
DENTAL~PALATAL place is referee-INCONSISTENT (चाक→t͡sak yet चाकर→t͡ɕak) → fold the affricate place; degemination.
NB the analysis fold must strip length ː (the backbone does) — forgetting it made the residual look far worse than
it was (4.8% vs the real 47.3%).

RESULT: wikipron folded 47.3→**68.3%** (after ɪ/ʊ folds, ृ→ɾu, ऐ/औ diphthongs), adjudicated common-word gold
**100%**. Status 🟡 — the segmental core + all Marathi-distinctive features verified; tail is final-schwa-after-
cluster retention (Marathi keeps more than Hindi: अनुबंध→ənubənd̪ʱə), the ज्ञ conjunct ([dɲ]/[d͡ny]), and
medial-schwa variation. Suite 33/33; typecheck clean.

NEXT (deferred): Marathi keeps the word-final schwa after a consonant cluster (unlike the Hindi always-delete) — a
cluster-conditioned retention rule would close much of the remaining gap; the ज्ञ conjunct realization.

## Run 2 — 2026-07-16 — the missing final-schwa-after-cluster RULE + two honest fold fixes → 68.3%→91.6%

The 68.3% was anomalously low for a data-only Indic bring-up (Gujarati 86%, Hindi higher). Bucketing the
wikipron residual found the cause was NOT a diffuse lexical tail but three concentrated, mostly-fixable classes.

**1. Word-final schwa retention (a REAL rule Hindi lacks) — +7.2pp, ships.** The referee KEPT the final ə on
368 words where we deleted it (अंक→əŋkə, महत्त्व→məɦət̪ːʋə). The GOLD, meanwhile, DELETES it on native words
(घर→ɡʱəɾ, जन→d͡zən) — so it isn't a blanket "Marathi keeps final schwa." The discriminator is phonotactic: the
schwa is retained to avoid a word-final **consonant cluster/geminate** (əŋk→əŋkə, ənː→ənːə) but deleted after a
**single** consonant (ɡʱəɾ). Measured on the corpus: among referee-retains-ə misses, 333 end in a cluster vs 35
single; among agreed deletions, 1531 end single vs 28 cluster — a clean split. The 28 "cluster" exceptions were
mostly a DETECTOR artifact: final affricates d͡z/t͡s (आज, नाच, रोज) are ONE phoneme, not a cluster (I'd stripped
the tie bar and double-counted). Added `retainFinalAfterCluster` to the shared schwa-deletion (hindi.ts,
`heavyFinalCoda`): affricates = 1 consonant, a length mark ː (geminate) = heavy. Hindi/Gujarati/Bhojpuri don't
set the flag → unaffected (20/20 sibling tests green). Genuine cluster-deletions that remain (~5) are foreign
loans: ऑगस्ट August→ɔɡəsʈ, पासपोर्ट passport, फ्रान्स France — undetectable without a loanword flag, documented.

**2. Affricate-place fold tie-bar bug — +5.1pp (measurement honesty, no engine change).** The च/ज place fold
`t͡?[sɕ]→t͡ʃ` reintroduced a tie bar ͡ in its replacement — but BACKBONE strips ties before the config folds run,
so ours folded to `t͡ʃ` (with tie) while the referee, already run through the earlier `ɕ→ʃ` fold, folded to `tʃ`
(no tie). ~250 words (अचानक, अजब, अगोचर…) failed on the invisible tie alone. Fixed the replacements to be
tie-less (`tʃ`/`dʒ`) and to include ʃ/ʒ in the class so the post-ɕ→ʃ referee form also normalises.

**3. Word-final ⟨े⟩ e~ə fold — +11pp (referee inconsistency).** 509 residual words ended in the -णे/-े ending
where wikipron wrote [ə] but we (and the gold: चौथे→t͡səut̪ʰe) write [e]. Probing all 1264 C+े words: wikipron is
**47/53 split** (589 ə vs 675 e) on the identical ending — it cannot adjudicate final e vs ə (ो-matra shows NO
such reduction, 8/8 keep o, so it's े-specific referee noise, not a real merge). Folded both sides `e$→ə` — the
same "referee doesn't consistently distinguish" logic as the ɪ~i fold; only the final e↔ə pair merges, so it
can't mask a real error (a final e vs i mismatch still fails).

**Medial-schwa tail — NEGATIVE result on the consensus lexicon.** The remaining ~222-word residual is the
medial-schwa VCəCV variation, proven-lexical across the Indic fleet (Ohala over/under-deletes; no rule). For
Gujarati this was closed by a wikipron∩kaikki cross-source consensus lexicon (189 entries). For Marathi it is
NOT viable: pulled kaikki mar (4,308 Devanagari words with IPA), but wikipron and kaikki share a folded form on
only 490/4,183 overlapping words (~12%) — kaikki mar's transcription style doesn't fold-align with wikipron —
yielding a mere 15 clean consensus pins. Not enough to justify a lexicon; the medial-schwa stays an unclosed,
data-bound residual. (Single-source wikipron would be unreliable — cf. its 47/53 final-vowel coin-flip.)

RESULT: wikipron folded **91.6%** (was 68.3%), gold **100%**. Deliberately STOPPED folding here: a nasal-place
fold would risk collapsing the real ण/न (ɳ~n) retroflex contrast, and a visarga ʰ fold would collide with real
aspiration — the remaining ~8% is genuine referee under-specification (nasal place, visarga h~ʰ) + the lexical
medial-schwa tail. STATUS **🟡** (not ✅): the headline is now a real phonological rule the engine was missing,
but the medial-schwa lexical tail persists and — unlike Gujarati — has no clean consensus-lexicon close.
Suite green; typecheck clean.

### Literature (tie-break check, 2026-07-16)

The rule is not a corpus-fit guess — it is the documented Marathi phonology:
- **Final schwa after cluster/conjunct** (rule #1): Wikipedia *Schwa deletion in Indo-Aryan languages* — "The
  schwa at the end of a word is almost always deleted in Marathi, except … when the word ends in a conjunct,"
  and Marathi "conserved the schwas after consonant clusters in words like शब्द" [ʃəbdə]. Our शब्द→ʃəbd̪ə,
  राष्ट्र→ɾaːʂʈɾə match. This is decisive, not a coin-flip.
- **Final ⟨े⟩ e~ə (the fold)**: ⟨े⟩ is an EXPLICIT e-matra = phonemic /e/, not the inherent schwa; the correct
  citation value is [e] (our output + the gold). The wikipron 47/53 ə/e split is transcription-convention noise,
  NOT a phonological tie — so folding (rather than pinning ə) is the literature-consistent call.
- **Medial schwa (the unclosed tail)**: the Ohala VCəCV rule is only ~89% correct (it "sometimes deletes a schwa
  that should remain and sometimes fails to delete" — *Schwa deletion in Indo-Aryan languages*), confirming the
  residual is irreducibly lexical (no rule-based tie-break), consistent with the Hindi/Gujarati/Bengali fleet.

Sources: en.wikipedia.org/wiki/Schwa_deletion_in_Indo-Aryan_languages, en.wikipedia.org/wiki/Marathi_phonology.
