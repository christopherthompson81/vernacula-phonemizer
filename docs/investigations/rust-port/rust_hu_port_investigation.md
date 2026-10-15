# Rust port: Hungarian (hu)

Part of #1463, the "north" group (fi, et, hu, is, fo). Method as in rust_fi_port_investigation.md.

Hungarian is a longest-match scan over the manifest's ordered rule table (trigraphs and geminate digraphs before
digraphs before singles, with the c+sz and c+h morpheme-boundary guards), then gemination, j-palatalisation, nasal
place assimilation, regressive voicing and a geminate merge, with a word-initial stress mark; a cardinal compositor
with the attributive *két*, the stem shortening before a vowel-initial suffix, and last-morph-replacement ordinals
and multiplicatives (numbers.ts); a normalizer that runs the symbol tier and the initialism pass ITSELF
(normalize.ts); and a `ROMAN_POLICIES` entry (romanOrdinals.ts), so `registry::roman_policy` gains a `hu` arm.
No lexicon, no neural entry.

## Run 1 — 2026-10-14 22:58 (the import closure, baseline)

**Question.** What does `src/languages/hungarian/` need that the Rust core lacks?

**Command.** Read hungarian.ts, manifest.ts, numbers.ts, normalize.ts, romanOrdinals.ts and their imports;
`grep -n "hu" src/registry.ts src/neuralRegistry.ts`.

**Raw finding.**
- Imports: core `clauses`, `hostWord`, `numbers` (digitIndex), `loadManifest`, `normalizeSymbols`, `initialisms`,
  `provenance`, `roman` (the `RomanPolicy` type). All ported; no new core module.
- registry.ts: `case "hu": return createHungarian();` and `hu: romanHu` in `ROMAN_POLICIES` (so the registry's
  default `ROMAN_EXCLUSIONS` do NOT apply; the policy has no `exclude`). No neural entry.
- The symbol tier's data is the manifest's `symbolTier` block, passed field by field (7 fields), so it is read
  from the jsonc through a typed `SymbolTier` struct rather than generated from a literal.
- hu golden: 200 rows, 111 distinct texts. FLEURS hu_hu: 1,995 distinct column-3 texts.

**Implication.** Port manifest → numbers → romanOrdinals → normalize → hungarian.

## Run 2 — 2026-10-14 23:02 (first end-to-end build, golden)

**Command.** `./target/release/parity hu` after registering `hu` (`build` arm, `roman_policy` arm, `LANGUAGES`).

**Raw finding.** `hu: 200/200 identical, 0 differ` on the first build.

## Run 3 — 2026-10-14 23:04 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `hu-normalize`, `hu-g2p`, `hu-numbers` (`hu: "hu_hu"` in `FLEURS_DIR`), one
`fn-diff` arm, run through `north/e2e.sh`. Inputs: golden, FLEURS hu_hu columns 3 and 4, the new synthetic
`probes/hu.txt`.
- `hu-normalize`: `normalizeHungarian` per text (its symbol tier and initialism pass are internal);
  `isUnreadableHungarian` per letter run; synthetic rows for every arm (multiplication, the abbreviations in
  every case INCLUDING the `i`-fold spellings `Kb.` and `ſtb.`, de-grouping in every separator, the clock
  grid, unit/metre/percent/degree/numeral/date/acronym hyphen suffixes, signs, division, the ordinal arms, Roman
  contexts).
- `hu-g2p`: `phonemizeWord` over every letter run, every 1–3 letter string of 36 letters, every 4-letter string over
  `szcygnjdtkbva` (digraph halves, voicing pairs, n, j), the boundary words; the nativiser.
- `hu-numbers`: `numberToWords` (0…20,000, magnitudes to 10¹², corners, raw strings), `ordinalWords`,
  `multiplicativeWords`, the Roman policy's `ordinal` over 0…3000, `stemForSuffix` over 3,001 cardinals × 11
  suffixes.
- end to end `LANGS=hu` `phonemize-sync`, `phonemize-best`, `phonemize-trace`, `trace`; `SYMBOLS_LANGS=hu symbols`.

**Raw finding.** First build, every one:
```
hu-normalize: 20611 identical, 0 DIFFER  (golden 111 / fleurs 3915 / probe 21 / synthetic 538 / words 16026)
hu-g2p: 184314 identical, 0 DIFFER
hu-numbers: 114229 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace / trace: 4047 identical, 0 DIFFER each
symbols: 7098 identical, 0 DIFFER  (probe 3072 / hungarian 4026)
```

**JS semantics reproduced on purpose.**
- `DOTTED_ABBREV[ab.toLowerCase()]!` under a `giu` alternation: a long s folds onto `s` in the match but keeps
  `ſ` in the key, so the lookup misses and the template stringifies `undefined` (finding 1). Reproduced.
- The j-palatalisation loop `splice`s inside a forward `for` whose bound is re-read each pass; the merge and the
  voicing loops run right to left. Ported as the same index walks.
- `base(ph)` strips ONE trailing ː; the gemination test is `/ː$/` without `u`.
- The digit-by-digit fallback maps code points through `digitIndex`, which compares a STRING with `"0"`…`"9"`,
  and reads `String(Math.abs(n))`, so `NaN` reads as `N a N`.
- `bothCases` uppercases the first code unit with the JS mapping; every noun starts in the BMP and Rust's
  `char::to_uppercase` agrees on all nine.

**Guard check (reverting a reproduction).** The c+sz guard disabled → the pin test FAILED on `1965. március 18-án`
(`…kilɛnd͡ʒzaːz…` vs `…kilɛnt͡ssaːz…`); restored, it passes.

## Run 4 — 2026-10-14 23:06 (reading for correctness: TS findings, reported not fixed)

**Command.** `WT=<worktree> N=languages/hungarian/normalize.ts FN=normalizeHungarian npx tsx north/t.mts hu <texts>`.

**Raw finding (TS output, verbatim):**
1. **A case-folded abbreviation is spoken as the word "undefined".** `ez ſtb. körül` → normalized
   `ez undefined körül` → `ˈɛz ˈundɛfinɛd ˈkøryl`. The `giu` alternation built from `DOTTED_ABBREV`'s own keys
   matches `ſtb`, `ab.toLowerCase()` keeps the long s, and the `!` hides the miss — the #1122 shape that
   csharp/PORTING.md describes (a dotted-abbreviation alternation built from the table's own keys, then given
   `i`). A Kelvin-sign `Kb.` is safe only because its lowercase IS `k`.
2. (Recorded, not a defect claim.) `Ez a második. Erzsébet jött` keeps its period — the residual the file's 9d
   note documents and deliberately leaves.

**Implication.** Finding 1 in the PR; Rust reproduces it (the synthetic rows carry it).

## Run 5 — 2026-10-14 23:08 (TS suite pins, gates)

**Changes.** hungarian.rs gains a test module: every call test/hungarian.test.ts makes into the engine (119: 29
`phonemizeWord`, 7 `numberToWords`, 4 `createHungarian().text`, 57 `getPhonemizer("hu").text`, 12
`ROMAN_POLICY.ordinal`, 10 `ROMAN_POLICY.ordinalAfter.test`), extracted by `north/pins.mts` (121 expects, 0
failures). The recorder was extended for this file: a policy OBJECT's function members and a RegExp member's
`.test` are recorded too.

**Raw finding.** parity, all 54 languages byte-identical but mag at its known 199/200; `hu: 200/200`. clippy adds
only `module_inception` on `hungarian::hungarian`.

**Implication.** No port-pending rows (TOKEN is all of Latin).
