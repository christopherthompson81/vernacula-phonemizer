# Rust port: Scottish Gaelic (gd)

Part of #1463, the "west" group (cy, ga, gd, eu, sq, ast, an, oc). Method as in rust_cy_port_investigation.md.

Scottish Gaelic is a rule engine with no lexicon and no neural entry: a broad/slender scan (NFC, lowercase, lenition
digraphs, doubled consonants, longest-match vowel clusters), pre-aspiration of a non-initial fortis stop, the ⟨chd⟩
cluster, first-syllable stress and unstressed reduction, all in `scottishgaelic.ts` (which declares its own
manifest slice, as here). A small normalizer (grouping, abbreviations, àireamh, decades, the `Nmh` ordinal, dot
decimals, a leading minus), the numbers compositor (`makeNumberToWords` over the manifest's table) and the tier.

## Run 1 — 2026-10-15 01:58 (the import closure)

**Command.** Read scottishgaelic.ts, normalize.ts, numbers.ts and their imports; `west/pins.mts`; `west/symdata.mts`.

**Raw finding.**
- Core imports: `clauses`, `hostWord`, `loadManifest`, `normalizeSymbols`, `provenance` — all ported. No neural or
  `ROMAN_POLICIES` entry. ⚠ FLEURS has no Scottish Gaelic, so the golden (200 rows), the synthetic dump rows and
  `probes/gd.txt` are the whole haystack.
- The dotted-abbreviation callbacks GUARD the #1122 miss (`w === undefined ? m0 : …`), so `ſrl.` stays as written.
- Pins: test/scottishgaelic.test.ts 20,056 calls / 20,078 expects, 0 failures; `west/trim_loop.py` (rewritten to
  keep every `numberToWords` argument the test's explicit `[n, "…"]` table names) drops the 0…20,000 property loop's
  19,979 rows, leaving 77.

**Implication.** Port numbers → normalize → scottishgaelic.

## Run 2 — 2026-10-15 02:02 (first build, the golden gate; escapes)

**Raw finding.** The grouping rule's `[    ]` was written with three literal characters; restored
with `perl -CSD`. Audit: 16 raw patterns, 3 not verbatim — the symbol JSON and two `format!` templates (the
abbreviation-end and TOKEN patterns), checked by hand against the TS template strings; the ordinal and
abbreviation-continue templates likewise. 4 plain patterns, all verbatim. `gd: 200/200 identical, 0 differ`.

## Run 3 — 2026-10-15 02:05 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `gd-normalize`, `gd-g2p` (no FLEURS entry), one `fn-diff` arm;
`west/e2e.sh <wt> gd gd gd-normalize gd-g2p phonemize-sync phonemize-best phonemize-trace trace`.
- `gd-normalize`: `normalizeScottishGaelic`, the recorded tier and `createScottishGaelic().text` over the golden, the
  16 probe lines and 2,302 synthetic rows (grouping with every separator and the leading-zero guard, each
  abbreviation in three casings × 7 tails and the `ſ` fold, àireamh, decades, the ordinal over 0…25 × 7 suffixes ×
  hyphen × 6 noun tails, decimals, minus forms).
- `gd-g2p`: `phonemizeWord` and `nat` over every letter run, every 1–3 letter string of 35 letters, every 4-letter
  string over `aeiouàòbcdghlnprst`, corners (a decomposed `e` + U+0300, `İ`, `ſ`, lone surrogates); `numberToWords`
  over 0…20,000, magnitudes, raw strings.

**Raw finding.** First build, every one:
```
gd-normalize: 7554 identical, 0 DIFFER   (golden 600 / probe 48 / synthetic 6906)
gd-g2p: 331028 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 216 identical, 0 DIFFER each
```
Texts the normalizer changes: golden 22/200, probes 10/16, synthetic 502/2,302.

**JS semantics reproduced on purpose.** `scan` NFC-normalizes before lowercasing, then walks CODE UNITS; the
vowel clusters are stably sorted; the out-of-range fallback reads `String(n)` filtered to ASCII digits.

**Guard check.** The NFC step removed: `gd-g2p: 331027 identical, 1 DIFFER` (the decomposed-`è` corner — the only
row with a decomposed vowel, which is why the corner is in the dump). Restored: 0 DIFFER.

## Run 4 — 2026-10-15 02:07 (reading for correctness: TS findings, reported not fixed)

**Command.** `WT=<wt> N=languages/scottishgaelic/normalize.ts FN=normalizeScottishGaelic npx tsx west/t.mts gd …`.

**Raw finding (TS output, verbatim):**
1. **A three-digit dot decimal is read as thousands.** `Tha pi mu 3.141 no 3.14.` → normalized `3141 no 3.14` →
   *… tʲʰɾʲˈiː mˈiːlʲə kʲʰˈiaːt̪ …* ("three thousand one hundred…"); `12.125` → `12125`. The dot-grouping rule claims
   every `\d.\d{3}` before the decimal rule, which itself only takes one or two fraction digits — in a language
   whose own decimal word (`puing`) the file reads off a dot.
2. **No range connective.** `Bha e 1990-2000 ann.` → unchanged → two juxtaposed cardinals with the hyphen dropped;
   there is no range rule (cy/ga read `i` / `go dtí`).

**Implication.** Reported; the Rust reproduces both.

## Run 5 — 2026-10-15 02:08 (TS suite pins, gates)

**Raw finding.** scottishgaelic.rs pins 77 calls; `cargo test scottishgaelic`: 1 passed. `parity` (all): every
language byte-identical but mag and tt at their known 199/200; `gd: 200/200`. clippy: only `module_inception` in
the new files. No port-pending rows.

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
