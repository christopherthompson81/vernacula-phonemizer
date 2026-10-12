# Rust port: Serbian, Croatian, Bosnian (sr, hr, bs)

The three Serbo-Croatian standards share one word g2p: `croatian.ts` and `bosnian.ts` import `phonemizeWord` and
`foreignLetters` from `serbian/serbian.ts`, and both normalizers import `normalizeSerbianInitialisms` and
`readDecimalComma` from `serbian/normalize.ts`; `composeSlavicNumber` (serbian/numbers.ts) is the cardinal
compositor all three call with their own word table. So Serbian is ported in full and the other two are thin:
their own manifest, numbers wrapper, normalizer and engine file. None has a neural entry (`neuralRegistry.ts`
lists none of them), and `ROMAN_POLICIES` names none of them (the registry's default Roman pass applies).

Import closure: `serbian/{manifest,numbers,normalize,serbian}.ts` plus core `clauses`, `hostWord`
(`hostWordRun`, `LATIN_RUN`, `makeNativiser`), `loadTsv`, `numbers` (`digitIndex`), `normalizeSymbols`
(`makeSymbolNormalizer`, `slavicCountForm`), `initialisms`, `boundaries`, `provenance`, `loadManifest`. All
already ported, so the group adds NO core module. One small JS-semantics helper joins `core/js_string.rs`:
`is_object_prototype_key`, for the record lookups that read an inherited `Object.prototype` member (see Run 3).

Host routing: `core/scripts.ts` has `sr: { Cyrillic: "sr" }`, and `scripts.rs` already carries it, so a
Cyrillic run inside sr text is Serbian's own. Serbian's TOKEN claims both scripts itself
(`hostWordRun(["Latin"], "а-шђјљњћџ")`), so a run reaches the router only when it is neither.

The engines share code in Rust where the TS has three identical copies (an engineering cleanup the contract
allows): the ordinal paradigm (`SlavicOrdinals` in serbian/normalize.rs, each standard supplying its own
hundreds row, word for 1000, ENDINGS record and cardinal table), `lat`/`cyr`, `counted`, `replaceEra` and the
dotted-abbreviation arms. Each standard's tables stay its own.

## Run 1 — 2026-10-10 21:35 (baseline, before any Serbo-Croatian code)

**Question.** What do the gates read before anything is registered?

**Command.** `cd rust && cargo build --release -p parity -p fn-diff && ./target/release/parity`.

**Raw finding.** en, en-GB, ja, it, es, pt, pt-BR, hi, cmn, fr, el, ko, th, ru, de, pl, tr, nl, uk, sv: each
`200/200 identical, 0 differ`. sr/hr/bs/sl/lt/lv are not registered.

**Implication.** Port Serbian (four modules) first; hr and bs depend on it.

## Run 2 — 2026-10-10 21:40 (Serbian end to end, golden)

**Question.** With `serbian/{manifest,numbers,normalize,serbian}.rs` ported and `sr` registered (`build`,
`LANGUAGES`), what does the golden gate say?

**Command.** `cd rust && cargo build --release && ./target/release/parity sr`.

**Raw finding.** `sr: 200/200 identical, 0 differ` on the first build.

**Implication.** A narrow probe; next the per-module differentials.

## Run 3 — 2026-10-10 21:50 (Serbian per-module differentials)

**Question.** Do the normalizer, the shared g2p, the fold, the nativiser and the compositor match the TS
beyond the golden?

**Command.** New `dump.mts` entries `sh-normalize` (`SH_LANGS=sr`), `sh-g2p`, `sh-numbers` (and `sr/hr/bs/sl/
lt/lv` in `FLEURS_DIR`), replayed by `fn-diff` arms of the same names:
`FLEURS_ROOT=<external-drive>/… npx tsx rust/tools/fn-diff/dump.mts <name> > .probe/sh/<name>.jsonl`, then
`./target/release/fn-diff <name> ../.probe/sh/<name>.jsonl`; and `LANGS=sr phonemize-sync` / `phonemize-best`.
- `sh-normalize`: per text, `normalizeSerbian`, `normalizeSerbianInitialisms` and `readDecimalComma` on the raw
  text, and the symbol tier rebuilt from normalize.ts's own `SYMBOLS` literal (evaluated from the source, so
  the dump holds no second copy of it); `isUnreadableSerbian` over every letter run. Synthetic rows: 42
  numbers × 22 suffixes (both scripts), `N.` before 52 licensor-shaped words of all three standards plus the
  `Object.prototype` names, every hour 0–25 × 6 minute values in five frames, the degree before every bearing
  letter, the era markers and dotted abbreviations before 7 followers, and the sign shapes.
- `sh-g2p`: `phonemizeWord` over all 101,965 stress.tsv keys, every 397th key uppercased and with each of
  the transition table's endings appended (the OOV accent tier); `phonemizeWord`, `foreignLetters`, Serbian's
  and Croatian's nativisers and `accentLexiconHas` over every letter run of the sr/hr/bs texts (as written,
  lowercased and folded), every 1–2 letter string over both alphabets plus q w x y й, every 3-letter string
  over 21 context letters, and edge strings (a lone surrogate, `ljjubav`, `pop-pevač`, `SSSR`, `HOLLAND`, …).
- `sh-numbers`: `composeSlavicNumber` over 0..20000, multiples and powers of ten, 2^53±, 1e21, NaN, ±∞, −0,
  and raw strings for the digit fallback (here only the sr table; hr/bs come with their ports).
- `probes/sr.txt`: 57 synthetic lines, at least one per normalize.ts arm with the neighbour it must decline.

**Raw finding.** First build, every replay clean:
```
sh-normalize (sr): 71460 identical, 0 DIFFER  (golden 448 / fleurs 15328 / probe 228 / synthetic 27904 / words 27552)
sh-g2p:           839654 identical, 0 DIFFER
sh-numbers (sr):   27066 identical, 0 DIFFER
phonemize-sync:     4001 identical, 0 DIFFER
phonemize-best:     4001 identical, 0 DIFFER
```

**JS semantics reproduced on purpose.**
- `LICENSOR[lat(word)]` is a plain-object lookup, and `constructor` is an `Object.prototype` member whose
  name survives `lat`'s lowercasing: the slot is a FUNCTION, `ENDINGS[slot]` then misses, and the template
  stringifies `inflect(...)!` as `undefined`. `Bilo je 5. constructor i dalje.` → `Bilo je undefined
  constructor i dalje.` (TS output). `Slot::Proto` in Rust.
- The middle dotted-abbreviation arm's `DOTTED[lat(ab)]!` (#1122): `Voće итᲁ., даље` (U+1C81, which `iu`
  folds onto д) → `Voće undefined, даље`.
- `"aeiou".includes(LETTERS[c])` is a SUBSTRING test; the vowel set is derived the same way.
- The transitions table's tone is not validated (`t as Accent["tone"]`): a tone outside `TONE` would read
  `undefined`. No row has one; kept.
- `phonemizeWord` scans code units, `isLetterRun` lowercases code point by code point.

**Implication.** Serbian matches. TS findings are collected in the findings run below.

## Run 4 — 2026-10-10 22:05 (test pins, gates for the sr commit)

**Question.** Do test/serbian.test.ts's expectations hold in Rust, and are the gates green with sr registered?

**Command.** `.probe/sh/pins.mts` (new; gitignored): parses each `expect(F(<literal>)).toBe/.not.toBe/.toContain(
<literal>)`, resolves the local helpers (`say`, `d.text(…).trim()`) from their nearest preceding definition,
EVALUATES the call in the TS engine, throws unless the test's own literal holds there, and prints a Rust
assertion holding the evaluated value. Then `cargo fmt`, `cargo clippy --workspace --release`, `cargo test
--release --workspace`, `./target/release/parity`.

**Raw finding.**
- `test/serbian.test.ts: 122 pins extracted, 15 skipped` (the skipped are computed expectations:
  `a.split(" ").length`, `toBe(say(…))`, loops over a language list). One pin is `phonemize("tko", "hr")`, which
  fails with `UnknownLanguage("hr")` until Croatian is registered; it is held back from this commit and lands
  with hr.
- `cargo test`: 131 + 1 passed. parity: the 20 earlier languages and sr each `200/200 identical, 0 differ`.
- clippy: nothing in the new files except `module_inception` on `serbian::serbian`.

**Implication.** Commit sr; port Croatian.

## Run 5 — 2026-10-11 09:20 (Croatian: port, differentials, pins)

**Question.** With `croatian/{manifest,numbers,normalize,croatian}.rs` ported (the tier `SYMBOLS` lives in
croatian.rs, as croatian.ts exports it and normalize.ts imports it) and `hr` registered, do the golden, the
per-module differentials and test/croatian.test.ts hold?

**Command.** `./target/release/parity hr`; `SH_LANGS=sr,hr sh-normalize`, `sh-numbers` (sr+hr rows), `LANGS=hr
phonemize-sync` / `phonemize-best`, with the new synthetic `probes/hr.txt` (39 lines, one or more per arm);
`.probe/sh/pins.mts test/croatian.test.ts hr e`; then the full gates.

**Raw finding.** One compile error (a `LazyLock<Box<dyn Fn>>` passed where `&dyn Fn` was wanted), then:
```
parity hr:          200/200 identical, 0 differ
sh-normalize sr+hr: 125612 identical, 0 DIFFER  (golden 828 / fleurs 31028 / probe 380 / synthetic 55808 / words 37568)
sh-numbers sr+hr:    54132 identical, 0 DIFFER
phonemize-sync hr:    4058 identical, 0 DIFFER
phonemize-best hr:    4058 identical, 0 DIFFER
pins: test/croatian.test.ts 92 extracted, 11 skipped (computed expectations); sr's held-back hr pin restored
cargo test --release --workspace: 133 + 1 passed; parity all 22 languages 200/200
clippy: only module_inception on croatian::croatian in the new files
```

**JS semantics reproduced on purpose.** Croatian's `LICENSOR[word]` is NOT lowercased (Serbian's goes through
`lat`), so every `Object.prototype` name starting with a lowercase letter reads the inherited member:
`Bilo je 7. hasOwnProperty i 3. toString.` → `Bilo je undefined hasOwnProperty i undefined toString.` (TS).

**Implication.** Commit hr; port Bosnian.

## Run 6 — 2026-10-11 09:50 (Bosnian: port, differentials over all three, trace, pins)

**Question.** With `bosnian/{manifest,numbers,normalize,bosnian}.rs` ported (TOKEN and the nativiser are
Serbian's character for character, so they are reused) and `bs` registered, do all gates hold for the three
standards together?

**Command.** `./target/release/parity bs`; `sh-normalize` (all three), `sh-g2p`, `sh-numbers` (all three tables),
`LANGS=bs phonemize-sync` / `phonemize-best`, `LANGS=sr,hr,bs trace`; new synthetic `probes/bs.txt` (29 lines);
pins; full gates. A small Python count over the sh-normalize dump measures how many texts normalize CHANGES
(the haystack check).

**Raw finding.**
```
parity bs:              200/200 identical, 0 differ
sh-normalize sr+hr+bs:  173673 identical, 0 DIFFER  (golden 1252 / fleurs 46452 / probe 492 / synthetic 83712 / words 41765)
sh-g2p:                 839872 identical, 0 DIFFER
sh-numbers (3 tables):   81198 identical, 0 DIFFER
phonemize-sync bs:        3990 identical, 0 DIFFER
phonemize-best bs:        3990 identical, 0 DIFFER
trace sr+hr+bs:          12049 identical, 0 DIFFER
pins: test/bosnian.test.ts 102 extracted, 20 skipped (the extractor first threw on a multi-line expected
      literal — `lit("\n  \"…\"")` returned undefined after `return` + newline; fixed by trimming)
cargo test --release --workspace: 135 + 1 passed; parity all 23 languages 200/200
clippy: only module_inception on the three new language modules
```
Texts normalize changes (changed / total): sr golden 19/112, FLEURS 515/3832, probe 45/57; hr golden 18/95,
FLEURS 584/3925, probe 37/38; bs golden 21/106, FLEURS 623/3856, probe 27/28; synthetic 2879 / 4389 / 4041 of
6976. So the golden reaches roughly one text in six, FLEURS one in seven, and the probes nearly all.

**Implication.** Commit bs. Findings next.

## Run 7 — 2026-10-11 10:05 (TS findings from reading; reported, not fixed)

**Command.** `npx tsx .probe/sh/check.mts <lang> <text>` (normalize, phonemize, phonemizeWord in the TS) and
`.probe/sh/tr.mts` (phonemizeTrace). Every input is synthetic.

**Raw finding (TS output, verbatim):**
1. **Object.prototype names after `N.` read `undefined`** (sr, hr, bs). `LICENSOR` is a plain object.
   sr/bs lowercase the key through `lat`, so only `constructor` reaches it: `Bilo je 5. constructor i dalje.`
   → `Bilo je undefined constructor i dalje.` (IPA `… ˈundefined t͡sˈonstrut͡stor …`); bs's coordinated pair
   doubles it: `U 3. i 4. constructor.` → `U undefined i undefined constructor.` Croatian does not lowercase, so
   `hasOwnProperty`, `toString`, `valueOf`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString` all reach
   it: `Bilo je 7. hasOwnProperty i 3. toString.` → `Bilo je undefined hasOwnProperty i undefined toString.`
   A `Map` or `Object.hasOwn` fixes it. 0 corpus hits (synthetic only).
2. **Serbian's middle dotted-abbreviation arm lacks the #1122 miss guard** (the other two arms have it; Bosnian's
   has it): `Voće итᲁ., даље` (U+1C81, which `iu` folds onto д) → `Voće undefined, даље`.
3. **A clock before a full stop or comma is not read** (sr, bs: `(?![\d:.,])`; hr: `(?![:.\d])`). `Sastanak u
   11:00.` → unchanged, IPA `… jedˈa˩˥naest , nˈu˥˩la .` (the colon read as a pause). The same defect Ukrainian
   has (rust_uk_port_investigation.md Run 5, finding 7).
4. **Serbian's first dotted-abbreviation arm eats a sentence end before a capital**: `Voće, povrće itd. Sutra
   idemo.` → `… i tako dalje Sutra idemo.` (no pause). Bosnian's own header documents this as the divergence it
   fixed; Serbian keeps it.
5. **Croatian's prenominal-Roman slot heuristic reads `-u` as nominative**: `U I. stoljeću.` → `U prvi stoljeću.`
   (`prvom` wanted; `stoljeću` is locative). Multi-letter numerals never reach step 4b through the registry (the
   shared Roman pass turns `IV.` into `4.` and the licensor gives `četvrtom`), so only `I.` and `V.` show it.
6. **Croatian's elided-year rule claims a fraction denominator**: `Vrijednost 2/1000.` → `Vrijednost
   2/tisućite.` The lookbehind `(?<![\d.,\-])` does not exclude `/`.
7. **Bosnian's `intOf` calls `rewrite` on a numeral string** (on the provenance seam, though `n` is not the
   pipeline string). Measured harmless today: `phonemizeTrace("Brzina je 3 m/s i dalje.", "bs")` is
   `traced: true`, 9/9 input spans (the enclosing rewrite recommits the mapping). Reproduced in Rust
   (`rewrite`/`rewrite_lit`); the `trace` replay agrees.

Every table the three manifests declare is read (checked field by field), and every TS module in the three
directories has a Rust twin. Nothing in the goldens, FLEURS or probes routes a run to an unported engine, so no
row is port-pending.

**Implication.** Reported in the PR; Rust reproduces the TS (findings 1 and 2 are pinned by probe and
synthetic rows in the dumps).

## Run 8 — 2026-10-11 17:10 (#1532: the TS fixes, measured on FLEURS)

**Question.** With the Run 7 findings fixed TS-first, what changes in the normalizer output beyond the synthetic
probes?

**Command.** A scratch script runs `normalizeSerbian` / `normalizeCroatian` / `normalizeBosnian` over every unique
FLEURS sr_rs / hr_hr / bs_ba transcript (column 3) before and after the edit, and diffs line by line. The probe
lines are the synthetic ones from Run 7.

**Fixes.**
1. `LICENSOR` lookups go through `core/own.ts` (sr step 7, hr step 7, bs steps 9b and 10). `Bilo je 5.
   constructor i dalje.` → `Bilo je 5. constructor i dalje.` (an unlicensed `N.`, as any other word gets).
2. sr's `,;:` dotted-abbreviation arm falls back to the match: `Voće итᲁ., даље` keeps `итᲁ.`.
3. sr's first dotted-abbreviation arm keeps the dot before a capital (Bosnian's rule): `itd. Sutra idemo.` →
   `i tako dalje. Sutra idemo.`
4. Clock trailing guard `(?![\d:]|[.,]\d)` in all three (sr/bs had `(?![\d:.,])`, hr `(?![:.\d])`).
5. hr step 4b takes a LICENSOR's slot before the ending heuristic: `U I. stoljeću.` → `U prvom stoljeću.`
6. hr step 7b's lookbehind adds `\d\/`: `2/1000.` is no longer a year.

**Raw finding.** First cut of 6 used a bare `/` in the lookbehind, and FLEURS hr caught it: `od sezone 1995./1996.
kada` lost the second year's ordinal (`… devedeset pete/1996. kada`). The season's slash follows a DOT; a
fraction's follows a digit. With `(?<![\d.,\-]|\d\/)` that line is unchanged again. Final diff:
```
sr  3 of 1923 lines change: 06:30 и 07:30.  /  у 22:08.  /  после 11:00,   (each now read as a clock)
hr  1 of 2007: između 06:30 i 07:30.   (the second time, before the full stop)
bs  1 of 1976: u 01:15, prema svjedocima
```
No FLEURS line reaches fixes 1, 2, 3, 5 or 6 (synthetic only); every changed line is fix 4.

**Implication.** Regenerate the sr/hr/bs goldens and look at what moves; then mirror into C# and Rust.

## Run 9 — 2026-10-11 18:10 (#1532: goldens, C# and Rust mirrored)

**Command.** `npx tsx tools/gen_parity_goldens.mts sr hr bs sl lt lv`, then a diff against the pre-fix copies;
the full C# suite and `csharp/tools/parity`; in rust, `parity`, the `sh-normalize` dump replayed by `fn-diff`
(`SH_LANGS=sr,hr,bs`), and `phonemize-sync` / `trace` over the six languages.

**Raw finding.** sr, hr, bs: 0 golden rows move (no golden text holds a clock before `.`/`,`, an
`Object.prototype` name, `itd.` before a capital, `I. stoljeću` or a `N/NNNN.`). C# already used dictionaries
for `LICENSOR` and already had the miss guard on sr's `,;:` arm, so only the clock guards, sr's capital rule and
hr's two edits were ported. In Rust `Slot::Proto` is gone (`slot_of` is an own-key lookup) and sr's first
abbreviation arm is its own regex, because its pattern now captures the follower and Bosnian's does not.
```
sh-normalize sr+hr+bs: 173724 identical, 0 DIFFER  (probe 536 with the 11 new synthetic lines)
phonemize-sync (6 langs): 23466 identical, 0 DIFFER; trace: 23466 identical, 0 DIFFER
parity sr/hr/bs: 200/200 each
```
