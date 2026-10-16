# Rust port: Karakalpak (`kaa`)

Branch `worktree-agent-a123e70f02c70c7cd`, on top of ba and crh. Part of #1463, the second Turkic group. Method as
in rust_ba_port_investigation.md.

## Run 1 — 2026-10-15 00:44 (the import closure)

**Question.** What does `src/languages/karakalpak/` need, and how far is it crh's shape?

**Command.** Read karakalpak.ts, normalize.ts, numbers.ts and their imports; `diff` the two numbers.ts compositors.

**Raw finding.**
- The same core imports as crh (`hostWord`, `latinPhones`, `normalizeSymbols`, `provenance`, `boundaries`), all
  ported. No other language's module, no neural entry, no Roman policy, no initialism pass. `kaa` is already in the
  Rust registry's `SPACED_DASH_OPT_OUT`.
- numbers.ts's compositor is textually identical to crh's (diff empty), but each is its own TS module, so each is
  its own Rust file with its own tables.
- ⚠ Two differences from crh that a copy would have erased: the scan has DIGRAPHS (`sh`, `ch`, matched on UTF-16
  units of the key), and the stress test is `IPA_VOWEL.has(s)` on the WHOLE segment, not crh's "contains a vowel".
  Ported as written (`is_vowel_seg`), with a comment.
- No FLEURS for kaa.

## Run 2 — 2026-10-15 00:47 (the golden gate)

**Command.** `./target/release/parity kaa` and `--sync kaa`.

**Raw finding.** `kaa: 200/200 identical, 0 differ` both modes, first build.

## Run 3 — 2026-10-15 00:49 (differentials)

**Command.** `run.sh <worktree> kaa kaa-normalize kaa-g2p kaa-numbers`.

**Raw finding.**
```
kaa-normalize: 2922 identical, 0 DIFFER   (golden 600, probe 213, synthetic 2109)
kaa-g2p:       80174 identical, 0 DIFFER
kaa-numbers:   32066 identical, 0 DIFFER
phonemize-sync / phonemize-best / trace: 271 identical, 0 DIFFER each
symbols:       3272 identical, 0 DIFFER   (probe 3072, karakalpak 200)
```
**Haystack.** normalize changed 69 of 200 golden rows, 52 of 71 probe and 500 of 703 synthetic; the tier 42 golden.

**Is the replay sensitive?** ⚠ A dead end first: my break of the digraph arm (`if let Some(..) = dg` →
`if false && (let …)`) does not compile, and `sens.sh` replayed the OLD binary and reported `0 DIFFER` as though
the break had been invisible. The script now refuses to replay unless the broken build finishes. Then: the stress
onset step disabled → `kaa-g2p: 20549 DIFFER`; the era marker's kept dot disabled → `kaa-normalize: 26 DIFFER`.
Restored from a copy, identical again. (The ba and crh breaks above all compiled; each reported differences, so
none of them was a stale binary.)

## Run 4 — 2026-10-15 00:51 (the TS suite as a Rust test; the regex audit)

**Command.** `pins.mts test/karakalpak.test.ts`, `append_pins.py`; `audit_regex.py`, `escape_ws.py`, `symcheck.py`.

**Raw finding.**
- 53 calls pinned, 1 skipped (the engine object); 53 matchers, 0 failures. The test passes; with the stress onset
  step disabled it FAILS (`phonemizeWord["qaraqalpaq"]`: `qɑrɑqɑlpˈɑq` for `qɑrɑqɑlˈpɑq`).
- ⚠ The de-grouping escapes were literal characters again (two literals); rewritten. Remaining audit misses are
  the `format!` templates, each compared by hand with its `new RegExp` template (`mln`, `mlrd`, `m.kv.`, `km kv`,
  `kvt/saat`, the comma group with `MAG_NEXT`, `b.e.sh.`, `-j.`, `t-ra`), and the SYMBOL_DATA JSON, which
  `symcheck.py` finds identical to the recorded TS literal.

## Run 5 — 2026-10-15 00:53 (reading for correctness: TS findings)

**Command.** `npx tsx tryword.mts karakalpak/karakalpak.ts phonemizeWord …`, `try.mts kaa …`.

**Raw finding.**
1. **The whole-segment vowel test misses the one multi-character vowel `latinPhone` returns**: `å → oː`, so
   `phonemizeWord("kitåp")` → *ˈkitoːp* (stress on the first syllable, not the last). crh's twin test (spread
   over the segment) would give the final syllable. Not reachable from `text()`, whose nativiser folds `å` first
   (`kitåp` → *kiˈtɑp*), so it only affects the exported word function, which the referee eval calls.
2. **No scale above milliard**: `1000000000000` → *ˈmɯŋ milliˈɑrd*.
3. **`24:00` is not a clock** (the hour class is `2[0-3]`): `saat 24:00 de` keeps the colon as a pause, *… ˈtørt ,
   ˈnol …*. Minor.

**Implication.** Reported, not fixed. Nothing port-pending.

## Run 6 — 2026-10-15 00:55 (after `cargo fmt` and three more probes)

**Command.** `run.sh … kaa kaa-normalize kaa-g2p kaa-numbers`; `parity kaa`.

**Raw finding.** kaa-normalize 2,928, kaa-g2p 80,182, kaa-numbers 32,066, phonemize-sync / phonemize-best / trace
274 each, symbols 3,272: 0 DIFFER. parity 200/200.

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
- kaa: kaa-normalize 2,928, kaa-g2p 80,182, kaa-numbers 32,066, phonemize-sync / phonemize-best / trace 274 each, symbols 3,272: 0 DIFFER; parity 200/200.

**Implication.** Done on this machine. The large `.probe/` dumps and `rust/target` are deleted after this run.

## Run 8 — 2026-10-15 20:35 (#1581 fixes, TS-first, mirrored to C# and Rust)

**Question.** Do the #1581 kaa defects reproduce?

**Found.**
- `phonemizeWord("tåw")` came back with NO stress mark. The vowel test took a whole segment, and ⟨å⟩ is `oː`.
  The text path was unaffected, because normalize folds ⟨å⟩ first.
- `24:00` fell through the clock rule.

**Done.**
- A segment is a vowel if any of its characters is.
- `24(?=:00)` joins the hour class. ISO 8601's end of day is the only hour-24 time; the corpus writes no `24:`
  time either way.
- trillion, attested in the mined artifact as 10¹² ("6 trillion AQSH dolları", a damages figure).

**Goldens.** kaa moved 2 rows: the pico- and femtosecond figures now read *trillion*.
