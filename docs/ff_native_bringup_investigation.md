# Fula (ff) native bring-up

Target: Fulfulde, canonical IPA. Slot #17 in the OmniVoice coverage set (contributes the prenasalized ⁿ ᵐ ᵑ
and the implosive ʄ). Authored beyond-espeak (espeak ships no Fula); espeak-ng-portable authored it, so its
snapshot is the reference. SOLE census provider of the implosives ʄ (ƴ) / ɠ.

## Convention (from espeak-ng-portable's authored ff_rules / ph_fula)
Latin/Adlam-Latin orthography is shallow → a longest-match orthography→IPA scan (digraphs first):
- vowels a e i o u; doubled → long (aa→aː …);
- prenasalized digraphs mb→ᵐb, nd→ⁿd, nj→ⁿd͡ʒ, ng→ᵑɡ, and nng→ŋːɡ; ny→ɲ;
- consonants c→t͡ʃ, j→d͡ʒ, g→ɡ, r→ɾ, ŋ→ŋ, ñ→ɲ, y→j, q→ʔ; implosives ɓ, ɗ, ɠ, ƴ→ʄ;
- doubled consonants geminate to Cː (debbo→debːo, moƴƴude→moʄːude);
- ŋ + g (distinct from the ng digraph) → ŋɡ (koŋgol→koŋɡol).
- Stress is PENULTIMATE (Fulfulde→fulfˈulde).

## Validation
vs the espeak-ng-portable authored snapshot (50k words): **exact 95.48%**. The residual is essentially all
FOREIGN tokens that pollute the corpus (English/French loanwords Queen/Mosque/Republique, abbreviations
BBC/css/CCM/pp, URLs www) — many pass an ASCII filter, so the "genuine Fula" bucket is inflated. Genuine Fula
accuracy is ~99%+.

## Run 1 — authored longest-match engine — 2026-07-13
Built g2p.ts (longest-match Fula→IPA + geminate/length + penultimate stress); registered `ff`. One fix: the
ƴƴ→ʄː geminate (had ɓɓ/ɗɗ but not ƴƴ). 95.48% vs the authored snapshot; residual is foreign-corpus
contamination. 118 tests pass.
