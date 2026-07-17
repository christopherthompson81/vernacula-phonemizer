# Uzbek (uz) native bring-up

Uzbek / oʻzbekcha — Turkic, ~35M speakers, modern standard in the **Latin** orthography. The third Turkic
language (after Turkish and Kazakh), and a Latin g2p like Turkish. Uzbek's defining trait among Turkic is that it
**lost vowel harmony** (centuries of Persian/Tajik contact), so — unlike Turkish or Kazakh — the g2p needs no
harmony machinery: a flat left-to-right scan with fixed letter values.

## Data availability (checked up front)

Three referees — a real convergence:
- **wikipron uzb_latn broad** — 345 human pairs (PRIMARY). (Cyrillic `uzb_cyrl` is empty.)
- **kaikki uz** — 450 human IPA entries (SECONDARY).
- **epitran uzb-Latn** — used as a third, but it is essentially **circular**: both it and our g2p are rule-based
  Latin→IPA converters over the same orthography, so 99.4% agreement measures shared rules, not correctness.

## The Uzbek profile (from the referees)

- **The vowel split ⟨o⟩→[ɒ] vs ⟨oʻ⟩→[o]** — the signature. ⟨o⟩ is the open back [ɒ] (Eron→erɒn), ⟨oʻ⟩ (comma-letter)
  is the close-mid [o] (Oʻzbekiston→ozbekistɒn shows both). Six vowels: a e i ɒ o u, **no harmony**.
- **Comma-letters** oʻ/gʻ (the modifier turned-comma ʻ, in practice typed as any apostrophe variant) → [o]/[ʁ].
  Distinct from the **tutuq belgisi** ʼ (a standalone apostrophe elsewhere) → glottal [ʔ] (sanʼat→sanʔat).
- **Digraphs** sh→ʃ, ch→t͡ʃ, ng→ŋ. Consonants x→χ, q→q, j→d͡ʒ, v→ʋ, y→j.

## Runs (folded vs wikipron primary / kaikki secondary)

- **Run 1 — first compile.** 77.7% / 46.2%. The flat scan (vowels, consonants, digraphs, apostrophe
  disambiguation) + final-syllable stress + a new **Turkic decimal number composer** (`turkicNumberWords`:
  units + tens + hundred/thousand/million, no fusion — 1984→ming toʻqqiz yuz sakson toʻrt). This landed the
  **`NumbersDef` schema lift** the ADR-0002 note anticipated: added optional million/billion magnitudes + optional
  teens (Turkic composes 11 = oʻn bir). kaikki was low (46%) purely from its **syllable-dot** notation (ɒ.ta).
- **Run 2 — notation + allophony folds.** Stripped kaikki's syllable dots (preFold), folded ⟨o⟩=[ɒ]~[ɔ] (kaikki's
  notation — preserving the ⟨o⟩/⟨oʻ⟩ contrast, since [o]=⟨oʻ⟩ is untouched), and the allophones ⟨i⟩=[i]~[ɨ]
  (back-i after uvulars) / [ɪ] (lax), ⟨e⟩=[e]~[ɛ], ⟨u⟩=[u]~[ʊ], dark ⟨l⟩=[l]~[ɫ]. → **91.3% / 87.1%**.

## Verdict — ✅ Referee-limited

**91.3% vs wikipron + 87.1% vs kaikki**, two human referees corroborating. The residual is a diffuse
proper-noun / loanword tail — the small referees are dominated by foreign place-names (Afrika, Chikago, Mozambik,
Rossiya) that the referee reads with source-language phonology ([o] kept, palatalised sʲ), which our
orthography-driven g2p (correctly) does not. The native core is solid. Deferred: the morpheme-boundary sh (Is-hoq
vs I-shoq — needs morphology) and the ⟨j⟩=[d͡ʒ]~[ʒ] Russian-loan split (not orthographically recoverable). Uzbek
Cyrillic is out of scope (the modern standard is Latin; no Cyrillic referee exists).
