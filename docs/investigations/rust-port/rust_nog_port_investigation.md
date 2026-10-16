# Rust port: Nogai (`nog`)

Branch `worktree-agent-a123e70f02c70c7cd`, on top of ba, crh and kaa. Part of #1463, the second Turkic group. Method
as in rust_ba_port_investigation.md.

## Run 1 — 2026-10-15 00:58 (the import closure: one core module missing)

**Question.** What does `src/languages/nogai/` need?

**Command.** Read nogai.ts, normalize.ts, numbers.ts and their imports; `ls rust/vernacula-phonemizer/src/core/`.

**Raw finding.**
- normalize.ts is one call: `separatorHygiene(input)` from `src/core/separatorHygiene.ts`, which is NOT ported.
  It is shared by eight languages (nog, smj, kl, naq, mto, quc, grc, rup), so it goes in its own mirrored file,
  `core/separator_hygiene.rs`, to be reused by those ports rather than forked.
- Otherwise `clauses`, `loadManifest`, `ipa` only. No neural entry, no Roman policy, no symbol tier, no
  initialisms. No FLEURS and no corpus at all for nog (the TS header says so); the golden has 68 rows.

## Run 2 — 2026-10-15 01:02 (the golden gate)

**Command.** `./target/release/parity nog` and `--sync nog`.

**Raw finding.** `nog: 68/68 identical, 0 differ` both modes, first build (68 is the golden's size).

## Run 3 — 2026-10-15 01:04 (differentials)

**Command.** `run.sh <worktree> nog nog-normalize nog-g2p nog-numbers`.

**Raw finding.**
```
nog-normalize: 3244 identical, 0 DIFFER   (golden 136, probe 90, synthetic 3018; ops normalize = separatorHygiene,
              engine)
nog-g2p:       45046 identical, 0 DIFFER
nog-numbers:   32066 identical, 0 DIFFER
phonemize-sync / phonemize-best / trace: 113 identical, 0 DIFFER each
symbols:       3072 identical, 0 DIFFER   (probes only: nog has no tier)
```
**Haystack.** normalize changed 0 of 68 golden rows (the golden carries no grouped figure), 14 of 45 probe and 899
of 1,509 synthetic rows (every separator × head × group shape × trailing context, dotted runs, dash spans). So the
golden alone would have proved nothing about the core module; the synthetic rows carry it.
⚠ A slip of mine: the editing tool wrote the `\u00a0\u202f\u2009` escapes of the dump's separator list as literal
characters. The dump was still right (a literal NBSP is the same string), but the file now has them escaped like the
TS; it carried two such literal lines from earlier ports, left as they were.

**Is the replay sensitive?** The decimal rule's replacement changed (`$1 $2` → `$1$2`) → `nog-normalize: 812
DIFFER`; coda в disabled → `nog-g2p: 9837 DIFFER`. Restored, identical again.
⚠ A negative result worth keeping: cutting the space-group loop to ONE pass changed NOTHING (`0 DIFFER` over 3,244
rows, multi-group figures included). See Run 5.

## Run 4 — 2026-10-15 01:07 (the TS suites as Rust tests; the regex audit)

**Command.** `pins.mts test/nogai.test.ts` and `pins.mts test/separator-hygiene.test.ts`, `append_pins.py`;
`audit_regex.py`, `escape_ws.py`.

**Raw finding.**
- nogai.test.ts: 24 calls pinned, 1 skipped (the engine object), 24 matchers, 0 failures; passes, and FAILS with
  coda в disabled (`phonemizeWord["гъарув"]`: `ʁaˈru` for `ʁaˈruw`).
- separator-hygiene.test.ts: 47 calls, 52 matchers, 0 failures. 31 are `separatorHygiene` calls and 16 are
  `phonemize` in eight languages, seven of them unported (quc naq rup kl mto smj grc). The Rust test in
  separator_hygiene.rs replays the 31 plus the two `nog` rows (33), and says which it leaves out.
- The `SP` escapes were literal again in separator_hygiene.rs (one literal); rewritten. The `SPACE_GROUP` template
  compared by hand with the TS `new RegExp` string.

## Run 5 — 2026-10-15 01:09 (reading for correctness: TS findings)

**Command.** `try.mts nog …`, and the one-pass break of Run 3.

**Raw finding.**
1. **The space-group fixed-point loop never does a second productive pass.** Its comment says "one pass consumes
   only the first separator of a pair", but the pattern is all lookaround (`(?<=\d)…SP(?=\d{3}(?!\d))`), so one
   global pass already removes every qualifying space, and a removal can only lengthen a digit run, which no
   lookahead for EXACTLY three digits can then newly accept. Harmless (the loop just costs a pass); the comment
   states a limitation that does not exist.
2. **The standalone-0 guard is half-applied in a multi-group zero**: `0 000 000` → `0 000000` (the first space kept by
   the guard, the second joined), read *ˈnol ˈnol*. Minor.
3. **No scale above milliard**: `1000000000000` → *ˈmɯŋ milliˈard*.

**Implication.** Reported, not fixed. Nothing port-pending.

## Run 6 — 2026-10-15 01:11 (after `cargo fmt`)

**Command.** `run.sh … nog nog-normalize nog-g2p nog-numbers`; `parity nog`.

**Raw finding.** nog-normalize 3,244, nog-g2p 45,046, nog-numbers 32,066, phonemize-sync / phonemize-best / trace
113 each, symbols 3,072: 0 DIFFER. parity 68/68.

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
- nog: nog-normalize 3,244, nog-g2p 45,046, nog-numbers 32,066, phonemize-sync / phonemize-best / trace 113 each, symbols 3,072: 0 DIFFER; parity 68/68.

**Implication.** Done on this machine. The large `.probe/` dumps and `rust/target` are deleted after this run.

## Run 8 — 2026-10-15 20:35 (#1581 fixes, TS-first, mirrored to C# and Rust)

**Question.** The #1576 note said ba probably had the tk/tt medial-cluster walk. Which of this group does?

**Found.** nog does: китаплар → *kitaˈplar*, the same sonority walk.

**Done.** The tt rule: one onset consonant word-internally, and a word-initial cluster is the whole onset.

**Declined: trillion.** No source found. There is no en.wiktionary entry, Omniglot "Numbers in Nogai" stops
at миллиард, and there is no mined artifact. nog also uses the shared space-group join (core/separatorHygiene.ts).

**Goldens.** nog moved 0 of its 68 rows.
