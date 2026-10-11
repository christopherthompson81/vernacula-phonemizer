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
