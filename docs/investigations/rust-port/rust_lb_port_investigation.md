# Rust port: Luxembourgish (lb)

Part of #1463, the "germanic" group (da, nb, af, lb, bar). Method as in rust_da_port_investigation.md.

Luxembourgish is a rule engine with no lexicon and no neural entry: a greedy longest-match grapheme scan over UTF-16
code units, then seven token passes (stress and short-⟨e⟩ realization, onset ⟨s⟩ voicing, initial ⟨st sp⟩, geminate
collapse, the velar nasal, intervocalic g-spirantization, devoicing). A normalizer resolving the four jobs of the
period (grouping / clock / ordinal / neither), licensed ordinals with the Eifeler Regel, the shared symbol tier, and
numbers through the shared units-first compositor (`danish/unitsFirstNumbers.ts`, reused) with the Eifeler Regel on
the connector and across a number's right edge.

## Run 1 — 2026-10-15 02:05 (the import closure)

**Command.** Read luxembourgish.ts, normalize.ts, numbers.ts and their imports.

**Raw finding.**
- Core imports: `clauses`, `latinPhones`, `hostWord` (`hostWordRun`, `makeNativiser`), `loadManifest`,
  `normalizeSymbols`, `ipa` (`IPA_VOWEL`), `provenance` — all ported; `unitsFirstNumbers` reused from danish/.
- No manifest.ts: luxembourgish.ts and numbers.ts each declare their own slice of luxembourgish.jsonc, so the Rust
  does the same (`LuxDef` in luxembourgish.rs, `LuxNumbersDef` in numbers.rs) rather than inventing a module.
- No neural entry, no `ROMAN_POLICIES` entry; FLEURS `lb_lu`. Symbol literal recorded:
  `{"multiply":{"times":"mol"},"percent":["Prozent"],"currency":{"$":["Dollar"],"€":["Euro"],"¥":["Yen"]},"units":{"km":["Kilometer"],"m":["Meter"],"cm":["Zentimeter"],"mm":["Millimeter"],"kg":["Kilogramm"]},"magnitudes":["Milliounen","Millioune","Millioun","Milliarden","Milliard"],"unitPer":{"h":"an der","s":"pro"},"rateDenominators":{"h":"Stonn","s":"Sekonn"},"exponentWords":{"squared":["Quadrat"],"cubed":["Kubik"],"position":"compound"}}`.
- Pins: test/luxembourgish.test.ts 158 calls / 152 expects, 0 failures.

## Run 2 — 2026-10-15 02:25 (first build, the golden gate; escapes)

**Commands.** `grep -nP '[\x{00a0}\x{202f}\x{2009}]'` over normalize.rs straight after writing it; `perl -CSD` to
restore; `cargo build --release -p parity && ./target/release/parity lb`.

**Raw finding.** The editing tool had again written every `\u00a0` / `\u202f` / `\u2009` escape (the `SP` class and the
six relational/ampersand patterns, 7 lines) as literal characters; restored before the first build. Then
`lb: 200/200 identical, 0 differ`. The Eifeler keeper string `aeiouäëéèáâôûüy` compared by code point against the
TS source (`python3`, 15 = 15, identical): no NFC fold.

## Run 3 — 2026-10-15 02:35 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `lb-normalize`, `lb-g2p`, `FLEURS_DIR` entry `lb: "lb_lu"`, one `fn-diff` arm;
`.probe/G/e2e.sh <wt> lb lb lb-normalize lb-g2p phonemize-sync phonemize-best phonemize-trace trace`. Inputs: the
golden (125 texts), FLEURS lb_lu columns 3 and 4 (3,697 texts), the new synthetic `probes/lb.txt`.
- `lb-normalize`: `normalizeLuxembourgish`, the recorded symbol tier over its output and `createLuxembourgish().text`,
  over every text plus 1,398 synthetic rows (grouping in both forms and every separator, era markers × 6 tails, the
  abbreviations incl. the long-s fold, ordinals 0…120 × 9 licensing frames, the clock over a 6 × 5 × 6 grid, sports
  times, fractions, both decimals, ranges, mph, degrees, signs); `applyEifelerRegel` over 9 words × 27 followers
  (capitals, `İ`, `ſ`, a lone surrogate, an astral letter, a pause); `ordinalStem` over −2…2,000 and corners.
- `lb-g2p`: `phonemizeWord` and `nat` over every letter run, every 1–3 letter string of 33 letters, every 4-letter
  string over `aeiouëgsntkdbzpvr`, prefix × stem grids, corners; `numberToWords` over 0…20,000, magnitudes, raw.

**Raw finding.** First build, every one:
```
lb-normalize: 17965 identical, 0 DIFFER   (golden 125 / fleurs 3697 / probe 17 / synthetic 1398 texts × 3 ops,
                                           + 243 eifeler + 2011 stem)
lb-g2p: 302394 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 3839 identical, 0 DIFFER each
```

**JS semantics reproduced on purpose.**
- the abbreviation callbacks' `DOTTED_ABBREV[ab.toLowerCase()]!` STRINGIFIES a miss: the pattern carries `iu`, so a
  long s folds onto `asw` while the key lookup does not (Run 4, finding 1);
- `applyEifelerRegel` reads `following[0]` (one code UNIT) and tests the LOWERCASED unit for membership in a set of
  one-letter strings, so a lowercase that grows (`İ`) deletes the ⟨n⟩;
- `fractionNoun` capitalises `stem.charAt(0)`, one code unit; the scan walks code units, `coreChars` code points.

**Guard check.** The stringified miss replaced by another value: `lb-normalize: 17953 identical, 12 DIFFER` (the
long-s probe rows). Restored: 0 DIFFER.

## Run 4 — 2026-10-15 02:40 (reading for correctness: TS findings, reported not fixed)

**Command.** `WT=<wt> N=languages/luxembourgish/normalize.ts FN=normalizeLuxembourgish npx tsx .probe/G/t.mts lb <texts>`.

**Raw finding (TS output, verbatim):**
1. **The #1122 trap, still open in lb's abbreviation table.** `Dat ass aſw. dann.` → normalized `Dat ass undefined
   dann.` → *dˈat ˈas ˈundəfinət dˈan .* (the same for `AſW.`). ABBREV_MID / _BEFORE_MARK / _END are built from the
   table's own keys and carry `giu`, so JS's simple case fold lets `ſ` match `s`; the callbacks then index the table
   with the lowercased match (which keeps the `ſ`) and assert `!`. The af normalizer guards the same shape
   (`w === undefined ? m0 : …`); lb's three callbacks do not. Rust reproduces the spoken *undefined*.

**Implication.** Reported; the fix is the af guard (return the match on a miss), TS-first.

## Run 5 — 2026-10-15 02:45 (TS suite pins, gates)

**Raw finding.** luxembourgish.rs pins all 158 calls; `cargo test luxembourgish`: 1 passed. Audit: 29 raw patterns,
6 not verbatim — the symbol JSON and five `format!` templates over `SP`, checked by hand against the TS
`String.raw` templates. `parity` (all): every language byte-identical but mag 199/200; `lb: 200/200`. clippy: only
`module_inception`. No port-pending rows.

## Run 6 — 2026-10-15 03:40 (the gates, rebased onto main after the Turkic group landed)

**Commands.** `git rebase origin/main` (conflicts in registry.rs and dump.mts only, rebuilt by
`.probe/G/resolve.py` from upstream plus this language's own block; dump.mts parse-checked with esbuild); then on the
combined tree: `cargo fmt --check`; `cargo run --release -p parity` (all); `cargo test --release`;
`cargo run --release -p regex-diff`; `cargo clippy --workspace --release`; every germanic per-module dump and
`LANGS=da,nb,af,lb,bar` `phonemize-sync` / `phonemize-best` / `phonemize-trace` / `trace`, re-dumped and replayed.

**Raw finding.**
```
fmt: clean
parity: all 67 language lines byte-identical except mag 199/200 and tt 199/200 (both known port-pending Arabic rows)
cargo test: 260 passed, 0 failed (+1 doc test)
regex-diff: 146326 probe results identical, 0 DIFFER, 0 patterns refused
clippy: in the new files only module_inception (registry.rs collapsible_if and structural_tagger.rs type_complexity predate)
phonemize-sync / phonemize-best / trace: 14128 identical, 0 DIFFER; phonemize-trace 14126 / 2 DIFFER — the first da
  and the first nb text (`nativised: "joao"` / `"marta"`), the lazy-lexicon trace note of da Run 3, not reproduced
```
