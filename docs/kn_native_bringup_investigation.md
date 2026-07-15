# Kannada (kn) native bring-up

Dravidian (Southern), the Kannada Brahmic abugida (Unicode U+0C80–U+0CFF), ~59M speakers. The cleanest kind of
bring-up: a near-exact **mirror of Telugu** — the generic abugida engine (`core/abugida.ts`) with a Kannada-Unicode
data file, its own thin module (own tokenizer + Kannada digits), and — like all Dravidian abugidas — **NO
inherent-vowel deletion** (every akshara is pronounced, inherent /a/), which sidesteps the one hard part
(Gujarati's schwa deletion). Validated against **three independent referees**: wikipron kan + kaikki kan (both
human) + epitran kan-Knda.

## Kannada specifics
- Dravidian short/long e·o distinguished (ಎ e / ಏ eː, ಒ o / ಓ oː); the inherent short /a/ is [ɐ] (the referee
  writes ɐ — we emit `a` for fleet consistency and fold a~ɐ~ɑ).
- Dental t̪/d̪ (ತ ದ) vs retroflex ʈ ɖ ɳ (ಟ ಡ ಣ), retroflex lateral ಳ→ɭ (+ ಳ್ಳ→ɭː), ಷ→ʂ, the archaic ೞ→ɻ / ಱ→r.
- Geminate → length ː; word-final anusvara ಂ → [m]; first-syllable (weak) stress.

## Runs — 2026-07-15
- **Run 1** — mirrored the Telugu module (`kannada.ts` + `kannada.jsonc`, Kannada Unicode). First measure
  **78.5% / 78.2%.**
- **Run 2** — the residual was DOMINATED by one class: **geminate notation** — we render ಕ್ಕ as length (ɐkːa)
  but both referees write a DOUBLED consonant (ɐkka). Since the backbone strips our ː (and the dental/combining
  marks), a degemination fold (`(.)\1+`→`$1` + affricate-gemination) collapses the referee's doubles to match.
  **→ 95.5% / 95.0%.** Then folding the referee-variable short-/a/ notation ([ɐ]~[a]~[ɑ]) → **97.4% / 96.8%.**

## Result — ✅
97.4% / 96.8% across two independent human referees — among the cleanest in the fleet. The residual is diffuse
referee noise: visarga h before a stop, anusvara before a fricative (ಅಂಶ→referee ɐmʃa), short o~ɔ, and diphthong
notation (ಕೈ→kai vs kɐɪ̯). Numbers verified (Kannada spellings via the shared Indic composer, native ೦-೯ digits
route correctly: ೧೦೦→ondu nūru). The Dravidian-abugida path (Telugu → Kannada) is now a ~clean data-only reuse.
