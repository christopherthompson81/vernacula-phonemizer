# Gujarati (gu) native bring-up

Indo-Aryan, the Gujarati abugida (Unicode U+0A80–U+0AFF), ~62M speakers. A clean **reuse** of the generic abugida
engine + the entire Hindi orchestration — the first time `makeNativeHindi` was parameterised by script so a
non-Devanagari abugida can share its schwa deletion, weight stress, number compositor and clause assembly. The
language module is a ~30-line wrapper + a Gujarati-Unicode `gujarati.jsonc`. Validated against wikipron guj +
kaikki guj (both human, ~4,200 pairs each).

## Gujarati specifics vs Hindi
- **No phonemic vowel length** — ⟨ઇ/ઈ⟩ both /i/, ⟨ઉ/ઊ⟩ both /u/ (Hindi keeps ɪ/iː etc.). ⟨અ⟩=ə (inherent) vs
  ⟨આ⟩=a (open; the referee writes [ɑ], folded). The mids ⟨ે⟩/⟨ો⟩ are [e]~[ɛ]/[o]~[ɔ] — one sign each, openness
  lexical (the candra signs ૅ/ૉ + ૈ/ૌ mark the open [ɛ]/[ɔ]) — folded vs the referee.
- Dental t̪/d̪ vs retroflex ʈ/ɖ (fleet Indic dental), ળ→ɭ, ષ→ʂ, ⟨અં⟩ anusvara → homorganic nasal (અંક→əŋk).
- Schwa deletion: reuses Hindi's Ohala VCəCV rule.

## Runs — 2026-07-15
- **Run 1** — parameterised `makeNativeHindi` with an `AbugidaScript` (word-run range + digit map), added the
  Gujarati Unicode constants, authored `gujarati.jsonc`. First measure **76.8% / 78.6%.**
- **Run 2** — the residual exposed a real latent bug: the syllable counter used `IPA_VOWELS`, which was **missing
  ɑ**, so any `…ɑCə` word looked monosyllabic and wrongly RETAINED its final schwa (વાંસ→ʋɑ̃sə). Adding ɑ to the
  shared set fixed Gujarati but rippled into 🟠 Urdu's weight-stress (Urdu uses ɑː — some words improved,
  બھائی regressed). So instead of the shared edit, Gujarati emits **a** for ⟨આ⟩ (already in the vowel set; inherent
  ə vs open a is the correct 2-way contrast) and folds a~ɑ vs the referee — no shared change, Urdu untouched.
  **→ 80.4% / 82.2%.**

## Result — 🟡
80.4% / 82.2% across two human referees — above Hindi's 77.7% baseline, with the SAME residual profile:
- **Schwa deletion** — Gujarati deletes/retains medial schwa somewhat differently from Hindi's Ohala rule
  (ચર્ચગેટ→referee t͡ʃəɾt͡ʃɡeʈ deletes where we keep; the reverse for અંકગણિત). A known hard, language-specific rule;
  reusing Hindi's is the pragmatic scope (Hindi itself ships ✅ at this level).
- **Loanword nukta ambiguity** — ⟨ફ⟩ = pʰ but [f] in loans (કોફી coffee), ⟨ઝ⟩ = d͡ʒʱ but [z] (ઝૂ zoo) — unrecoverable
  without the explicit nukta.
- Referee matra-only artifacts (a bare ⟨િ⟩ entry).

🟡 for the schwa-deletion tail + the **21–99 number gap** (the irregular compound spellings are a bounded
authoring task; round tens + 0–20 + magnitudes are authored, so 21–99 currently mis-compose).

## Run (2026-07-16) — REVIEW: intervocalic ɖ→ɽ flap rule + notation folds (80.4/82.2 → 86.0/87.9%)

Bucketed the wikipron+kaikki miss set (backbone-folded). The dominant "other" bucket was vowel nasalization
(ə̃ŋk vs referee əŋk) — already neutralized by the eval BACKBONE (it strips combining ̃), so not a real miss. The
true residual, in order:
- **ɖ~ɽ (98)** — intervocalic ડ: referee split 43 ɖ / 37 ɽ; word-initial ડ is ALWAYS ɖ (31/0). Standard Gujarati
  (Cardona) realizes intervocalic /ɖ ɖʱ/ as the flaps [ɽ ɽʱ], so the 37 ɽ are correct and the 43 ɖ are referee
  under-marking. Added a postRule **`(V)ɖ(V)→(V)ɽ(V)`** (+ ɖʱ→ɽʱ) — fires only intervocalically (અડદ→əɽəd̪), not
  word-initial (ડબ→ɖəb), geminate (અડ્ડો→əɖɖo) or cluster. CANONICAL correctness for shipped output; the eval
  gain comes from also folding ɖ~ɽ (the referee is inconsistent → allophonic fold).
- **ɦ~ʱ (50)** — હ post-vocalic breathy: referee [ʱ], ours [ɦ] — notation fold.
- **gemination** — our length ː (backbone-stripped) vs referee doubled consonant (əkkəl) — degemination fold.

RESULT: wikipron **86.0%**, kaikki **87.9%** (+5.6/+5.7); suite 371/371. The remaining ~14% is the genuine 🟡 tail:
**schwa-deletion** (~281, BOTH directions — Gujarati deletes/retains medial schwa differently from Hindi's Ohala
rule, and it is partly lexical/variable), **anusvara-before-fricative** (અંશુ→ənʃu: the referee writes an [n] where
we vowel-nasalize — a shared-engine representation choice), aspirated-geminate notation (ʈʰʈʰ, not in the geminate
class), and loanword nukta (ફ→pʰ/f, ઝ→d͡ʒʱ/z). ✅ would need the Gujarati-specific schwa-deletion rule; the referee
being split BOTH ways on it suggests a real variable/lexical ceiling, not a single clean rule.
