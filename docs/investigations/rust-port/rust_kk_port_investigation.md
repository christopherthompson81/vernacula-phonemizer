# Rust port: Kazakh (`kk`)

Branch `worktree-agent-af4c70c2a8782f57e`, on top of the az port. Part of #1463, the Turkic group. Method as in
rust_az_port_investigation.md.

## Run 1 — 2026-10-14 22:41 (the import closure)

**Question.** What does `src/languages/kazakh/` need, and does it share anything with Turkish or Azerbaijani?

**Command.** Read kazakh.ts, g2p.ts, normalize.ts, numbers.ts, manifest.ts, romanOrdinals.ts and their imports.

**Raw finding.**
- No Turkish or Azerbaijani import. Core imports (`normalizeSymbols`, `clauses`, `provenance`, `loadManifest`) are
  all ported. No neural entry; `ROMAN_POLICIES` names `kk: romanKk`.
- ⚠ An import CYCLE the Rust has to keep: normalize.ts imports `SYMBOLS` from kazakh.ts (which imports normalize.ts)
  and applies the tier INSIDE the pass (step 7), and kazakh.ts's text() applies it AGAIN on the result. The Rust
  keeps both applications: one `OnceLock` tier (`kazakh::symbols()`), built and checked by `create_kazakh`.
- text() splits a Cyrillic run with `part.split(/(?<=\p{Ll})(?=\p{Lu})/u)`. The Rust core has no regex `split`,
  and the pattern is zero-width, so JS's split cuts at every match strictly inside the string; `split_camel`
  reproduces that from `match_all` (no core change).
- Numbers are emitted PRE-PHONEMIZED from the manifest's IPA atoms (numbers.ts), while normalize.ts builds
  ORTHOGRAPHIC number words for the suffix/clock rules: two compositors, both ported as written.

**Implication.** Port manifest → g2p → numbers → romanOrdinals → normalize → kazakh.

## Run 2 — 2026-10-14 22:46 (the golden gate)

**Command.** `cd rust && ./target/release/parity kk` and `--sync kk`.

**Raw finding.** `kk: 200/200 identical, 0 differ` both modes, first build. 101 distinct golden texts.

## Run 3 — 2026-10-14 22:48 (differentials, and a FLEURS directory with one split)

**Command.** `.probe/turkic/run.sh <worktree> kk kk-normalize kk-g2p kk-numbers kk-roman` (plus phonemize-sync,
phonemize-best, trace with `LANGS=kk`, and symbols with `SYMBOLS_LANGS=kk`).

**Raw finding.**
- First attempt: every dump threw `ENOENT … kk_kz/dev.tsv`. **FLEURS kk_kz ships only `train.tsv`** (first line of
  column 3 checked: a sentence). dump.mts's `textsFor` reads all three splits and is loud by design, so it gains a
  `FLEURS_SPLITS` table (`kk_kz: ["train"]`): still loud for any split it names.
- Then:
```
kk-normalize: 13492 identical, 0 DIFFER  (fleurs 5790, probe 52, synthetic 7448 — two ops per text)
kk-g2p:       91424 identical, 0 DIFFER
kk-numbers:   25197 identical, 0 DIFFER
kk-roman:     3022 identical, 0 DIFFER
phonemize-sync: 3022 identical, 0 DIFFER
phonemize-best: 3022 identical, 0 DIFFER
trace:          3022 identical, 0 DIFFER
symbols:        6149 identical, 0 DIFFER  (probe 3072, kazakh 3077)
```
**Haystack.** normalize changed 243 of 2,895 FLEURS rows, 11 of 101 golden, 19 of 26 probe and 3,076 of 3,724
synthetic (every case suffix, ordinal suffix and noun tail × 39 numbers; the clock grid × seven suffixes;
fractions, divisions, degrees). The SECOND symbol-tier application (text()'s) changed 0 rows of any source: on
these inputs it is idempotent after step 7's. The Roman pass changed 8 FLEURS rows.

**Is the replay sensitive?** The voiceless instrumental (-пен) disabled → `kk-normalize: 81 DIFFER`; the
initial-cluster epenthesis disabled → `kk-g2p: 349 DIFFER`. Both reverted.

## Run 4 — 2026-10-14 22:51 (the TS suite as a Rust test; the regex audit)

**Command.** `node .probe/turkic/pins.mjs test/kazakh.test.ts '<shapes>'`. The extractor now also expands a pin
inside `for (const <pat> of <list>)` (a literal array or a `const` array in the file), drops `expect`'s message
argument, strips `await`, and knows `.not.toBe`. Then `re_audit.py`.

**Raw finding.**
- 115 pins from 107 `expect(` sites (two loops expand); 2 skipped (`ordinalAfter.test`, covered by kk-roman). One
  shape needed its own kind: `phonemizeWord("кино").replace(/ˈ/u, "")`. `the_ts_suite_pins_hold` passes; with the
  -пен arm disabled it FAILS on 4 pins (5-пен, 3-пен, 4-пен, 40-пен).
- A dead end of my own: reverting a sensitivity break with `sed 's/if false && //'` also deleted the `if`, and the
  next build failed to parse. Fixed and re-replayed (kk-normalize and kk-g2p identical again) before the pins ran.
- Regex audit: the editing tool again wrote the `   ` escapes (step 0, TOKEN) as literal
  characters; rewritten, 46/46 verbatim.

## Run 5 — 2026-10-14 22:53 (reading for correctness: TS findings)

**Command.** `npx tsx .probe/kk/findings.mts`. Rust reproduces each; the inputs are in probes/kk.txt.

**Raw finding.**
1. **No scale above a million** (numbers.ts `numberToIpa`): 10⁹ reads *bˈɪr mˈəŋ məjlɫəjˈon* ("one thousand
   million") and 2·10¹² *jˈekɪ məjlɫəjˈon məjlɫəjˈon* ("two million million"); Kazakh has миллиард / триллион.
2. **Past 2⁵³ the digits are the rounded double's** (text() `Number(m[2])`): `12345678901234567890` reads a number
   ending …168.
3. **A range loses its relation** (normalize.ts step 6): `1977-1981` becomes `1977–1981`, and the en dash is not
   a token, so it reads as two bare numbers with no word or pause between them. The step's comment names "ден"
   (from/to) as the reading, but nothing emits it.
4. **A case suffix after a unit or percent is read as its own word** (step 4 claims only a bare number): `5 км-ге`
   → *bˈes kəjlomˈetr ɡˈe*, `20%-ға` → *… pˈɑjəz ʁˈɑ*. az handles the `%-suffix` shape; kk does not.
5. **A declined round-thousand ordinal leaves a stray syllable**: `1000-шы жыл` → *bˈɪr mˈəŋ ʃˈə ʒˈəɫ*. The decline is
   deliberate (the comment says мыңыншы is not constructed); the leftover suffix is what it costs.

**Implication.** Reported in the PR, not fixed. Nothing port-pending: the probe's Latin, Greek and Han runs route to
ported engines.

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
- kk: kk-normalize 13,492, kk-g2p 91,424, kk-numbers 25,197, kk-roman 3,022, phonemize-sync / phonemize-best / trace 3,022 each, symbols 6,149: 0 DIFFER; parity 200/200.

**Implication.** Done on this machine. The large `.probe/` dumps and `rust/target` are deleted after this run.

## Run 7 — 2026-10-15 19:20 (the findings fixed, TS-first, #1576)

**Question.** Do the five findings of Run 5 fix cleanly, and what moves?

**Command.** Probe scripts under `.probe/` on synthetic inputs (`npx tsx .probe/tt.mts <lang> …`), then `npx vitest run`, `npx tsx tools/check-goldens.mts --write`, `dotnet run --project csharp/tools/parity`, `cargo run -p parity`, and each source file reverted alone against `test/turkic-defects-1576.test.ts`.

**Raw finding.**
1. Scales: `milliard` and `trillion` atoms added to kazakh.jsonc. DERIVED, not typed — the g2p reads миллион as
   mˈəjɫɫəjon and the authored atom is məjlɫəjˈon (first ɫ clear, stress on the last vowel); the same two edits on
   the g2p's миллиард / триллион give məjlɫəjˈɑrd / trəjlɫəjˈon, and the script asserts it reproduces the million.
   Attestation: "25 триллион теңге" in Kazakh-language financial news; миллиард has a Wiktionary Kazakh entry.
2. Past 2⁵³: `digitsToIpa` reads the run digit by digit from the unit atoms. kk came off `ACCEPTED_LOSSY`.
3. Range: rewritten to `$1, $2` (a pause, as tk/ba/tt/chv). ⚠ The first cut kept the trailing guard
   `(?![\d.-])`, and test/clause-final-range.test.ts (trap 58) caught `137–151.` losing the pause — the guard
   refused the sentence dot. Now `(?![\d-]|\.\d)`.
4. Unit/percent suffix: after the tier, `<digit> <unit word>-<suffix>` glues the written suffix (`5 км-ге` =
   `5 километрге`, `20%-ға` = `20 пайызға`).
5. Round thousand: `1000-шы` → *бір мыңыншы* (Wiktionary Kazakh numeral мыңыншы, "thousandth"). The two pins that
   held the decline were re-pinned with the source.
- Goldens: 2 kk rows changed, the same `2-5 күн` row twice — the range pause. Nothing else.

**Implication.** Done; mirrored to C# and Rust (parity 200/200).
