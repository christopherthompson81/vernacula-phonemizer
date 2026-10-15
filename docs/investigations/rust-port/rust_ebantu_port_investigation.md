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

## Run 3 — 2026-10-15 06:05 (rw: the engine, the shared Rwanda-Rundi composer, the normalizer)

**What was written.** `languages/kinyarwanda/{manifest,numbers,normalize,kinyarwanda}.rs`. `RwandaRundiNumbers` and
`compose_rwanda_rundi` are `pub` for rn. The normalizer's escapes: the regex-literal NBSP / NNBSP / thin-space / NUL
escapes stay ESCAPES in raw strings, and the ones the TS cooks into a template or plain string (`NOT_COORD`, the
unit, clock, range and per-unit templates, the NUL sentinel) are Rust `\u{…}` escapes in ordinary strings, so the
compiled pattern has the TS's code points and no invisible character is literal. All of them were written as
placeholders and substituted byte-level. A `UNIT[key]` miss falls back to `"undefined"`, as the TS template would
write it (#1122); no input reaches that arm (under `/iu` the only fold onto a key letter is the Kelvin sign onto
`k`, which lowercases onto `k`).

**Command.** `parity -- rw`; `audit.sh kinyarwanda kinyarwanda`; `escape_audit.py`; `regs.sh rw` (JsRegex::new
temporarily logs every pattern while fn-diff replays the rw sync dump; compared by code point with every RegExp the
TS constructs over the same texts plus the regex corpus); the `rw-normalize` / `rw-g2p` dumps (golden, the new
synthetic `probes/rw.txt`, generated arms; every 1–3 letter string, 4-letter context strings; numberToWords over
0…20,000, the 10¹² ceiling and raw strings); two mutations; e2e + trace + symbols; provenance-poison; pins.

**Raw finding.**
- `rw: 200/200 identical`, first build.
- Audits: 23 raw patterns, 1 miss (the TOKEN template); 27 non-ASCII runs, 0 missing; escapes `TS 38, Rust 30` for
  U+00A0 — the 8 cooked NBSPs inside templates are the one `NB` constant interpolated 8 times, so the count cannot
  match; checked by the compiled-pattern comparison instead: `rust 95, ts 3423, rust-only 14`, and all 14 Rust-only
  patterns are core pre-pass patterns (`core/unicode.rs` mojibake repair, separator hygiene, the symbol tier's
  own), none from `languages/kinyarwanda/`. Every rw pattern Rust compiles is one the TS compiles, code point for
  code point.
- One rw pattern holds `"` inside a character class (the compass rule's `[″"]`), which regex-diff cannot see (#1590);
  covered by the compiled-pattern comparison above and by the compass probes.
- `rw-normalize: 6443 identical, 0 DIFFER` (golden 600, probe 57, synthetic 2172, number 3614); `rw-g2p: 170857
  identical, 0 DIFFER`.
- Mutations (the 2–9 thousand multiplier range cut to 2–8; the initialism's end-of-input test dropped):
  `rw-normalize: 6428 identical, 15 DIFFER`, `rw-g2p: 169856 identical, 1001 DIFFER`. A slip in `mutate.py` (an
  ambiguous revert string) left the second one in place for one rebuild; reverted by hand and re-run: 6443/0.
- `phonemize-sync / phonemize-best / phonemize-trace / trace: 219 identical, 0 DIFFER` each; `symbols: 3272
  identical, 0 DIFFER`; provenance-poison `0` sites; test/kinyarwanda.test.ts `134 pinned, 0 skipped; expects
  evaluated: 139, failures: 0` (83 normalizeKinyarwanda, 31 numberToWords, 20 phonemize); both Rust tests pass.
- Haystack: rw has no FLEURS, so beyond the 200 golden rows only the synthetic probes reach the arms.

**Reading for correctness** (TS prints, `t.mts rw`):
- A decimal with three or more fractional digits is not a decimal to this normalizer: the decimal rules take
  `\d{1,2}` after the mark, and dot de-grouping claims `[1-9]\d{0,2}(\.\d{3})+`. So `3.141` reads as the integer
  3141 (`ibihumbi bitatu na ijana na mirongo ine na rimwe`), `0.125` as `zeru . ijana na makumyabiri na gatanu` (a
  sentence break and then 125), and `3.14159` as `gatatu .` followed by 14,159. The first is the dot-grouping
  convention working as designed; the last two read a confidently wrong quantity.
- Not defects, recorded: a bare `-5` loses its sign (there is no negative rule outside the degree arm); `1/2` reads
  `rimwe kabiri`; `5°C-10°C` reads both temperatures with no range word.

**Implication.** rw done; rn reuses `compose_rwanda_rundi`. TS defect to report (not fixed): kinyarwanda/normalize.ts
reads a decimal with ≥3 fractional digits that dot de-grouping cannot claim as a sentence break plus an integer.
