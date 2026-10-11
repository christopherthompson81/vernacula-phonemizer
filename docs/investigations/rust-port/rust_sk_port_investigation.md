# Rust port: Slovak (sk)

Part of #1463, the Slavic group (cs, sk, be, bg, mk). Method as in rust_cs_port_investigation.md: per-module
`fn-diff` differentials, then the public entry end to end, then the golden gate.

Slovak is a rule g2p (`g2p.ts`: scan with ch/dz/dž, x, the rising diphthongs, ô, long syllabic ĺ/ŕ, d/t/n/l
palatalisation; syllabic r̩/l̩; gemination; voicing with ⟨v⟩ a limited target) with first-syllable stress
(secondary on even non-final nuclei), a cardinal compositor (to 10⁹, then digit by digit), and a normalizer
that runs the shared symbol tier and the initialism pass ITSELF (`SYMBOLS` lives in slovak.ts and normalize.ts
imports it). No lexicon, no neural entry, no `ROMAN_POLICIES` entry. Slovak shares no TS module with Czech
(each directory is self-contained), so nothing from `languages/czech/` is reused.

## Run 1 — 2026-10-11 05:30 (the import closure, baseline)

**Question.** What does `src/languages/slovak/` need that the Rust core lacks, and what does the golden hold?

**Command.** Read slovak.ts, g2p.ts, normalize.ts, numbers.ts, manifest.ts and their imports; `grep -n sk
src/registry.ts src/neuralRegistry.ts`; the Run 1 script scan from the cs log.

**Raw finding.**
- Imports: core `clauses`, `hostWord`, `normalizeSymbols`, `initialisms`, `numbers` (digitIndex), `loadManifest`,
  `provenance`. All ported; no new core module.
- sk golden: 200 rows, 141 distinct texts, every letter Latin (15,366). FLEURS sk_sk: 1,719 distinct column-3 texts.
- The module cycle: normalize.ts imports `SYMBOLS`/`skCountForm` from slovak.ts, which imports normalize.ts. In
  Rust `SYMBOLS` is a `LazyLock<Result<SymbolNormalizer, String>>` in slovak.rs; `create_slovak` checks it, so
  normalize.rs's `expect` is reached only through a checked path.
- Unlike Czech, no step throws: every `!` either indexes an exact-match key (LICENSOR, from its own
  alternation without `i`) or a table the fold cannot widen (DOTTED's `iu` alternation over
  `tzv|atď|napr|č|dr|jr`: no letter there has a non-ASCII fold partner; the miss would stringify `undefined`,
  ported as such).

**Implication.** Port manifest → numbers → g2p → normalize → slovak.

## Run 2 — 2026-10-11 05:36 (first end-to-end build, golden)

**Command.** `cd rust && cargo build --release -p parity && ./target/release/parity sk` after registering `sk`
(one `build` arm, `LANGUAGES`). The symbol tier's data is the slovak.ts literal recorded by the `symbols` dump.

**Raw finding.** `sk: 200/200 identical, 0 differ` on the first build.

**Implication.** The golden reaches 9 of 34 rewrite sites (Run 4); the differentials carry the weight.

## Run 3 — 2026-10-11 05:40 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `sk-normalize`, `sk-g2p`, `sk-numbers` (`sk: "sk_sk"` in `FLEURS_DIR`), one
`fn-diff` arm: `FLEURS_ROOT=<external-drive>/omnivoice_ipa/corpus/fleurs_transcripts/data npx tsx
rust/tools/fn-diff/dump.mts <name> > .probe/sk/<name>.jsonl`, then `./target/release/fn-diff <name> …`.
Inputs: the golden, FLEURS sk_sk columns 3 and 4, and the new synthetic `probes/sk.txt`.
- `sk-normalize`: `normalizeSlovak` and `normalizeSlovakInitialisms` per text; `isUnreadableSlovak` per letter
  run; synthetic rows: 16 numbers × 13 heads (licensors, a non-licensor, a capital, a comma) × 6 prefixes
  (none, v, three name endings, a list item), the clock grid after 5 prepositions, 54 fractions; and
  `ordinalWords` over 0…3000 plus corners × all 15 slots.
- `sk-g2p`: `phonemizeWord` / `toSegments` over every letter run, every 1–3 letter string of the 43 letters,
  every 4-letter string over `vdtnliezhcskrbaž`, corners; `nat` (slovak.ts's NATIVE_CLASS) over them.
- `sk-numbers`: `numberToWords` (0…20,000, powers, k·10³/10⁶, corners, raw strings directly and through the 10⁹
  fallback), `readDigits`, `skCountForm`.
- end to end `LANGS=sk` `phonemize-sync`, `phonemize-best`, `phonemize-trace`; `SYMBOLS_LANGS=sk symbols`.

**Raw finding.** First build, every one (re-run with the defect probe lines of Run 5):
```
sk-normalize: 70488 identical, 0 DIFFER  (golden 282 / fleurs 6628 / probe 96 / synthetic 3604 / words 14728;
                                          the rest are the 45k ordinalWords rows)
sk-g2p: 483571 identical, 0 DIFFER
sk-numbers: 50196 identical, 0 DIFFER
phonemize-sync / phonemize-best / phonemize-trace: 3503 identical, 0 DIFFER
symbols: 6525 identical, 0 DIFFER  (probe 3072 / slovak 3453)
```

**JS semantics reproduced on purpose.**
- `readDigits` splits code UNITS (`split("")`), Czech's code points;
- in step 7 a declined list item writes back its WHOLE match (comma included) and then the comma again;
- ⟨v⟩'s branch runs before the obstruent test and `v` is a key of neither voicing map, so a `v` is never a
  trigger, but an onset v already devoiced to `f` (right to left) IS one for the consonant before it;
- `geminate` merges right to left, so `kkk` → `k kː`;
- DOTTED's miss stringifies `undefined` (unreachable, kept).

**Guard check (reverting a reproduction).** Two mutations, then restored:
- declined list item written as `n.` instead of the whole match: `sk-normalize: 70487 identical, 1 DIFFER` (the
  probe `V 1000., 5. storočí …`: ts `1000.,, piatom`, rust `1000., piatom`).
- onset/coda distinction removed (`coda_v = false`): `sk-g2p: 479735 identical, 3836 DIFFER` (`premávky` ts
  `prˈemaːvki`, rust `prˈemaːfki`).
Restored: both 0 DIFFER.

## Run 4 — 2026-10-11 05:44 (per-arm reach)

**Command.** `FLEURS_ROOT=… npx tsx .probe/cov/run.mts sk sk_sk slovak normalizeSlovak` (texts each rewrite site
changed, by normalize.ts line).

**Raw finding.** (distinct texts golden 141 / FLEURS 1719 / probe 48; golden/FLEURS/probe)
```
372 group 5/31/5     373 space 0/17/1     380 multi-dot 0/9/5   389 abbrev cont 1/15/4  391 abbrev end 0/4/1
393 abbrev else 0/2/2  401 St. 0/1/1      408 clock range 0/2/2  418 clock 2/10/2     428 version 0/3/4
439 range 0/4/3      447 licensed ord 6/55/6  482 general ord 0/0/2  496 míľ/h 0/1/1  498 mi/h 0/0/1
503 °C 1/1/1  505 °F 0/0/1  507 ° 0/0/1  508 × 0/3/1  517 ± 0/0/1  518 + 1/1/2  519 minus 0/0/1
528 decimal comma 4/15/4  535–538 fractions 0/0/1 each  547–551 relational 0/0/1 each  559 A&B 0/1/1  564 & 0/0/1
```
(The symbol tier at line 524 is not a `rewrite` call and is measured by the `symbols` replay instead.) Step 8 (the
general/regnal ordinal) is reached by FLEURS only after the registry's Roman pass, which this harness skips;
`phonemize-sync` covers that path. Every site is reached by at least one source; only the probes reach `°F`, `°`,
the minus, `±`, the fractions, the relational signs and the bare `&`.

**Implication.** No port-pending rows: every Latin run is Slovak's own (TOKEN is all of Latin).

## Run 5 — 2026-10-11 05:46 (reading for correctness: TS findings, reported not fixed)

**Command.** `N=slovak npx tsx .probe/cs/t.mts <texts>` (normalizeSlovak) and `L=sk …` (phonemize).

**Raw finding (TS output, verbatim):**
1. **A declined item in an ordinal list doubles its comma.** `V 1000., 5. storočí.` → `V 1000.,, piatom storočí.`
   The inner replace's fallback is `w` (the whole `\d.,` match) and then appends `comma` again. Audible effect
   none today (the clause sink merges the two pauses), but the item is also left as a cardinal plus a stray dot.
2. **A dotted abbreviation before a capitalised word eats the sentence end.** `Atď. Potom.` → `a tak ďalej Potom.`,
   `kozmonaut č. Potom` → `kozmonaut číslo Potom`. Same defect as cs/ru/uk. The file's own keepFinal handles exactly
   this for the multi-dot step ("the SECOND is the one Czech's version misses"); step 2's continuation rule does not.
3. **Decomposed input loses the caron.** `ľad` (NFD *ľad*) → `lˈat` (vs `ʎˈat`). Same as cs finding 7.
4. **(For a native reader.) The regnal gender heuristic reads any capitalised word ending in -a as feminine.**
   `Tesla 3. model` → *Tesla tretia model*. The docstring scopes it to names; the guard is only "capitalised".

**Implication.** Reported in the PR; one probe line per finding appended to probes/sk.txt (Run 3's numbers include
them).

## Run 6 — 2026-10-11 05:49 (tests and gates)

**Changes.** slovak.rs gains a test module: test/slovak.test.ts's 17 `phonemizeWord`, 75 `normalizeSlovak`
(including the six-word identity loop), 13 `createSlovak().text`, 3 `getPhonemizer("sk").text`, 11 `ordinalWords`
and 1 `toBeUndefined` pins, extracted MECHANICALLY by `.probe/pins.mjs` (extended for `.text(…)[.trim()]`, the
ordinal pins and the identity loop), plus the file's one relational pin (`v roku 1835.` keeps its final `.`).
Pin guard: `coda_v = false` → `the_ts_suite_pins_hold` FAILED on `dievča`; restored, it passes.

**Raw finding.**
- parity: all 22 (the 20 earlier, cs, sk) `200/200 identical, 0 differ`.
- `cargo test --release --workspace`: 135 + 1 passed. regex-diff `144898 … 0 DIFFER, 0 patterns refused`.
  fmt clean; clippy adds only `module_inception` on `slovak::slovak`.
- No TS regex added; the regex corpus needs no re-extraction.
