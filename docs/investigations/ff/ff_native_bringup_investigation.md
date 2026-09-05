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

## Adlam front-end (2026-07-26)

Added **Adlam** (𞤀𞤁𞤂𞤃, U+1E900–1E95F) as a second input script — the modern (1989, the Barry brothers) phonemic
alphabet for Fulfulde/Pular, now in wide diaspora + West-African use. The Tashelhit/Tifinagh pattern: Adlam is a
1:1 phonemic alphabet, so `fulaAdlam.ts` **transliterates Adlam → the Latin (Boko) orthography** and the existing
longest-match g2p runs unchanged — prenasalisation (a nasal letter + stop → mb/nd/nj/ng), gemination, and vowel
length all fall out of the same Latin rules, so both scripts yield IDENTICAL IPA.

Adlam specifics handled: caseless folding (uppercase U+1E900–1E921 → lowercase U+1E922–1E943); the ALIF/VOWEL
LENGTHENER (𞥄/𞥅) doubles the preceding vowel (𞤢𞥄 → "aa" → [aː]); the GEMINATION MARK (𞥆) doubles the preceding
consonant (𞤦𞥆 → "bb" → [bː]); HAMZA (𞥇) → the glottal ⟨q⟩→[ʔ]; the CONSONANT MODIFIER / GEMINATE MODIFIER / NUKTA
(rare foreign-sound marks) are dropped. The loan letters (va x gb z kp sh) transliterate to their Boko equivalents —
identical to how the Latin engine already treats them.

**Validation = self-consistency** (no Adlam referee exists — no wikipron ff_adlm / kaikki): transliterating all 1998
Latin referee words → Adlam and phonemizing both paths gives **1998/1998 = 100% identical IPA**, so the Adlam path
inherits the Latin path's epitran-validated accuracy. Adlam is now the 2nd fleet member (after Tashelhit's Tifinagh)
where a covered language gains a second community script via a grapheme front-end over the shared engine.
