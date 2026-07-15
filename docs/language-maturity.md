# Language maturity

A per-language reliability reference: **is a language's output trustworthy, and what work (if any) is outstanding?**
This exists because the single most visible number — the referee-corroboration % in
`tools/referee-eval/referee-eval.test.ts` — is a **confounded** signal and a poor proxy for maturity on its own.

## How to read this (why the referee % ≠ maturity)

The referee floors measure folded agreement with an **independent** transcription source (wikipron / epitran /
kaikki). That number is deflated by two things that have nothing to do with our engine:

- **Referee quality.** wikipron/kaikki dumps are noisy: proper nouns, letter-name rows (`A → eɪ`), acronyms,
  taxonomic Latin, and cross-dialect variants (rhotic vs non-rhotic, N-vs-S Welsh, 3-dialect Irish). English
  measures 36% almost entirely for this reason, not because the engine is 64% wrong.
- **Fold ceiling.** We deliberately fold away layers where we are *richer* than the broad referee (length, tone,
  offglide notation) — so real distinctions we get right, and real ones we get *wrong*, can both be invisible to
  the number (Welsh's n/r/l length errors are folded away, for instance).

So a low number can mean a noisy referee, a fold ceiling, **or** genuine work — you tell them apart by the
**residual composition**, not the headline:

- A **systematic segment class** in the residual (e.g. Welsh's `ɨ ≠ i`) → real, fixable work.
- **Diffuse** proper-noun / notation / dialect noise → referee artifact, not a backlog.

Maturity here is therefore judged on **two axes**, read together with the per-language unit test (the committed
correctness anchor) and the bring-up investigation doc:

1. **Core reliability** — is the segmental g2p correct for the input it supports?
2. **Scope / completeness** — are whole subsystems (text front-end, pitch/tone, diacritization, number
   compositor) deferred, narrowing the input it's reliable *for*?

## Verdict legend

| | Meaning |
|---|---|
| ✅ **Reliable** | Trust the output. Deferrals are minor/notation, or the low referee % is just referee noise / a fold ceiling. |
| 🟡 **Reliable + lexical tail** | Correct for the bulk; a documented exception/lexicon layer would close a small, *specific* class (open/close mid vowels, loanwords, stress on learned words). Safe, with a known small error rate on those classes. |
| 🟠 **Scope-limited** | Core g2p correct, but a whole subsystem is deferred — reliable only for a *narrower* input (diacritized Arabic; pinyin, not raw Hanzi; segmental, without pitch/tone). |
| 🔵 **In active development** | Not yet at a stable plateau; the bring-up is still adding a core layer. |

## The languages

Sorted by verdict, then by referee corroboration. "Referee" = primary measured folded-agreement (floor in
parens); "2nd" = an independent secondary source where one exists (a much better quality signal than a noisy
primary — see fr/pt/de/ru/ha/vi/tr).

| Lang | Referee (floor) | 2nd source | Verdict | Core / outstanding work |
|------|-----------------|-----------|---------|--------------------------|
| **ar** Arabic | 57.4% (.55) | kaikki 62.6% | ✅ | **Referee-limited**, core mature. The 15 MB CPU diacritizer ships in every distribution (never absent), so the full BARE-text pipeline IS the product — tiering it on the model-absent, diacritized-input-only path was hobbling ourselves. Pipeline: neural diacritizer (~2% DER on running text) + g2p (~96% segments on diacritized) + a **skeleton-gated Tashkeela pausal lexicon supplement** (restore.ts) that repairs OOV/isolated words the context-trained BiLSTM under-vowels (يقول→jaquːl). The 50% is **NOT a quality signal** — the wikipron referee is ISOLATED citation-form lemmas (OOD for a context model + full-iʕrab convention vs our correct pausal + isolated-word ambiguity + loan noise), not phonemizer error (docs/ar_referee_investigation.md). Minor deferral: FORMAL-register mid-sentence iʕrab (a register choice needing syntactic case; pausal is complete & natural). **Run 9:** lexicon-PRIMARY (Tashkeela hit overrides the OOD neural for covered words) → +7 on both isolated referees. **Run 11 (PROSE test — the real target):** on 600 gold-diacritized running-text sentences OUR neural pipeline scores **65.7%** vs espeak-ng-portable's authored **51.9%** — we WIN by +13.8, the REVERSE of the isolated-lemma ranking (where espeak's context-free rule base wins 69.8 vs 62.6). The neural's context disambiguation dominates on running text; the isolated referees are adversarial for a context model. So ✅ holds on the target that matters. |
| **ca** Catalan | 81.3% (.76) | — | ✅ | **Referee-limited** (the eval already folds the vowel axis — Central reduction + lexical mids — so 81.3% measures consonants/rhotics/geminates). All the once-noted gaps are DONE: stressed open/close mid lexicon (10413 entries: dona/dóna, os/ós, deu/déu), intervocalic ⟨x⟩ (examen→əɡz), -nts→ns (ponts→pɔns). **53% of the residual is the referee writing generic ⟨r⟩ for our correct coda/cluster TAP [ɾ]** (our tap/trill is verified correct — trill: roig/carro/terra/Enric; tap: cara/borles/tord/prat), + 7% geminate Cː-vs-CC where ours is proper IPA and the referee doubles. Crediting those (ours-correct) → ~92%. Residual thin tail: dm→mm assimilation, learned-⟨ble⟩ gemination (dialectal). |
| **cmn** Mandarin | 84.7% (.80) | CC-CEDICT 97.3% · g2pM 97.7%nat | ✅ | **Referee-limited**, Hanzi front-end BUILT + validated on real-frequency text (phrase+char dicts, polyphones, 一/不 + 3-3 sandhi, numbers/year/decimal, Latin→en). Word-level vs CC-CEDICT (124k, non-pypinyin): **97.3% reading**. Cross-word CONTEXT vs g2pM CPP: **97.7% natural-frequency-weighted** (kHanyuPinlu). The epitran 84.7% is syllable→IPA only; the g2pM *balanced* 87.9% is adversarial — it over-samples non-dominant readings (剌 la4, 应 yìng), same shape as the Arabic isolated-lemma referee (kHanyuPinlu confirms our dominants match natural frequency). Deferral: hard context-ambiguous polyphones (~2.5% on real text) that only a context model closes — minor for TTS. |
| **cs** Czech | 97.0% (.95) | rule-engine OOV 97.7% | ✅ | **Referee-limited** (wikipron partly circular — see below). Referee first swapped epitran→**wikipron ces (human)**: 69.9→94.8% (epitran was buggy — p→b before liquids před→"bret", no ě-palatalization; now the noted secondary). Then the **loanword de-palatalization** class (di/ti/ni stay hard in loans: stadion→stadɪjon, studie, technik — natives correctly palatalize, tisíc→cɪsiːts) was closed by a **kaikki/Wiktionary loanword lexicon** (403 entries, converter 100%-validated, narrowed to de-palatalization+length so it never overrides correct native voicing/gemination) → **97.0%**. CIRCULARITY (accepted, Thai-style): kaikki and wikipron are both Wiktionary, so the 404 dict-covered words match trivially — the honest signal is **rule-engine OOV 97.7%** (near-ceiling on its own domain). Residual: foreign proper nouns (Chicago→t͡ʃ, Caesar) — a diffuse tail, not a class. |
| **cy** Welsh | 73.5% (.70) | — | 🟡 | Runs 1–5 (dialect-matched North Welsh referee). Session +17: Run-4 diphthong nuclei (final ⟨-au⟩→a, wy→ʊɨ, ei→ei…) + **Run-5 penult vowels stay LAX** (pobol→pɔbɔl — the espeak-tensed [o]/[e] was an oracle artifact, cf. the i→ɨ one; +5.9%) + ⟨gwy⟩/⟨chwy⟩ structural (gwyn→ɡwɨn). Residual: **English/foreign-name anglicization** (Algeria→ald͡ʒiːrja — referee applies English phonology, arguably not our error), ⟨ae⟩ (referee-contested), degemination (nn→n), glide edges — intricate/lexical. |
| **de** German | 78.2% (.78) | wikipron 76.7% | ✅ | **Referee loan/proper-noun-limited** (~85% common-word agreement; residual is ~5–6% English/French loan readings [dessert, beige, Stil], acronyms, proper nouns, + cosmetic syllabic-n̩ notation). 40 runs, all kaikki-derived + 5 lexicons (stress/length/quality/consonant/**er**). Closed the genuine-native classes: reduction, tensing, loanword lax↔tense, long-ä, fricative devoicing, Latinate -ie/-iVC-/-eur/-age/-ium, rhotic consonant-slot, recursive+particle-verb compound seams, geminate devoicing, gestern/un-/mit- prefix traps, ⟨hör⟩-root h. Remaining native tail is documented MINOR exceptions: **her-** (lexically inconsistent even in kaikki: herstellen short vs herkommen long), **in-** (ambiguous prefix), loan **-er** (dessert→eːɐ̯), a few unflagged compound heads (Mühlstein). |
| **en** English | 36.1% (.30) | — | ✅ | **Referee-noise-limited** (proper nouns, GB variants, letter-names). Core is mature; the % is not a quality signal. |
| **es** Spanish | 92.5% (.88) | — | ✅ | Only `-mente` double-stress deferred (minor). |
| **ff** Fula | 71.2% (.62) | — | ✅ | Referee-limited (epitran nj→ɲ vs our prenasal + non-Fula salt). |
| **fr** French | 66.5% (.62) | gold 85.6% | 🟡 | Primary is wikipron-noisy (gold confirms core); Phase 2 = exception lexicon (learned words) + cross-word liaison/elision. |
| **ga** Irish | 44.8% (.40) | — | ✅ | **3-dialect referee, ~34% ceiling.** Runs 1–3 + a referee-gated Connacht lexicon done. |
| **ha** Hausa | 90.3% (.85) | epitran 88.4% | ✅ | Tone + segmental corroborated across two sources. |
| **hi** Hindi | 77.7% (.72) | — | ✅ | Schwa-deletion edge cases only. |
| **kk** Kazakh | 86.2% (.83) | — | ✅ | Residual ~7.8% is stress-only + epitran's own ө/ү merger. |
| **ko** Korean | 58.5% (.52) | — | ✅ | Referee-limited (narrow-transcription allophony: ㄹ ɭ~ɾ, intervocalic voicing). |
| **ja** Japanese | 57.9% (.52) | OpenJTalk (kanji 97.7% · pitch 96.0%) | ✅ | **Referee-limited** (the wikipron primary is toneless/segmental — it can't see the kanji front-end or pitch, so 57.9% is not a quality signal). ALL subsystems built + independently validated vs OpenJTalk (an independent reading/accent engine): kana→IPA **99.7%**, numbers, counter (助数詞) fusion **99.9%**, kanji reading **97.7%** per-char, and **pitch accent 96.0%** nucleus (`tools/ja-pitch-eval.mts`). Pitch is near the inherent ~90-95% ceiling — JA accent is a task where dictionaries themselves disagree (映画 0/1, 期間 1/2), and the residual is contested-accent + verb-stem-fragment artifacts, not systematic error. CAVEAT: OpenJTalk is one of the three voters (kanjium/OpenJTalk/UniDic) behind our merged pitch lexicon, so pitch is a conservative-but-not-fully-independent referee — no larger free Tokyo-accent source exists (kaikki/Wiktionary carries ~3 Tokyo words). ː is the unified long-vowel notation. |
| **pt** Portuguese | 78.0% (.74) | gold 99.4% | 🟡 | Gold shows near-perfect; grapheme `x` (ʃ/z/ks/s) + `l`-coda are the lexical tail. |
| **ru** Russian | 94.8% (.90) | gold 97.7% | ✅ | Loanword hard-C-before-е + genitive г→v are a tiny lexical tail (🟡-adjacent). |
| **si** Sinhala | 93.5% (.90) | — | ✅ | Residual is 1× referee quirks. |
| **sv** Swedish | 55.7% (.52) | wikipron accent 96.6% | ✅ | **Referee-limited** (the 55.7% broad wikipron strips stress/length + has casual/truncated forms — not a quality signal). Full pipeline built: segmental + NST stress + **tonal word accent 1/2** (accent-2 grave, **validated 96.6% vs wikipron ¹/²**, an inherent ~95% task) + lexical o-quality + numbers + **compound prosody**. Compounds use NST's own secondary stress (13178 words, `s<N>`/`L<ords>` → ˌ + boundary-safe vowel length/quality + 2nd-onset softening: storkök→stˈùːrɕˌøːk), sidestepping the net-negative wordlist-splitter path (Run 6/8); +3.1 referee. Residual is OOV compounds (outside the 42k corpus → first-syllable stress) + minor folds (short ɛ→æ before r). |
| **ta** Tamil | 63.0% (.58) | — | ✅ | Referee-limited (ற geminate + diphthong notation). |
| **th** Thai | 84.7% (.82) | rule-engine OOV 82.7% | ✅ | **Referee-limited** (wikipron is now PARTLY CIRCULAR — see below). Full pipeline: syllabifier + computed 5-tone + **word segmentation** (seg-words DAG, 64.8k ICU/PyThaiNLP words — running-text espeak-gold 97.1%) + a **lexical dictionary** covering the Sanskrit/Pali tail (2563 entries: espeak's 1789 + **774 kaikki/Wiktionary** multi-syllable content words the rules mis-derive — วิทยาศาสตร์, ประวัติศาสตร์, ประชาธิปไตย; converter 100%-validated, Run 6). Word-internal kr/pr/tr clusters fixed structurally (Run 5). CIRCULARITY (accepted — kaikki is the authoritative Thai source): kaikki and wikipron are both Wiktionary, so the 874 dict-covered wikipron words match trivially; the 84.7% is NOT independent for those. The honest independent signal is the **rule-engine accuracy on OOV words: 82.7%** — the rules' quality on their own domain. Residual: adversarial isolated-lemma noise + a thin tail of Sanskrit words absent from kaikki (กรมการ — no source). |
| **tr** Turkish | 76.2% (.70) | epitran 79.8% | 🟡 | Morphological segmentation (stem lexicon) + acronym spell-outs deferred. |
| **vi** Vietnamese | 71.0% (.65) | epitran 51.3% | ✅ | Referee-limited (2nd source is *lower*); minor foreign-word switch deferred. |
| **zu** Zulu | 100% (.99) | — | ✅ | Clicks/implosives/ejectives/laterals all corroborated. Done. |

## What "outstanding work" concretely means

- **🟠 scope gaps** — a whole *subsystem* deferred (Mandarin Hanzi front-end, Japanese/Swedish pitch accent, Thai
  compound segmentation) — are now **all built**: no language currently sits at 🟠. The pattern, when one recurs,
  is to feed the engine its supported input and treat the deferred layer as absent (not wrong) until built.
- **🟡 lexical tails** are bounded: a specific, enumerable class (mid-vowel height, loanword C-hardening, learned
  stress) that a small exception lexicon closes. The rule engine is right for everything else. Irish's Run-3
  referee-gated lexicon (`docs/ga_bringup_investigation.md`, `[[vernacula-oracle-lexicon-method]]`) is the
  template for building these when they're worth it.
- **✅** languages have no subsystem gap and no systematic residual class — only notation folds, referee noise, or
  a fold ceiling. The low-numbered ✅s (en, ga, ta, ff, vi, ko) are the ones whose referee is the limiting factor,
  *not* the engine; their real correctness anchor is the hand-authored `test/<lang>.test.ts`.

## Maintaining this doc

Not auto-generated (the verdicts are judgment calls). Refresh a row when a bring-up run lands: re-run
`npx tsx tools/referee-eval/eval.ts <code>` for the measured %, read its **residual classes** (systematic → real
work; diffuse → referee noise), and reconcile against the language's investigation-doc deferred list. The referee
% alone is never the maturity — always pair it with the residual composition and the unit test.
