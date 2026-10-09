# Rust port: English (en, en-GB)

English goes first because Kokoro TTS needs it (#1463). The path covers core (unicode, roman, initialisms,
clauses, provenance, trace, the loaders), english/* and english-gb, plus the neural OOV tagger (its runtime
is a separate investigation: rust_neural_runtime_investigation.md).

## Run 1 — 2026-10-09 (ARPABET → IPA differential)

**Question.** Does `english_arpabet.rs` reproduce `makeArpabetToIpa` over the real dictionary, with the
shipped syllabic and nasal-seam slot tables (english.ts's call) and with none (englishTagger.ts's call)?

**Command.** `npx tsx rust/tools/fn-diff/dump.mts arpabet > .probe/rust/arpabet.jsonl`, then
`cargo run --release -p fn-diff -- arpabet ../.probe/rust/arpabet.jsonl`. The dump covers every `g2p-dict.tsv`
row (135,321 words) plus the first 5,000 again with the bare converter.

**Raw finding.** `arpabet: 140321 identical, 0 DIFFER`.

**Implication.** The converter is done. The slot parser depends on JS `Number()` (`"".split(",")` →
`[""]` → `Number("")` = 0, a valid slot), so `core::js_string::js_number` now ports StringToNumber; its
expectations were checked against Node. `fn-diff` is the per-module differential for every English module
that follows, before the golden gate.

## Run 2 — 2026-10-09 (numbers, spellingVariants, posTagger differentials)

**Question.** Do the three leaf modules match their TS twins?

**Command.** `npx tsx rust/tools/fn-diff/dump.mts {pos,spelling,numbers}`, then `fn-diff` replays.
- `pos`: every whitespace-split golden sentence (en, en-GB, en-IN), 600 rows.
- `spelling`: every g2p-dict word plus the en-GB lexical-set tables and ~25 hand probes, with lexicon
  membership as `known`. 136,293 rows.
- `numbers`: 0..20000, then 10^e, 10^e−1, 10^e+7 and a mixed value for e = 3..36 (past the 10^33
  "say the digits" cap), as cardinal and ordinal. 40,274 rows.

**Raw finding.** `pos: 600 identical`, `spelling: 136293 identical`, `numbers: 40274 identical`, 0 differ
each. The spelling probe is not vacuous: 297 rows found a respelling, the rest correctly found none.

**Implication.** Leaves done. Three decisions recorded in the code:
- the `our` loop's early exit at index ≤ 1 is kept;
- BigInt becomes a canonical digit string (`BigNat`), so the > 33-digit branch stays reachable;
- POS feature duplicates count once, as the TS object's keys do.

## Run 3 — 2026-10-09 (Math.log, and the n-gram G2P)

**Question 1.** Does `f64::ln` (glibc) agree with V8's `Math.log` (fdlibm port)? The n-gram beam ranks
by sums of logs.

**Command.** Node dumps `Math.log` bit patterns for 2M random positive doubles, 2M random count ratios and
every count ratio in `g2p-model.json` (4,149,804 inputs). `fn-diff log` compares them against both
`core::js_math::log` (an fdlibm `e_log.c` port) and `f64::ln`.

**Raw finding.** `fdlibm port 4149804 identical, 0 DIFFER; f64::ln differs on 155865 (5586 of them
n-gram ratios)`.

**Implication.** `Math.log` must be `js_math::log`. `f64::ln` is off in the last bit on 3.8% of inputs,
including 5,586 of the model's own ratios. (Not yet shown at the word level. Do that once the full g2p
dump exists: swap in `f64::ln` and count changed words.)

**Question 2.** Does `english_g2p.rs` match `createEnglishG2p` as `createEnglish()` builds it?

**Command.** `dump.mts g2p` (every accent-lexicon word plus synthetic OOVs: glued pairs, `-ishness`,
`-ings`, doubled vowels, consonant-only strings) and `fn-diff g2p`. The TS dump runs at ~13 ms/word, so
the first 14,000 rows were checked while the rest generates.

**Raw finding, in order.**
- First port: `14000 identical, 0 DIFFER`, but 95 s for 14k words (≈6.8 ms/word in Rust).
- Indexing each context's count list: still 60 s.
- Interning tokens, a 4-slot history, back-pointers for phones: `11840 identical, 2160 DIFFER`. The bug:
  model keys were parsed by splitting on spaces, but a token's chunk can hold spaces (`n:AH0 N`).
- Parsing keys by token shape (every token starts `<letter>:` or is `^`; a load-time assert checks that
  every key parses into exactly `order` tokens): `14000 identical, 0 DIFFER`, 11.6 s with model load
  (~0.8 ms/word).

**Implication.** The G2P is correct on the first 14k, and the full-dump result is pending. `perf` cannot run
in this session: `perf_event_paranoid` is 4, so unprivileged `perf_event_open` fails even outside the
sandbox. The hot path was found by counting allocations instead.

## Run 4 — 2026-10-09 (english.ts on pre-normalized text; markup.ts)

**Question.** Does `english.rs`, the engine minus `normalize.ts`, match `EnglishPhonemizer.text`?
The comparison uses the TS's own `preNormalized` path: TS normalizes, and both engines read the
normalized string.

**Command.** `dump.mts english-pre` (every golden sentence of en/en-GB/en-IN plus every FLEURS en_us
utterance, column 3; 1,977 distinct texts), then `fn-diff english-pre`.

**Raw finding.** `english-pre: 1977 identical, 0 DIFFER` on the first run.

**Also found while porting `core/markup.ts` (a TS defect, not fixed here).** `stripMarkup`'s `NAMED` entity
table is a plain object literal, so `NAMED["constructor"]` is `Object.prototype.constructor`.
`&constructor;` (any case) is replaced by `function Object() { [native code] }`, and
`phonemize("Use &constructor; here.", "en")` reads *jˈuːz fˈʌŋkʃən ˈɑːbd͡ʒɛkt nˈeᶦt̬ɪv kʰˈoᶷd hˈɪɹ .*
The Rust port reproduces it under a PAIRED-FIX PENDING marker (core/markup.rs). The fix belongs in the TS
first: `Object.hasOwn`, or a null-prototype table, after which the C# twin should be checked too.

**Implication.** The English engine body is done, and `normalize.ts` is the remaining sync piece (its port is
running on `rust-en-normalize`). Next: en-GB, the registry's `foldPass` for en, and the public `phonemize`.
