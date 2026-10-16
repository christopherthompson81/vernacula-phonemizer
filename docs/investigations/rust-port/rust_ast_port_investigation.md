# Rust port: Asturian (ast)

Part of #1463, the "west" group (cy, ga, gd, eu, sq, ast, an, oc). Method as in rust_cy_port_investigation.md and
the Romance logs (rust_gl_port_investigation.md).

Asturian is a rule engine with no lexicon and no neural entry: a longest-first digraph + grapheme scan over the NFC
lowercase (code units) with the ⟨qu gu gü⟩, distinción ⟨c⟩, rising-glide and ⟨y⟩ context rules and nasal place
assimilation before a labial (`asturian.ts`, which declares its own manifest slice, symbol tier included); stress and
spirantization are deliberately folded (the file header says so). Numbers (`numbers.ts`, its own manifest slice) and
a normalizer for grouping, the dot decimal, era markers, dates, clocks, degrees, minus and ranges.

## Run 1 — 2026-10-15 02:34 (the import closure)

**Command.** Read asturian.ts, numbers.ts, normalize.ts and their imports; `west/pins.mts`.

**Raw finding.**
- Core imports: `clauses`, `latinPhones`, `hostWord`, `loadManifest`, `normalizeSymbols`, `numbers` (`digitIndex`),
  `boundaries`, `provenance` — all ported. No other language's module, no neural or `ROMAN_POLICIES` entry. FLEURS
  `ast_es`.
- The symbol tier is built from the manifest's `symbolTier` (field by field, as spanish.rs does); its
  `exponentWords.position` is optional in the TS interface, the only `#[serde(default)]` here.
- The TOKEN's extras are `'·` and `[.!?…,;:]` inside TS template literals, so the TS regex SOURCE holds the
  literal `·` / `…`; the Rust builds the same code points.
- Pins: test/asturian.test.ts 68 calls / 66 expects, 0 failures.

**Implication.** Port numbers → normalize → asturian.

## Run 2 — 2026-10-15 02:37 (first build, the golden gate; escapes)

**Raw finding.** The grouping class `[    ]` (both uses) was written with literal characters;
restored. Audit: 17 raw patterns, 1 not verbatim (the degree-tail `format!` template; the era, date and TOKEN
templates checked by hand against the TS template strings, `DEGREE_TAIL` itself verbatim); 1 plain pattern
verbatim. `ast: 200/200 identical, 0 differ`.

## Run 3 — 2026-10-15 02:40 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `ast-normalize`, `ast-g2p`, `FLEURS_DIR` `ast: "ast_es"`, one `fn-diff` arm;
`west/e2e.sh … ast …`. Inputs: the golden (121 texts), FLEURS ast_es columns 3 and 4 (3,657 texts), probes/ast.txt
(14 lines), 147 synthetic rows (grouping, era markers × 6 tails, Roman months incl. XIII/IIII/VV, numeric months
0…13, the clock over 7 × 5, degrees with each tail, minus forms, ranges with their declining neighbours).
`ast-g2p`: `phonemizeWord` and `nat` over every letter run, every 1–3 letter string of 38 letters (incl. ḥ ḷ ·),
every 4-letter string over `aeiouüqgcynrlbpm`, corners (decomposed ḷḷ and ñ); `numberToWords` over 0…20,000,
magnitudes, raw strings.

**Raw finding.**
```
ast-normalize: 11817 identical, 0 DIFFER   (golden 363 / fleurs 10971 / probe 42 / synthetic 441)
ast-g2p: 295456 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 3792 identical, 0 DIFFER each
```
Texts the normalizer changes: golden 5/121, FLEURS 260/3,657, probes 8/14, synthetic 113/147.

**JS semantics reproduced on purpose.** `G[c] ?? latinPhone(…)` keeps the manifest's empty ⟨h⟩ (`""` is not
nullish), which the `ph !== ""` test then drops; the out-of-range number passes a non-digit code point through as
itself (`ONES[digitIndex(d)] ?? d`); the era callbacks read `full.slice(offset + m0.length)`.

**Guard check.** The ⟨gü⟩ arm of the glide rule (`next === "ü" ||`) removed: `ast-g2p: 295296 identical, 160
DIFFER`. Restored: 0 DIFFER.

## Run 4 — 2026-10-15 02:41 (reading for correctness)

**Command.** `WT=<wt> N=languages/asturian/normalize.ts FN=normalizeAsturian npx tsx west/t.mts ast …`.

**Raw finding.** Nothing reported. `3.141` → `3141` is the dot-thousands convention this layer follows (unlike gd/sq,
whose own decimal mark is the one being consumed); ranges read as a pause (`1990, 2000`) and the missing stress are
both documented choices in the file.

## Run 5 — 2026-10-15 02:42 (TS suite pins, gates)

**Raw finding.** asturian.rs pins all 68 calls; `cargo test asturian`: 1 passed. `parity` (all): every language
byte-identical but mag and tt at their known 199/200; `ast: 200/200`. clippy: only `module_inception`. No
port-pending rows.

## Run 6 — 2026-10-15 02:51 (a finding carried back from the Aragonese reading)

**Command.** `WT=<wt> npx tsx west/t.mts ast "a les 9:00 hores" "a les 9:05"`.

**Raw finding (TS output, verbatim).** `a les 9:00 hores` → *a les nwebe θeɾo oɾes*; `a les 9:05` → *a les nwebe
θinko*. The clock rule is `$1 $2`, so the tokenizer reads `00` as *cero* and `05` as *cinco* (the minutes' zero
dropped, nothing marking them as minutes). Run 4's "nothing reported" is superseded: this is a TS finding, reported
with the identical Aragonese one (rust_an_port_investigation.md Run 4); the Rust reproduces it.

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

## Run 8 — 2026-10-15 22:30 (#1585: the TS defects this port reproduced, fixed in all three engines)

- **`9:00`.** It read *nueve cero*. `:00` is now the hour alone, as es, ca and gl read it.
- **`9:05` → *nueve cinco*: DECLINED.** This matches the closest sibling convention: es and ca read `hour minute` with no conjunction (*nwˈeβe θˈinko*), while gl, pt and it insert *e*. No Asturian-specific source for a conjunction was found.

All probes are synthetic. Each fix was made in TS first and mirrored to C# and Rust. Tests: `test/west-defects-1585.test.ts`, `WestDefects1585Tests.cs`, and a `defects_1585_tests` module in this language's `normalize.rs`. Every new test fails with its fix reverted.
