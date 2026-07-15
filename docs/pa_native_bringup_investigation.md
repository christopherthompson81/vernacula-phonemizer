# Punjabi (pa) native bring-up — investigation log

Punjabi in Gurmukhi — a Brahmic abugida (generic engine, core/abugida.ts) + Punjabi's signature TONOGENESIS.
Punjabi is the only TONAL Indo-Aryan language: the historical voiced aspirates lost their breathy voice, which
became lexical tone. Referees: wikipron pan_guru broad (human, 1586 words) + a 20-word adjudicated common-word gold.

## Run 1 — 2026-07-15 — abugida + tonogenesis → 🟡 (folded 61.7%, gold 100%)

Built punjabi.jsonc (Gurmukhi consonants/vowels/matras/signs; the voiced-aspirate letters ਘਝਢਧਭ carry the
breathy form ɡʱ/d͡ʒʱ/ɖʱ/d̪ʱ/bʱ as a MARKER) + punjabi.ts:
- **addak ੱ** gemination — pre-normalize ੱC → C੍C so the following consonant is long (ਪੱਕਾ→pəkːaː).
- **TONOGENESIS**: rewrite each breathy marker to its de-aspirated, TONED realization — voiceless + low tone
  ˨˩ word-initially (ਘੋੜਾ→koː˨˩ɽaː, ਭਾਰਤ→paː˨˩ɾət̪), voiced + high-falling ˥˩ post-vocalically (ਕੰਘਾ→kə̃˥˩ŋɡaː,
  ਸਿੰਘ→sɪ̃˥˩ŋɡ, ਦੁੱਧ→d̪ʊ˥˩d̪ː). Verified against the referee (ਘਟਾਉਣਾ→kə˨˩ʈaːʊɳaː matches kəʈaʊ˨ɳäː).
- inherent-schwa deletion (word-final + Ohala medial, shared with Hindi); weight stress; Indic numbers.

KEY INSIGHT: the referee-eval BACKBONE already strips Chao tone letters, so the eval grades the SEGMENTAL output
— and the segmental crux is the DE-ASPIRATION (ਘ→k/ɡ, not ɡʱ), position-dependent voicing (word-initial voiceless
vs medial voiced, confirmed in the referee: ਘ word-initial→k, ਕੰਘਾ medial→ɡ). Tones are graded on the synthesis
output, not the backbone.

Folds added (each a notation/convention difference): tap ɾ→r; ਵ ʋ~w (referee-split); degemination (.)\1→$1 (our
length ː vs referee doubling — NB the first attempt had a doubled-backslash bug `\\1` that silently no-op'd);
word-final schwa (we DELETE per Punjabi speech, the referee keeps an ultrashort ə̆). These + the degemination fix
took the folded backbone 48.2→61.7%.

RESULT: wikipron folded 61.7% (small, NOISY referee — epenthetic ᵊ/final ə̆, medial-schwa variation, x~kʰ, the
intervocalic-h tone), adjudicated common-word gold **100%**. Status 🟡 — the segmental core + tonogenesis are
verified; the tail is intervocalic ਹ→tone (we keep ɦ) and medial-schwa variation. Suite 33/33; typecheck clean.

NEXT (deferred): intervocalic/coda ਹ → tone + h-deletion (ਕਹਾਣੀ→käːɳiː); a larger/cleaner tone referee (the
narrow wikipron, or epitran pan-Guru) for the tone axis proper.
