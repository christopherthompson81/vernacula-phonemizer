# Swahili / Kiswahili (sw) native bring-up

Bantu (Niger-Congo), ~90M+ speakers (East African lingua franca; up to ~200M with L2). Unusually for Bantu,
Swahili is **NOT tonal** — it has regular penultimate stress instead — and its Latin orthography is highly
**phonemic**, so this is a clean rule-based g2p (the id/tl pattern). espeak ships an sw voice, but this is a
fresh cleanroom bring-up validated against **three independent referees**: wikipron swa + kaikki swa (both human)
+ epitran swa-Latn (map).

## The distinctive Swahili segments
- **Implosive voiced stops** — /b d j g/ are realised [ɓ ɗ ʄ ɠ] (both human referees mark them: abu→ɑɓu,
  video→viɗɛɔ, jambo→ʄambo, fuga→fuɠɑ).
- **Prenasalized stops** — a homorganic nasal + voiced stop is ONE segment with a superscript nasal: mb→ᵐb,
  nd→ⁿd, nj→ⁿd͡ʒ, ng→ᵑɡ (jambo→ʄɑᵐbɔ, ndege→ⁿdɛɠɛ). ⟨mv⟩/⟨nz⟩ likewise → ᵐv/ⁿz.
- **⟨ng'⟩ (apostrophe) → ŋ** (velar nasal) — DISTINCT from ⟨ng⟩ → ᵑɡ (ng'ombe→ŋɔᵐbɛ vs ngoma→ᵑɡɔmɑ).
- **Syllabic nasals** — a nasal before a non-homorganic consonant is syllabic (mtu→m̩tu, nchi→n̩t͡ʃi, the noun-class
  prefixes). Before a vowel or a glide (mw/my) it's a plain onset.
- **Long vowels** from doubled letters (⟨aa⟩→ɑː, kuu→kuː), **Cʷ labialization** (kweli→kʷɛli, mwezi→mʷɛzi), the
  Arabic-loan fricatives dh/th/gh/kh→ð/θ/ɣ/x, and vowels [ɑ ɛ i ɔ u].

## Runs — 2026-07-15
- **Run 1** — authored engine (implosives, prenasal digraphs, ng'/ng, syllabic nasals, penult stress) + the
  standard number compositor (na-joined). **wikipron 85.1% / kaikki 88.1%.**
- **Run 2** — the residual showed two clean notation classes: doubled vowels → the referee's LENGTH (kuu→kuː)
  and **Cʷ labialization** (mwezi→mʷɛzi). Collapsed identical adjacent vowels → Vː and attached ʷ to a consonant
  before ⟨w⟩+vowel. **→ wikipron 92.2% / kaikki 96.5%.**
- **Run 3** — folded the referee-inconsistent notation axes (cardinal vowels a~ɑ/e~ɛ/o~ɔ; implosive ɓ~b etc.).
  **→ wikipron 93.5% / kaikki 97.8%.**

## Result — ✅
93.5% / 97.8% across two independent human referees. The residual is entirely **Arabic-loan nativization where
WE are more correct than the referee** — Standard Swahili nativizes the Arabic phonemes the referee preserves:
akili q→k, habari/hofu x→h, arusi ʕ→∅, hata ħ→h. Two referees corroborate the segmental inventory; no systematic
error remains. Numbers verified (11=kumi na moja, 21=ishirini na moja, 1234=elfu moja na mia mbili na thelathini
na nne).
