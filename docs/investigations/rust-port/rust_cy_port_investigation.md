# Rust port: Welsh (cy)

Part of #1463, the "west" group (cy, ga, gd, eu, sq, ast, an, oc). Method as in rust_da_port_investigation.md and
rust_lb_port_investigation.md: per-module `fn-diff` differentials, then the public entries end to end (sync, best,
trace), then the golden gate.

Welsh is a rule engine with a small kaikki lexicon: a longest-match grapheme scanner (`g2p.ts`: digraphs, the
word-initial nasal mutation, vowel clusters with their offglides, ⟨w i y⟩ resolved in context), penultimate stress and
the vowel-length rule (`welsh.ts`), a normalizer for ordinals, ranges with the soft mutation after `i`, clocks,
version dots, fractions, signs and initialisms (`normalize.ts`), decimal-system numbers (`numbers.ts`), and the shared
symbol tier.

## Run 1 — 2026-10-15 01:15 (the import closure, baseline)

**Question.** What does `src/languages/welsh/` need that the Rust core lacks, and is there a neural side?

**Command.** Read welsh.ts, g2p.ts, normalize.ts, numbers.ts, manifest.ts and their imports;
`grep -nE '"(cy|ga|gd|eu|sq|ast|an|oc)"' src/registry.ts src/neuralRegistry.ts`; `ls <FLEURS_ROOT>`; the TS suite
through the recording vitest shim (`west/pins.mts test/welsh.test.ts`).

**Raw finding.**
- Core imports: `clauses`, `hostWord` (`hostWordRun`, `makeNativiser`), `latinPhones`, `loadTsv` (`loadTsvMap`,
  optional, no fold), `loadManifest`, `initialisms` (`makeInitialismNormalizer`, `makeUnreadableTest`),
  `normalizeSymbols`, `provenance` (`rewrite`) — all ported. No other language's module is imported.
- No neural entry (`src/neuralRegistry.ts` names none of the group), no `ROMAN_POLICIES` entry. FLEURS has `cy_gb`.
- The manifest is parsed through `parseJsonc`, which strips the prototype, so `EXCEPTIONS["constructor"]` is
  undefined (checked: `phonemize("constructor","cy")` → *kɔnstrˈɨktɔr*). The in-code tables (`LETTER_NAME`, `SOFT`,
  `CLIP`, `FEM`, `ROUND_TENS`, the decimal-unit literal) are only ever indexed with keys from closed alternations.
- Pins: test/welsh.test.ts 104 calls / 109 expects, 0 failures.

**Implication.** Port manifest → g2p → numbers → normalize → welsh, one file each.

## Run 2 — 2026-10-15 01:28 (first build, the golden gate; escapes)

**Commands.** `grep -nP '[\x{00a0}\x{202f}\x{2009}]'` over the new files straight after writing them; `perl -CSD` to
restore; `west/audit_regex.py` (raw patterns) plus a check of every non-raw `js_re!("…")` / class string against the
TS source; `cargo build --release -p parity && ./target/release/parity cy`.

**Raw finding.** The editing tool had again written the ` ` of the dotted-capital rule (`[  ]?`) as a
literal NBSP; restored before the build. Audit: 52 raw patterns, 1 not verbatim — the symbol JSON, checked by hand;
the non-raw ones (`[ᶤᶦᶷᵘ]`, `[a-z]`, `,`, `±`, the nativiser class and the unreadable-test vowel class) all occur
verbatim in the TS. Then `cy: 200/200 identical, 0 differ` on the first build.

## Run 3 — 2026-10-15 01:32 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `cy-normalize`, `cy-g2p`, a `FLEURS_DIR` entry `cy: "cy_gb"`, one `fn-diff` arm;
`west/e2e.sh <wt> cy cy cy-normalize cy-g2p phonemize-sync phonemize-best phonemize-trace trace`. Inputs: the golden
(98 texts), FLEURS cy_gb columns 3 and 4 (3,921 texts; first row checked to be a sentence) and the new synthetic
`probes/cy.txt` (29 lines, one or more per normalize.ts arm with its neighbour, plus g2p corners).
- `cy-normalize`: `normalizeWelsh`, the recorded symbol tier over its output and `createWelsh().text`, over every text
  plus 2,476 synthetic rows (era markers × tails, the currency prefixes and DU/UDA/AS/UD in each case, dotted capitals
  with NBSP and non-ASCII capitals, ayb., ordinals 0…220 × 8 suffixes, decades, the timezone hyphen, clock and number
  ranges with every unit and a following sign, clocks over a 7 × 4 × 9 hour/minute/marker grid, dot clocks, version
  dots, decimals with units, comma decimals, fractions over 13 × 19 numerators/denominators, degrees, rates, signs);
  `ordinalWords` over −2…2,000 and corners; `soften` over 25 words incl. `İ`, a lone surrogate and an astral letter.
- `cy-g2p`: `phonemizeWord`, `toSegments` (ph/nucleus/long per segment) and `nat` over every letter run, every
  lexicon key, every 1–3 letter string of 36 letters, every 4-letter string over `aeiouwyngchdlsr`, enclitic forms,
  corners (`İ`, `ſ`, lone surrogates, astral letters, `constructor`); `numberToWords` over 0…20,000, magnitudes, raw.

**Raw finding.** First build, every one:
```
cy-normalize: 21609 identical, 0 DIFFER   (golden 294 / fleurs 11763 / probe 87 / synthetic 7428, + 2037 ordinal/soften)
cy-g2p: 359050 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 4048 identical, 0 DIFFER each
```
How much of the haystack the normalizer touches (`west/changed.py`): golden 14/98, FLEURS 294/3,921, probes 21/29,
synthetic 951/2,476 texts changed by `normalizeWelsh`. No first-row `nativised` trace difference: the Welsh lexicon
has no fold, so the lazy-load leak of the da/sv logs cannot occur here.

**JS semantics reproduced on purpose.** The scan walks CODE UNITS (`w[i]`, `w[i + 1] ?? ""`); the vowel clusters are
sorted by length with a STABLE sort; the out-of-range number fallback keeps only the ASCII digits of each code point;
`LENGTHENS` is a set of code points.

**Guard check.** The -au reduction's "a nucleus precedes" condition removed: `cy-g2p: 358821 identical, 229 DIFFER`.
Restored: 0 DIFFER.

## Run 4 — 2026-10-15 01:38 (reading for correctness: TS findings, reported not fixed)

**Command.** `WT=<wt> N=languages/welsh/normalize.ts FN=normalizeWelsh npx tsx west/t.mts cy <texts>`.

**Raw finding (TS output, verbatim):**
1. **A glued metre reads as the letter [m].** `Neidiodd 4.5m o uchder.` → normalized `4 pwynt pump m` → *… pˈɨmp m …*,
   while `4.5 m` → `metr`. Step 7's version-letter rule (`802.11n`, `(?=[a-z](?![\p{L}\p{M}]))`, flag `i`) runs
   BEFORE the decimal-unit rule, so it claims a glued one-letter unit, against the file's own "UNITS ARE RESOLVED
   BEFORE DECIMALS".
2. **Two spellings of kilometre, one of them the form the file argues against.** The range and decimal rules expand
   `km` through `UNIT_WORD` / the decimal literal as *cilometr*, while the tier reads *cilomedr* — and welsh.ts's
   own SYMBOLS note measures `cilometr` at ×0 in the corpus and an audible [t] where Welsh says [d]:
   `Rhedodd 12 km` → *kilˈɔmɛdr*, `Rhedodd 12.8 km` → *kilˈɔmɛtr*, `Rhedodd 2-3 km` → *… drˈiː kilˈɔmɛtr*.
3. **A zero denominator reads as an ordinal.** `1/0 modfedd` → *un dimfed modfedd* ("one zeroth"); the fraction rule
   accepts any denominator `ordinalWords` answers, and it answers 0.

**Implication.** Reported in the PR; the Rust reproduces all three byte for byte.

## Run 5 — 2026-10-15 01:40 (TS suite pins, gates)

**Changes.** welsh.rs gains a test module: all 104 calls test/welsh.test.ts makes (49 `phonemize`, 40
`phonemizeWord`, 12 `normalizeWelsh`, 2 `soften`, 1 `ordinalWords`), extracted by `west/pins.mts`.

**Raw finding.** `cargo test welsh`: 1 passed. `parity` (all languages): every line byte-identical but mag and tt at
their known 199/200 (port-pending Arabic rows); `cy: 200/200`. clippy: in the new files only `module_inception`
(a `sort_by_key` and two collapsible ifs fixed). `cargo test --release`: 261 passed, 0 failed (+1 doc test);
`regex-diff`: 146326 probe results identical, 0 DIFFER, 0 refused; `cargo fmt --check` clean. No port-pending rows.

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

- **Glued metre.** `4.5m` read *… pump m* (the letter). The version-letter rule (`802.11n`) ran before the decimal-with-unit rule and claimed the `m`. The corpus's version letters are `a b g n`, all after `802.11`, so I moved the unit rule first. Now `4.5m` = `4.5 m`, and `802.11n` is unchanged.
- **km.** `UNIT_WORD` and the decimal rule's literal both said *cilometr*, while the tier and welsh.ts's own measurement say *cilomedr*. Both are now *cilomedr*, so `km` reads the same after a range, after a decimal and on its own.
- **`1/0`.** It read *un dimfed* ("one zeroth"). A denominator below 2 is now declined, so the figures read as written (`1/1` read *un cyntaf* the same way).

All probes are synthetic. Each fix was made in TS first and mirrored to C# and Rust. Tests: `test/west-defects-1585.test.ts`, `WestDefects1585Tests.cs`, and a `defects_1585_tests` module in this language's `normalize.rs`. Every new test fails with its fix reverted.
