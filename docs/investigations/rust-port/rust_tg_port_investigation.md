# Rust port: Tajik (`tg`)

Branch `worktree-agent-a123e70f02c70c7cd`, on top of ba, crh, kaa, nog and chv. Part of #1463, the last of the second
Turkic group (Tajik is Iranian, grouped here for its Cyrillic). Method as in rust_ba_port_investigation.md.

## Run 1 — 2026-10-15 01:29 (the import closure)

**Question.** What does `src/languages/tajik/` need, and is there FLEURS text?

**Command.** Read tajik.ts, manifest.ts, normalize.ts and their imports; `ls $FLEURS_ROOT/tg_tj`.

**Raw finding.**
- Core imports: `clauses`, `loadManifest`, `normalizeSymbols`, `initialisms`, `provenance`. All ported. No other
  language's module, no neural entry, no Roman policy.
- ⚠ An import CYCLE kept as the TS has it: normalize.ts imports `numberWords` from tajik.ts, which imports
  normalize.ts. Rust modules may refer to each other, so `normalize.rs` uses `super::tajik::number_words`.
- The data is all in tajik.jsonc (manifest.ts); `TajikManifest` names every field, and the symbol tier is BUILT
  from `symbolTier` in the TS field order (as russian does), not copied as a JSON constant. `validate` refuses a
  short `units` / `teens` / `months` at load (the TS would stringify `undefined`); `tens` keeps the TS's
  `undefined` stringification for a missing key.
- FLEURS tg_tj ships all three splits (train 2,298, dev 240, test 600 lines; column 3 of the first line checked: a
  sentence). `tg: "tg_tj"` added to dump.mts's `FLEURS_DIR`.

## Run 2 — 2026-10-15 01:33 (the golden gate)

**Command.** `./target/release/parity tg` and `--sync tg`.

**Raw finding.** `tg: 200/200 identical, 0 differ`. `--sync`: 198/200, both the same lead with an embedded English
OOV (`Panthera`: *pʰˈænthɪɹə* sync against *pɑːnθˈɛɹə* in the golden), the sync n-gram reading against the async
BiLSTM one the golden records (as for chv and tt). phonemize-sync below shows the two SYNC paths agree.

⚠ A slip caught before any number was trusted: the editing tool wrote step 0's `\u00ad` (SOFT HYPHEN) as a literal
character in `js_re!(r"…")`. `escape_ws.py` did not catch it: its class held the space-like characters only. The
class is now every Cf / Zs / Zl / Zp / Cc character above U+007F; re-run over all six ports, this was the only one.

## Run 3 — 2026-10-15 01:38 (differentials, FLEURS included)

**Command.** `run.sh <worktree> tg tg-normalize tg-g2p tg-numbers` (phonemize-sync, phonemize-best and trace over
the golden, FLEURS and probes with `LANGS=tg`).

**Raw finding.**
```
tg-normalize: 37002 identical, 0 DIFFER   (fleurs, golden, probe 380, synthetic 5955, words 12492; ops normalize,
              initialisms on raw and normalized, symbols, engine, unreadable)
tg-g2p:       64119 identical, 0 DIFFER  (including every text word in NFD)
tg-numbers:   58133 identical, 0 DIFFER  (numberWords, tajikOrdinal, the engine's number reading)
phonemize-sync / phonemize-best / trace: 3711 identical, 0 DIFFER each
symbols:      6707 identical, 0 DIFFER   (probe 3072, tajik 3635)
```
**Haystack.** normalize changed 256 of 3,506 FLEURS rows, 11 of 129 golden, 52 of 76 probe and 963 of 1,191
synthetic; the tier 68 FLEURS rows; the initialism pass 58 FLEURS inputs.

**Is the replay sensitive?** The hiatus [j] before и / ӣ disabled → `tg-g2p: 10336 DIFFER`; `сӣ → сиюм` disabled →
`tg-normalize: 11 DIFFER`, `tg-numbers: 200 DIFFER`. Restored, identical again.
⚠ Negative result: the space de-grouping's THREE passes cut to ONE changed nothing (`0 DIFFER` over 37,002 rows),
the same as nog's separatorHygiene loop (Run 5).

## Run 4 — 2026-10-15 01:42 (the TS suite as a Rust test; the regex audit)

**Command.** `pins.mts test/tajik.test.ts`, `append_pins.py`; `audit_regex.py`, `escape_ws.py`, `cps.py`, `nfc_check.py`.

**Raw finding.**
- 49 calls pinned, 1 skipped (the engine object), 49 matchers, 0 failures; plus the suite's one expectation on a
  manifest VALUE (`MANIFEST.numbers.and`), extracted from the test source and replayed against the Rust manifest.
  The test passes; with е-iotation disabled it FAILS (`phonemizeWord["эронӣ"]`: `erɔnˈi` for `jerɔnˈi`).
- The space-group escapes were literal again; rewritten. Remaining audit miss: the `format!` degree template, checked
  by hand, as were the percent-suffix, case-suffix and Celsius templates. `[CСcс]` and `[Сс]` match the TS by code
  point.

## Run 5 — 2026-10-15 01:44 (reading for correctness: TS findings)

**Command.** `try.mts tg …`; the one-pass break of Run 3.

**Raw finding.**
1. **Past 10¹⁵ the compositor silently drops the leading digits.** `three`'s `h > 9` refusal, commented "never
   reachable once the ladder covers the magnitude", IS reached for a trillion multiplier of 1000 or more, and
   `numberWords` has no safe-integer or digit-at-a-time fallback (unlike the other engines in this group):
   `1000000000000000` → *trilliˈɔn* ("one trillion", a 1000× error), and `9007199254740993` → *trilliɔnˈu sadˈu …*,
   the 9007 gone. Any 16-digit run reads a different quantity with no marker.
2. **The minus sign is dropped**: `-5 дараҷа` → *pˈand͡ʒ darad͡ʒˈa*. No sign rule exists.
3. **The de-grouping's three passes are one productive pass** (lookaround-only pattern), as in core/separatorHygiene.

**Implication.** Reported, not fixed. Nothing port-pending.

## Run 6 — 2026-10-15 01:46 (after `cargo fmt` and two more probes)

**Command.** `run.sh … tg tg-normalize tg-g2p tg-numbers`; `parity tg`.

**Raw finding.** tg-normalize 37,012, tg-g2p 64,119, tg-numbers 58,133, phonemize-sync / phonemize-best / trace
3,713 each, symbols 6,707: 0 DIFFER. parity 200/200.

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
- tg: tg-normalize 37,012, tg-g2p 64,119, tg-numbers 58,133, phonemize-sync / phonemize-best / trace 3,713 each, symbols 6,707: 0 DIFFER; parity 200/200.

**Implication.** Done on this machine. The large `.probe/` dumps and `rust/target` are deleted after this run.

## Run 8 — 2026-10-15 20:35 (#1581 fixes, TS-first, mirrored to C# and Rust)

**Question.** Do the #1581 tg defects reproduce, and what is the fix shape? Tool: `try.mts tg …` (synthetic probes).

**Found.**
- `1000000000000000` read *trilliˈɔn*. The trillion multiplier was 1000, `three` refuses any group over 999, and
  the leading digits vanished with no marker.
- `9007199254740993` dropped its `9007` and read the rounded double.
- The fixed-point loop around the space-group join never did more than one pass's work, and `0 000 000` came
  out half joined.

**Done.**
- An oversized multiplier is composed in full: 10¹⁵ → *ҳазор триллион*, the kk shape from #1576.
- A digit run past 2⁵³ is read digit by digit (`digitWords`). Its callers are the number token and the
  numeral+enclitic rule.
- The space-group join is now core/separatorHygiene.ts `joinSpaceGroups`: the whole run in one pass, and a
  standalone-`0` run refused whole.

**Declined: the minus.** `-5 дараҷа` → *five* stays as it is. normalize.ts records it as a measured refusal:
`манфӣ` fails on sense, and most dash-before-digit shapes in the corpus are not negatives.

**Goldens.** tg moved 0 rows.
