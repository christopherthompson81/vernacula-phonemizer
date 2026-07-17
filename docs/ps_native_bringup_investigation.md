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

## Run (review) — 2026-07-16 — ی-glide before final ا + homorganic nasal; the abjad ceiling characterised

Bucketed the wikipron pus residual (43.8% at start). Two clean, canonically-correct RULE fixes; the rest is the
inherent abjad + multi-dialect ceiling.

**ی-glide before a word-final ا (ـيا → jɑ).** Country/abstract nouns in -يا (اسپانيا, البانيا, دنيا) were read
with the ی as the vowel [i] and the ا wrongly gliding (…nij) — an inverted parse. Fixed by mirroring the existing
glide-before-final-ه rule: a ی before a word-final ا is the glide [j], and the ا is the [ɑ] nucleus
(اسپانيا→əspɑnjɑ, دنيا→dunjɑ).

**Homorganic ن → [ŋ] before a velar stop** (انګور→aŋɡor). Runs AFTER medial-schwa deletion so the nasal is
actually adjacent to the velar (the g2p first inserts an epenthetic ə that deletion removes).

Result: wikipron 44.9% (was 43.8%), kaikki 49.0%, gold green.

**The inherent ceiling (documented, not fixable by rule).** The residual is dominated by three abjad/dialect
classes, all measured:
- **و glide/vowel ambiguity (~117)** — و is /o/, /u/ or the glide /w/, and as a glide it carries UNWRITTEN short
  vowels (the verbal infinitive -ول = /awəl/: استول→əstawəl, we read و→o → əstol). Which و is a glide is
  partly MORPHOLOGICAL/lexical, not skeleton-derivable — the same abjad gap as short-vowel restoration (a targeted
  -ول restoration is possible but belongs in the restoration subsystem, and risks non-verb ول words).
- **multi-dialect ښ/ږ (~129)** — the referee spans dialects: ښ = ʂ (Kandahari, ours) ~ x (North-East) ~ ç
  (Central); ږ = ʐ ~ ɡ ~ ʝ. We fold ʂ/ç→ʃ and ʐ→ʒ, but the NE x/ɡ CANNOT be folded without merging خ (x) / ګ (ɡ).
- **short-vowel presence / epenthesis position (~102)** — unwritten and unrecoverable from the skeleton (initial
  clusters سپی→spe vs the epenthetic سپي→səpi; زلیخا→zʊlaixa).
- plus ~65 single-letter LETTER-NAME referee entries (ش→ʃin, ږ→ʐe) — referee artifacts, not word phonemisations.

STATUS stays 🟡: the consonant + written-vowel skeleton is correct (gold), but the folded % is inherently capped
by the abjad's omitted short vowels + the multi-dialect referee — not an engine defect. Suite green; typecheck clean.
