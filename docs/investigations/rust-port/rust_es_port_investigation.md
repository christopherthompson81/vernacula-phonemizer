# Rust port: Spanish (`es`), and core `makeSymbolNormalizer`

Branch `rust-lang-es`, rebased onto `origin/main` at 78174e0a (#1466, the shared core and generic registry).
Part of #1463. The method is the English port's (rust_english_port_investigation.md): per-module `fn-diff`
differentials, then the public entry end to end, then the golden gate.

## Run 1 — 2026-10-09 15:30 (the import closure)

**Question.** What does `src/languages/spanish/` need that the Rust core does not have yet?

**Command.** Read spanish.ts, g2p.ts, manifest.ts, normalize.ts, numbers.ts, romanOrdinals.ts and their
imports; compared each import against `rust/vernacula-phonemizer/src/core/`.

**Raw finding.** Everything is ported except `core/normalizeSymbols.ts`'s `makeSymbolNormalizer` (with
`makeBareUnitNormalizer`, `spacedBareExponent`, `isBareUnitKey`, `slavicCountForm`, `numValue`, `pick`). The
Rust file held only `foldedIndex` and `resolveUnitSymbol`, and its header said the rest would come "with
their first consumer". Spanish is that consumer, and so are fr and hi (siblings porting in parallel), so the
coordinator assigned the port to this branch as a standalone commit the siblings cherry-pick.

**Implication.** Port `makeSymbolNormalizer` first, prove it for every language that declares it, commit it
alone, then Spanish.

## Run 2 — 2026-10-09 15:50 (makeSymbolNormalizer, every tier in the fleet)

**Question.** Does the Rust `make_symbol_normalizer(d).apply(text)` match the TS closure, for every
`SymbolData` any language builds, over real pipeline inputs?

**Method.** Building each language's `SymbolData` in Rust would need every language's manifest struct, so the
dump records the data instead. `rust/tools/fn-diff/symbols-hook.mjs` is a module resolve hook that redirects
every import of `src/core/normalizeSymbols.ts` to `symbols-wrap.ts`, which re-exports the real module but
wraps `makeSymbolNormalizer` to keep its `SymbolData`, its caller (the language dir, from the stack) and every
`(input, output)` the returned closure sees. The dump then runs the public sync `phonemize` over the goldens
(and FLEURS where `FLEURS_DIR` names it), and emits one `def` row per distinct tier followed by its pairs. The
replay deserializes `SymbolData` straight from the def row. `countForm` is a function, so it is named by
identity (`default`, `slavic`) or by its esbuild-minified source, which the replay maps onto a Rust twin and
refuses (panics) when it has none. Ten distinct sources occur (`()=>0`, the Baltic, Czech, Polish, Slovak,
Slovenian, Macedonian and Maltese selectors, and the uk/be `isInteger ? slavic : 3`), and all ten have twins.
es, fr and hi also get their RAW texts through their own tier, and every tier gets
`probes/symbols.txt` (24 synthetic lines, one per arm plus the neighbour it must decline).

**Command.** `SYMBOLS_LANGS=es,fr,hi npx tsx rust/tools/fn-diff/dump.mts symbols > .probe/es/symbols-3.jsonl`,
then `cargo run --release -p fn-diff -- symbols ../.probe/es/symbols-3.jsonl`.

**Raw finding.**
```
  hindi: 3438 identical, 0 DIFFER
  hindi-raw: 154 identical, 0 DIFFER
  french: 3975 identical, 0 DIFFER
  french-raw: 709 identical, 0 DIFFER
  spanish: 3896 identical, 0 DIFFER
  spanish-raw: 248 identical, 0 DIFFER
symbols: 12420 identical, 0 DIFFER
```
(before the probe set was added). 128 normalizers are built at module load, 128 distinct. With the probes
and `SYMBOLS_LANGS=es`: `probe: 3072 identical`, `spanish: 3896`, `spanish-raw: 248`, 0 DIFFER.

**How much of that exercised the tier.** Of the 3,896 Spanish pipeline inputs, only 108 are CHANGED by the
tier; of the 248 raw-only texts, 17. The probes change 2,331 of 3,072 rows. So the corpus witnesses the common
arms (percent, currency, units) and the probes carry the rest.

Dead end: the first harness emitted `countForm` as hand-typed pretty sources (`(n) => (n === 1 ? 0 : 1)`); tsx
hands the hook esbuild output, which is minified (`n=>n===1?0:1`), so every custom selector was skipped. The
signature is now the minified source verbatim.

Dead end: a Python patch matched an 8-space-indented line inside the new 16-space-indented arm first and put
the def-row `continue` into the wrong loop (a panic in `units`, not a silent pass).

## Run 3 — 2026-10-09 16:05 (the whole fleet, and the commit)

**Command.** `npx tsx rust/tools/fn-diff/dump.mts symbols > .probe/es/symbols-all.jsonl` (every golden, 189
languages, plus FLEURS for the `FLEURS_DIR` ones, plus the probe set through every tier), then the replay.

**Raw finding.** `symbols: 131 normalizers recorded, 130 distinct` (three are built lazily on first use).
`symbols: 50750 identical, 0 DIFFER` over 132 sources, including `probe: 3120` (130 × 24), `hindi: 4043`,
`french: 3975`, `spanish: 3902`, `russian: 136`, `czech: 117`, `polish: 113`. Of the 47,630 corpus rows, 1,694
are changed by the tier; of the 3,120 probe rows, 2,371.

**Is the replay sensitive?** Two deliberate breaks (the default exponent position After → Before, and `MANY`
5 → 2), replayed over the es dump: `probe: 28 DIFFER, spanish: 6 DIFFER, spanish-raw: 4 DIFFER`. Reverted.

**Implication.** Committed alone as 9aceb875 (parent origin/main 78174e0a) for the siblings to cherry-pick.
`cargo test --workspace` green (3 new unit tests), 0 warnings.

## Run 4 — 2026-10-09 16:20 (Spanish: the golden gate, first look)

**Command.** `cargo run --release -p parity -- es` after porting manifest, g2p, numbers, roman_ordinals,
normalize and spanish (and one arm each in `build`, `roman_policy`, `LANGUAGES`).

**Raw finding.** `es: 200/200 identical, 0 differ` (the golden has 111 distinct texts), and the same with
`--sync`. en and en-GB stay at 200/200.

**Implication.** The golden is narrow, so the per-module differentials carry the weight.

## Run 5 — 2026-10-09 16:35 (per-module differentials)

**Commands.** `dump.mts es-normalize | es-g2p | es-numbers`, each replayed by `fn-diff`. Inputs: the es golden,
FLEURS es_419 columns 3 and 4 (checked: the first line is a corpus sentence of read news-style prose, not a WAV filename)
and `probes/es.txt` (45 synthetic lines). es-normalize runs each text three ways: `normalizeSpanish`, with
`americas: true`, and the initialism pass after it. es-g2p feeds `phonemizeWord` and `toSegments` every
letter run of those texts (as written and lowercased) plus every 1–3 letter string over 38 letters. es-numbers
covers 0…20,000, the powers of ten to 10¹⁹ and their neighbours, the unsafe and non-integer values, the raw
digit path, and `spanishOrdinal` over the same.

**Raw finding.**
```
  golden: 333 identical, 0 DIFFER
  fleurs: 11355 identical, 0 DIFFER
  probe: 135 identical, 0 DIFFER
es-normalize: 11823 identical, 0 DIFFER
es-g2p: 53714 identical, 0 DIFFER
es-numbers: 40153 identical, 0 DIFFER
```
The first es-numbers replay was `40150 identical, 3 DIFFER`: `1e21`, `1.234567e+21` and `Infinity` without
`raw`. `String(Math.abs(n))` is JS Number::toString, and the port had used Rust's `{}` (`1000000…`, `inf`).
Now `js_number_string` reproduces it (exponent form from 1e21, `Infinity`). The branch is unreachable from
the engine (every unsafe value comes from a digit token, which passes `raw`), but the function is held to the
TS anyway.

**Per-arm coverage of normalize.ts.** A scratch resolve hook (`.probe/es/cov/`) wrapped `rewrite` for the
Spanish modules and counted, per pattern, the texts it MATCHED and the texts it CHANGED:

| arm | corpus matched/changed | probe matched/changed |
|---|---|---|
| 0 digit groups (run twice) | 30/30 | 3/3 |
| 0 separators → space | 3896/0 | 44/0 |
| 0b dot decimal | 9/9 | 3/3 |
| 1 a. C. / d. C. | 6/6, 3/3 | 1/1, 1/1 |
| 2 EE. UU. / ee. uu. | 17/17, 4/4 | 1/1, 1/1 |
| 2b a. m. / p. m. | 7/7 | 1/1 |
| 3 número | 2/2 | 1/1 |
| 4 dotted abbrev (continues / ends) | 10/10, 5/5 | 4/4, 3/3 |
| 5 ordinal indicators | 2/2 | 4/4 |
| 6 ±, glued +, spaced +, minus | 0, 0, 4/4, 0 | 1/1 each |
| 6b = < > ÷ | 0 each | 2/2, 1/1, 1/1, 1/1 |
| 7 fractions | 2/2 | 2/1 (the decline line matches and is refused) |
| 8 times | 34/34 | 3/3 |
| 9 first of the month | 6/6 | 1/1 |
| `o$` inside the `1er` callback | 2/2 | 1/1 |

Seven arms (±, glued +, minus, =, <, >, ÷) are reached ONLY by the probes. Every arm is reached by at least one
probe line. Probe lines bundle several cases each, so the per-arm evidence is a line or two.

## Run 6 — 2026-10-09 16:45 (end to end)

**Command.** `LANGS=es npx tsx rust/tools/fn-diff/dump.mts phonemize-sync` and `phonemize-best`, replayed by
`fn-diff`.

**Raw finding.** First pass: `3940 identical, 0 DIFFER` for both. The haystack has NO non-Latin script run
(only `º`/`ª`), so the foreign-reader path was unexercised. One probe line with Greek, Cyrillic and Han runs
was added: `3940 identical, 1 DIFFER` for both, and the one row is that line. The TS reads *alfa*, *sɫˈovə* and
*ʈ͡ʂʊŋ˥˥* through el, ru and cmn; Rust drops all three because those engines are not ported. That row is
PORT-PENDING (el, ru, cmn), not a defect.

**TS findings (reported, not fixed; the Rust ports current behaviour).**
1. **A substring call on the provenance seam** (normalize.ts step 5): `rewrite(masc, /o$/u, "")` is handed the
   ordinal word, not the pipeline string. Under a trace, `onPoison` fires: `"el 1er lugar" vs "primero"` and
   `"el 3er día" vs "tercero"`, which tools/provenance-poison.mts would class as SUBSTRING. It should be
   `masc.replace(/o$/u, "")`. The outer rewrite re-commits the mapping, so only the poison report is wrong.
2. **The apocopated forms are missing before a noun** (numbers.ts): `21000` reads *veintiuno mil*, `31000`
   *treinta y uno mil*, `101000` *ciento uno mil*, and `21000000` *veintiuno millones*. The norm is
   *veintiún mil*, *treinta y un mil*, *ciento un mil* and *veintiún millones*. `numberToWords` has no
   apocope, though `fractions.numeratorOne` shows the language already knows the form. Not measured against
   audio here.
3. **`er` is accepted after any number** (step 5): only `1er` and `3er` (*primer*, *tercer*) are real, but
   `2er` reads *seɣˈund* and `5er` *kˈint*, because the `-o` is stripped from whatever ordinal comes back.
   Unattested in either corpus, so this is low priority.
4. No `Object.prototype` read is reachable. `letterNames[l]` gets one code point, `DOTTED_ABBREV` gets a
   fold of its own keys (the miss is handled), `ACCENTED`/`STOP_TO_FRIC` get phones, `CLAUSE_MARK` gets one
   of its own keys, and `DENOMINATOR[String(den)]` gets "2"–"999".

**Implication.** es meets #1463's definition of done on this machine: golden 200/200, every differential at
0 DIFFER except the one port-pending probe row. `cargo test --workspace`: 46 passed. `cargo build`: 0 warnings.

## Run 7 — 2026-10-09 17:40 (review round, rebased onto main c64801a5)

**Changes.**
- Rebased onto origin/main c64801a5 (#1467 ja, which includes the reviewed symbol tier, and #1468). The
  standalone symbol commit (9aceb875) is superseded by main's version and was dropped. The shared lists merged
  by keeping both sides: `LANGUAGES` is `en, en-GB, es, ja`, and `build` has both a `ja` and an `es` arm. I
  checked each arm and each fn-diff entry for completeness after the merge.
- The manifest loader is `core::data_source::load_once`, so a failure is retried instead of cached.
- No public entry point can reach the `MANIFEST` panic. The module functions are `pub(crate)` and `MANIFEST`
  is `pub(crate)`. Their public face is methods on `SpanishPhonemizer` (`normalize`, `normalize_initialisms`,
  `phonemize_word`, `segments`, `number_to_words`, `ordinal`). Holding one proves `create_spanish` loaded the
  manifest, and the differentials now go through them. The Roman-ordinal closure, which `registry::pre_pass`
  reaches without building the engine, calls `try_manifest()` first and declines the ordinal (so the
  cardinal stands) instead of panicking.
- The private `js_number_string` and `is_safe_integer` are deleted in favour of core
  `js_number_to_string`/`is_safe_integer`. normalize.rs builds its alternations with core
  `sorted_by_length_desc`/`alternation`.
- The `symbols` replay no longer keys `countForm` by esbuild-minified source. A selector travels by NAME
  (`default`, `slavic`, `custom:<language dir>`) plus `countProbe`, the TS selector's values on a fixed
  31-value vector (integers around every boundary, fractions, negatives, NaN, Infinity). The replay asserts its
  twin reproduces that vector. Proved by breaking the Maltese twin: `countForm custom:maltese(11): the Rust
  twin no longer matches the TS`. Restored.
- Run 5's doc quoted a FLEURS sentence verbatim. It now describes it ("a corpus sentence of read news-style
  prose").

**Raw finding (every gate, after the changes).**
```
parity:          en 200/200, en-GB 200/200, es 200/200, ja 200/200
es-normalize:    11823 identical, 0 DIFFER  (golden 333, fleurs 11355, probe 135)
es-g2p:          53714 identical, 0 DIFFER
es-numbers:      40153 identical, 0 DIFFER
phonemize-sync:  3940 identical, 1 DIFFER   (the port-pending el/ru/cmn probe line)
phonemize-best:  3940 identical, 1 DIFFER   (the same line)
symbols:         131 recorded, 130 distinct; 50750 identical, 0 DIFFER; 14 custom countForms, all checked
cargo test --workspace: 50 passed; cargo build (debug, release): 0 warnings; cargo fmt --check clean
```

**Implication.** Done. The TS findings of Run 6 stand, still reproduced, for the later TS-first batch.

## Run 8 — 2026-10-09 18:10 (rebased onto main cd2492a8, after Italian #1469)

**Command.** `git rebase origin/main`. The shared-list conflicts were resolved by keeping both sides:
`LANGUAGES` = en, en-GB, ja, it, es; `build` and `roman_policy` both have the `it` and `es` arms; `mod.rs` lists
italian and spanish. fn-diff merged cleanly, and every dump entry has its replay arm. Then every gate again.

**Raw finding.** parity `en`, `en-GB`, `ja`, `it`, `es`: 200/200 identical each. es-normalize 11,823 / es-g2p 53,714 /
es-numbers 40,153 identical, 0 DIFFER. phonemize-sync and -best: 3,940 identical, 1 DIFFER, the port-pending
el/ru/cmn probe line as before. `cargo test --workspace`: 53 passed. Debug and release builds: 0 warnings.
`cargo fmt --check` flags only main's italian files and the mod list's order (main's own order), none of mine.

**Implication.** Ready to merge as it stands.

## Run 9 — 2026-10-09 18:30 (Run 6's findings 1–3, fixed TS-first; branch `fix/es-port-findings`)

**Question.** Do the three Run 6 findings close in all three engines, and what moves when they do?

**Fixes (TS, then C#, then Rust).**
- **Apocope of the multiplier** (finding 2). spanish.jsonc `numbers.apocope` = `{uno: un, veintiuno: veintiún}`.
  numbers.ts `multiplier()` applies it to the LAST word of the words before `mil` (below1e6) and before a scale
  noun (numberToWords). The final group keeps the full form (21021 = *veintiún mil veintiuno*).
  **Feminine.** I checked for a feminine path and found none that reaches `mil`: `feminineCardinal` is called
  only from `timeWords` (hours ≤ 23, minutes ≤ 59). The number token has no noun-gender knowledge, so
  `21000 personas` reads *veintiún mil personas*. The apocopated form is the one the engine can always give.
  *Veintiuna mil* would need gender agreement, which no engine has.
- **`er` restricted** (finding 3). The indicator is accepted only when the ordinal ends in `ordinals.units[1]`
  or `[3]` (primero or tercero), so `1er`, `3er`, `13er` (*decimotercer*), `21er` (*vigésimo primer*) and `1.er`
  are accepted. Any other number declines and stays as written: `2er` is now *dˈos ˈeɾ* (was *seɣˈund*), `5er`
  *θˈinko ˈeɾ* (was *kˈint*), `11er` *ˈonθe ˈeɾ* (was *undˈeθim*).
- **Off the seam** (finding 1). `rewrite(masc, /o$/u, "")` → `masc.replace(...)`. The C# had a SECOND copy
  of the same mistake that the TS did not: `FeminineOrdinal` called `Rewrite(w, FINAL_O, "a")` on each word, so
  every `1ª` poisoned under a C# trace. Fixed as well; the TS was already a plain replace there.

**Before → after (the fixed engine's output, `.probe/es/fix/{before,after}.txt`).** 21000 *veintiuno mil* →
*veintiún mil*; 31000 *treinta y uno mil* → *treinta y un mil*; 101000 *ciento uno mil* → *ciento un mil*; 21000000
*veintiuno millones* → *veintiún millones*; 1001000000 *mil uno millones* → *mil un millones*. End to end,
`21.000` reads *beᶦntjˈuno mˈil* → *beᶦntjˈun mˈil*.

**Poison.** `tools/provenance-poison.mts es es-419` reads only the goldens, and they hold no ordinal indicator
(0 rows match `[0-9](er|º|ª)` in either file), so it reports `distinct poison sites: 0` both BEFORE and after
the fix and proves nothing. A scratch copy (`.probe/es/fix/poison-probes.mts`) uses the same classifier over
`probes/es.txt`. With the old normalize.ts it reports `distinct poison sites: 1 (SUBSTRING 1, desync 0)`,
`2 SUBSTRING src/languages/spanish/normalize.ts:198:40`. With the fix it reports `distinct poison sites: 0`.
C# `parity --poison es es-419`: 0 sites.

**Tests, each proved by reverting its fix.** test/spanish-port-findings.test.ts (5 tests):
- numbers.ts reverted: the two apocope tests fail.
- the `er` gate reverted (keeping `.replace`): "stays as written" fails.
- `rewrite` restored (keeping the gate): the poison test fails with `["el 1er lugar vs primero", "el 3er día vs
  tercero"]`.

C# SpanishPortFindingsTests (4): with both files reverted, all 4 fail, and the poison test shows `["el 1er lugar vs
primero", "el 3er día vs tercero", "la 1ª vez vs primero"]`. Rust (3 new tests in spanish.rs): with numbers.rs and
normalize.rs reverted, all 3 fail. No existing test in any engine pinned the old readings.

**Goldens.** `npm run check:goldens`: `goldens fresh: 189 languages, 36495 rows, 0 stale`. Nothing was
regenerated, es and es-419 included.

**Differentials, from the FIXED TS.** The es-numbers inputs gain every multiplier k·10³, k·10³+21, k·10⁶,
k·10⁶+1, k·10⁹, (k+1000)·10⁶ and k·10¹² for k = 1…999, because the old range stopped at 20,000 and never reached
21,000. probes/es.txt gains two synthetic lines (the `er` declines and accepts; the apocope).
```
es-normalize:   11829 identical, 0 DIFFER  (golden 333, fleurs 11355, probe 141)
es-g2p:         53716 identical, 0 DIFFER
es-numbers:     54139 identical, 0 DIFFER
phonemize-sync: 3942 identical, 1 DIFFER
phonemize-best: 3942 identical, 1 DIFFER
```
The one DIFFER row is the Run 6 port-pending foreign-script probe line. cmn is ported now and matches; el and
ru are still unported. Is the replay sensitive? Against the OLD Rust, the same dumps give `es-numbers: 53515
identical, 624 DIFFER` and `es-normalize: probe 3 DIFFER`.

**What moved.** An old-TS vs new-TS `phonemize-sync` dump over the same inputs: 2 rows moved, and both are the
two new probe lines. 0 golden rows moved and 0 FLEURS rows moved. Neither corpus has a multiplier ending in
*uno* before *mil*/*millones*, or an `er` indicator after any other number.

**Gates.** Rust `parity` (all ported: en, en-GB, ja, it, es, pt, pt-BR, hi, cmn, fr): 200/200 identical each.
`cargo test --workspace`: 68 + 1 passed. Debug and release builds: 0 warnings. `cargo fmt --check` clean. C#
`parity es es-419`: 400 rows ok, 0 differ. C# full `dotnet test`: 7037 passed, 0 failed. TS: `npm run typecheck` clean, and `npx vitest run` gives 339 files, 6382 passed and 5 skipped.

**Left open (same defect class, outside this batch).** A fraction numerator is a multiplier too: `21/5` reads
*veintiuno quintos* where the norm is *veintiún quintos*. A bare cardinal before a noun (`21 años`) also reads
*veintiuno*. Fixing that one needs a decision between the pronoun and adjective readings, which the number
token cannot make alone. (The fraction case is fixed in Run 10.)

## Run 10 — 2026-10-09 19:10 (review round, rebased onto main 944b4940)

**Question.** The review found four more things. (1) The apocope misses a digit token followed by a WRITTEN
scale noun (`21 millones`). (2) Fraction numerators also need the multiplier. (3) `apocope` restated `ones`, and
nothing checked its keys. (4) A declined `2.er` kept its `.`, which became a phrase break. Do all four close in
the three engines, and does any corpus row move?

**Changes.**
- Number token (spanish.ts / Spanish.cs / spanish.rs): `numberTokenWords(tok, after)` applies `multiplier` when
  the rest of the pipeline string starts with `\s+` and then `mil`, a `many`, or the last word of a scale's `one`
  (`millón`, `billón`), case-insensitive, with `(?![\p{L}\p{M}])` so `milímetros` and `miles` do not count. The
  nouns are built from the manifest. A decimal token is left alone: `2,1 millones` keeps *dos coma uno*, since
  its digits after the comma are read one by one.
- Fractions: every numerator goes through `multiplier`. `fractions.numeratorOne` is retired, because
  `apocope["1"]` is the same "un". The manifest-lifted test pinned `numeratorOne`, and it now pins `apocope["1"]`,
  with the reason in the test, in TS and C#. Portuguese and Italian comments still mention Spanish's old key.
  Those are comments in other languages' files, left alone.
- `numbers.apocope` is keyed by number (`{"1": "un", "21": "veintiún"}`), so the full word lives only in
  `ones`. The loader maps `ones[key]` to the short form and throws when a key is not all digits or is not a slot
  (TS `Error`, C# `InvalidDataException`, Rust `try_manifest` → `Err`). Checked by breaking it: key "30" →
  `spanish.jsonc numbers.apocope: key "30" is not a numbers.ones slot`.
- `ordinals.apocopating: ["primero", "tercero"]` replaces the `units[1]`/`units[3]` test. Each entry must be a
  `units` word, checked at load: with "terzero" →
  `spanish.jsonc ordinals.apocopating: "terzero" is not an ordinals.units word`.
- A declined `er` returns `String(n)`. The marker goes, the cardinal stands, and the same holds past 1000
  (`1001er` → `1001`). º and ª past 1000 still keep the raw match. That is outside this finding.
- Rust: the poison test clears the hook in a `Drop` guard. `SPACE`, the word-keyed `APOCOPE` map and
  `APOCOPATING_ORDINALS` are `LazyLock` statics.
- `csharp/regex-corpus.jsonl` re-extracted (`tools/extract_regexes.mts`; the TS key check added `^\d+$`).
- probes/es.txt: three more synthetic lines (written scale nouns, the declines, fractions and `2.er`).

**Readings (fixed engine, `.probe/es/fix/probe2.mts`).** `21 millones de personas` → *beᶦntjˈun miʎˈones*;
`101 mil` → *θjˈento un mˈil*; `1 millón` → *un miʎˈon*; `21 billones` → *beᶦntjˈun biʎˈones*; `21/5` →
*veintiún quintos*; `21/100` → *veintiún centésimos*; `el 2.er piso` → *el dˈos pˈiso* (was *el dˈos . ˈeɾ
pˈiso*). Declines: `21 milímetros`, `21 años` and `2,1 millones` keep *uno*.

**FLEURS.** Among the non-probe texts of the es haystack (golden + FLEURS es_419, 3,898 texts), 30 have a
digit token followed by a written mil/millón/millones/billón/billones (40 occurrences). By last digit: 10 end
in 0, 6 in 7, 4 in 2, 2 each in 3, 4 and 5, and 10 are decimals. NONE is an integer whose last group ends in
1, so the rule is right but no corpus row exercises it. An old-vs-new `phonemize-sync` dump over the same inputs
(`.probe/es/fix/moved.mts`): `{ probe: 3 }`. 0 FLEURS rows moved and 0 golden rows moved; the 3 moved rows are
the new probe lines.

**Tests, each proved by reverting its fix.** TS (7 in spanish-port-findings): reverting the number-token
multiplier, the fraction multiplier and the `String(n)` decline fails 3. C# (6): the same reverts fail 3. Rust
(5 Spanish tests in spanish.rs): the same reverts fail 3.

**Gates on the rebased tree.**
```
check:goldens:   goldens fresh: 189 languages, 36495 rows, 0 stale
TS:              typecheck clean; 340 files, 6388 passed, 5 skipped
C#:              dotnet test 7043 passed, 0 failed; parity es es-419 400 ok, 0 differ; --poison 0 sites
regex-diff:      C# 145198 identical, 0 DIFFER; Rust 145198 identical, 0 DIFFER
es-normalize:    11838 identical, 0 DIFFER (golden 333, fleurs 11355, probe 150)
es-g2p:          53724 identical, 0 DIFFER
es-numbers:      54139 identical, 0 DIFFER
phonemize-sync:  3945 identical, 1 DIFFER   (the el/ru port-pending probe line)
phonemize-best:  3945 identical, 1 DIFFER   (the same line)
Rust parity:     en en-GB ja it es pt pt-BR hi cmn fr: 200/200 each
cargo test --workspace: 71 + 1 passed; debug and release builds 0 warnings; cargo fmt --check clean
```
Against the PRE-review Rust, the same dumps give `phonemize-sync: 4 DIFFER` and `es-normalize: 6 DIFFER`.

Dead end: the first TS full run on the rebased tree failed 6 subprocess tests (check-goldens --jobs refusals,
build-en-gb-sets) because they time out after about 5 s. They ran alongside `dotnet test` and the dumps; alone
they pass (11/11), and the solo full run is green. During that run I also briefly swapped the spanish.jsonc
and Rust files for the sensitivity check, so I re-ran both full suites alone afterwards. The numbers above come
from those solo runs.

**Rebased again onto main b6629d83 (#1482, ja), no conflicts, every gate re-run in sequence.** check:goldens:
189 fresh, 0 stale. TS: typecheck clean; 341 files, 6403 passed, 5 skipped, with regex-corpus-fresh green.
C#: 7068 passed; parity es es-419 400 ok; regex-diff 145198 identical, 0 DIFFER. Rust, over dumps regenerated
on this tree: es-normalize 11838, es-g2p 53724 and es-numbers 54139 identical, 0 DIFFER; sync and best 3945
identical, 1 DIFFER (the same port-pending line). Rust regex-diff 145198 identical; parity 200/200 for all 10
languages; `cargo test --workspace` 75 + 1 passed; 0 warnings in debug and release; fmt clean.
