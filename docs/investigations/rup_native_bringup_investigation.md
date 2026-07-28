# Aromanian (rup) native bring-up investigation

Target: **Aromanian** (armãneashti / rrãmãneshti) — an EASTERN (Balkan) ROMANCE language, a close
sibling of Romanian, spoken across the Balkans (Greece, Albania, North Macedonia, Romania, Bulgaria;
~250k). Latin script (the Cunia/DIARO orthography). Canonical IPA, espeak-independent. Joins the
Romance family alongside the fleet's Romanian (ro).

## Run 1 — referee landscape (2026-07-27)

- **wikipron `rup_latn_narrow`**: 196 pairs, HUMAN, space-segmented. → PRIMARY.
- **kaikki Aromanian**: 6.1 MB dump → 201 IPA pairs (marks stress + syllable dots). → SECONDARY.
- **epitran**: none.
Two corroborating HUMAN referees (both Wiktionary-derived → 🔷 single-source-family, but two).

## Run 2 — the phonology (Romanian-sibling + Aromanian's own)

★ **AROMANIAN DIGRAPHS** (where Romanian uses diacritic letters ș ț): ⟨ts⟩→[t͡s], ⟨dz⟩→[d͡z], ⟨sh⟩→[ʃ],
⟨nj⟩→[ɲ], ⟨lj⟩/⟨ll⟩→[ʎ] (palatals), ⟨dh⟩→[ð], ⟨th⟩→[θ] (Greek-contact interdentals), ⟨gh⟩→[ɣ], ⟨ch⟩→[k].
★ ⟨ã⟩ is the SINGLE central-vowel letter → [ə] (also [ɨ] — the Cunia orthography, unlike Romanian's
ă/â split, does not distinguish them; folded). ★ SHARED ROMANCE rules: ⟨c/g⟩ soften before ⟨e i⟩
(⟨ce ci⟩→t͡ʃ, ⟨ge gi⟩→d͡ʒ, silent softener i — Crãciun→krət͡ʃun); RISING DIPHTHONGS ⟨ea⟩→[e̯a], ⟨oa⟩→[o̯a]
(noaptea→no̯apte̯a); the ⟨i u⟩ GLIDES. ⟨r⟩→[r]. ★ The WORD-FINAL ⟨-u⟩ (Latin short -us) DESYLLABIFIES
after a single consonant → dropped (the referee's [Cʷ]: cãntãtoru→[kəntətor], acatsu→[akat͡s]); after a
cluster it stays syllabic (amintu→[amintu]).

## Run 3 — build + tune

Self-contained Cunia-orthography scan (aromanian.ts), borrowing the Romanian c/g-softening + diphthong
+ glide pattern. First pass **87.3% folded**; +final-⟨-u⟩ desyllabification + no ⟨u⟩-glide before ⟨ã⟩
(dzuã→d͡zuə hiatus) → 93.9%; +word-final ⟨ie⟩ hiatus (educatsie→edukatsie) + the ⟨gh⟩ [ɣ]~[ɡ] fold →
**94.9% folded / 98.6% symbol (wikipron)**. The kaikki secondary (which dots every syllable — a pure
notation difference, folded) corroborates at **92.5%**. Folds: ⟨ã⟩ ə~ɨ, ⟨r⟩ ɾ~r, the desyllabified-⟨-u⟩
[ʷ], ⟨gh⟩ ɣ~ɡ, kaikki syllable dots. Residuals: a few 1-word referee inconsistencies (the variable
final-⟨-u⟩ where the two referees disagree — wikipron desyllabifies, kaikki keeps; ⟨y⟩→[ɣ] in one word;
unstressed final ⟨-e⟩→[i] raising in one word — all dialectal/loan).

## Run 4 — 2-agent review (2026-07-27)

**Code/wiring reviewer — CORRECT, no bugs.** Verified the digraph-vs-c/g ordering (⟨ch gh⟩ fire as
digraphs), the final-⟨-u⟩ logic including the digraph edge (out[last]=t͡s → out[last-1]=vowel correct),
the diphthong/glide ordering, NFC, and all wiring. Two non-blocking glide edges noted (word-initial
⟨iu⟩, ⟨ia⟩ in loans) — inherited from the shared Romance glide logic.

**Phonology reviewer — core scan sound**, 3 real fixes applied:
- ★ **⟨y⟩→[ɣ]** (was [j], WRONG) — ⟨y⟩ is the Greek-gamma letter, [ɣ] in ALL 4-5 referee words
  (anyedz→anɣed͡z, yioarã→ɣio̯arə) — a clear, consistent, unfolded error. Fixed.
- ★ **⟨ndz⟩+front-vowel → [ndʒ]** (the soft-g reflex, Latin *sanguine*: sãndze→sɨndʒe) — added; plain
  ⟨dz⟩ stays [d͡z] (dzinire→d͡zinire).
- ★ **gh→[ɡ]** (was [ɣ]) — [ɡ] matches 2/3 of the referee (ghini→ɡini) vs [ɣ]'s 1/3 (ghine); switched
  the canonical default, kept the ɣ~ɡ fold. → **97.0% folded (wikipron) / 95.5% (kaikki)**, +2pp.
- CONFIRMED correct: dh→[ð], ã→[ə]/[ɨ] (genuinely unpredictable — same lemma both ways), c/g softening,
  the final-⟨-u⟩ DROP (matches wikipron's desyllabification near-perfectly), stress deferral. Noted-
  not-fixed: th→[θ] and ll→[ʎ] are PLAUSIBLE but UNTESTED (no ⟨th⟩/⟨ll⟩ word in either referee); the
  final-⟨-u⟩ over-applies to the Turkish loan dushmanu (lexical, unpredictable); final-⟨-e⟩→[i] raising
  (dialectal, 1-2 words); the word-initial ⟨iu⟩/⟨ia⟩ glide edges.

**Final: 97.0% folded / 98.6% symbol (wikipron) + 95.5% (kaikki).** Floor 0.90. Goldens (4 tests incl.
the y/ndz fixes), the 154-test referee floor, and typecheck all green.
