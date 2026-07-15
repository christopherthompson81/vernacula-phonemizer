# Pashto / پښتو (ps) native bring-up

First **Eastern Iranian** language, ~60M speakers. Written in an EXTENDED Perso-Arabic **abjad** (retroflex letters
ټ ډ ړ ڼ ښ ږ, the affricates څ t͡s / ځ d͡z, the velar ګ). espeak ships an *immature* ps voice with artifacts
(voiceless-r̥, ghost-r, aspiration) — not something to inherit into an espeak-independent project — so this is a
fresh authored g2p modeled on the Urdu/Persian abjad approach. Validated against wikipron pus + kaikki pus (human).

## Approach — the abjad skeleton (🟠, like Urdu/Persian)
Pashto is a SHALLOWER abjad than Urdu/Arabic: it writes the long/mid vowels distinctly — ا/آ→ɑ (ā), ې→e, و→o
(or the glide w), ی→i (or the glide j), ۍ/ئ→əi — but the SHORT vowels a/ə/i/u are usually UNWRITTEN. So a default
[ə] (Pashto's zwarakay) + medial-schwa deletion stand in for the deferred short-vowel-restoration subsystem.
Word-final ه→[ə] (ښه→ʂə); ع→ʔ. Dialect: ښ/ږ rendered as the SW/Kandahari retroflex ʂ/ʐ.

## Runs — 2026-07-15
- **Run 1** — authored `pashto.jsonc` (consonant inventory from the espeak `ps_rules` + Pashto phonology) +
  `pashto.ts` (Persian-modeled: word-initial vowel carrier, long-vowel letters, harakat, default [ə]). **30.4%.**
- **Run 2** — three fixes from the residual: (a) و/ی before a word-final ه is a GLIDE (برتانيه→…njə, not …nih);
  (b) dialect folds ʂ/ç→ʃ, ʐ→ʒ, ɻ→r; (c) an initial-cluster ə-suppression heuristic — which **backfired**
  (broke CvC words: کتاب→ktɑb) and was reverted, since real clusters (سپک→spək) and CvC (کتاب→kətɑb) are
  indistinguishable in the abjad. **→ 32.0%.**
- **Run 3** — removed the Persian-style final-cluster ə-deletion: Pashto RETAINS the epenthetic ə before many
  final clusters (اخښل→axʂəl), unlike Persian. Verified keeping medial-schwa deletion (35.4%) beats dropping it
  (28.5%). **→ 35.4% / 37.7%.**

## Result — 🟠 (scope-limited abjad)
35.4% / 37.7% vs the two human referees — below Urdu's 42.9% ceiling, because Pashto is genuinely HARDER:
1. **Multi-dialect referee** — ښ = ʂ (Kandahari) ~ x (NE) ~ ç (Central); ږ = ʐ ~ ɡ ~ ʝ. I fold ʂ/ç→ʃ and ʐ→ʒ, but
   the referee's NE **x/ɡ** can't be folded without merging real خ/ګ.
2. **Epenthesis position is unrecoverable** — initial clusters (سپک→spək) vs CvC (کتاب→kətɑb) look identical in
   the abjad; the default [ə] lands in one canonical spot, the referee's varies.
3. **Referee noise** — single-letter entries are letter NAMES (ش→ʃin), and short-vowel quality (a~ə~i~u) is folded
   as unrecoverable.

The consonant + written-vowel SKELETON is correct (retroflexes, affricates, dental t̪/d̪, ā/e/o/i distinction,
glide/vowel و/ی disambiguation, final ه→ə) — the same 🟠 story as Urdu/Persian, with short-vowel + epenthesis
restoration as the deferred subsystem.
