# Kurmanji / Northern Kurdish (kmr) native bring-up

Kurmanji / Kurdî — Northern Kurdish, Iranian (Indo-European), ~16M speakers, the **Latin Hawar alphabet**. A
cleanroom near-phonemic g2p, espeak-independent. The 3rd Iranian language (after Persian, Pashto).

## The key structural point (checked up front)

Unlike Persian (`fa`) and Pashto (`ps`), which use the **Perso-Arabic abjad** and need short-vowel *restoration*
(the unwritten-vowel wall), Kurmanji is written in the **Latin Hawar alphabet — the vowels are written**. So it is
a near-phonemic Latin g2p, no restoration layer, much simpler and more reliable than its abjad siblings.

## Data availability

- **wikipron kmr_latn broad** — 2,151 human words (PRIMARY). Narrow-ish (marks aspiration + pharyngealisation).
- **epitran kmr-Latn** — programmatic (SECONDARY, INDEPENDENT). Two independent referees.
- No kaikki Kurmanji.

## The rule core

The Hawar alphabet is near one-to-one:

- **⟨c⟩→[d͡ʒ]** and **⟨ç⟩→[t͡ʃ]** — the reverse of the Romance/Turkish values (çav→[t͡ʃɑːv]); ⟨j⟩→[ʒ] (roj→[roːʒ]),
  ⟨ş⟩→[ʃ], ⟨q⟩→[q] (uvular), ⟨x⟩→[x]; the one digraph **⟨xw⟩→[xʷ]** (xwarin→[xʷɑːrɪn]).
- **The vowel system**: LONG ⟨a ê î o û⟩ → [ɑː eː iː oː uː] vs SHORT ⟨e i u⟩ → [ɛ ɪ ʊ]. ⟨a⟩ is a long low BACK
  vowel [ɑː] (the human referee confirms; epitran uses front [aː]).
- **n→ŋ before k/ɡ** (nasal place assimilation: bang→[bɑːŋɡ], aheng→[ɑːhɛŋɡ]) — added from the referee residuals
  (all the -ng words).
- **Final-syllable stress** (Kurmanji default; unwritten, folded by the backbone).

## The deferred/folded layers

The Hawar orthography does not write two allophonic contrasts the narrow referee marks, so they are folded (not
emitted): **aspiration** (kʰ/pʰ/tʰ — the aspirated/unaspirated stop contrast) and **pharyngealisation** ([t͡ʃˤ]
etc.). Also folded: the single rhotic [r]~[ɾ], the referees' differing ⟨a⟩ ([ɑː]~[aː]) and short ⟨u⟩ ([ʊ]~[u]), and
the intervocalic ⟨x⟩→[ɣ] voicing / the ⟨xw⟩ [xʷ]~[x w] notation.

## Run — vs the two referees

**97.4% vs wikipron / 96.3% vs epitran** — near-perfect, both independent referees strongly corroborating. The
residual is: standalone dotted-letter headwords (ẍ→ɣ, ḧ), a few loan/proper-noun spellings, and the aspiration/
pharyngealisation the orthography can't determine.

## Verdict — ✅ Reliable

A near-phonemic Latin orthography (the easy Iranian, vs the abjad wall of Persian/Pashto), verified against two
independent referees. Numbers (tens û units with the "û" connector, multiplied hundreds/thousands) are done.
**Outstanding:** the unwritten aspiration/pharyngealisation contrasts (not derivable from Hawar spelling — a bound,
folded); the r vs rr (tap/trill) distinction Hawar collapses; a few Sorani-influenced spellings.
