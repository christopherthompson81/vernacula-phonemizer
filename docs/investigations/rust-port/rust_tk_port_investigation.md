# Rust port: Turkmen (`tk`)

Branch `worktree-agent-af4c70c2a8782f57e`, on top of az, kk, ky, uz. Part of #1463, the Turkic group. Method as
in rust_az_port_investigation.md.

## Run 1 — 2026-10-14 23:21 (the import closure, and what the inputs are)

**Question.** What does `src/languages/turkmen/` need, and what text can the differential use?

**Command.** Read turkmen.ts, normalize.ts, numbers.ts, romanOrdinals.ts and their imports; `ls` the FLEURS root;
`cut -f1 csharp/goldens/tk.tsv | sort -u | wc -l`.

**Raw finding.**
- Core imports: `clauses`, `hostWord`, `loadManifest`, `numbers`, `normalizeSymbols`, `latinPhones`, `ipa`,
  `initialisms`, `boundaries`, `provenance`. All ported. No Turkish import, no neural entry; `ROMAN_POLICIES`
  names `tk: romanTk`, whose `ordinal` imports normalize.ts's `ordinalOf` (the Rust does the same).
- Like Uzbek there is no manifest.ts: `TurkmenDef` lives in turkmen.rs, and numbers.rs has its own loader for the
  `numbers` block, which `number()` in turkmen.rs also reads (one copy of the data).
- ⚠ `turkmenNumberWords` recurses on the JS number as given. Every caller guards it (`ordinalOf`:
  `Number.isInteger`, `n ≥ 0`; `number`: safe integer), so the Rust composer is over `f64` like the TS.
- **No FLEURS for tk**, and no other corpus on this machine (the `phonemized_vernacula/byid` tree is gone). The
  golden has 200 distinct texts. So the probes and GENERATED shapes carry the normalizer, as for hil/ilo.
- The symbol tier is built from `SYMBOL_DATA`, the JSON of the TS literal as recorded through fn-diff's
  symbols-hook (`.probe/turkic/gen_symbols.mts`), compared byte for byte with the recording: SAME. The same tool
  confirms the hand-written az/kk/ky/uz tiers carry exactly the recorded data (key order included).

## Run 2 — 2026-10-14 23:24 (the golden gate)

**Command.** `./target/release/parity tk`, `--sync tk`.

**Raw finding.** `tk: 200/200 identical, 0 differ` both modes, first build.

## Run 3 — 2026-10-14 23:26 (differentials)

**Command.** `.probe/turkic/run.sh <worktree> tk tk-normalize tk-g2p tk-numbers tk-roman` (plus phonemize-sync,
phonemize-best, trace, symbols). tk-normalize also replays the ENGINE's `text()` on every row, since without
FLEURS the end-to-end dumps see only 217 texts.

**Raw finding.**
```
tk-normalize: 11510 identical, 0 DIFFER  (golden, probe 85, synthetic 5625+, words 3458; ops normalize,
              initialisms on raw and normalized, tildes, symbols, engine)
tk-g2p:       141528 identical, 0 DIFFER
tk-numbers:   84329 identical, 0 DIFFER  (numberToWords, ordinalOf both classes, roman, the engine's digit reading)
tk-roman:     337 identical, 0 DIFFER    (golden 200, probe 17, synthetic 120 Roman × asyr-form rows)
phonemize-sync: 217 identical, 0 DIFFER
phonemize-best: 217 identical, 0 DIFFER
trace:          217 identical, 0 DIFFER
symbols:        3272 identical, 0 DIFFER  (probe 3072, turkmen 200)
```
**Haystack.** normalize changed 85 of 200 golden rows, 9 of 17 probe and 812 of 1,125 synthetic (every written
ordinal suffix × 29 numbers, the era markers × seven trailing contexts, suffixed percents, fractions, signed and
suffixed degrees, ranges); the tilde fold 19 golden rows. The weak spot is stated plainly: the golden is the only
real text.

**Is the replay sensitive?** The obstruent+liquid onset test disabled → `tk-g2p: 2340 DIFFER`,
`tk-normalize: 487 DIFFER` (through the engine op); the rounded linking vowel disabled →
`tk-numbers: 12832 DIFFER`. Both reverted.

## Run 4 — 2026-10-14 23:29 (the TS suite as a Rust test)

**Command.** `node .probe/turkic/pins.mjs test/turkmen.test.ts '<shapes>'`. Two extractor changes: a shape can be
scoped to a line range, because the file rebinds `tk` (line 35: `createTurkmen()`; line 61:
`{ text: (s) => phonemize(s, "tk") }`), which is the bare engine in one describe and the registry in the next;
and a relational pin inside a `for … of [...] as const` loop expands per element.

**Raw finding.** 61 pins from 58 sites, 0 skipped. The test passes, and FAILS with the rounded linking vowel
disabled (*dördünji*, *onunjy*, *ýüzünji*). Regex audit 28/28; LETTER_NAME 30/30.

## Run 5 — 2026-10-14 23:31 (reading for correctness: TS findings)

**Command.** `npx tsx .probe/tk/findings.mts`, and `phonemizeWord` on a few native words. Rust reproduces each;
the inputs are in probes/tk.txt.

**Raw finding.**
1. **The stress mark takes word-internal clusters as onsets.** `phonemizeWord` walks left from the last nucleus
   while the pair is obstruent+liquid, fricative+stop or nasal+stop, so a syllable boundary Turkmen draws between
   them is moved: *kitaplar* → *kitɑˈplɑɾ*, *gyzlar* → *ɡɯˈðlɑɾ*, *dostluk* → *doˈθtluk*, *tizlik* → *tiˈðlik*
   (kitap.lar, gyz.lar). The rule suits a word-INITIAL loan cluster (*sport*); medially it splits the coda.
2. **A dash before a number is a minus wherever a space precedes it**: `Ilkinji ýyl – 1995.` → *… minus 1995*.
3. **No scale above milliard**: 10¹² → *bir müň milliard*.
4. Latent, not reachable through `phonemize`: `numberToWords(NaN)` recurses until "Maximum call stack size
   exceeded" (every comparison is false, so it falls to the milliard branch with NaN), and `numberToWords(-5)` is
   `[undefined]`. Every caller guards; the exported function does not.

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
- tk: tk-normalize 11,510, tk-g2p 141,528, tk-numbers 84,329, tk-roman 337, phonemize-sync / phonemize-best / trace 217 each, symbols 3,272: 0 DIFFER; parity 200/200.

**Implication.** Done on this machine. The large `.probe/` dumps and `rust/target` are deleted after this run.
