# Guarani (gn) native bring-up investigation

Target: **Paraguayan Guaraní** (Avañe'ẽ, `gug`), Latin script (the achegety),
canonical IPA, espeak-independent. Tupian (the fleet's first). Co-official in
Paraguay (~6.5M). Near-phonemic orthography: 12 vowels (6 oral a e i o u y + 6
nasal ã ẽ ĩ õ ũ ỹ; ⟨y⟩ = high central /ɨ/), prenasalized voiced stops ⟨mb nd ng⟩,
the glottal stop ⟨'⟩ (puso), nasal harmony (mostly marked by the tilde).

## Run 1 — referee landscape

- **wikipron `gug_latn_broad`**: 348 lines (HUMAN, space-separated phones) +
  `gug_latn_narrow` 229. No `grn_*`. → PRIMARY. Confirms: ⟨y⟩→ɨ, ⟨ch⟩→ɕ
  (Chíle→ɕile), ⟨j⟩→d͡ʒ (Jasy→d͡ʒasɨ), prenasalized ⟨nt⟩→ⁿt / ⟨mb⟩→ᵐb
  (Arahentína→…eⁿti…, Kolómbia→…oᵐbj…), ⟨gu⟩→w (Ka'aguasu→…awasu), ⟨'⟩→ʔ, ⟨ñ⟩→ɲ +
  nasal spread (Epáña→epaɲã).
- **kaikki Paraguayan Guarani**: 962 entries, 632 IPA (phonemic /../ + phonetic
  [..]; stress + syllable dots; ⟨y⟩→ɨ, nasal ẽ). Same Wiktionary tradition as
  wikipron → CORRELATED, not independent. → SECONDARY.
- **epitran**: no `grn-Latn` mapping. None.

Verdict: 🔷 single-source-FAMILY (both referees are Wiktionary-derived, human but
correlated — the Tashelhit/Māori situation), not two independent sources.

## Run 2 — engine + tuning

Engine: longest-match scan (Quechua/Māori template) + these measured rules:
- **Glide formation** (+~6pp): a non-nuclear prevocalic high vowel i/u→[j/w]
  (Kolómbia→koloᵐbja, kuéra→kweɾa, Venesuéla→veneswela). Biggest lever.
- **⟨gu⟩ is Spanish-style**: before a back vowel → [w] (guata→wata), before a
  front vowel → [ɰ] (gue→ɰe, u silent). Emitting [ɰw] (velar+glide) scored SYMBOL
  higher but FOLDED lower (the referees mostly use one segment) → reverted to [w].
- **⟨ng⟩ is emitted plain [ŋ]** (scores slightly higher than [ᵑɡ]: 75.6 vs 75.0).
  NOTE: ⟨ng⟩ is NOT categorically plain — like ⟨mb nd⟩ it is *variably* prenasalized
  (~48%, 12/25 across both referees; an earlier "0/25" count was a script bug —
  ascii ⟨g⟩ vs the script ⟨ɡ⟩ in [ᵑɡ]). [ŋ] is just the majority default; the
  prenasalized tail is deferred on the same (partly-lexical) nasal-harmony grounds
  as ⟨mb nd⟩ (which stay prenasalized [ᵐb ⁿd] by default).
- Folds: ⟨ch⟩ ɕ~ʃ, ⟨v⟩ ʋ~v, ⟨j⟩ ʝ~d͡ʒ, ⟨e⟩ ɛ~e, prenasal notation ᵐ→m/ⁿ→n, the
  glide labialization ʷ~w, syllable dots. Stress folded (broad referee marks none).

**NEGATIVES (measured, reverted):**
- **Word-initial glottal [ʔ]** (avañe'ẽ→ʔava…): HURT −16pp — the BROAD referee
  omits it for most vowel-initial words (ava→ava, not ʔava); it's a narrow/phonetic
  detail. Reverted.
- **Whole-word nasal-harmony reduction** (⟨mb nd⟩→[m n] if the word has a nasal
  vowel/ñ): net −1.5pp. The referee split is ~50/50 (⟨mb⟩ 24 prenasalized / 26
  reduced; ⟨nd⟩ 14/14) and nasal harmony is LOCAL (morpheme-domain), not
  whole-word — plus counterexamples like hendu→henu reduce with NO written trigger
  (lexical). Not modelled; the ~50% is the honest residual.

**Result: 75.6% FOLDED / 94.9% symbol** (wikipron primary) · 75.9% / 94.4%
(kaikki secondary). The 95% symbol is the headline (segments right); the folded is
dragged by the partly-lexical nasal harmony + the two correlated referees'
⟨g/gu/j⟩ notation spread. 🔷 single-source-family. Deferred: full morpheme-domain
nasal harmony (needs lexical nasality), numbers, the word-initial glottal.
