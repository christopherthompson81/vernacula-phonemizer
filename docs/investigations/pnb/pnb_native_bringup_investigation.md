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

## Phase 3 — 2026-07-18 — Gurmukhi Wikipedia transliteration scaling: TESTED NEGATIVE

Attempted to scale the cross-script beyond kaikki's real pairs using Gurmukhi (Punjabi) Wikipedia — the largest
voweled Gurmukhi corpus (95 MB dump → **149,938 words** at freq≥3). Since Wikipedia gives only Gurmukhi, scaling
requires TRANSLITERATING Gurmukhi → a canonical Shahmukhi key (the value stays the gold Gurmukhi-g2p IPA).

**Transliterator fidelity, first measured, then improved:** naïve Gurmukhi→Shahmukhi transliteration exact-matched
the real Shahmukhi spelling only **52.7%** of the time. The misses were SYSTEMATIC positional spelling rules, and
fixing three lifted it to **76.7%**: (1) nasalization ੰ/ਂ → full ن when a consonant follows (homorganic, پنجابی),
ں only word-finally; (2) the eː/ɛ matra ੇ/ੈ → ی medially (سیوا), ے only word-finally; (3) independent ਆ → plain ا
mid-word (دنیا, not دنیآ). The residual 23% are ETYMOLOGICAL loan letters Gurmukhi can't distinguish (ਹ→ح/ہ,
ਤ→ت/ط, ਸ→س/ص, ਜ਼→ز/ذ/ض/ظ) — inherently unrecoverable, and already covered by kaikki's real pairs.

**Result: net NEGATIVE on the referee.** Adding 1971 transliterated+gated Wikipedia pairs moved the pan_arab
Shahmukhi referee **49.9% → 49.1% (−0.8pp)**. Even at 76.7% fidelity, the wrong 23% plus SKELETON COLLISIONS (a
correct synthetic key can equal a *different* referee word's consonant skeleton — inherent abjad homography) apply a
wrong gold IPA and net-harm. This empirically CONFIRMS the codebase's prior "the synthetic transliteration sank the
Punjabi cross-script" (`crossscript_pa.ts` header). **Reverted — crossscript.tsv stays at the 2637 real kaikki pairs
(49.9%).**

**Conclusion:** transliteration cannot scale the cross-script cleanly; the reliable ceiling is REAL dual-script
pairs. To scale further would need MORE real (Gurmukhi, Shahmukhi) spelling pairs — e.g. Wikipedia interlanguage
links between pa.wikipedia (Gurmukhi) and pnb.wikipedia (Shahmukhi) article titles, or Wikidata lexemes — not
transliteration. The transliterator FIDELITY fix (52.7→76.7%) is real but unshipped (its only consumer was the sunk
scaling). Deferred to a real-pairs data hunt if pnb is prioritized further.

## Phase 4 — 2026-07-18 — real-pairs route (Wikidata/interwiki) + a USABILITY-FLAG principle

Chased REAL dual-script pairs beyond kaikki (the transliteration route having sunk). Findings:

- **Punjabi Transliteration Corpus (PTC, SLPG/HuggingFace, 6.3M parallel sentences)** — REJECTED: the HF dataset repo
  is EMPTY and carries NO license (the model repo too). Fails the permissive-data policy; can't verify the Shahmukhi
  side is real vs machine-transliterated. Do not use.
- **Wikipedia pnb↔pa interlanguage links** (both CC-BY-SA) — extracted 16,990 pnb↔pa title links → 2,973 single-word
  script-clean pairs → 1,406 after phonemize + consonant-skeleton gate + (kaikki wins). But they are almost all
  **PROPER NOUNS / entities** (October, Akbar, Accra, place names). Measured on the general-vocab pan_arab referee:
  only 21 overlap, and net **−1** (0 fixed, 1 broken) — at EVERY length floor (0/3/4/5). So they are referee-neutral
  (they don't cover common vocabulary) and carry a small collision risk. NOT shipped to the referee-scored path.

**The usability-FLAG principle (from the user, generalized).** Both scaling failures (transliteration, interwiki)
share one root cause: **skeleton COLLISION** — an entry's Shahmukhi spelling equals a DIFFERENT word's spelling
(homograph), so exact-word lookup applies the wrong gold IPA. This is worst for (a) short entries (many words share a
short consonant skeleton) and (b) proper nouns (spelled like common words). The transliteration case ALSO added
fidelity errors. Mitigation, for any future mined/derived cross-script lexicon:
  1. a LENGTH FLOOR (drop ≤2-3-letter keys — highest collision density), and
  2. a PROVENANCE/USABILITY FLAG per entry (e.g. `gold-general` [kaikki, safe as default] vs `gold-propernoun`
     [interwiki, exact-entity lookup only, NOT a default for an ambiguous homograph] vs `derived-lowconf`), so a
     consumer can choose which tiers to trust for exact-word vs partial/compound matching.
The current shipped `crossscript.tsv` is exact-word-only and general-vocab (kaikki), so it needs no flag today; the
flag matters the moment proper-noun or transliterated tiers are added. Recorded as the design rule.

**Conclusion for pnb.** The permissive GENERAL-VOCABULARY real-pairs ceiling is kaikki (2637 shipped, 49.9% + the
retroflex-infinitive rule). PTC is license-blocked; interwiki is proper-noun-only (referee-neutral). Further gains
need either a permissive general-vocab dual-script corpus (none found) or accepting proper-noun coverage as a
separate FLAGGED tier for TTS running text (product value, not a referee-mover).

## Phase 5 — 2026-07-18 — residual rounds: rule-tractability EXHAUSTED at 52.6%

Picked away at the Shahmukhi residual with per-class net-effect tests (fixed−broke, both referees, Shahmukhi-gated
where the abjad is ambiguous but Gurmukhi is authoritative). Shipped the tractable classes:
- **retroflex infinitive -ਣਾ [ɳaː]**, rhotic-conditioned: word-final naː→ɳaː EXCEPT after /ɾ ɽ/ (کرنا kəɾnaː,
  مارنا maːrnaː stay dental) — a real morphophonemic split Gurmukhi spells (ਣ/ਨ); Shahmukhi-only. +24.
- **no phonemic /ʔ/** (ع/ء silent/hiatus, not glottal): +6. **no aspirated sonorants** (نھ/لھ/مھ → n/l/m + /h/,
  not nʱ/lʱ/mʱ): +4. Both no-ops for Gurmukhi.
→ 42.7 → 48.8 (cross-script) → 49.9 → 50.9 → **52.6%**.

**Then hit the lexical wall.** The remaining residual is abjad-inherent and NOT cleanly rule-tractable:
- word-initial short-vowel QUALITY (ادر ə vs ʊ, اباسی ʊ) — unpredictable from the skeleton;
- loanword o/e + epenthesis (اعتراض etɪraz, اقتصادی ɪqətɪsadi) — lexical;
- etymological retroflex ɳ in NON-infinitive words (انکھ→əɳəkʰ, انوکھا→əɳokʰa) — lexical, not positional (an
  intervocalic n→ɳ rule was +7/−13 earlier, i.e. net-marginal and dirty);
- schwa-insertion INCONSISTENCY (پنج→pənəd͡ʒ unassimilated vs پنجابی→pəɲd͡ʒaːbiː) that blocks nasal assimilation —
  a labial-nasal rule tested +0/+1 Shahmukhi but −3 GURMUKHI, so the default-schwa machinery can't be retuned
  without regressing the authoritative Gurmukhi path.

**Conclusion:** 52.6% is the rule-tractable ceiling for the Shahmukhi abjad. Further gains require COVERAGE (real
cross-script pairs), which is capped at kaikki (permissive general-vocab). The consonant + tone backbone and the
recoverable morphophonemics (infinitive, tonogenesis, assimilation-where-consistent) are done.
