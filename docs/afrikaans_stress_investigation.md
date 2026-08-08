# Afrikaans outstanding items — stress/syllable, proper nouns, nasalization, numbers

Goal: the floor comment's "path to higher" list. Referee = en.wiktionary Afrikaans
(human, 2220), single-source; baseline 1680/2220 (75.7%) folded.

## Run 1 — 2026-08-08

Command: scratch probe replicating the eval fold pipeline, classifying all 540 folded
misses; then an empirical payoff sweep over candidate folds.

Classes (first-match classification):
- **proper nouns 58** (capitalized rows: Afrika, Botha, Blignault, AWB…) — g2p cannot
  win these; they need a lexicon (house pattern: sibling TSV like tagalog's
  stress-lexicon.tsv, portuguese's lexicon.tsv).
- **"schwa" cover-class 151** — on inspection THREE distinct things:
  ⟨ei⟩ notation (ours əi, referee ɛi — same phoneme, ⟨ei⟩=⟨y⟩ are homophonous in
  Afrikaans); short-⟨a⟩ backness (referee free-varies a~ɑ: "adrɛs" but "ɑrm"); and the
  REAL stress-conditioned reduction (adres → ours adrəs, ref adrɛs — we reduce a
  stressed loan-final syllable; aalagtig → ours -təχ, ref -tiχ — closed unstressed ⟨i⟩).
- **nasal n-deletion: ×2 visible** (boepens, wetenskap) — the nasal TILDE is already
  backbone-stripped; only the n-deletion shows, and it shows twice. Tiny.
- **other 329** — sub-classes: the referee's OPTIONAL-SCHWA parens are stripped rather
  than tried both ways ("al(ə)s" compares only as als, so ours aləs misses — and
  "an(d)ər" loses a real d); intervocalic ɦ written inconsistently by the referee
  (-heid rows both keep and drop it); morpheme-boundary assimilation (aandete→ɑntiətə,
  aanmatiging→ɑmɑtəχəŋ); fw→v cluster (afwesig→aviəsəχ).

Payoff sweep (fold candidates, measured):
| variant | score |
|---|---|
| baseline | 1680 (75.7%) |
| paren-either matching | +4 |
| fold ɛi→əi | +4 |
| fold a~ɑ (both sides) | +62 |
| fold ɦ-drop | +2 |
| all four | **1753 (79.0%)** |

Numbers: numbers.ts EXISTS and is wired (unit-en-ten compositor) — the floor comment's
"numbers deferred" is stale.

Implication: implement (1) paren-either in eval.ts (generic — the referee writes real
segments in parens, not only schwas), (2) the three folds with justifications, (3) the
proper-noun lexicon (~58 entries, referee-sourced with the circularity documented —
single-source language, same trade tl made), (4) engine stress/reduction fixes measured
one at a time. Nasalization stays deferred with the ×2 evidence; numbers note corrected.

## Run 2 — 2026-08-08

Command: implemented (1)–(3); re-ran eval + the af suite.

- **75.7% → 81.2% folded (1802/2220), symbol accuracy 93.5% → 95.3%.** Composition:
  folds + paren-either +73 (measured stepwise in Run 1), lexicon +49. The generative
  number WITHOUT the lexicon is 79.0% — recorded because the lexicon rows are
  reference-parity, not independent confirmation (single-source language).
  ⚠ **These two numbers did not survive review — see Run 3.** Both the headline and the
  79.0% were inflated by a fold that was masking real errors.
- af-lexicon.tsv: 49 entries — the capitalized single-word folded misses, referee IPA
  minus stress/dots/optional-parens, loaded lazily like tagalog's stress lexicon.
  Provenance + circularity: af-lexicon.PROVENANCE.md.
- eval.ts now expands a parenthesized reference group into BOTH variants generically
  (the old af preFold deleted real segments: "an(d)ər" lost its d).
- Numbers: confirmed implemented and wired (numbers.ts, unit-en-ten) — stale "deferred"
  note removed from the floor comment and catalogue.
- Nasalization: re-deferred with evidence — tilde is backbone-stripped; the visible
  n-deletion class is ×2/2220; the lexicon carries afrikɑ̃ːs.

**The remaining path (NOT done — the stress/reduction model proper).** The measured
taxonomy of what's left, for the next session:
- MORPHOLOGY OVER-SPLITTING drives schwa errors in both directions: "beter" decomposes
  as be+ter (prefix reduction eats a stressed stem vowel → bətɛr for biətər; same for
  besig), and suffix-ish tails split as stressed morphemes (-ers → ɛrs, -etjie → ɛki).
- LOAN FINAL STRESS: adres, argitek reduce a stressed final syllable (ours ə, ref ɛ) —
  stressFinalSuffixes can't carry -es/-ek (native -es is weak: "al(ə)s"), so this needs
  either a loan lexicon tier or a smarter heuristic.
- BOUNDARY ASSIMILATION at compound seams: aandete→ɑntiətə (dt), aanmatiging→ɑmɑtəχəŋ
  (nm→m), bestanddeel ntd→nd, advies dv→tf.
- Referee-inconsistent rows that should NOT be chased: final devoicing (ref writes
  bard, antiɛld against standard Afrikaans devoicing), -ig as both iχ and əχ.

## Run 3 — 2026-08-08 (review of PR #770)

Nine findings; all fixed. Three changed the reported NUMBERS, which is the important part.

**1. The headline was circular.** The eval scored the shipped `phonemizeWord`, which now
consults a lexicon built from the referee itself. Fixed by the house pattern: a new
`phonemizeWordRules` export (mirrors en-GB/tl/ilo) is what the eval imports; the lexicon
improves shipped output only and earns zero eval credit.

**2. The short-⟨a⟩ fold was masking the engine's own headline rule.** It gained 63 words,
but re-measuring with `ː` retained showed **39 of those 63 were genuine open/closed-LENGTH
errors** (anys ɑːnəis vs aˈnəis; apart; fantasie; ekstase) — the fold ran after the
backbone strips ː, so our long ɑː landed on the referee's short a. Fixed by moving it to
a **preFold** guarded `ɑ(?![ː̃])`, where the length mark is still present: short vowels
fold, long and nasal ones stay visible. Those 39 words are now back in the miss list where
they belong, and are the largest single remaining class.

**3. Three lexicon rows were unreachable from the pipeline** and earned eval-only credit:
`suid-afrika`/`kwazulu-natal` (the tokenizer splits on the hyphen), `awb` (normalize.ts
expands initialisms before phonemizeWord). Two more (`j`, `q`) were single letters that
**overrode the letter-name rule of #761** — ⟨J⟩ was reading [jɛ] instead of the name
[jiə]. Dropped all five (44 entries remain), and the lookup now sits after the rule
path's own special cases so a future stray row is harmless rather than silent.

**4. The lexicon values were not in the engine's inventory** despite the PROVENANCE claim
— `ɪə`/`ʊə`, mixed `x`/`χ`, plus `ˑ`, `◌̯`, `ɨ`, `ɲ`, `c`. The eval could not see any of
it (its own folds neutralize exactly those symbols), so it would have reached users
unmeasured. Normalized; PROVENANCE rewritten to describe what was actually done.

**5. The ɦ fold was fleet-blinding for 2 words** — an engine that dropped /h/ entirely
would have scored the same. Scoped to the `-heid` suffix, same +2.

**6. Paren expansion was global.** 160 referee files contain a parenthesis and in some it
is data (Amharic `(ʔ)itjopʼja`), so every language's numbers could move unmeasured. Now
opt-in per language (`parenOptional`), and it generates **every** combination (2ⁿ) rather
than only all-in/all-out.

**Honest result: 76.9% folded / 93.9% symbol** (rules only), up from the 75.7% baseline
— +1.2pp, not the +5.5pp first reported. Floor 0.73 → 0.74. The lexicon's value is real
but lives in shipped output, not in the score.
