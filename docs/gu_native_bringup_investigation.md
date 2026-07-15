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
