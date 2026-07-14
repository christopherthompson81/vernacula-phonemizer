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
| **ar** Arabic | 45.4% (.40) | — | 🟠 | Core g2p + quantity-stress solid; depends on the **diacritization** subsystem (ONNX diacritizer has short-vowel misses; ADR pending on porting it). Reliable for *diacritized* input. |
| **ca** Catalan | 81.3% (.76) | — | 🟡 | Stressed open/close mids (ɛ/e, ɔ/o) need a lexicon; +intervocalic ⟨x⟩, -nts→ns. |
| **cmn** Mandarin | 84.7% (.80) | — | 🟠 | Syllable-level pinyin→IPA is reliable; deferred: **Hanzi text front-end** (char/phrase dicts, polyphones) + number compositor. Reliable for *pinyin* input, not raw Hanzi. |
| **cs** Czech | 69.9% (.65) | — | 🟡 | Referee itself is epitran-buggy (deflates); loanword-exception lexicon (portable from espeak cs_list) is the real residual. |
| **cy** Welsh | 56.5% (.50) | — | 🟡 | Runs 1–3 done (i-front fixed vs the oracle artifact). Deferred: n/r/l vowel length (`tân`/`tan`), wy-diphthong quality, loan-name switch — minor/lexical, mostly length-folded-away. |
| **de** German | 74.6% (.73) | wikipron 74.1% | 🟡 | Mature core (9 runs, all kaikki-derived: compound splitter + per-position length + full unstressed-vowel QUALITY lexicon covering reduction AND loanword lax→tense). Runs 7/9/10 closed the big levers (independent wikipron 52→67%). Remaining tail is stem-lexicon coverage gaps (compounds whose constituents aren't flagged, e.g. pickel·haube) + fine loanword consonants. Referee still loan/proper-noun deflated. |
| **en** English | 36.1% (.30) | — | ✅ | **Referee-noise-limited** (proper nouns, GB variants, letter-names). Core is mature; the % is not a quality signal. |
| **es** Spanish | 92.5% (.88) | — | ✅ | Only `-mente` double-stress deferred (minor). |
| **ff** Fula | 71.2% (.62) | — | ✅ | Referee-limited (epitran nj→ɲ vs our prenasal + non-Fula salt). |
| **fr** French | 66.5% (.62) | gold 85.6% | 🟡 | Primary is wikipron-noisy (gold confirms core); Phase 2 = exception lexicon (learned words) + cross-word liaison/elision. |
| **ga** Irish | 44.8% (.40) | — | ✅ | **3-dialect referee, ~34% ceiling.** Runs 1–3 + a referee-gated Connacht lexicon done. |
| **ha** Hausa | 90.3% (.85) | epitran 88.4% | ✅ | Tone + segmental corroborated across two sources. |
| **hi** Hindi | 77.7% (.72) | — | ✅ | Schwa-deletion edge cases only. |
| **kk** Kazakh | 86.2% (.83) | — | ✅ | Residual ~7.8% is stress-only + epitran's own ө/ү merger. |
| **ko** Korean | 58.5% (.52) | — | ✅ | Referee-limited (narrow-transcription allophony: ㄹ ɭ~ɾ, intervocalic voicing). |
| **ja** Japanese | 57.9% (.52) | — | 🟠 | Kana→IPA + numbers reliable; **pitch accent** deferred (Phase 2, needs a lexicon). Referee residual is narrow allophony. |
| **pt** Portuguese | 78.0% (.74) | gold 99.4% | 🟡 | Gold shows near-perfect; grapheme `x` (ʃ/z/ks/s) + `l`-coda are the lexical tail. |
| **ru** Russian | 94.8% (.90) | gold 97.7% | ✅ | Loanword hard-C-before-е + genitive г→v are a tiny lexical tail (🟡-adjacent). |
| **si** Sinhala | 93.5% (.90) | — | ✅ | Residual is 1× referee quirks. |
| **sv** Swedish | 52.6% (.48) | — | 🟠 | Segmental + NST stress/accent lexicon done; **pitch accent 1/2** deferred (Phase 2) + lexical o=oː. |
| **ta** Tamil | 63.0% (.58) | — | ✅ | Referee-limited (ற geminate + diphthong notation). |
| **th** Thai | 81.9% (.76) | — | 🟠 | Segmentally strong; residual ~8% is compound words needing the **seg-words segmentation** subsystem + lexical Sanskrit/Pali readings. |
| **tr** Turkish | 76.2% (.70) | epitran 79.8% | 🟡 | Morphological segmentation (stem lexicon) + acronym spell-outs deferred. |
| **vi** Vietnamese | 71.0% (.65) | epitran 51.3% | ✅ | Referee-limited (2nd source is *lower*); minor foreign-word switch deferred. |
| **zu** Zulu | 100% (.99) | — | ✅ | Clicks/implosives/ejectives/laterals all corroborated. Done. |

## What "outstanding work" concretely means

- **🟠 scope gaps** are the substantive items: Mandarin's Hanzi front-end, Japanese/Swedish pitch accent, Arabic's
  diacritization port, Thai's compound segmentation. Each is a *subsystem*, tracked in that language's
  `docs/<code>_*investigation.md`. Until built, feed these engines their supported input (pinyin, diacritized
  Arabic, etc.) and treat the deferred layer as absent, not wrong.
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
