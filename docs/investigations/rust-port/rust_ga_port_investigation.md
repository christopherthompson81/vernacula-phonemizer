# Rust port: Irish (ga)

Part of #1463, the "west" group (cy, ga, gd, eu, sq, ast, an, oc). Method as in rust_cy_port_investigation.md:
per-module `fn-diff` differentials, then the public entries end to end (sync, best, trace), then the golden gate.

Irish is lexicon-first: the ~7.5k-row Connacht lexicon (keyed lowercase, no fold), else a broad/slender rule g2p
(`g2p.ts`: word-initial eclipsis, lenition digraphs, doubled consonants, longest-match vowel clusters, each
consonant's quality from its flanking vowel letters) with nasal assimilation, svarabhakti, the i-offglide,
first-syllable stress and unstressed reduction (`irish.ts`). A normalizer for era markers, the `Nú` ordinal (with
its enclosed noun and t-prothesis), ranges, clocks, decimals, fractions, degrees, rates and signs; numbers with the
counting/attributive series and the lenition/eclipsis mutations; the shared symbol tier.

## Run 1 — 2026-10-15 01:42 (the import closure)

**Command.** Read irish.ts, g2p.ts, normalize.ts, numbers.ts, manifest.ts and their imports; the TS suite through
the recording vitest shim (`west/pins.mts test/irish.test.ts`); the symbol literal through `west/symdata.mts`.

**Raw finding.**
- Core imports: `clauses`, `hostWord`, `latinPhones`, `loadTsv` (required, no fold), `loadManifest`, `initialisms`,
  `normalizeSymbols`, `provenance` — all ported. No other language's module; no neural entry; no `ROMAN_POLICIES`
  entry; FLEURS `ga_ie`.
- The in-code tables indexed with a matched string (`ECLIPSIS[two]`, `UNIT_ORD`/`TENS_ORD[word]`, the compass and
  unit literals) only ever see keys from closed alternations or from the number words; the `[NSEW]` compass class
  carries `giu`, so `ſ` matches and `"ſ".toUpperCase()` is `S` — found, not a miss.
- Pins: test/irish.test.ts 20,101 calls / 20,125 expects, 0 failures. 19,981 of them are the `0..20000` property
  loop (`not.toMatch(/undefined|NaN|[0-9]/)`); `west/trim_loop.py` drops that loop from the Rust table (fn-diff's
  `words` op replays 0…20,000 exhaustively), leaving 120 calls.

**Implication.** Port manifest → g2p → numbers → normalize → irish.

## Run 2 — 2026-10-15 01:47 (first build, the golden gate; escapes)

**Commands.** `grep -nP '[\x{00a0}\x{200b}-\x{200d}\x{feff}]'` over the new files; `perl -CSD` to restore;
`west/audit_regex.py` and `west/audit_plain.py` (a new check for the non-raw `js_re!("…")` / `JsRegex::new("…")` /
nativiser strings); `./target/release/parity ga`.

**Raw finding.** The editing tool had written all four escapes of the zero-width class `[​‌‍﻿]`
and both ` `s (the dotted-capital and ordinal rules) as literal characters; restored. The same happened to the
`​`/` ` escapes in the new dump.mts blocks (restored there too, so no invisible character is committed).
Audit: 53 raw patterns, 2 not verbatim — the symbol JSON, and `"^r"` misread as a raw-string opener (a false
positive); 16 plain patterns, all verbatim. `ga: 200/200 identical, 0 differ`.

## Run 3 — 2026-10-15 01:52 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `ga-normalize`, `ga-g2p`, `FLEURS_DIR` `ga: "ga_ie"`, one `fn-diff` arm;
`west/e2e.sh <wt> ga ga ga-normalize ga-g2p phonemize-sync phonemize-best phonemize-trace trace`. Inputs: the golden
(110 texts), FLEURS ga_ie columns 3 and 4 (3,789 texts), the new synthetic `probes/ga.txt` (26 lines).
- `ga-normalize`: `normalizeIrish`, the recorded tier and `createIrish().text` over every text plus 1,724 synthetic
  rows (each zero-width character, era markers × tails, US$, dotted capitals, Dr./etc., `Nú` over 0…120 × 8
  article/noun frames, ranges, the clock over a 7 × 4 × 10 grid, decimals with every unit, a slash and `mſu`, comma
  decimals, fractions over 13 × 22, degrees and compass points incl. `ſ`, rates, signs, the percent-after-pointe
  rule); `ordinalWords` over −2…2,000 and corners, with and without a noun.
- `ga-g2p`: `phonemizeWord`, `g2pWord`, `toSegments` and `nat` over every letter run, every lexicon key, every 1–3
  letter string of 33 letters, every 4-letter string over `aeiouáóbdghlnrst`, eclipsis/lenition prefix grids,
  corners; `numberToWords` over 0…20,000, magnitudes, raw strings with a sign.

**Raw finding.** First build, every one:
```
ga-normalize: 20977 identical, 0 DIFFER   (golden 330 / fleurs 11367 / probe 78 / synthetic 5172, + 4030 ordinal)
ga-g2p: 511130 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 3925 identical, 0 DIFFER each
```
Texts the normalizer changes: golden 13/110, FLEURS 319/3,789, probes 19/26, synthetic 1,552/1,724. No first-row
`nativised` trace difference (the lexicon has no fold).

**JS semantics reproduced on purpose.** The scan walks CODE UNITS, `w[i - 1] ?? ""` at the word start; the
out-of-range number fallback reads `String(n)` (sign included, then filtered to ASCII digits per code point); the
vowel clusters are stably sorted; `epenthesis`/`offglide` splice while iterating downwards.

**Guard check.** The ⟨eo⟩ `noGlide` flag forced false: `ga-g2p: 508471 identical, 2659 DIFFER`. Restored: 0 DIFFER.

## Run 4 — 2026-10-15 01:54 (reading for correctness: TS findings, reported not fixed)

**Command.** `WT=<wt> N=languages/irish/normalize.ts FN=normalizeIrish npx tsx west/t.mts ga <texts>`.

**Raw finding (TS output, verbatim):**
1. **A clause-final score loses its connective.** `Bhuaigh siad 5-3.` → normalized unchanged → *ˈa kˈuːɟ ˈa tʲɾʲˈiː
   .*, while `5-3 inné` → `5 go dtí 3`. The range rule's right guard is `(?![\d.])`, the playbook trap 58 shape that
   welsh/normalize.ts already fixed to `(?![\d]|\.\d)` with the same symptom.
2. **A half reads as "the second".** `thart ar 1/2 méadar` → `an dara méadar`; `3/2` → `a trí dara`. The fraction
   rule takes every denominator's noun from `ordinalWords`, which has no `leath` for 2 (Welsh special-cases
   `hanner`).
3. **A glued metre reads as the letter.** `Rith sé 1.5m.` → `1 pointe a cúig m` → *… mˠ .*: the version-letter rule
   runs before the decimal-unit rule, as in Welsh.

**Implication.** Reported; the Rust reproduces all three.

## Run 5 — 2026-10-15 01:55 (TS suite pins, gates)

**Raw finding.** irish.rs pins 120 calls (36 `phonemize`, 44 `phonemizeWord`, 18 `normalizeIrish`, 21
`numberToWords`, 1 `ordinalWords`); `cargo test irish`: 1 passed. `parity` (all): every language byte-identical
but mag and tt at their known 199/200; `ga: 200/200`. clippy: only `module_inception` in the new files. No
port-pending rows.

## Run 6 — 2026-10-15 03:20 (the gates, rebased onto main after #1579 and the second Turkic group #1580)

**Commands.** `git rebase origin/main` (conflicts in registry.rs, dump.mts and languages/mod.rs only, rebuilt per
commit by `west/resolve.py` from upstream plus this language's own block; dump.mts parse-checked with esbuild after
each), `cargo fmt`; then `west/gates.sh` on the combined tree: `cargo fmt --check`, `parity` (all), `cargo test
--release`, `regex-diff`, `cargo clippy --workspace --release`, every west per-module dump re-dumped and replayed, and
`LANGS=cy,ga,gd,eu,sq,ast,an,oc` `phonemize-sync` / `phonemize-best` / `phonemize-trace` / `trace`.

**Raw finding.**
```
fmt: clean
parity: all 81 language lines byte-identical except mag 199/200 and tt 199/200 (both known port-pending Arabic rows)
cargo test: 275 passed, 0 failed (+1 doc test)
regex-diff: 146326 probe results identical, 0 DIFFER, 0 patterns refused
clippy: in the new files only module_inception (the fn-diff main.rs:651 warning predates)
cy-normalize 21609 / cy-g2p 359050 / ga-normalize 20977 / ga-g2p 511130 / gd-normalize 7554 / gd-g2p 331028 /
eu-normalize 2528 / eu-g2p 142643 / sq-normalize 1838 / sq-g2p 215786 / ast-normalize 11817 / ast-g2p 295456 /
an-normalize 1041 / an-g2p 295860 / oc-normalize 12339 / oc-g2p 314896: all identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 16653 identical, 0 DIFFER each
```

## Run 7 — 2026-10-15 22:30 (#1585: the TS defects this port reproduced, fixed in all three engines)

- **Clause-final score.** `5-3.` read with no connective, because the range rule's right guard was `(?![\d.])` (trap 58). It is now `(?!\d|\.\d)`, the same as Welsh. `5 go dtí 3.` is kept, and a decimal continuation is still declined.
- **`1/2`.** It read *an dara* ("the second"). A unit fraction over 2 is now *leath*, the word the file's own `½` rule uses.
- **Glued metre.** `4.5m` read the letter, the same order bug as cy. The decimal-with-unit rule now runs before the version letter.

All probes are synthetic. Each fix was made in TS first and mirrored to C# and Rust. Tests: `test/west-defects-1585.test.ts`, `WestDefects1585Tests.cs`, and a `defects_1585_tests` module in this language's `normalize.rs`. Every new test fails with its fix reverted.
