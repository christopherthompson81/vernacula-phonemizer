# Rust port: the East/Central Bantu group (sw, rw, rn, lg, ln, nya)

Swahili (`src/languages/swahili/`), Kinyarwanda (`kinyarwanda/`), Kirundi (`kirundi/`), Luganda (`luganda/`),
Lingala (`lingala/`) and Chichewa (`chichewa/`, registry code `nya`). One log for the group: all six are a
Latin-script rule g2p over a manifest, a normalizer and (for most) a number composer, and rn reuses rw's number
composer. Tracking issue #1463. Method as the earlier ports (rust_vi / rust_dravidian logs): per-module fn-diff, the
public entry end to end, the trace, then the golden gate.

## Run 0 — 2026-10-15 05:20 (import closure, registry codes, neural and Roman entries)

**Question.** What do the six engines import that the Rust core lacks; which registry codes, neural entries, Roman
policies, goldens, FLEURS transcripts and test files exist?

**Command.** `grep -h "^import" src/languages/{swahili,kinyarwanda,kirundi,luganda,lingala,chichewa}/*.ts | sort -u`;
`grep` of the six factories in src/registry.ts and of the codes in src/neuralRegistry.ts and `ROMAN_POLICIES`;
`ls csharp/goldens`, the FLEURS transcript directory and `test/`.

**Raw finding.**
- Core imports: `clauses` (assembleClauses), `hostWord` (hostWordRun, LATIN_RUN, makeNativiser), `loadManifest`,
  `normalizeSymbols` (makeSymbolNormalizer; lingala `makeBareUnitNormalizer`), `provenance` (rewrite, renormalize),
  `latinPhones` (latinPhone), `numbers` (digitIndex). Every one exists under `rust/vernacula-phonemizer/src/core/`:
  no new core module.
- One cross-language import: kirundi imports `composeRwandaRundi` from `kinyarwanda/numbers.ts` and the type
  `RwandaRundiNumbers` from `kinyarwanda/manifest.ts`. Ported once with rw and reused by rn.
- Registry codes: `sw`, `rw`, `rn`, `lg`, `ln`, and **`nya`** for Chichewa (not `ny`). Every factory takes no reader.
  None is in `src/neuralRegistry.ts`, `ROMAN_POLICIES`, `FOLD_OPT_OUT` or `VULGAR_FOLD_OPT_OUT`.
- Goldens: sw, rw, rn, lg, ln, nya (200 rows each). FLEURS: `sw_ke`, `lg_ug`, `ln_cd`, `ny_mw`; nothing for rw or rn
  (probes carry them). Test files: test/{swahili,kinyarwanda,kirundi,luganda,lingala,chichewa}.test.ts.
- The sibling "sbantu" group (zu, xh, st, tn, nso, sn) has not landed on origin/main (0d87566f); nothing of it to
  reuse.

**Implication.** Port in the given order, rw's numbers module before rn.

## Run 1 — 2026-10-15 05:30 (sw: first golden gate and the code-point audit)

**What was written.** `languages/swahili/{manifest,normalize,swahili}.rs`. The manifest struct names every field of
`SwahiliDef` (the symbol tier is a `Required<Pick<…>>`, so every key is required). The TS's escaped NBSP — a ` `
cooked into a template string (expandDotted) and a ` ` regex escape (the bare `BC` rule) — and the literal
U+0329 of the syllabic nasal were written from placeholders and substituted byte-level (`subst.py`).
`w.startsWith(velarNasal, i)` takes a code-unit index while `i` counts code points; reproduced and noted.

**Command.** `cargo run --release -p parity -- sw`; `audit.sh swahili swahili`; `escape_audit.py`.

**Raw finding.** `sw: 200/200 identical, 0 differ`, first build. Audits: `26 raw patterns, 1 not found verbatim` (the
TOKEN `format!` template, checked by hand); `15 non-ASCII runs, 0 not found`; `2 TS escapes, 0 code points short`.
No Cf character in the Rust.

**Implication.** Per-module differentials next.

## Run 2 — 2026-10-15 05:36 (sw: per-module differentials, sensitivity, end to end, trace, symbols, TS suite)

**Command.** New dump entries `sw-normalize` (normalizeSwahili, the engine's own symbol tier recorded through
`symbols-wrap.ts`, and `renderInHost("sw", t)`, over the golden, FLEURS sw_ke columns 3+4, the new synthetic
`probes/sw.txt` and generated rows per arm; and digit strings 0…3,000, scaled samples, 10⁶…10²² and long runs
through the engine) and `sw-g2p` (phonemizeWord and the nativiser over every letter run of the texts as written /
lower / UPPER, every 1–3 letter string over a–z plus `'`, every 4-letter string over a nasal/glide/vowel context
set, and edge strings). Then `LANGS=sw e2e.sh … phonemize-sync phonemize-best phonemize-trace trace` and
`SYMBOLS_LANGS=sw … symbols`; `npx tsx tools/provenance-poison.mts sw`; test/swahili.test.ts run under the recording
vitest shim (`pins.mts`) into `the_ts_suite_calls_return_the_ts_values`; a Rust poison test over probes + golden.

**Raw finding.**
```
sw-normalize: 16335 identical, 0 DIFFER   (golden 327, fleurs 11304, probe 63, synthetic 1026, number 3615)
sw-g2p:      180212 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 3898 identical, 0 DIFFER each
symbols:       6948 identical, 0 DIFFER
```
Sensitivity (two temporary breaks, then reverted): the labialization arm's vowel test forced true, and the range
comparison `<` → `<=`: `sw-normalize: 16307 identical, 28 DIFFER` (fleurs 16, probe 4, synthetic 8), `sw-g2p:
174505 identical, 5707 DIFFER`. Reverted: 16335/0.
provenance-poison: `distinct poison sites: 0`. TS suite: `49 pinned, 0 skipped; expects evaluated: 54, failures:
0`; both Rust tests pass. Nothing port-pending: sw wires no foreign reader.

**Reading for correctness** (TS prints, `t.mts sw`):
- `joto 10-15°C` → `ʄˈoto kˈumi ɲˈuzi ʄˈoto kˈumi nˈa tˈano selsiˈasi`: the degree rule (step 5) runs BEFORE the
  range rule (step 6) and puts `nyuzi joto` between the two endpoints, so the range never matches and the dash is
  dropped — a temperature range reads "ten degrees fifteen Celsius", no `hadi`. `10 - 15°C` the same.
- Not defects, recorded: `1/2` reads `mˈoʄa ᵐbˈili` (no fraction rule; the slash is dropped); `5,5` reads as two
  numbers with a pause (the decimal comma is documented as unhandled); `1.000.000` reads as a decimal plus a
  sentence break (dot grouping is not Swahili's convention).

**Implication.** sw done. TS defect to report (not fixed): normalize.ts's degree step pre-empts the range step on a
temperature range.
