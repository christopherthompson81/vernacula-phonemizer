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
