# Rust port: Uzbek (`uz`)

Branch `worktree-agent-af4c70c2a8782f57e`, on top of az, kk, ky. Part of #1463, the Turkic group. Method as in
rust_az_port_investigation.md.

## Run 1 — 2026-10-14 23:10 (the import closure)

**Question.** What does `src/languages/uzbek/` need?

**Command.** Read uzbek.ts, normalize.ts, numbers.ts, romanOrdinals.ts and their imports.

**Raw finding.**
- Core imports: `normalizeSymbols`, `latinPhones`, `hostWord` (`hostWordRun`, `makeNativiser`), `clauses`, `numbers`
  (`renderNumber`, `spellDigits`), `loadManifest`, `ipa` (`IPA_VOWEL`), `initialisms`, `provenance`. All ported.
  No Turkish import, no neural entry; `ROMAN_POLICIES` names `uz: romanUz`; uz is in `VULGAR_FOLD_OPT_OUT`
  (already in the Rust registry).
- Uzbek has NO manifest.ts: uzbek.ts, numbers.ts and romanOrdinals.ts each `loadManifest` the same file. The Rust
  keeps that shape without a fourth module: `UzbekDef` lives in uzbek.rs, numbers.rs has its own `{ numbers }`
  loader, and roman_ordinals.rs reads numbers.rs's (the same data, not a fork).
- ⚠ `turkicNumberWords` composes ANY floored number in `numberToWords` (no safe-integer guard there), so the Rust
  composer is over `f64`, with a `u64` wrapper as core's `NumberComposer` for `renderNumber`.
- ⚠ `phonemizeWord` finds the last vowel's index in `[...x]` (CODE POINTS) and slices `x` with it (CODE UNITS).
  Reproduced as written.
- The apostrophe set (U+02BB ' U+2019 U+2018 ` U+02BC U+2032) appears four times (APOS, NATIVE_CLASS, the
  hostWordRun extra, WORD) in two different orders. Read from the source bytes, written as `\u{…}` escapes.

## Run 2 — 2026-10-14 23:14 (the golden gate)

**Command.** `./target/release/parity uz`, `--sync uz`.

**Raw finding.** `uz: 200/200 identical, 0 differ` both modes, first build. 108 distinct golden texts.

## Run 3 — 2026-10-14 23:16 (differentials)

**Command.** `.probe/turkic/run.sh <worktree> uz uz-normalize uz-g2p uz-numbers uz-roman` (plus phonemize-sync,
phonemize-best, trace, symbols). FLEURS uz_uz columns 3 and 4 (first line checked: a sentence). The initialism
pass and the phonotactic test are module-private, so uz-normalize rebuilds them from normalize.ts's config.

**Raw finding.**
```
uz-normalize: 30159 identical, 0 DIFFER  (probe 63, synthetic 1650, words 16461, plus golden and fleurs)
uz-g2p:       87696 identical, 0 DIFFER
uz-numbers:   58274 identical, 0 DIFFER  (words/ordinal/roman, and the engine's digit reading incl. decimals)
uz-roman:     4016 identical, 0 DIFFER
phonemize-sync: 4016 identical, 0 DIFFER
phonemize-best: 4016 identical, 0 DIFFER
trace:          4016 identical, 0 DIFFER
symbols:        7067 identical, 0 DIFFER  (uzbek 3994, russian 1)
```
**Haystack.** normalize changed 518 of 3,887 FLEURS rows, 20 of 108 golden, 14 of 21 probe, 418 of 550
synthetic; the initialism pass 80 FLEURS rows; the symbol tier 53; the Roman pass 12.

**Is the replay sensitive?** The `ng` + ʻ exception disabled → `uz-g2p: 121 DIFFER`; the regnal floor (n ≥ 2)
lowered to 1 → `uz-normalize: 7 DIFFER`. Both reverted.

## Run 4 — 2026-10-14 23:18 (the TS suite as a Rust test; audits)

**Command.** `node .probe/turkic/pins.mjs test/uzbek.test.ts '<shapes>'`; `re_audit.py`; `table_check.mjs`.

**Raw finding.** 89 pins from 91 sites (2 `ordinalAfter.test` skipped, covered by uz-roman); the test passes, and
FAILS with the `ng` + ʻ exception disabled (`toʻngʻiz` → *toŋʔˈiz*). Regex audit 35/35 verbatim after the escape
rewrite (the NBSP class, again). LETTER_NAME 26/26, WORD_ACRONYMS 6/6 against the TS literals.

## Run 5 — 2026-10-14 23:19 (reading for correctness: TS findings)

**Command.** `npx tsx .probe/uz/findings.mts`. Rust reproduces each; the inputs are in probes/uz.txt.

**Raw finding.**
1. **`numberToWords` composes the rounded double past 2⁵³** (numbers.ts has no safe-integer guard, unlike
   `ordinalWords` and the tokenizer): `12345678901234567890-regbi` reads a number ending …168, and above a
   milliard it stacks *milliard … milliard*. Reached only by the regbi / moliviy exception and the fraction rule.
2. **No scale above milliard**: 10¹² → *mˈiŋ milliˈard* ("thousand billion"); trillion is *trillion* in Uzbek.
3. **A docstring that contradicts its own code** (numbers.ts `ordinalWords`): it gives "190 → bir yuz
   toʻqsoninchi", but the composer drops *bir* before *yuz* (its own stated rule), so `ordinalWords(190)` is *yuz
   toʻqsoninchi*. The code is the documented rule; the example is stale.

**Implication.** Reported in the PR, not fixed. Nothing port-pending.

## Run 6 — 2026-10-14 23:58 (every gate, on the tree rebased onto origin/main 257ac271)

**Command.** `git rebase origin/main` (fi/et/hu/is/fo had merged meanwhile; the conflicts were the registry's
`LANGUAGES`/`build`/`roman_policy` lists and dump.mts's `FLEURS_DIR` and dump table. They were resolved as a union.
dump.mts's block-boundary conflict needed the shared `},` restored, and it was parse-checked with
`npx esbuild rust/tools/fn-diff/dump.mts`). Then `cargo run --release -p parity` (ALL languages),
`cargo test --workspace --release`, `cargo run --release -p regex-diff`, `cargo fmt --check`,
`cargo clippy --workspace --release`, and `.probe/turkic/all.sh` (every Turkic fn-diff dump regenerated from the
TS on this tree and replayed).

**Raw finding.**
- parity: every one of the 62 language lines is identical, except mag 199/200 (its known Arabic row) and tt
  199/200 (its Arabic row, port-pending on `ar`). hil 112/112 and ilo 94/94 are the sizes of their goldens.
- cargo test: 248 + 1 passed, 0 failed.
- regex-diff: 146,326 identical, 0 DIFFER, 0 refused.
- fmt: clean. clippy: the only new warnings are `module_inception` on the six new `mod.rs` files.
- uz: uz-normalize 30,159, uz-g2p 87,696, uz-numbers 58,274, uz-roman 4,016, phonemize-sync / phonemize-best / trace 4,016 each, symbols 7,067: 0 DIFFER; parity 200/200.

**Implication.** Done on this machine. The large `.probe/` dumps and `rust/target` are deleted after this run.

## Run 7 — 2026-10-15 19:20 (the findings fixed, TS-first, #1576)

**Question.** Do the Run 5 findings fix cleanly?

**Command.** Probe scripts under `.probe/` on synthetic inputs (`npx tsx .probe/tt.mts <lang> …`), then `npx vitest run`, `npx tsx tools/check-goldens.mts --write`, `dotnet run --project csharp/tools/parity`, `cargo run -p parity`, and each source file reverted alone against `test/turkic-defects-1576.test.ts`.

**Raw finding.**
1. Past 2⁵³: `numberToWords` returns "" for an unsafe integer; the regbi/moliviy branch then leaves the digits for
   the engine's digit-at-a-time reading.
2. `trillion` added (infoedu.uz's table: milliard 9 zeros, trillion 12); 10¹² = *bir trillion*.
3. The `ordinalWords` docstring now says *yuz toʻqsoninchi*, which is what the code returns.
- Goldens: 0 uz rows changed.

**Implication.** Done; mirrored.
