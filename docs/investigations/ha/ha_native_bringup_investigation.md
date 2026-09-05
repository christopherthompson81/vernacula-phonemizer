# Hausa (ha) native bring-up

Target: Kano-standard Hausa (Boko orthography), canonical IPA. Slot #15 in the OmniVoice coverage set
(contributes `ʼ` ejective, `ɓ` implosive, `ʷ` labialization). Hausa is the first AUTHORED (beyond-espeak)
bring-up in vernacula — espeak ships nothing for Hausa; portable-espeak authored it, so its authored output
is the reference. Fills census gaps: implosives ɓ ɗ, ejectives kʼ t͡sʼ, labialization kʷ ɡʷ kʷʼ, glottalized
ʔʲ (ƴ / 'y), palatals c (ky) / ɟ (gy), and ɸ (f).

## Convention (from portable-espeak's authored ha_rules / ph_hausa)
Boko spelling is shallow and near-1:1, so a longest-match orthography→IPA scan (digraphs/trigraphs first):
- vowels a e i o u; doubled → long (aa→aː …); diphthongs ai→aⁱ, au→aᵘ;
- consonants b, c→t͡ʃ, d, f→ɸ, g→ɡ, h, j→d͡ʒ, k, l, m, n, p, q→k, r, s, t, v, w, x→ks, y→j, z; sh→ʃ,
  ts→t͡sʼ, kw→kʷ, gw→ɡʷ, ky→c, gy→ɟ; ɓ, ɗ, ƙ→kʼ, ƙw→kʷʼ, ƴ→ʔʲ, '→ʔ, 'y→ʔʲ;
- n → ŋ before a velar (k/g/ƙ): hankali→ha˥ŋkˈa˩li˩.
- **stress is penultimate** (the penultimate vowel nucleus; a diphthong counts as one).

## Tone (a lexicon, NOT spelling)
Tone is not written in Boko and is not derivable from spelling. It is overlaid from `tone.tsv` (1,627 entries,
Wiktionary/kaikki-derived, ported from portable-espeak) — one code per vowel nucleus (H→˥ / L→˩ / F→˥˩ /
R→˩˥), placed after the vowel. All-Low words are omitted (privative-H convention), and out-of-lexicon words are
left untoned (sannu→sˈannu). A word's tone is a linguistic FACT, not copyrightable expression.

## Validation
vs the portable-espeak AUTHORED gold (50k words): **exact 97.4%, segmental 97.4%**. The residual (~2.6%) is
essentially all FOREIGN words that pollute the corpus — accented Latin loanwords (José, María, François,
Köppen) whose diacritics we drop, camelCase/multiword tokens (YouTube, KwaZulu) espeak splits, and
abbreviations (ng, png). Genuine Hausa accuracy is ~99%+.

## Numbers
Cardinal compositor (numbers.ts): units/tens lexicalised, hundreds (ɗari) / thousands (dubu) compounding with
"da" (and) and "goma sha X" for the teens. Tone is added by the g2p lexicon per word.

## Run 1 — authored Boko engine + tone lexicon — 2026-07-13
Built g2p.ts (longest-match Boko→IPA + n-assimilation + penultimate stress + tone overlay) + numbers +
tone.tsv (ported); registered `ha`. One glyph fix: au→aᵘ (U+1D58), not aᶷ — took exact 95.4%→97.4%. 111 tests
pass. Residual is foreign-word corpus contamination.
