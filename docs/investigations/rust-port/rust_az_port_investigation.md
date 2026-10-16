# Rust port: Azerbaijani (`az`)

Branch `worktree-agent-af4c70c2a8782f57e`, from main a8b90335. Part of #1463, the first of the Turkic group (az, kk,
ky, uz, tk, tt). The method is the tr port's (rust_tr_port_investigation.md): per-module `fn-diff` differentials, the
public entry end to end, then the golden gate.

## Run 1 — 2026-10-14 22:24 (the import closure)

**Question.** What does `src/languages/azerbaijani/` need that the Rust core lacks; does az share code with the
Turkish modules just reworked (#1570/#1572); does it have a neural entry or a Roman policy?

**Command.** Read azerbaijani.ts, g2p.ts, normalize.ts, numbers.ts, manifest.ts, romanOrdinals.ts and their imports;
`grep -n` for the six Turkic codes in src/registry.ts and src/neuralRegistry.ts; `ls` the FLEURS root.

**Raw finding.**
- No Turkic language imports a Turkish module. az mirrors Turkish's SHAPE (its own scan, own `azLower`, own
  ordinal/harmony helpers) but shares no code with it, so there is nothing to reuse and nothing forked.
- Every core import is ported: `provenance` rewrite, `normalizeSymbols`, `hostWord` LATIN_RUN/makeNativiser,
  `clauses`, `loadManifest`, `initialisms`, `latinPhones`. No new core module.
- No neural entry. `ROMAN_POLICIES` names `az: romanAz`, so `registry::roman_policy` gains an arm. az is in
  `VULGAR_FOLD_OPT_OUT`, which the Rust registry already lists.
- FLEURS has `az_az` (and `kk_kz`, `ky_kg`, `uz_uz`; no tk, no tt). dump.mts's `FLEURS_DIR` gains all four.

**Implication.** Port manifest → g2p → numbers → romanOrdinals → normalize → azerbaijani, one file each.

## Run 2 — 2026-10-14 22:28 (the golden gate, first look)

**Command.** `cd rust && cargo run --release -p parity -- az` and `-- --sync az`.

**Raw finding.** `az: 200/200 identical, 0 differ` in both modes, first build, no warnings. The golden has 118
distinct texts.

**Implication.** 118 texts say little about the normalizer's rarer arms. The differentials have to carry it.

## Run 3 — 2026-10-14 22:31 (per-module and end-to-end differentials)

**Command.** `.probe/turkic/run.sh <worktree> az az-normalize az-g2p az-numbers az-roman` (each dump through
`npx tsx rust/tools/fn-diff/dump.mts`, replayed by `fn-diff`; then `phonemize-sync`, `phonemize-best`, `trace` with
`LANGS=az`, and `symbols` with `SYMBOLS_LANGS=az`). Inputs: the az golden, FLEURS az_az columns 3 and 4 (first line
checked: a sentence) and `probes/az.txt` (synthetic: one line per normalize.ts arm and a neighbour it must decline,
casing corners, q/ğ/x, geminates, nasal assimilation, foreign scripts, lone surrogates). az-normalize adds
synthetic rows: 25 numbers × six `-ci` suffixes, the 25×4 clock grid × eight case suffixes, 12×13 fractions and
divisions, five percents × ten suffixes.

**Raw finding.**
```
az-normalize: 44167 identical, 0 DIFFER  (golden 118, fleurs 3720, probe 60, synthetic 3936, words 28537 — per op)
az-g2p:       270272 identical, 0 DIFFER
az-numbers:   50266 identical, 0 DIFFER
az-roman:     3898 identical, 0 DIFFER
phonemize-sync: 3898 identical, 0 DIFFER
phonemize-best: 3898 identical, 0 DIFFER
trace:          3898 identical, 0 DIFFER
symbols:        6910 identical, 0 DIFFER  (probe 3072, azerbaijani 3838)
```
**Haystack.** `normalize` changed 447 of 3,720 FLEURS rows, 18 of 118 golden, 45 of 60 probe and 1,255 of 1,312
synthetic; the initialism pass alone changed 65 FLEURS rows; the symbol tier 78; the Roman pass 18 FLEURS rows.

**Is the replay sensitive?** Two deliberate breaks, each reverted: the y-buffer in `harmoniseSuffix` disabled →
`az-normalize: 73 DIFFER`; word-final q → x disabled → `az-g2p: 5820 DIFFER`.

**Implication.** The modules match. Next: the TS suite's pins, and reading for correctness.

## Run 4 — 2026-10-14 22:35 (the TS suite as a Rust test, and a regex-literal audit)

**Command.** `node .probe/turkic/pins.mjs test/azerbaijani.test.ts '<shapes>'` extracts every
`expect(<call>).toBe(<literal>)` whose call matches a configured shape (phonemizeWord, `createAzerbaijani().text`,
`getPhonemizer("az").text`/`ph`, normalizeAzerbaijani, ordinalWords, the Roman ordinal), evaluating each literal
rather than retyping it, into a `PINS` table appended to azerbaijani.rs. Then `python3 .probe/turkic/re_audit.py`
checks every `js_re!`/`JsRegex::new` literal in the Rust files against the TS sources code point for code point.

**Raw finding.**
- 95 of the file's 97 `expect(` calls extracted; the 2 skipped are `ordinalAfter.test(w)` (the az-roman dump covers
  the context regex). `the_ts_suite_pins_hold` passes. Guard check: LOW harmony forced to `a` → the test FAILS on 5
  pins (46%-dən, 01:15-də, 23:35-ə, 11:00-dan, 1/5). Disabling the y-buffer alone did NOT fail it: no pin exercises
  the buffer (the differential does, Run 3).
- ⚠ The audit found 2 of 44 literals NOT verbatim: the editing tool had written the ` `, ` `, ` `
  escapes in normalize.rs steps 2 and 5 as the literal characters. Same matches either way (parity and the dumps
  were green before the fix), but the contract is the TS code points; rewritten to the escapes
  (`.probe/turkic/escape_spaces.py`), audit 44/44, az-normalize and trace re-replayed identical.

**Implication.** Rust reproduces the suite. Next: TS findings.

## Run 5 — 2026-10-14 22:37 (reading for correctness: TS findings)

**Command.** `npx tsx .probe/az/findings.mts`: the TS engine on synthetic inputs chosen while reading each file
against its docstring. Rust reproduces each (the inputs are in probes/az.txt); none is fixed here.

**Raw finding.**
1. **A numeral past 2⁵³ is read from the rounded double** (numbers.ts, and `numberTokenToWords`). `12345678901234567890
   nəfər` reads the digits of `12345678901234567000`, ending *… yeddi sıfır sıfır sıfır*, and from 10²¹ `String(n)` is
   exponent notation, so `numberToWords(1e21)` is *bir sıfır sıfır iki bir* ("1e+21" read character by character).
   16–18-digit numerals take the scale path with wrong low digits. This is the defect tr fixed in #1523 with
   `digitsToWords`; az still has it.
2. **A period-thousands with a comma decimal splits** (azerbaijani.ts TOKEN). `1.234,5 manat` →
   *mˈin icˈi jˈyz otˈuz dˈœɾd , bˈeʃ mɑnˈɑt*: the token's alternatives are period-thousands OR `\d+,\d+`, never
   both, so the decimal becomes a clause pause and a bare digit. `20 000,5` works (step 5 de-groups first).
3. **The `BE` era arm matches lower case** (normalize.ts MULTI_DOT, built with `giu`): `be 5 il` and `Be 2010` read
   *bizim eramız …*. The comment documents the capital `BE` only.
4. **The Roman context is unanchored at the end by design, so it also prefixes unrelated words**: `XX əsrarəngiz`
   ("mysterious") reads the ordinal *iyirminci*. Rare.

**Implication.** Reported in the PR, not fixed (TS first, in a separate change). Nothing is port-pending for az: the
foreign-script probe line (Cyrillic, Greek, Han) routes to ported engines.

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
- az: az-normalize 44,167, az-g2p 270,272, az-numbers 50,266, az-roman 3,898, phonemize-sync / phonemize-best / trace 3,898 each, symbols 6,910: 0 DIFFER; parity 200/200.

**Implication.** Done on this machine. The large `.probe/` dumps and `rust/target` are deleted after this run.

## Run 7 — 2026-10-15 19:20 (the findings fixed, TS-first, #1576)

**Question.** Do the four findings of Run 5 fix cleanly, and does anything move?

**Command.** Probe scripts under `.probe/` on synthetic inputs (`npx tsx .probe/tt.mts <lang> …`), then `npx vitest run`, `npx tsx tools/check-goldens.mts --write`, `dotnet run --project csharp/tools/parity`, `cargo run -p parity`, and each source file reverted alone against `test/turkic-defects-1576.test.ts`.

**Raw finding.**
1. Past 2⁵³: `digitsToWords` groups the written digits (tr's #1523 shape); `numberToWords` now returns "" for an
   unsafe integer instead of reading `String(n)`. `12345678901234567890 nəfər` reads its 20 digits one by one (7
   groups > 6 scale words), and `1000000000000000000000` its 22. az came off `ACCEPTED_LOSSY` in
   test/large-numeral-fidelity.test.ts.
2. TOKEN: the period-thousands alternative takes an optional `,\d+`; `1.234,5 manat` = `1234,5 manat`.
3. `BE` moved out of the case-insensitive MULTI_DOT table into its own `gu` regex: `be 5 il`, `Be 2010` no longer
   read *bizim eramız*; `BE 1000` does.
4. The Roman CONTEXT is bounded by harmony: every stem is front-voweled, so `(?![\p{L}\p{M}]*[aıou])` refuses
   `əsrarəngiz`. ⚠ The first cut had `[aıouAIOU]` — under `i`, `I` folds to `i`, and `əsrin` was refused; the
   existing pin "context matches the agglutinated century forms" caught it.
- Goldens: 0 az rows changed. Each fix's test fails with its file reverted.

**Implication.** Done; mirrored to C# and Rust (parity 200/200).
