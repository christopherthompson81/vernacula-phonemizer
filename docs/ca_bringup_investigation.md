# Catalan (ca) bring-up / maturity investigation

Central/Eastern Catalan (rikssvenska analogue: General Central), canonical IPA, espeak-independent. Rule g2p
(g2p.ts) + two lexicons: **mid-vowels.tsv** (10413 entries — stressed open/close mid HEIGHT ɛ/e, ɔ/o, which Catalan
spelling doesn't mark: dona/dóna, os/ós) and **bl-gl-geminate.tsv** (lexical intervocalic bl/gl gemination:
poble→pˈɔbːlə vs learned problema→pɾuβlə). Both espeak-1.52-Central-derived (build-ca-midvowels.mts / build-ca-geminate.mts).

## Run 1 — 2026-07-14 — maturity audit: the note was stale; ca is ✅ (referee-limited)

The maturity note ("stressed open/close mids need a lexicon; +intervocalic ⟨x⟩, -nts→ns") was STALE — every item is
already handled:
- **Mid-vowel lexicon DONE & working**: dona→dˈɔnə / dóna→dˈonə, os→ˈɔs / ós→ˈos, deu→dˈɛw / déu→dˈew, son/són ✓.
- **Intervocalic ⟨x⟩**: examen→əɡzˈamən, exacte→əɡzˈaktə, caixa→kˈaʃə ✓.
- **-nts→ns**: ponts→pˈɔns, cants→kˈans, dents→dˈens, vint→bˈin ✓.

The wikipron primary is 81.3%, but the eval already folds the vowel axis (Central reduction + the lexical mids — the
documented ceiling), so it measures the consonant/rhotic/geminate system. Categorising the 973 residual mismatches:
- **513 (53%) rhotic ɾ vs r** — the referee writes generic ⟨r⟩ where Catalan has a coda/cluster **tap [ɾ]**. OUR
  tap/trill is fully correct (verified): trill for initial/rr/after-n·l·s (roig, carro, terra, Enric), tap for
  intervocalic/coda/onset-cluster (cara, borles, tord, prat, forsa). The referee is IMPRECISE, not us.
- **65 (7%) geminate Cː vs CC** — ours writes length **Cː** (poble pˈɔbːlə), proper IPA; the referee doubles (abb,
  ll) and uses ː zero times. Ours is the correct notation, the referee's is not. (Do NOT fold our correct form to
  the referee's — user steer.)
- **395 other** — mostly more referee imprecision (ametlla tll→ʎ ours-right), hiatus reduction, and rare/malformed
  corpus words, with a thin tail of genuine minor gaps (dm→mm assimilation admissions→əmmisions; a few intervocalic
  ⟨x⟩ contexts alexandrina; learned-⟨ble⟩ gemination that varies dialectally).

Crediting just the rhotic+geminate (ours-correct) cases → ~92.4%. So the 81.3% is REFEREE-LIMITED: the residual is
its imprecise rhotic/geminate transcription (where we're correct) + a diffuse thin tail, NOT an engine class. The
mid-vowel lexicon (the stated 🟡 reason) is done. → **✅** referee-limited. Optional future micro-fixes (not a class):
dm→mm assimilation, learned-⟨ble⟩ gemination — deferred as dialectal/minor.
