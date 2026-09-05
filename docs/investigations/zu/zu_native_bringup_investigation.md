# Zulu (zu, isiZulu) native bring-up

Target: isiZulu, canonical IPA. Nguni Bantu, Latin script. **AUTHORED beyond-espeak** — espeak ships only a
crude "testing" voice and has no click phoneme at all; the reference is *our own* authored Zulu in
portable-espeak (a near-clone of Xhosa: `authoring/zu/{zu_rules,ph_zulu,zu_tone.tsv}`, validated there against
the epitran zul-Latn + kaikki referees). This port lifts that authored convention directly into vernacula. Fills
the census click gaps ǀ ǃ ǁ. Gold = portable-espeak's canonical-mode output over the 50k corpus (our authored
output), 49,621 words.

## Architecture — longest-match rule g2p + penult length + lexical tone
`g2p.ts` is a longest-match orthography→IPA scan (trigraphs/digraphs before the bare letter, so clicks and
affricates resolve as single phonemes). The ortho→IPA table is the composition of portable-espeak's
`zu_rules` (ortho→phoneme-mnemonic) with `ph_zulu` (mnemonic→IPA):
- **15-way click series**: c/q/x → kǀ/kǃ/kǁ; aspirated ch/qh/xh; voiced-depressor gc/gq/gx (ɡ̤ǀ…); nasal
  nc/nq/nx (ŋǀ…); breathy-nasal ngc/ngq/ngx (ŋ̤ǀ…); ejective-nasal nkc/nkq/nkx (ŋǀʼ…).
- implosive b → ɓ (plain b only after m: mb=[mb]); plain voiceless stops are EJECTIVE (p/t/k → pʼ/tʼ/kʼ),
  aspirates ph/th/kh → pʰ/tʰ/kʰ; voiced obstruents carry the depressor (breathy) diacritic (g→ɡ̤, d→d̤, z→z̤, v→v̤).
- lateral fricatives hl→ɬ, dl→ɮ̤; velar-lateral affricate kl→k͡xʼ; affricates tie-barred (ts→t͡sʼ, tsh→t͡ʃʼ,
  j→d͡ʒ̤); nasal place-assimilation n→ŋ/ɲ before velar/palatal (nk→ŋkʼ, nj→ɲd͡ʒ̤, ng→ŋɡ̤).

`zulu.ts` applies **Nguni penultimate stress with vowel LENGTHENING** (the penult vowel takes ˈ and ː) and a
**lexical tone overlay**: Zulu tone is not derivable from spelling, so it is read from `tone.tsv` (1,052 words,
kaikki/Wiktionary-derived, one H/L/F/R code per vowel nucleus → Chao ˥/˩/˥˩/˩˥, placed after the vowel and its
length); out-of-lexicon words are left untoned.

**Compounds**: espeak splits a noun-class prefix + Titlecase stem (eNingizimu, INingizimu, FOOTNOTEMeredith) on
the internal Titlecase boundary. If the FULL lowercased word is in the tone lexicon (isingisi→HLHL) its codes
are threaded across the split parts; if not, the whole word is untoned (isiTsonga — even though standalone "isi"
carries tone, espeak only tones whole-word lexicon hits).

## Validation
vs the 49,621-word authored gold (text path): **exact 99.40%, tone-only 0**. The residual 298 (0.6%) are all 1×
abbreviations / acronyms / code identifiers (NG, BBC, png, COinS, latNS) that espeak letter-spells — genuine
corpus noise, not Zulu words.

## Numbers — Zulu text composed through the g2p (toned like any word)
Zulu numerals are agglutinative Bantu: units 1–5 have distinct standalone (ku-), connective (na-) and
multiplier (ama-) stems, and 6–9 are isi- nouns; tens/hundreds/thousands are noun classes with an ama-/izi-
multiplier (amashumi amabili nanye = "tens two and-one" = 21). `numbers.ts` composes the Zulu TEXT and the
phonemizer runs each word through the g2p, applying the tone lexicon exactly like any other word.

**Tone on numbers (linguistic-correctness note).** Zulu number words are ordinary nouns and carry tone; the
kaikki/Wiktionary referee (independent of espeak) lists ishumi→FFL, ikhulu→FFL, isithupha→LHLL,
inkulungwane→HLHLH, isigidi→LHLL. espeak's *number compositor path* emits them untoned, but that is a
deficiency of espeak, not a fact about Zulu — and the project target is canonical linguistic correctness, not
espeak parity (numbers aren't in the corpus gold, so there is no regression-guard conflict). So numbers are
toned wherever the lexicon has data (6, 7, 10, 100, 1000, 1000000); the ku-/na-/ama- combining stems have no
tone entry and stay untoned, uniformly with how every out-of-lexicon word is handled. This is a deliberate,
referee-backed divergence from espeak.

## Run 1 — port authored zu + penult/tone + numbers — 2026-07-13
Built g2p.ts / zulu.ts / numbers.ts + copied tone.tsv; registered zu. Iteration on the 50k gold: 85.5% (first
cut) → 96.7% (tie-bars on affricates t͡s/t͡ʃ/d͡ʒ/k͡x + camelCase split) → 98.7% (generalized split to fire before any
Titlecase run, catching I-/U-/A- noun-class prefixes) → 99.0% (thread full-compound tone across split parts) →
99.35% (untoned fallback for compounds not in the lexicon — was over-applying standalone "isi" tone) → **99.40%**
(word-initial ntsh keeps plain n). 6 unit tests + full suite (136) green.

Key lessons:
- The canonical output tie-bars affricates (t͡ʃʼ, d͡ʒ̤, k͡x) even though `ph_zulu`'s `ipa` fields don't — read the
  gold, not just the phoneme table.
- Compound tone is a whole-word property: thread the lexicon codes across the split, and if the compound isn't
  listed, emit NO tone rather than falling back to per-part lookup (which wrongly tones standalone prefixes).

## Independent-referee corroboration (added 2026-07-13)
Beyond the espeak-canonical gold (a regression guard), the segmental backbone is cross-checked against the
**espeak-independent** epitran `zul-Latn` referee via `tools/referee-eval` (fold classes justified in its
config): **100%** backbone agreement (1047 words) — an independent G2P corroborates the full click / implosive /
ejective / lateral-fricative inventory. `referee-eval.test.ts` pins a 99% floor.
