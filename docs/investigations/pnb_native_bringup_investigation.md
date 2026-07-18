# Western Punjabi / Lahnda (pnb) — revisit + registration

pnb (Western Panjabi / Lahnda, ~80M, Pakistan, **Shahmukhi** / Perso-Arabic script) vs the already-done `pa`
(Eastern Punjabi, Gurmukhi). The prompt's hypothesis — "≈parent; may just need Shahmukhi input; we already have
Shahmukhi input, so this might be just mapping the language code" — is **correct**, and the revisit confirms both
the alias and the maturity ceiling.

## What already existed (so pnb is a code alias, not a new engine)

`src/languages/punjabi/punjabi.ts` **auto-detects the script per word**: `SHAHMUKHI_WORD.test(w) ? scanShahmukhi(w)
: g2p(gurmukhi)`. Both feed the SAME shared Punjabi post-processing — tonogenesis (the voiced-aspirate → tone
crux), addak/shadda gemination → length, inherent-schwa deletion, homorganic nasal assimilation, weight stress. The
Shahmukhi front-end (`shahmukhi.ts` + `shahmukhi.jsonc`) is complete: the Punjabi-specific retroflex letters ݨ→[ɳ]
and ࣇ→[ɭ], do-chashmi ھ aspiration → the breathy tone markers, majhūl long vowels و/ی, harakat when present. It
was built and validated as `pa`'s Shahmukhi path (wikipron pan_arab, a `pa` secondary referee).

So the only change is **registering `pnb` → `createPunjabi(...)`** (registry.ts). `phonemize(text,"pnb") ==
phonemize(text,"pa")` for the same input — verified: لہور پاکستان دا وڈا شہر اے → `ləɦoːɾ paːkəst̪aːn d̪aː ʋəɖaː
ʃəɦɾ eː` on both. (This is standard/Majhi-type Western Punjabi; Saraiki `skr`, with its implosives ɓ ɗ ʄ ɠ, is a
separate variety and NOT this code.)

## Maturity: abjad-capped, exactly like Urdu

The Shahmukhi path scores **42.7%** vs the wikipron pan_arab (Shahmukhi, human, 1360 words) referee — far below the
Gurmukhi 73.6%, and in the same tier as Urdu (ur, 56.8%). Reading the residual, the gap is **abjad-inherent, not a
scanner bug**, and three ambiguities COMPOUND (which is why stripping short vowels alone doesn't recover it —
measured: a naïve short-vowel strip gives 14.6%, lower, because the long-vowel/consonant ambiguities then dominate):

1. **Unwritten short vowels** — the abjad omits them, so a default [ə] stands in (ədər vs referee ʊdər, k vs kʊ).
2. **Majhūl long-vowel ambiguity** — و is [oː]~[uː] and ی is [iː]~[eː], one letter each, unrecoverable from the
   skeleton.
3. **ن spells both /n/ and retroflex /ɳ/** — Shahmukhi writes the Punjabi -ɳaː verbal infinitive with plain ن, so
   آنا→[aːna] where the referee (human) knows [aːɳaː] (ana≠aɳa, akʰna≠akʰɳa, tʃʰəɖna≠tʃʰəɖəɳa recurred in the
   residual). Not recoverable from the letter — a lexical/grammatical fact, like the short vowels.

The consonant + tone BACKBONE is correct where the abjad is unambiguous: لہور→ləɦoːɾ, پنجابی→pəɲd͡ʒaːbiː (with the
homorganic ɲ), گھر→kə˨˩ɾ (tonogenesis گھ→k + low tone), دس→d̪əs, پانی→paːniː.

## Improvement levers (identified, NOT yet pursued)

- **Expand the Shahmukhi short-vowel restoration lexicon** (harakat lexicon) — the ur/sd/arz pattern; the shipped
  path already restores harakat for the covered words, and more coverage directly lifts the common-word core.
- **Independent triangulation** — Grierson's *Linguistic Survey of India* has **Lahnda of Shahpur** (`lexibank/lsi`,
  CC-BY, 193 words, IPA with short vowels), an independent non-Wiktionary tradition. The exact sd method (concept →
  Shahmukhi spelling → compare our output vs Grierson's short vowels) would give pnb its own independent referee and
  quantify the true backbone agreement — a real maturity upgrade, deferred pending a decision to invest.

## Status: 🟡 — registered; abjad-capped, same as ur

The engine is correct and complete for Western Punjabi; the ceiling is the Shahmukhi abjad wall, not the phonology.
Improvement is a data (short-vowel-restoration) problem, not an engine problem.
