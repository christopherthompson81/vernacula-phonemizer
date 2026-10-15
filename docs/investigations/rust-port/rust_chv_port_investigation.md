# Rust port: Chuvash (`chv`)

Branch `worktree-agent-a123e70f02c70c7cd`, on top of ba, crh, kaa and nog. Part of #1463, the second Turkic group.
Method as in rust_ba_port_investigation.md.

## Run 1 — 2026-10-15 01:13 (the import closure)

**Question.** What does `src/languages/chuvash/` need?

**Command.** Read chuvash.ts, normalize.ts, numbers.ts, romanOrdinals.ts and their imports.

**Raw finding.**
- Core imports: `clauses`, `loadManifest`, `normalizeSymbols`, `initialisms`, `boundaries`, `provenance`. All
  ported. No other language's module, no neural entry; `ROMAN_POLICIES` names `chv: romanChv`.
- numbers.ts has TWO unit series (FULL / SHORT) and an `attr` flag; normalize.ts adds `spellAttributive`, which
  text() runs AFTER the symbol tier. The tables (FULL, SHORT, TENS, LETTER_NAME) are GENERATED from the TS literals
  with `rows.mts` + `put_table.py`, and SYMBOL_DATA with `put_sym.py` from the recorded literal, so none is
  hand-typed.
- ⚠ The scan is a struct pass (Seg with `vowel`, `reduced`, `palatal`), then a voicing pass that MUTATES left to
  right (a segment voiced at k is the `prev` of k+1), then palatalization, then stress. Ported in the same order,
  with a comment on the in-place mutation.
- ⚠ Two encodings of one letter: the patterns carry both ӗ (U+04D7) and the Latin ĕ (U+0115). Compared by code point
  (`cps.py`) in the TS and the Rust: identical, in every pattern that names them.
- No FLEURS for chv.

## Run 2 — 2026-10-15 01:17 (the golden gate)

**Command.** `./target/release/parity chv` and `--sync chv`.

**Raw finding.** `chv: 200/200 identical, 0 differ`. `--sync`: 199/200, the one row an embedded English OOV
(`Alpes-Maritimes`: *ˈæɫps* sync against *ˈæɫpɛz* in the golden), whose sync n-gram reading differs from the async
BiLSTM reading the golden records — the same shape tt's log records; phonemize-sync below shows the Rust and TS SYNC
paths agree on it.

## Run 3 — 2026-10-15 01:21 (differentials)

**Command.** `run.sh <worktree> chv chv-normalize chv-g2p chv-numbers chv-roman`.

**Raw finding.**
```
chv-normalize: 17031 identical, 0 DIFFER  (probe 525, synthetic 12544, words 2562; ops normalize, initialisms on
              raw and normalized, symbols, spellAttributive on the tier's output and on the raw text, engine,
              unreadable)
chv-g2p:       56305 identical, 0 DIFFER  (including every text word in NFD)
chv-numbers:   84321 identical, 0 DIFFER  (both series, ordinalOf, the Roman ordinal, the engine's number reading)
chv-roman:     473 identical, 0 DIFFER    (golden 200, probe 75, synthetic 198: ӗмӗр in both encodings)
phonemize-sync / phonemize-best / trace: 275 identical, 0 DIFFER each
symbols:       3272 identical, 0 DIFFER
```
**Haystack.** normalize changed 46 of 200 golden rows, 39 of 75 probe, 1,197 of 1,792 synthetic; spellAttributive
97 of 400 golden inputs; the initialism pass 98 golden.

**Is the replay sensitive?** The liquid arm's full-vowel condition dropped → `chv-g2p: 405 DIFFER`; step 6's Latin-ĕ
fold dropped → `chv-normalize: 192 DIFFER`. Restored, identical again.

## Run 4 — 2026-10-15 01:23 (the TS suite as a Rust test; the regex audit)

**Command.** `pins.mts test/chuvash.test.ts` (the recorder now also takes boolean arguments, for
`foldCyrillicConfusables(s, true)`), `append_pins.py`; `audit_regex.py`, `escape_ws.py`, `cps.py`, `symcheck.py`.

**Raw finding.**
- 86 calls pinned, 1 skipped (the engine object); 81 matchers, 0 failures. Before the boolean change 3 were skipped
  (the two `foldCyrillicConfusables` calls among them). The test passes; with the voicing trigger disabled it FAILS
  (`phonemizeWord["апат"]`: `aˈpat` for `aˈbat`).
- The de-grouping escapes were literal again (five literals); rewritten. The audit's remaining misses: SYMBOL_DATA
  (identical to the recorded literal) and the `format!` templates, compared by hand.

## Run 5 — 2026-10-15 01:25 (reading for correctness: TS findings)

**Command.** `tryword.mts chuvash/normalize.ts normalizeChuvash …`, `try.mts chv …`.

**Raw finding.**
1. **The Latin-ĕ arms of steps 5 and 6 cannot match the corpus forms their own comments cite.** The suffix class
   `SFX` has no Latin ĕ, so `м[ĕӗ]ш${SFX}{0,6}` fails on `мĕшĕсенче` (the tail's ĕ is a letter the class rejects and
   NOT_LETTER_AFTER then refuses): `normalizeChuvash("15-мĕшĕсенче")` returns it unchanged, and `11-15-мĕшĕсенче` →
   `11, 15-мĕшĕсенче`. Step 5 has no ĕ fold at all. The shipped path is rescued only because the registry's
   `foldCyrillicConfusables` turns ĕ into ӗ before the engine runs (`phonemize` reads both endpoints as ordinals),
   so the in-pass fold is dead there and wrong for a direct caller of the exported function.
2. **The attributive pass takes the short series before any word**, verbs included: `5 килчӗ` → *ˈpilɘk ˈkilt͡ɕɘ*.
   The TS states this cost in `spellAttributive`'s comment; recorded here as measured.
3. **`24:30` is a clock** (the two-field hour class reaches 24): *ˈɕirɘm təˈʋatːə ˈʋədər*. Minor.
4. **No scale above milliard**: `1000000000000` → *ˈpin milːiˈard*.

**Implication.** Reported, not fixed. Nothing port-pending.

## Run 6 — 2026-10-15 01:27 (after `cargo fmt` and four more probes)

**Command.** `run.sh … chv chv-normalize chv-g2p chv-numbers chv-roman`; `parity chv`.

**Raw finding.** chv-normalize 17,052, chv-g2p 56,305, chv-numbers 84,321, chv-roman 477, phonemize-sync /
phonemize-best / trace 279 each, symbols 3,272: 0 DIFFER. parity 200/200.

## Run 7 — 2026-10-15 02:01 (every gate, on the tree rebased onto origin/main 8f7cf14f)

**Command.** `git rebase origin/main` (the germanic group da/nb/af/lb/bar and #1579 had merged meanwhile). Every
commit conflicted on the registry's `LANGUAGES` list; ba also on `build`, `languages/mod.rs` and dump.mts's dump table,
nog on `languages/mod.rs`, tg on dump.mts's `FLEURS_DIR`. Resolved as a union by `resolve.py`: the `LANGUAGES` codes merged and the array length recounted, and at
a block boundary the shared closing lines (`.map_err(…),`, `    },`) copied between the two halves so neither entry
loses its closure; dump.mts parse-checked with `npx esbuild` after each step. Then `cargo run --release -p parity`
(ALL languages), `cargo test --workspace --release`, `cargo run --release -p regex-diff`, `cargo fmt --check`,
`cargo clippy --workspace --release`, and `all.sh` (every dump of this group regenerated from the TS on this tree
and replayed).

**Raw finding.**
- parity: all 73 language lines identical except mag 199/200 and tt 199/200 (their known Arabic rows, port-pending
  on `ar`). hil 112/112, ilo 94/94 and nog 68/68 are the sizes of their goldens.
- cargo test: 267 + 1 passed, 0 failed. regex-diff: 146,326 identical, 0 DIFFER, 0 refused. fmt: clean.
- clippy: the only new warnings are `module_inception` on the six new `mod.rs` files. (One other, `if_same_then_else`
  on tajik.rs's two glide arms, was fixed by joining the conditions; the tg dumps and pins re-replayed identical.)
- chv: chv-normalize 17,052, chv-g2p 56,305, chv-numbers 84,321, chv-roman 477, phonemize-sync / phonemize-best / trace 279 each, symbols 3,272: 0 DIFFER; parity 200/200.

**Implication.** Done on this machine. The large `.probe/` dumps and `rust/target` are deleted after this run.
