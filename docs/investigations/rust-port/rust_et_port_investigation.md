# Rust port: Estonian (et)

Part of #1463, the "north" group (fi, et, hu, is, fo). Method as in rust_fi_port_investigation.md: per-module
`fn-diff` differentials, then the public entry end to end (sync, async, both traces), then the golden gate.

Estonian is a greedy grapheme scan (a doubled vowel is long; a doubled consonant is a geminate only AFTER a
vowel) with fixed first-syllable stress; a cardinal compositor private to estonian.ts (`number`); a normalizer
(normalize.ts: the marked clock, grouping, era markers, dotless abbreviations, the ordinal inflected to its head
noun's case with the terminative/essive/abessive/comitative concord exception, the hyphen case suffix, `kuni`
ranges, the decimal comma, degrees with the clause-bounded `saidNear` guard, signs) plus an initialism pass that
first resolves the hyphen inflection on an initialism; and the shared symbol tier, applied after both. No lexicon,
no neural entry, no `ROMAN_POLICIES` entry. Estonian shares no module with Finnish (each directory is
self-contained), so nothing from `languages/finnish/` is reused.

## Run 1 — 2026-10-14 22:42 (the import closure, baseline)

**Question.** What does `src/languages/estonian/` need that the Rust core lacks?

**Command.** Read estonian.ts and normalize.ts and their imports; `grep -n '"et"' src/registry.ts
src/neuralRegistry.ts`.

**Raw finding.**
- Imports: core `numbers` (digitIndex), `clauses`, `hostWord`, `loadManifest`, `normalizeSymbols`,
  `initialisms`, `provenance`. All ported; no new core module. There is no manifest.ts: the `EstonianDef`
  interface lives in estonian.ts, so the Rust struct does too.
- registry.ts: `case "et": return createEstonian();`; no Roman policy, not `ROMAN_NATIVE`; no neural entry.
- et golden: 200 rows, 126 distinct texts. FLEURS et_ee: 1,906 distinct column-3 texts.

**Implication.** Port normalize → estonian. The symbol data is generated (`north/symdata.mts`, the recording
hook) and `diff`ed against the Rust literal: identical.

## Run 2 — 2026-10-14 22:46 (first end-to-end build, golden)

**Command.** `./target/release/parity et` after registering `et`.

**Raw finding.** `et: 200/200 identical, 0 differ` on the first build.

## Run 3 — 2026-10-14 22:48 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `et-normalize` and `et-g2p` (`et: "et_ee"` in `FLEURS_DIR`), one `fn-diff`
arm, run as in the fi log through `north/e2e.sh`. Inputs: golden, FLEURS et_ee columns 3 and 4, the new synthetic
`probes/et.txt`.
- `et-normalize`: per text, `normalizeEstonian`, the initialism pass over its output and the recorded symbol tier
  over that; `isUnreadableEstonian` per letter run; synthetic rows: 16 numbers × 16 head stems (incl. a
  nominative-only and an unlisted head) × 12 endings (the ten recognised, plus `na` and `sse`), the coordination
  and range grid, the clock grid behind 5 markers, the range grid (5 shapes × 5 joiners × 3 frames), the hyphen
  suffix (with and without `$`), degrees near/far from a `kraad` word, 16 abbreviations × 6 tails; `ordinal` over
  0…2100 and corners × the nominative sentinel and all 12 endings.
- `et-g2p`: `phonemizeWord` over every letter run, every 1–3 letter string of 38 letters, every 4-letter string
  over `aeoõkstlny`, corners; the nativiser; the private `number` through `createEstonian().text` over 0…20,000,
  magnitudes and unsafe/long runs.
- end to end `LANGS=et` `phonemize-sync`, `phonemize-best`, `phonemize-trace`, `trace`; `SYMBOLS_LANGS=et symbols`.

**Raw finding.** First build, every one:
```
et-normalize: 66130 identical, 0 DIFFER  (golden 378 / fleurs 11106 / probe 87 / synthetic 11148 / words 15994;
                                          the rest are the ordinal rows)
et-g2p: 188673 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 3857 identical, 0 DIFFER each
symbols: 6896 identical, 0 DIFFER  (probe 3072 / estonian 3824)
```

**JS semantics reproduced on purpose.**
- `saidNear` builds its regex from the needle list per call; the one call site's needle is constant, so the
  Rust builds the same pattern string once (`(?<![\p{L}\p{M}])(?:kraad\p{L}*)(?![\p{L}\p{M}])`, `iu`).
- The degree callback returns only the CAPTURED digit when the word was already said — the match starts at the
  last digit, so the number survives.
- `clauseWindow` slices code units (`Math.max(0, start - 45)`), and `search` is the first match's index.
- `number` reads digit by digit over CODE POINTS (`[...digits]`), each through `phonemizeWord`; a whole number is
  ONE `sink.emit` of the joined words (the trace sees one emission).
- `ordinal` is integral by its own guard (`Number.isInteger`, 1…9999), so it runs on `i64`.

**Guard check (reverting a reproduction).** `clauseWindow`'s right-hand truncation removed:
`et-normalize: 66128 identical, 2 DIFFER`. Restored: 0 DIFFER.

## Run 4 — 2026-10-14 22:50 (reading for correctness: TS findings, reported not fixed)

**Command.** `WT=<worktree> N=languages/estonian/normalize.ts FN=normalizeEstonian npx tsx north/t.mts et <texts>`.

**Raw finding (TS output, verbatim):**
1. **The marked clock's minutes lose their zero, or read it as a number.** `kell 22:08 algas` → `kell 22 08` →
   `kˈelː kˈɑkskymːend kˈɑks kˈɑheksɑ` (22:08 is spoken as 22:8), and `kell 10:00 algas` → `kˈelː kˈymːe nˈulː`
   (the `:00` is read as a bare *null*). The #1102 rule only removes the separator's pause; the Finnish sibling
   reads the same field through a `minutes()` that keeps the zero as a word.
2. (Pinned by the TS suite, so recorded rather than reported as a defect.) `5000–6000-ni` → `5000–kuue tuhandeni`:
   step 6 words the right operand before step 7 can see a span, so the dash is dropped silently.

**Implication.** Finding 1 in the PR. Rust reproduces both.

## Run 5 — 2026-10-14 22:53 (TS suite pins, gates)

**Changes.** estonian.rs gains a test module: every call test/estonian.test.ts makes into the engine (155: 13
`phonemizeWord`, 79 `normalizeEstonian`, 8 `normalizeEstonianInitialisms`, 7 `isUnreadableEstonian`, 23
`ordinal`, 7 `createEstonian().text`, 9 `prePass` + 9 `getPhonemizer("et").text`) with the TS return value,
extracted by `north/pins.mts` (149 expects evaluated, 0 failures). The `test.each` table runs through the shim too.
Pin guard: the concord exception disabled (`GENITIVE_ATTRIBUTE` never consulted) → FAILED on `19. sajandini`
(`üheksateistkümnendani` vs `üheksateistkümnenda`); restored, it passes.

**Raw finding.** parity, all 53 languages: every one byte-identical but mag at its known 199/200;
`et: 200/200 identical, 0 differ`. clippy adds only `module_inception` on `estonian::estonian`.

**Implication.** No port-pending rows (TOKEN is all of Latin).
