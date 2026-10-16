# Rust port: Afrikaans (af)

Part of #1463, the "germanic" group (da, nb, af, lb, bar). Method as in rust_da_port_investigation.md.

Afrikaans serves a word from four tiers: the 44-row curated lexicon, the RCRL lexicon, the BiLSTM tagger (best path
only) and the rules, every non-rule reading given a primary mark where the rule would put it (`withStress`). The rule
engine decomposes compounds through the shared Germanic morphology (af-stems.txt) and phonemizes each element with a
greedy longest-match grapheme scan over UTF-16 code units — open/closed vowel length, positional and regressive
devoicing, suffix- and prefix-driven stress counted by `countNuclei` — joined at the seams (blocked devoicing before a
resyllabifying suffix, ⟨d⟩ degemination). The normalizer reads the English separator convention; the symbol tier and
the initialism pass are re-applied after it.

## Run 1 — 2026-10-15 01:15 (the import closure)

**Question.** What does `src/languages/afrikaans/` need that the Rust core lacks?

**Command.** Read afrikaans.ts, normalize.ts, numbers.ts, morphology.ts, manifest.ts, afrikaansTagger.ts,
afrikaansNeural.ts and their imports.

**Raw finding.**
- Core imports: `normalizeSymbols`, `clauses`, `loadTsv`, `loadManifest`, `initialisms` (`makeInitialismNormalizer`,
  `makeUnreadableTest`), `numbers` (`digitIndex`), `provenance`, `germanicMorphology` (`makeDecompose`), `dataPath`,
  `dataSource`, `foreign`, `structuralTagger` — all ported (germanic_morphology since de/nl). No new core module.
- The symbol tier is built from manifest fields (`symbolTier`, `signWords.times`), so the Rust builds its
  `SymbolData` from the loaded manifest (as ru does) rather than embedding a copy of data/ — the recorded literal
  (`.probe/G/symdata.mts`) is the reference the `af-normalize` symbols op replays against.
- Neural entry `phonemizeAfNeural`; no `ROMAN_POLICIES` entry; FLEURS `af_za`.
- Pins: test/afrikaans.test.ts 170 calls / 192 expects (7 skipped: `decompose` objects and `MANIFEST` reads),
  test/afNeural.test.ts 16 calls / 15 expects, 0 failures.

**Implication.** Port manifest → numbers → morphology → normalize → afrikaans → afrikaans_tagger → afrikaans_neural.

## Run 2 — 2026-10-15 01:35 (first build, the golden gate; the escape rewrite again)

**Commands.** `cd rust && cargo build --release -p parity && ./target/release/parity af`; then
`grep -nP '[\x{00a0}\x{202f}\x{2009}]'` over the new files.

**Raw finding.** `af: 200/200 identical, 0 differ` on the first build, no compiler warning. The grep, run right after
writing normalize.rs and BEFORE any build: step 2's `[ \u00a0]` had been written by the editing tool as a literal
NBSP — the second time in this group (nb Run 3). Restored with `perl -CSD`; from here the grep runs after every write.

## Run 3 — 2026-10-15 01:45 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `af-normalize`, `af-g2p`, `af-tagger`, `FLEURS_DIR` entry `af: "af_za"`, one
`fn-diff` arm; `.probe/G/e2e.sh <wt> af af af-normalize af-g2p af-tagger phonemize-sync phonemize-best
phonemize-trace trace`. Inputs: the golden (166 texts), FLEURS af_za columns 3 and 4 (2,359 texts), the new synthetic
`probes/af.txt` (22 lines).
- `af-normalize`: per text `normalizeAfrikaans`, the recorded symbol tier over its output, the initialism pass over
  the tier's output, and `createAfrikaans().text`; 2,144 synthetic rows (the article's six spellings and an
  n-word, each abbreviation × 3 casings × 4 tails, ordinals 0…200 × 7 endings, every clock form over a 6 × 5 × 6
  hour/minute/marker grid in colon, dot and bare form, grouping / decimals / versions / rates, regnal forms, degrees,
  signs and fractions); `isUnreadableAfrikaans` over every letter run (126,002 rows); `ordinalWord` over −2…2,000 and
  the 10⁶ / 10⁹ / 2⁵³ / NaN corners.
- `af-g2p`: `phonemizeWordRules`, `phonemizeWord` and `decompose` (parts, kinds, stress part) over every letter run,
  every key of both lexicons, every 1–3 letter string of 45 letters, every 4-letter string over
  `aeiouybdgvwstkch`, corners; `numberToWords` over 0…20,000, magnitudes and raw strings.
- `af-tagger`: `tag` over every pre-pass word (NFC + lowercase), every 25th RCRL key and corners.

**Raw finding.** First build, every one:
```
af-normalize: 146778 identical, 0 DIFFER   (golden 166 / fleurs 2359 / probe 22 / synthetic 2144 texts × 5 ops,
                                            + 126002 unreadable + 2012 ordinal)
af-g2p: 555120 identical, 0 DIFFER
af-tagger: 7377 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 2547 identical, 0 DIFFER each
```
(af's lexicons are not folded through a nativiser, so the da/nb first-trace note does not arise.)

**JS semantics reproduced on purpose.**
- the grapheme scan, `countNuclei`, `isOpen` and `withStress` walk code UNITS; `foldForeignLetters` and the
  single-letter tests walk CODE POINTS; `KNOWN_LETTERS` takes `fixed` keys of one code point, `VOICELESS_NEXT` keys of
  one code unit;
- `(isOpen ? REDUCE_OPEN[c] : undefined) ?? REDUCE[c]`; `C_SOFT.has(w[i+1] ?? "")` (word-final ⟨c⟩ is [k]);
- `numberToWords`'s fallback splits `raw ?? String(n)` per code unit and keeps a non-digit as itself.

**Guard check.** Word-final ⟨c⟩ made soft: `af-g2p: 543101 identical, 12019 DIFFER`. Restored: 0 DIFFER.

## Run 4 — 2026-10-15 01:55 (reading for correctness: TS findings, reported not fixed)

**Commands.** `.probe/G/af-normwords.mts` (the words the normalizer and the symbol tier can emit, against both
lexicons); `.probe/G/best.mts af <texts>`.

**Raw finding (TS output, verbatim):**
1. **A word the normalizer creates never reaches the tagger** — the pre-pass scans the PRE-normalization text (the da
   and fr shape). Of 87 words the normalizer can emit, 28 are in neither lexicon (`Fahrenheit`, `Dokter`, `megabit`,
   `Wêreldoorlog`, `volt`, `dertigste`, …). `Dit is 90°F.` best → *fˈaɦrənɦəit* (rule), `Dit is negentig grade
   Fahrenheit.` best → *fˈarənɦəit* (tagger). Most of the 28 happen to read alike either way; Fahrenheit is the one
   measured here that does not.
2. (Observation, not a defect claim.) Neither lexicon holds the commonest function words — `en`, `een`, `twee`,
   `dit`, `is`, `aan`, `as`, `voor` — so they are always read by rule.

**Implication.** Reported; the Rust reproduces it byte for byte.

## Run 5 — 2026-10-15 02:00 (TS suite pins, gates)

**Raw finding.** afrikaans.rs pins the 186 calls of the two suites (the dispatch threads `numberToWords`'s raw string
and maps `afrikaansLexiconHas` to `"true"`/`"false"`); `cargo test afrikaans`: 3 passed. Audit: 34 raw patterns, 0
not verbatim; the five `format!` templates checked by hand against the TS template literals. `parity` (all): every
language byte-identical but mag 199/200; `af: 200/200`. clippy: only `module_inception` in the new files. No
port-pending rows.

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

## Run 7 — 2026-10-15 18:33 (#1578: fixing Run 4's finding 1)

**Question.** Does recording the words the engine asks for close finding 1, and does it expose anything the
old pre-pass kept from the tagger?

**Commands.** A best-path probe; a script comparing `phonemizeWordRules` with `tagger.tag` on every number
word and every letter name outside both lexicons; `npx tsx tools/check-goldens.mts --show 40 af`.

**Raw finding.**
1. `Dit is 90°F.` best → *fˈarənɦəit*, the same as the written-out `Fahrenheit`.
2. **The golden caught a regression the fix created.** `USSR` is normalized to letter names (`uu es es er`),
   which the tagger now saw. It read `er` *ər* where the rule path's letter name is *ɛr*. Of the 20 letter names
   outside both lexicons, `er` is the only one whose segments differ (the rest differ by the stress mark alone,
   which `withStress` adds to every tier). The letter names are therefore rule-reserved
   (`afrikaansRuleReserved`), the seam guard that already held `'n` and the bare letters. That makes four
   springings of this trap in this language.
3. The 19 number words outside both lexicons (`twee`, `honderd`, `duisend`, …) read the same from the
   tagger as from the rules, so `text()`'s number arm was left without the override: there is no observable
   gap to close.
4. Golden: 0 af rows stale after the letter-name guard (1 before it).

**Implication.** Closed in TS, C# and Rust. Reverting the letter-name guard fails two tests in each engine.
