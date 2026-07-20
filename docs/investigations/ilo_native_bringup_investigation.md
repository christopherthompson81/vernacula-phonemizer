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

## Run 2 — a stress model was TRIED and REJECTED (negative result)

The gliding residual correlates with stress (garcia→ɡaɾˈsi**a**, the *stressed* high vowel stays syllabic, vs
rosario→ɾoˈsaɾ**j**o, the *unstressed* one glides), so a stress model was the natural next attempt (before a
lexicon). Two positional stress rules were tested against both human referees:

| model | wikipron | kaikki |
|---|---|---|
| **mechanical** (glide every C‑i/u‑V; the shipped rule) | **83.2%** | **85.2%** |
| protect the penult **vowel letter** from gliding | 77.1% | 78.1% |
| glide-then-restore the penult **nucleus** (syllabify after provisional gliding) | 74.1% | 75.3% |

**Both stress rules made it WORSE.** The reason is decisive: `garcia` (i stays) and `radio` (i glides) are the
*identical* C‑i‑V shape — they differ **only in lexical stress**, which Ilocano does not mark in the orthography and
which is phonemic/contrastive (not positionally predictable). Any positional heuristic therefore mis-locates stress
and blocks/permits gliding on the wrong words, and the errors outnumber the fixes. The proper-noun-heavy referee
(Spanish names with etymological stress like García) makes this worse.

**Conclusion:** the mechanical rule is the rule-based ceiling; further gains require actual lexical stress — i.e. a
**lexicon** (or a model trained on the stress-marked referee), not a rule. The stress model is closed as a dead end;
the shipped module is unchanged. (Kept per the negative-results discipline.)
