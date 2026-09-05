# Maltese (Malti, mt) bring-up — Semitic (Central), Latin script, ~520k

Maltese — the only Semitic language written in the LATIN alphabet (a Siculo-Arabic core with heavy Sicilian/Italian +
English superstrate). Malta, ~520k. Referee: **wikipron `mlt_latn_broad`** (human, CUNY-CL/wikipron, 15,837
headwords — LARGE). Unlike Arabic/Hebrew (abjads), Maltese orthography is fairly phonemic, so it is a rule g2p.

## Run 1 — 2026-07-26 — grapheme g2p + final devoicing + the silent-letter rules

**Consonants (the interesting signal — verified from the referee):** the distinctive Maltese letters ⟨ċ⟩→t͡ʃ, ⟨ġ⟩→d͡ʒ,
⟨ħ⟩→ħ (pharyngeal), **⟨q⟩→ʔ** (the glottal stop — qalb→ʔalp), ⟨x⟩→ʃ, ⟨z⟩→t͡s vs ⟨ż⟩→z, ⟨g⟩→ɡ vs ⟨ġ⟩→d͡ʒ; ⟨j⟩→j,
⟨w⟩→w. **FINAL DEVOICING** (Attard→attart, Albaniż→albaniːs, qalb→ʔalp) + **regressive voicing assimilation**
(ħobż→ħɔps, b devoices before the final ż→s) + **⟨n⟩→m before a labial** (ġenb→d͡ʒɛmp).

**The silent-letter rules (Maltese's signature):**
- **⟨għ⟩** — historically /ʕ ɣ/, now SILENT but it lengthens/pharyngealizes an adjacent vowel (għamel→aːmɛl ~ aˤːmɛl ~
  ɣ in careful speech). We emit it silent; the length + the ˤ pharyngealization are folded.
- **⟨h⟩** — SILENT word-medially (it lengthens the adjacent vowel in the referee: deheb→dɛːp, xahar→ʃaːr; WE emit the
  length-stripped skeleton deheb→dɛp, xahar→ʃar) but → [ħ] WORD-FINAL
  (fih→fiːħ). ⟨ħ⟩ is always [ħ].
- **⟨ie⟩** → the long [ɪː] (tliet→tlɪːt, ktieb→ktɪːp).

**The QUANTITY is FOLDED (the Estonian call).** Maltese vowel length (~50% of referee lines carry ː) is largely
STRESS-CONDITIONED (a stressed vowel lengthens in an open syllable — the Arabic-style weight system) + comes from the
silent letters (għ/h) + ⟨ie⟩ — a full model needs the weight-based stress rule (deferred, genuinely complex). So we
emit the short-vowel + segment skeleton and FOLD the length (ː) + the għ pharyngealization (ˤ). Stress is unwritten
(the referee marks none) → not emitted.

## Run 2 — 2026-07-26 — residual iteration → 91.9% folded / 98.0% symbol

Wired against the wikipron `mlt_latn_broad` referee (15,837 human headwords, variants merged). Three residual-driven
fixes on top of the Run-1 segment skeleton, each measured:

- **word-final geminate DEGEMINATION** (`degeminateFinal`): a doubled consonant collapses word-finally (Ħadd→ħat,
  att→at) but a MEDIAL geminate is kept (attard→attart, qattus→ʔattus). +2.4pp.
- **word-final ⟨għ⟩ → [ħ]** (biegħ→bɪħ, friegħ→frɪħ) — the same word-final surfacing as ⟨h⟩.
- **★ affricate GEMINATION** (`geminateAffricate`): a geminated affricate surfaces as its STOP + the affricate, NOT a
  doubled affricate — ⟨ġġ⟩→[dd͡ʒ] (mweġġa'→mwɛdd͡ʒa), ⟨ċċ⟩→[tt͡ʃ]. This was the big win: **+4.7pp** (87.2→91.9%),
  because the referee consistently writes the stop+affricate form for every geminate ⟨ġġ/ċċ⟩.

**Measured NEGATIVE — devoicing-only regressed.** Tried dropping the regressive VOICING direction (keep only
devoicing) to fix Afgan→afɡan (referee keeps [f] before [ɡ], we voiced f→v). It REGRESSED 87.2→85.7%: regressive
voicing is net-positive across the corpus and Afgan is a rare loan exception. **Kept both-direction assimilation.**

**Residual tail (all 1–2× counts, not fixed):** (a) the ⟨għ⟩-as-GLIDE diphthongs (Għid→ajt, biegħed→bijat — medial
għ colours the vowel + acts as [j]/[w]; the deferred għ/quantity territory); (b) loan-NAME spellings (Agius = Italian
soft-g ⟨g⟩→[d͡ʒ], Aquilina = Latin ⟨qu⟩→[kw], Bajada = geminated ⟨jj⟩); (c) referee ARTIFACTS where the entry carries
the definite article (Baħrejn→ilbaħrejn, Birgu→ilbirgu) — not our bug. None is a systematic win.

**Final: raw 47.1% / folded backbone 91.9% (14,553/15,837) / symbol accuracy 98.0%.** Single LARGE human referee,
quantity (ː) + għ-pharyngealization (ˤ/ɣ) folded, stress unwritten. 🔷 single-source (standard Borg &
Azzopardi-Alexander 1997 / Wikipedia consonant map, attested across thousands of aligned tokens).
