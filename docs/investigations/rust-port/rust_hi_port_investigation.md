# Rust port: Hindi (hi)

The Hindi engine (`src/languages/hindi/`) plus the core modules it needs that were not yet ported:
`core/abugida.ts`, `phonology.ts`, `postposedSign.ts`, `schwa.ts` and `weightStress.ts`. The other Indic
languages reuse all five, so they are ported in full, not only the paths Hindi takes.

## Run 0 — 2026-10-09 15:44 (import closure)

**Question.** What does `createHindi` reach that `rust-kokoro-core` has not ported?

**Command.** `grep -n "^import" src/languages/hindi/*.ts src/core/{abugida,phonology,postposedSign,schwa,weightStress}.ts`,
then a read of each Rust core module the imports name.

**Raw finding.** Already ported: `loadManifest`, `numbers` (indic composer, `renderNumber`, `spellDigits`),
`clauses` (`assembleClauses`), `provenance` (`rewrite`), `unicode` (`DEVANAGARI_WORD`, `DEVANAGARI_DIGITS`,
`IPA_VOWELS`), `jsonc`, `dataPath`, `dataSource`. NOT ported: the five core modules above, plus
`makeSymbolNormalizer` (normalizeSymbols.ts, about 740 lines; `normalize_symbols.rs` is marked PARTIAL).

**Implication.** The coordinator assigned `makeSymbolNormalizer` (and `core/own.rs`) to the es agent. Until
that commit is cherry-picked, Hindi's symbol tier is a marked identity stub, and golden rows carrying
`%`, a currency sign, a unit, `×`/`x` between digits or a superscript are expected to differ.

## Run 1 — 2026-10-09 15:50 (first golden gate, symbol tier stubbed)

**Question.** With the five core modules and hi/* ported, how far is the golden?

**Command.** `cd rust && cargo run --release -p parity -- hi`

**Raw finding.** `hi: 198/200 identical, 2 differ`. Both rows are the same sentence (`… अतिरिक्त AUD $45 मिलियन …`):
TS reads `ˈɔːd pɛː̃n̪t̪aːlˈiːs ɖˈɔːləɾ mˈɪlɪjən`, Rust drops `ɖˈɔːləɾ`, the dollar word.

**Implication.** Exactly the stubbed `makeSymbolNormalizer` (currency arm). Nothing else in the golden moved.

## Run 2 — 2026-10-09 15:53 (per-module differentials)

**Question.** Do normalize, the word level and each new core module match the TS, call for call?

**Command.** `npx tsx rust/tools/fn-diff/dump.mts {hi-normalize,hi-word,abugida-core} > .probe/hi/<name>.jsonl`, then
`./target/release/fn-diff <name> ../.probe/hi/<name>.jsonl`.
- `hi-normalize`: `makeHindiNormalizer(MANIFEST.numbers, MANIFEST)` over golden + FLEURS hi_in (columns 3, 4) +
  `probes/hi.txt`.
- `hi-word`: raw `makeAbugidaG2P`, `wordRules` and `number()` over every Devanagari run in the hi/mr/ne/awa/bho/hne/
  mai/mag goldens + hi FLEURS + probes, every consonant × {∅, virama, anusvara, chandrabindu, visarga, nukta, each
  matra, matra+anusvara, matra+chandrabindu, ZWJ, ZWNJ, avagraha} in three frames, consonant+virama+consonant
  conjuncts, independent vowels + signs; and 3,000+ digit strings (ASCII, Devanagari, grouped, decimal, > 2^53).
- `abugida-core`: `deleteMedialSchwa` (ə and ɔ), `applyWeightStress`, `tokenizeIpa`, `heavyFinalCoda` over g2p
  outputs and every hi/mr/bn/gu/ne golden IPA line and word; `postposedSign` over every hi text with four signs
  (including the escaped `\\+` and a `$&` in the words).

**Raw finding.** `hi-normalize: 3582 identical, 0 DIFFER` (golden 132, fleurs 3306, probe 144);
`hi-word: 43098 identical, 0 DIFFER`; `abugida-core: 85738 identical, 0 DIFFER`. All clean on the first run.

**Implication.** A clean first run needs a check that the harness can see a difference: Run 3.

## Run 3 — 2026-10-09 15:55 (mutation check, and per-arm coverage)

**Question 1.** Does the `hi-normalize` replay detect a real divergence?

**Command.** Temporarily changed the fraction arm (`आधा` → `आधी`, and 1/4 → 1/5), rebuilt, replayed, reverted.

**Raw finding.** `hi-normalize: 3582 identical, 4 DIFFER` (fleurs 2, probe 2); after revert `3586 identical, 0`.

**Question 2.** Which normalize arms does each source actually exercise? (`.probe/hi/arms.mts` counts the texts each
arm's pattern matches.)

**Raw finding (golden / fleurs / probe).** era ई.स.पू 0/0/1, ई.पू 0/4/1; ordinal 0/51/9; suppletive 0/0/7;
abbreviation 0/14/7; Devanagari unit 2/36/8; coordinates 0/0/1; ℃ 0/0/1; ℉ 0/0/1; °C 0/2/3; °F 0/0/1; bare ° 0/2/9;
time 3/22/5; plus glued 0/0/1, plus open 0/4/3; minus open 0/0/4, minus degree 0/0/2, minus decimal 0/0/**0**;
`<` 0/0/2, `>` 0/0/1, `=` 0/0/2, `×` 0/0/1, `÷` 0/0/1, `±` 0/0/2, `&` Latin 0/0/2, `&` 0/0/4; fraction 0/2/7.
Tokenizer: Latin 7/140/20, number 38/647/99, grouped 4/55/6, decimal 3/33/9, native digit 0/0/6, `%`/`₹` 1/10/3,
danda 4/602/2, decomposed nukta 62/1707/4, avagraha 0/0/1, ZWJ/ZWNJ 0/4/2, chandrabindu 1/351/9, visarga 0/24/2, ज्ञ 5/128/1.

**Implication.** The minus-before-a-decimal arm was reached by nothing: my probes wrote it with Devanagari digits
(`-२.८८`), which `\d` does not match on the raw text (the registry folds native digits before normalize, but this
differential calls the normalizer directly). Added four ASCII-digit lines. After that: minus decimal 0/0/2, and
`hi-normalize: 3586 identical, 0 DIFFER`. Most sign arms are probe-only: FLEURS hi_in never writes them.

## Run 4 — 2026-10-09 15:56 (end to end: sync, best, and Devanagari inside English)

**Command.** `LANGS=hi npx tsx rust/tools/fn-diff/dump.mts phonemize-sync` (and `phonemize-best`), replayed with
`fn-diff phonemize-sync|phonemize-best`; `dump.mts hi-in-en` (`probes/hi-in-en.txt` through `en` and `en-GB`, with
`BEST=1` for the async path), replayed with the same two arms.

**Raw finding.** `phonemize-sync: 3571 identical, 11 DIFFER`; `phonemize-best: 3571 identical, 11 DIFFER`. Every one
of the 11 carries a symbol-tier trigger: `$` ×3, `£` ×2, `¥` ×6 (some rows several), `₹` ×1, `5mm` ×2.
`hi-in-en`: 14 identical, 0 DIFFER on both paths, so `phonemize("I said नमस्ते to them", "en")` reads
`aᶦ sˈɛd nəmˈəst̪eː tʰuː ðˈɛm` in both engines, through the script reader to `hi`.

**Implication.** Port-pending on `makeSymbolNormalizer` only. Re-run all of this after the cherry-pick.

## Run 5 — 2026-10-09 15:57 (TS readings worth reporting)

- **The ordinal arm composes floats above 2^53.** `number()` refuses (`isSafeInteger`) and spells the digits, but
  step 2 of normalize.ts passes `Number(digits)` straight to `indicNumberWords`: `9007199254740993वाँ` reads
  "…बानवे-वाँ" (…992, a quantity the text did not write), and a run of 309+ digits is `Infinity`, whose recursion
  overflows the stack: `phonemize("1"×400 + "वाँ", "hi")` throws `RangeError: Maximum call stack size exceeded`.
  Rust reproduces the float composition (a local crore-arm replica in `normalize.rs`) and panics on `Infinity`.
  The 309-digit case is not in the probe list, because the TS dump would throw.
- **`ordinalSuffixes`'s contract contradicts the code.** The `HindiDef` doc and the step-2 comment say a family
  member that declares no suffixes "gets no ordinal rule rather than Hindi's", but `makeHindiNormalizer` does
  `own?.ordinalSuffixes ?? DEFAULT_SUFFIXES`, so it gets Hindi's. That is the default normalizer's case for
  rangpuri, awadhi, bhojpuri, chhattisgarhi and others (only magahi declares the block). The file header says the
  fallback is deliberate, so the docstrings are what is wrong.
- **`irregularOrdinals` is required in `HindiDef` but absent from 8 of the 9 sibling manifests** (only gujarati has
  it). `loadManifest`'s cast hides this, and the `??` falls back to Hindi's. In Rust it is `Option`, and every
  family manifest is tested to load through `HindiDef`.
- Object.prototype reachability: every plain-object lookup indexes with a single character, a matched own key or a
  numeric string, so none can reach `Object.prototype`. Nothing to reproduce.

## Run 6 — 2026-10-09 16:00 (provenance seam)

**Question.** Is every `rewrite` in the Hindi path on the pipeline string, and would the check notice if one were not?

**Command.** `npx tsx tools/provenance-poison.mts hi` (TS); the Rust test `hindi_rewrites_never_poison_the_mapping`
(`phonemize_trace` over probes/hi.txt + the hi golden, counting `on_poison` hits). Guard proof: changed step 7c's
`=` rewrite to a bare `JsRegex::replace`, ran the test, reverted.

**Raw finding.** TS: `distinct poison sites: 0`. Rust: 0 hits over 300+ lines; with the reverted site, `left: 3,
right: 0` (FAILED); green again after restoring it.

**Implication.** The seam matches the TS, and the test detects a desync.

## Run 7 — 2026-10-09 16:03 (after cherry-picking makeSymbolNormalizer, 9aceb875)

**Question.** With the real symbol tier wired in (the stub dropped), is everything byte-identical?

**Command.** `git cherry-pick 9aceb875` (dump.mts conflicted only by adjacency; both sides kept). `HindiDef.symbolTier`
is now the core `SymbolData`, and `SYMBOLS` is built from Hindi's manifest with the six fields the TS passes. Added
twelve symbol-tier lines to probes/hi.txt (units with powers and rates, bare exponents, every currency, `US$`, `x`/`×`,
`%`/`٪`), regenerated every dump, replayed.

**Raw finding.**
- `cargo run --release -p parity -- en en-GB hi`: `en 200/200`, `en-GB 200/200`, `hi: 200/200 identical, 0 differ`.
- `phonemize-sync: 3597 identical, 0 DIFFER`; `phonemize-best: 3597 identical, 0 DIFFER` (golden + FLEURS hi_in
  columns 3 and 4 + 159 probe lines).
- `hi-normalize: 3597 identical, 0 DIFFER` (golden 132, fleurs 3306, probe 159); `hi-word: 43098 identical, 0`;
  `abugida-core: 85798 identical, 0`; `hi-in-en` (en, en-GB): 14 identical, 0 on both paths.
- `cargo test --workspace --release`: all green; `cargo build` and `cargo build --release`: 0 warnings.

**Implication.** Hindi is done. No row is port-pending: the only foreign reader Hindi calls is `en`, which is ported.

## Run 8 — 2026-10-09 17:34 (review round, on main c64801a5)

**Question.** After rebasing onto main (#1467 ja + the symbol tier, #1468 cross-cutting fixes) and applying the
review, is every gate still byte-identical?

**What changed.**
- Rebased onto `origin/main`; dropped the cherry-picked symbol commit (main carries the reviewed version). The
  shared lists conflicted with ja and were resolved keeping both sides. ⚠ git had factored a shared closing `},`
  out of the dump.mts hunk, which left `symbols()` unterminated (`dump.mts` failed to parse). Restored it, then
  counted the arms: dump.mts has 27 entries (23 on main + 4) and main.rs has 27 (24 + 3).
- `OnceLock<Result<…>>` became `core::data_source::load_once` (manifest, phonology, and the new once-built `SYMBOLS`).
- New `PhonemizeError::Input`: the TS throws on this input. A 309+-digit ordinal now returns
  `Err(Input("RangeError: …"))` instead of panicking. `TextFn` (normalize and symbol overrides) returns `Result`.
- `number()` reads `units` with `.get` and returns `Err(Data)` when the table is short.
- The `std::ptr::eq` own-tier check became an explicit `Overrides::symbol_tier_is_hindis`, set by `create_hindi`.
  The fn-diff `hi-word` replay at first panicked on the guard (it built Hindi with `Overrides::default()`), which
  shows the flag is live. It now sets the flag, as `makeNativeHindi(MANIFEST)` means.
- Core helpers in place of local copies: `is_safe_integer`/`MAX_SAFE_INTEGER`, `js_number_to_string` for the
  `IRREGULAR_L[n]` key, and `provenance::escape` in `alt()`.
- `schwa.rs`: the per-unit `/[̀-ͯ]/u` regex became `(0x0300..=0x036F).contains`.

**Command.** All dumps regenerated from main's TS, then: `parity -- hi en en-GB ja`; `fn-diff` for `phonemize-sync`,
`phonemize-best`, `hi-normalize`, `hi-word`, `abugida-core` and `hi-in-en` (sync and best); `cargo test --workspace`;
`cargo build` debug and release. Guard proof for the schwa change: narrowed the range to `0x0300..=0x0302`, replayed
`abugida-core`, then restored it.

**Raw finding.** parity: `hi 200/200`, `en 200/200`, `en-GB 200/200`, `ja 200/200`. `phonemize-sync 3597/0`,
`phonemize-best 3597/0`, `hi-normalize 3597/0` (golden 132, fleurs 3306, probe 159), `hi-word 43098/0`,
`abugida-core 85798/0`, `hi-in-en 14/0` on both paths. With the narrowed range: `abugida-core: 85288 identical,
510 DIFFER`; restored, 0. Tests: 53 + 1 passed. Warnings: 0 and 0.

**Implication.** Done. The schwa check is load-bearing and proven, and the panic paths are gone.

## Run 9 — 2026-10-09 17:42 (final rebase onto main 2f7e3628)

**Question.** After one rebase onto main with ja, it, es, pt and pt-BR merged, is every list whole and every gate
still byte-identical?

**Command.** `git rebase origin/main`. Conflicts arose only in the shared lists (`registry.rs`, `core/mod.rs`,
`languages/mod.rs`, fn-diff `dump.mts` and `main.rs`), resolved keeping both sides. Then: `parity -- en en-GB ja it es
pt pt-BR hi`, every hi dump regenerated and replayed, `cargo test --workspace`, `cargo build` debug and release.

**Raw finding.** Entry counts: dump.mts 33 (main 29 + 4), main.rs replay arms 33 (main 30 + 3), and `core/mod.rs` and
`languages/mod.rs` hold main's modules plus hi's. `LANGUAGES` = en, en-GB, ja, it, es, pt, pt-BR, hi. `build` and
`roman_policy` arms are intact, and `PhonemizeError::Input` is kept. parity: all eight at 200/200. `phonemize-sync
3597/0`, `phonemize-best 3597/0`, `hi-normalize 3597/0`, `hi-word 43098/0`, `abugida-core 85798/0`, `hi-in-en 14/0`
on both paths. Tests: 60 + 1 passed. Warnings: 0 and 0.

**Implication.** Ready to merge.
