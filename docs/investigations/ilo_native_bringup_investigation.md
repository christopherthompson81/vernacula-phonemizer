# Ilocano (ilo) native bring-up

Ilocano / Iloko (ilo) — Austronesian (Malayo-Polynesian → Philippine → NORTHERN Luzon, the Ilocano subgroup — NOT
Bisayan); ~8M speakers, the lingua franca of northern Philippines. Latin, near-phonemic.

## Gate — three referees

wikipron ilo_latn broad (PRIMARY, human, 926 — proper-noun-heavy) + kaikki ilo (SECONDARY, human, native, 973) +
epitran ilo-Latn (programmatic, 887). A strong, real bespoke bring-up.

## The engine — Philippine core, but a DIFFERENT hiatus

The sibling Bisayan engine (Hiligaynon) scored only **72%** on the ilo referee — Ilocano is a different Philippine
subgroup with distinct phonology, not a Bisayan clone. It keeps the Philippine core (⟨ng⟩→ŋ, word-initial glottal,
penultimate stress) but differs in three ways:

1. **HIATUS RESOLUTION (the big one):** a HIGH vowel ⟨i u⟩ directly before another vowel **GLIDES** — i→[j], u→[w]
   (dua→dwa, radio→ɾadjo, dies→djɛs) — where the Bisayan langs insert a glottal (duʔa). A non-high hiatus keeps the
   glottal (tao→taʔo).
2. **The 6th vowel:** ⟨e⟩→[ɯ] (close back unrounded, native) ~ [ɛ] (loan) — the Ilocano signature. Not
   spelling-predictable → default [ɛ], folded.
3. **⟨ll⟩ is a native geminate** [lː] (two l's), not the Spanish [lj] of the Bisayan Spanish-loan layer.

(One bug found + fixed en route: `"aeiou".includes("")` returns `true`, so a word-final vowel wrongly counted the
next char as a vowel and glided — dakami→dakamj. Guarded with an explicit bounds check.)

## Result

`npx tsx tools/referee-eval/eval.ts ilo`:
- **wikipron (human, primary): 82.7% folded (766/926).**
- **kaikki (human, secondary): 84.5% folded (822/973).**
- epitran (programmatic): 75.9%.

Folds: stress (unwritten penult), the 6th vowel ɯ~ɛ~e, the ⟨ng⟩ ambiguity ŋ~nɡ~ŋɡ (digraph vs n+ɡ across a
boundary: domingo→dominɡo), word-final + inconsistent word-initial glottal, ɾ~r.

## Verdict: 🟡 bounded

The ~16% residual is the genuinely **orthography-ambiguous gliding/hiatus**: whether a high vowel glides or stays
syllabic (and whether a non-high hiatus glottalises) is **stress- and lexeme-dependent, not recoverable from
spelling** — the residual histogram shows the rule both over-glides (j→i, w→u) and under-glides (ʔ→w) in roughly
equal measure, i.e. the referee itself isn't spelling-predictable here. The wikipron primary is proper-noun-heavy
(Spanish place/family names), which inflates the hiatus difficulty; the native kaikki referee scores higher (84.5%).
The fix would be a stress model or an exceptions lexicon (deferred). Three referees corroborate the segmental
backbone. Numbers deferred. Gold: `test/ilocano.test.ts`. Floor `ilo: 0.80`.
