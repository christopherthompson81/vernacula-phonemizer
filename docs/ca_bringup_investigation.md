# Catalan (ca) bring-up investigation

Target: General Eastern/Central Catalan (Barcelona standard), canonical IPA, espeak-independent.
Template: Spanish (Romance rule-g2p, no lexicon) + Portuguese-style unstressed vowel REDUCTION.
Referee: wikipron cat_latn NARROW (98,709 rows, multi-dialect/multi-pron, NO stress marks → fold stress).
Reference phonology: espeak-ng-portable's catalan_convergence_investigation.md (mature shim-converged ca).

## Central Catalan phonology (from the convergence work)
- **Vowel reduction** (the signature): unstressed a/e → ə, unstressed o → u; i/u unchanged.
- **Stressed mids are LEXICAL** open/close (ɛ/e, ɔ/o) — dona/dóna, os/ós — NOT spelling-derivable.
  Ceiling/residual; referee unreliable here too → fold ɛ↔e, ɔ↔o in the eval.
- **Palatal nasal assimilation**: n → ɲ before a palatal (t͡ʃ d͡ʒ ʃ ʒ ʎ). menja→meɲʒə.
- **Rhotics**: trill r (word-initial, after n/l/s, rr); tap ɾ elsewhere; final -r often SILENT (cantar→kənta).
- **Spirantization** b/d/ɡ → β/ð/ɣ (honest/explicit, like es).
- **Betacism** (Central): v → b.
- Digraphs: ny→ɲ, ll→ʎ, l·l→lː, tx→t͡ʃ, tj/tg→d͡ʒ, ig#→t͡ʃ, ix→ʃ, x→ʃ, qu/gu, ç→s, s→z intervocalic.
- **Final devoicing**: b→p d→t ɡ→k z→s d͡ʒ→t͡ʃ etc.
- Stress: STRESSPOSN_2R — written accent wins; else penult if ends in vowel / -as/-es/-os / -en/-in; else final.

## Run 1 — 2026-07-14 — scaffold the engine + first measurement
Building: catalan.jsonc + manifest.ts + g2p.ts + numbers.ts + catalan.ts, mirroring es + pt-reduction.

### Run 1 result — engine scaffolded, 79.4% vs Central-preferring referee
Built catalan.jsonc + manifest.ts + g2p.ts + numbers.ts + catalan.ts + registry + test + referee-eval CONFIG.
Pipeline: toSegments → 2R stress → unstressed reduction (a/e→ə, o→u) → final-r deletion + coda-cluster
simplification → regressive voicing assimilation → spirantization → nasal place assimilation → devoicing.

**Bugs found + fixed in-run (probe vs referee):**
- Catalan Cia/Cio is HIATUS, not a Spanish-style rising glide (abacials əbəsjəls→əbəsiəls): onglide i/u stays a
  nucleus; glides are only OFFglides (ai/au/iu falling) + word-initial (iogurt). +big.
- all-weak runs are FALLING (ciutat iu→iw, not sju): first vowel is the nucleus.
- dark l: Central velarises ALL /l/ → ɫ (ll→ʎ, l·l→ɫː).
- ⟨ix⟩ after a vowel → ʃ, the i a silent marker (caixa→kaʃə), NOT a glide+x.
- final devoicing ran AFTER spirantization, so final d→ð escaped it (actitud→əktitud) — reordered.
- nasal place assimilation only did palatal → added velar (n→ŋ, abrilenca) + labial (n→m).
- regressive voicing assimilation added (abscessos→əpsəsus, esbós→əzβos).
- coda-cluster simplification (vint→bin, cent→sɛn, molt→mɔɫ, camp→kam).

**Referee: the wikipron cat referee is a DIALECT MIX.** First-pron sampling leaned non-Central (unreduced,
final-r/clusters kept) → every correct Central feature LOWERED the raw score. Re-sampled preferring the
ə-richest (most Central) pron per word; even so ~⅓ of words only have an unreduced pron (Advent→a d v e n t),
so the reduction/final-r/cluster axes CANNOT be adjudicated by this referee → folded in the eval (reduction
{a,e,ɛ}→ə {o,ɔ}→u, betacism v→b, dʒ/ʒ affrication, dark-l, spirantization, final-r). The 79.4% then measures
the consonant/glide/palatal/rhotic system + i, not the folded dialect axes. Calibration words verified correct
by hand (Wheeler). Unit test 8/8; full suite 191/191.

**Deferred (Run 2+):** stressed open/close mid height (ɛ/e, ɔ/o) — LEXICAL, needs a lexicon (the ceiling; espeak
uses its dict); bl/gl gemination (poble→pɔbːɫə); nx→ɲt͡ʃ affrication; degemination (abscessos pss→ps); a
Central-only secondary referee (epitran cat / a pron-lexicon) to unlock the folded axes.

### Run 1 review (2 agents) — fixes applied
Two finders (g2p/pipeline correctness + Catalan phonology). Real bugs fixed:
- **nasalAssim ran AFTER finalPass** → banc/sang/fang gave ŋk/ŋg not ŋ. Reordered nasalAssim BEFORE finalPass so
  n→ŋ feeds the coda-cluster drop.
- **final -ig after a VOWEL never fired** (the vowel-run swallowed the i) → maig gave majk not mat͡ʃ. Handle it
  in the run (i silent → t͡ʃ). Also fixed the pre-existing consonant-preceded -ig which DROPPED the i nucleus
  (mig → mt͡ʃ) → now mig → mit͡ʃ (i is a nucleus there).
- **spirantization blocked b/ɡ after a lateral** — only /d/ stays occlusive; alga → aɫɣə, alba → aɫβə now.
- **falling-diphthong-final words mis-stressed** (remei → rˈɛməj) — a final glide closes the syllable → OXYTONE
  (remei → rəmˈɛj, correu → kurˈɛw).
- **dos-cents number fusion** — HUNDREDS kept orthographic hyphens; the token phonemized as one word. Switched
  to spaces (200 → dˈɔs sˈɛnts).
- **s → z after a glide** (pausa → pˈawzə).
Full suite 191/191; ca 79.5%. Deferred to Run 2: intervocalic ⟨x⟩ = ks/ɡz (examen — lexical), open/close mids,
-nts→ns plural cluster.

## Run 2 — 2026-07-14 — lexical stressed mid-vowel height (open/close)
The stressed mid-vowel height (⟨e⟩=ɛ/e, ⟨o⟩=ɔ/o) is LEXICAL (dona/dóna, os/ós — not spelling-derivable), the
Run-1 ceiling. Swedish-style solution: the mature **espeak-ng 1.52 Central shim** (the project's ca convergence
reference) is the oracle. Ran it over the 50k frequency corpus (paragraph-per-word for clean 1:1 alignment —
space-split misaligns because espeak inserts prefix-boundary spaces), extracted the STRESSED mid height per
word, and committed the CLOSE deviations from the engine's open default → `src/languages/catalan/mid-vowels.tsv`
(10,413 words: 5,706 close-e, 4,707 close-o; `word\te` / `word\to`). Engine: after stress, a flagged word's
stressed ɛ→e / ɔ→o. Generator: `tools/gen/build-ca-midvowels.mts`.

Fixes the exact Run-1 ceiling words: menja→mˈeɲʒə, metge→mˈed͡ʒə, Barcelona→bəɾsəɫˈonə, pedra→pˈeðɾə, molt→mˈoɫ
(unflagged stay open: dona→dˈɔnə, terra→tˈɛrə, cel→sˈɛɫ). **Referee UNCHANGED (79.5%)** — the eval folds
open/close (the wikipron referee is itself unreliable on height), so it can't see the win; validated instead by
the espeak oracle + hand-check (Wheeler). Unit test 10/10. OOV words (outside the 50k) keep the open default.

Remaining (Run 3+): intervocalic ⟨x⟩=ks/ɡz (lexical), -nts→ns plural cluster, bl/gl gemination, a Central-only
secondary referee.
