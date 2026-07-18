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

## Phase 2 — 2026-07-18 — cross-script GOLD restoration (42.7% → 48.8%)

Follow-up on the "42.7% is low for all that machinery" observation. Diagnosis: the machinery existed but the WORKING
lever was never built for Punjabi. The neural rider diacritizer (`riderDiacritizer.onnx`, multilingual, covers pa)
runs only on the ASYNC path (`riderNeural.ts`) — the sync eval uses the lexicon path — and its pa silver was mined
short-vowel-blind (+4.5 only). The cross-script gold that DOES work was built with REAL parallel spellings only for
Urdu (`build_hindi_urdu.ts`, Hindi/Devanagari↔Shahmukhi, 8593 pairs → ur 56.8%); Punjabi had only a SYNTHETIC
Gurmukhi→Shahmukhi transliteration (`crossscript_pa.ts`) which, per its own header, "sank." So pa/pnb shipped just
158 lexicon entries + default-ə → 42.7%.

**The fix (cheap, GOLD, no BiLSTM):** port the Hindi→Urdu real-parallel method to Punjabi. kaikki Punjabi records
**4099 real dual-script pairs** (a Gurmukhi headword carries its actual Shahmukhi spelling, tagged `Shahmukhi`).
`build_gurmukhi_shahmukhi.ts`: take the real Shahmukhi spelling as the key, the GOLD IPA from our Gurmukhi g2p as the
value (Gurmukhi is a full abugida — it writes the short vowels, the majhūl و/ی, AND ن vs retroflex ݨ). No IPA
harmonization (both scripts feed the same engine). A consonant-skeleton GATE (retroflex-folded, so the ن/ɳ pairs we
WANT pass while real mispairs fail) drops 768 → **2637 gold pairs**, shipped as `src/languages/punjabi/crossscript.tsv`
and looked up with PRECEDENCE in `phonemizeWord` (before the harakat layer). The direct word→IPA form (the arz
`egyptianLexicon` pattern) is used, not harakat-inversion, because harakat cannot change ن→ݨ (a consonant).

**Result: 48.8% vs the wikipron pan_arab referee (+6.1pp).** Concrete fixes: کتاب kət̪aːb→**kɪt̪aːb** (short vowel),
سورج soːɾəd͡ʒ→**suːɾəd͡ʒ** (majhūl و oː→uː), and the ن/ɳ words resolve. The Gurmukhi primary (73.6%) is unchanged —
cross-script keys are Perso-Arabic, so Gurmukhi input never matches. One test updated: پنجابی is now the richer
Gurmukhi-sourced pˈə̃ɲd͡ʒaːbiː (with the nasal ə̃ the abjad drops) — asserted via `toContain("ɲd͡ʒ")`.

**Honesty note:** kaikki-Gurmukhi and the wikipron-Shahmukhi referee are both Wiktionary, so part of +6.1pp is
same-tradition. But the vowels come from an independent ORTHOGRAPHY (the Gurmukhi abugida), it is GOLD (real spellings,
not a guess), and it is the exact method already shipped for Urdu. Truly-independent scale = Gurmukhi Wikipedia
(beyond kaikki) + Grierson LSI *Lahnda of Shahpur*. The mechanism ports directly to sd (Sindhi↔Devanagari) and any
abjad with a voweled sister script.
