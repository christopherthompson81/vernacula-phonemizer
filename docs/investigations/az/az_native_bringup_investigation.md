# Azerbaijani (az) native bring-up

Azerbaijani / Azərbaycan dili — North Azerbaijani, Turkic (Oghuz — the sibling of Turkish), ~28M speakers, Latin
script. A cleanroom rule g2p that reuses the Turkish engine's shape (a shallow left-to-right scan: vowel harmony is
already spelled, k/g palatalize before front vowels, dark/clear l, geminate stops, nasal place assimilation,
final-syllable stress), espeak-independent.

## Data availability (checked up front)

- **wikipron aze_latn narrow** — 4,034 human words (PRIMARY, merged from 6,105 lines). A *very* fine-grained
  narrow transcription (aspiration, palatalization marks, affrication + final-devoicing variants) → duplicate
  prons merged into tab-variants, and the systematic narrow allophony folded.
- **epitran aze-Latn** — programmatic, INDEPENDENT (SECONDARY). Naive on the allophony (no dark-l, no k→c
  palatalization, no final -q devoicing), but a real independent corroborator once its non-contrastive laxing is
  folded.
- **wikipron aze broad** (513) exists but is small; the narrow is the bigger, if noisier, referee.

## The Azerbaijani differences from Turkish

The Turkish scan shape ports directly; the DATA + three ALGORITHM points differ:

- **The extra vowel ⟨ə⟩ → [æ]** (a FRONT vowel — it triggers harmony + palatalization), plus a → **[ɑ]** (back,
  opener than Turkish [a]) and ö → **[œ]**.
- **⟨q⟩ is a distinct letter → [ɡ]** (the back voiced stop: qapı→ɡɑpɯ), **devoicing to [x] word-finally**
  (oxumaq→oxumɑx, balıq→bɑlɯx) — this is the standard Azerbaijani final-/q/ rule, and notably the one place epitran
  is simply *wrong* (it keeps [ɡ]); the human narrow referee confirms [x]/[χ].
- **⟨x⟩ → [x]** (voiceless velar fricative — a real letter, not Turkish ⟨x⟩=ks) and **⟨ğ⟩ → [ɣ]** (voiced velar
  fricative — not the Turkish lengthening/j).
- k → c and g → ɟ before a front vowel (kitab→citɑb, gəlmək→ɟælmæc), as in Turkish (Azerbaijani ⟨g⟩ is inherently
  the palatal member). Dark-l, geminate stops, nasal assimilation, final stress — all shared.

## Run — vs the two referees

**81.6% vs wikipron narrow (primary) / 66.4% vs epitran (secondary)** — two independent referees corroborate, and
16/16 hand-diagnostics are correct. Folds are all notational/allophonic, never a contrast:

- narrow **aspiration ʰ** and **palatalization ʲ** marks (allophonic detail);
- **dark-l ɫ → l** (the narrow referee marks it inconsistently — 866 times but not in salam/Dolça — and epitran not
  at all; we keep ɫ in the canonical output, fold only for comparison);
- **tap ɾ → r** (one Azerbaijani rhotic, both notations in the referee);
- the **[q]~[ɡ]~[ɢ]** and **[x]~[χ]** back allophones of ⟨q⟩/⟨x⟩;
- the single low vowel **ɑ~a**;
- epitran's non-contrastive laxing **ɪ→i / ɔ→o** (Azerbaijani has no /ɪ/ or /ɔ/) — folding these lifted the
  epitran secondary 39%→66% (the remaining epitran gap is its lack of palatalization + final-q devoicing, where
  *we* are correct and it is naive).

## Verdict — ✅ Reliable

Shallow near-phonemic orthography (like Turkish), verified against two independent referees, with the residual
being narrow-referee noise (variant transcriptions, foreign-name loan vowels) rather than engine error. Numbers
(thousands-scale, bir-dropped before yüz/min) and the Oghuz consonant set are done. **Outstanding:** the
pre-accenting-suffix stress morphology Turkish has is not ported (final-syllable default only — but stress is
backbone-stripped in the eval, so it does not affect the measured number), and a loanword vowel-quality tail (o→ɑ
in some borrowings). See the Turkic fleet: [[nogai_bringup]], [[crimean_tatar_bringup]].
