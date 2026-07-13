# Thai (th) native bring-up

Target: Standard (Bangkok) Thai, canonical IPA. Slot #16 in the OmniVoice coverage set (contributes `ɤ`).
Thai is an authored bring-up (espeak-ng shipped only a broken partial) and the HARDEST script in the set: a
Brahmic abugida written with no inter-word spaces, wrap-around vowel circumfixes, silent leaders, and computed
(not lexical) tone.

## Approach — REUSE our authored syllabifier
The genuinely hard subsystem (vowel-span parsing, the epitran-based schwa/inherent-vowel algorithm, leading-
vowel reorder + อักษรนำ leaders, syllable segmentation, and the tone computation) was already written by us in
espeak-ng-portable's `src/Normalize/scriptSegmentation.ts` + `thaiPron.ts`. Rather than reimplement it, we PORT
those (→ `syllabifier.ts` + `thaiTone.ts`), which produce a per-syllable structure `{onset, nucleus, coda,
long, tone}`. In espeak-ng-portable that structure is emitted as PUA markers for the espeak L2S rules; here
`g2p.ts` RENDERS it to IPA directly — so vernacula stays espeak-independent while reusing the hard logic.

The lesson: a first from-scratch attempt (bespoke vowel-pattern matcher + greedy syllabifier) plateaued at 24%
— multi-syllable segmentation is the crux. Swapping in the ported syllabifier took it to 73% with only a thin
IPA renderer (consonant/vowel/coda/tone tables + glide/length/glottal conventions).

## Convention
Onset/coda consonant tables; vowel quality from the unit's graphemes + length from the scan's live/dead
computation; 5 tones as Chao contours (`˧` mid, `˨˩` low, `˦˥` high, `˥˩` falling, `˩˩˦` rising) after the
nucleus. Glide vowels ไ/ใ/ำ/เา are short + a j/w coda; centering diphthongs ua/ia/ɯa take no length. A written
SHORT open syllable takes a glottal `ʔ` — but only word-finally (minor/unstressed short syllables don't). Stress
`ˈ` on the first syllable; `ˌ` on the last when there are ≥3.

## Validation
vs the espeak-ng-portable authored gold (20k words): **exact 73.2%; 93% on monosyllables**. The residual is
lexical irregulars that espeak handles via its Thai DICTIONARY: length irregulars (ได้→daːj, น้ำ→naːm), the
silent-ร Sanskrit set (สร้าง→saːŋ, จริง→t͡ɕiŋ), a few cluster-under-leading-vowel cases (ใคร→kʰraj), and
เ–ิ/เ–coda length variation. Porting that dictionary is the documented next step.

## Run 1 — reuse the authored syllabifier — 2026-07-13
Ported scriptSegmentation.ts (Thai portions) + thaiPron.ts; wrote a native IPA renderer over the scan output.
24% (from-scratch) → 73.2% (with the ported syllabifier). 111 tests pass; residual is dictionary-class lexical
irregulars.
