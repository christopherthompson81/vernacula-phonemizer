# Rust port: Crimean Tatar (`crh`)

Branch `worktree-agent-a123e70f02c70c7cd`, on top of the ba port. Part of #1463, the second Turkic group. Method as
in rust_ba_port_investigation.md.

## Run 1 — 2026-10-15 00:30 (the import closure)

**Question.** What does `src/languages/crimeantatar/` need?

**Command.** Read crimeantatar.ts, normalize.ts, numbers.ts and their imports.

**Raw finding.**
- Core imports: `clauses`, `hostWord` (`LATIN_RUN`, `makeNativiser`), `loadManifest`, `latinPhones`, `ipa`,
  `provenance` (`renormalize`, `rewrite`), `normalizeSymbols`, `boundaries`. All ported. No other language's
  module, no neural entry, no Roman policy (the registry's default arm), no initialism pass.
- The symbol tier is built inside normalize.ts and applied mid-pass (step 3), so it lives in normalize.rs.
  `SYMBOL_DATA` is the recorded TS literal; compared with the Rust constant: identical.
- ⚠ The pass ends with a plain `s.replace(/[^\S\n]{2,}/gu, " ")`, not `rewrite`, so the Rust uses
  `JsRegex::replace` there (off the provenance seam), with a marker comment.
- No FLEURS for crh: the golden (200 distinct texts), probes/crh.txt and generated shapes carry it.

## Run 2 — 2026-10-15 00:33 (the golden gate)

**Command.** `./target/release/parity crh` and `--sync crh`.

**Raw finding.** `crh: 200/200 identical, 0 differ` both modes, first build.

## Run 3 — 2026-10-15 00:36 (differentials)

**Command.** `run.sh <worktree> crh crh-normalize crh-g2p crh-numbers` (plus phonemize-sync, phonemize-best,
trace, symbols).

**Raw finding.**
```
crh-normalize: 1707 identical, 0 DIFFER   (golden 600, probe 201, synthetic 906; ops normalize, symbols, engine)
crh-g2p:       70576 identical, 0 DIFFER  (phonemizeWord and the nativiser)
crh-numbers:   32066 identical, 0 DIFFER
phonemize-sync / phonemize-best / trace: 267 identical, 0 DIFFER each
symbols:       3272 identical, 0 DIFFER   (probe 3072, crimeantatar 200)
```
**Haystack.** normalize changed 39 of 200 golden rows, 46 of 67 probe and 276 of 302 synthetic; the tier alone
changed 5 golden, 18 probe and 77 synthetic rows.

**Is the replay sensitive?** Gemination disabled → `crh-g2p: 5953 DIFFER`; the era marker's kept final dot
disabled → `crh-normalize: 18 DIFFER`. Both restored from a copy (`cmp` clean) and identical again.

## Run 4 — 2026-10-15 00:38 (the TS suite as a Rust test; the regex audit)

**Command.** `pins.mts test/crimeantatar.test.ts`, `append_pins.py`; `audit_regex.py`, `escape_ws.py`,
`nfc_check.py`.

**Raw finding.**
- 51 calls pinned, 1 skipped (the `createCrimeanTatar()` object); 51 matchers, 0 failures. The test passes; with
  gemination disabled it FAILS (`createCrimeanTatar().text["555"]`: `elˈli` for `eˈlːi`).
- ⚠ The editing tool again wrote the de-grouping step's `\u00a0\u202f\u2009` escapes as literal characters (two
  literals); rewritten. The audit's remaining misses are the `format!` templates (era, magnitude, square-measure,
  coordinate and TOKEN patterns), each compared by hand with its `new RegExp` template, plus the SYMBOL_DATA JSON.
  `[CСcс]` matches the TS byte for byte. Sources and ports are NFC (the only combining mark in the Rust is U+0361
  in the pinned IPA).

## Run 5 — 2026-10-15 00:40 (reading for correctness: TS findings)

**Command.** `npx tsx try.mts crh …`. Rust reproduces each; the inputs are in probes/crh.txt.

**Raw finding.**
1. **The percent step glues the NEXT WORD on as a case suffix**: step 1's `(\d)\s?%\s?-?\s?(\p{Ll}{1,4})` makes the
   hyphen and both spaces optional, so any short lowercase word after a percent is taken: `Bu 50% ve 30% faiz` →
   *eˈlːi fɑizˈve oˈtuz fɑizfɑˈiz*, `50% az` → *fɑiˈzɑz*. Its comment's case is the hyphenated `0,7%-ine`.
2. **A spaced hyphen used as a dash before a number reads as minus**: `Uzunlığı - 5 km` → *… miˈnus ˈbeʃ …* (step 9's
   `[-−–]\s?(\d)` after a space).
3. **No scale above milliard**: `1000000000000` → *ˈbiŋ milːiˈɑrd*.

**Implication.** Reported in the PR, not fixed. Nothing port-pending.

## Run 6 — 2026-10-15 00:41 (after `cargo fmt` and four more probes)

**Command.** `run.sh … crh crh-normalize crh-g2p crh-numbers`; `parity crh`.

**Raw finding.** crh-normalize 1,719, crh-g2p 70,582, crh-numbers 32,066, phonemize-sync / phonemize-best / trace
271 each, symbols 3,272: 0 DIFFER. parity 200/200.

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
- crh: crh-normalize 1,719, crh-g2p 70,582, crh-numbers 32,066, phonemize-sync / phonemize-best / trace 271 each, symbols 3,272: 0 DIFFER; parity 200/200.

**Implication.** Done on this machine. The large `.probe/` dumps and `rust/target` are deleted after this run.
