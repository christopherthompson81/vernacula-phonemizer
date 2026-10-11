# Rust port: Russian (ru)

Russian is a rule g2p fed by a lexical stress dictionary (`stress.tsv`, 406k rows) and a loanword hard-е
lexicon (`hard-e.tsv`). It has no neural model (`neuralRegistry.ts` does not list it), so `phonemize_best`
is `phonemize`. The import closure is `russian/{russian,manifest,g2p,normalize,numbers,romanOrdinals}.ts`
plus core `normalizeSymbols` (`makeSymbolNormalizer`, `slavicCountForm`), `clauses`, `initialisms`,
`loadTsv`, `loadManifest`, `numbers` (`digitIndex`), `provenance` and `roman`. Every one of those core
modules is already ported, so this port adds NO core module.

## Run 1 — 2026-10-10 19:51 (baseline, before any Russian code)

**Question.** What do the gates read before Russian is registered, and does any already-ported golden
contain Cyrillic (which registering `ru` would route to the new engine)?

**Command.** `cd rust && cargo build --release -p parity -p fn-diff && ./target/release/parity`; then
`cut -f1 csharp/goldens/<lang>.tsv | grep -cP '\p{Cyrillic}'` for every ported language.

**Raw finding.**
- `en, en-GB, ja, it, es, pt, pt-BR, hi, cmn, fr`: each `200/200 identical, 0 differ`.
- Cyrillic lines in the ported goldens: 0 for every one of the ten. The ru golden: 200 rows, 116 distinct
  texts, 7 with a Latin run (read by the English foreign reader, already ported), none with another script.
- FLEURS ru_ru: 3,693 rows over train/dev/test.

**Implication.** The other ten goldens cannot move when `ru` is registered (no Cyrillic run reaches the
script reader from them). Their FLEURS differentials can: the fr port recorded one FLEURS row
port-pending on ru/el/cmn. That gets re-measured after registration.

## Run 2 — 2026-10-10 20:20 (first end-to-end build, golden)

**Question.** With all six modules ported (manifest, numbers, romanOrdinals, g2p, normalize, russian) and `ru`
registered (`build`, `roman_policy`, `LANGUAGES`), what does the golden gate say?

**Command.** `cd rust && cargo build --release && ./target/release/parity ru`.

**Raw finding.** `ru: 194/200 identical, 6 differ`. Every differing row is a space-grouped number:
`55 000` read `pʲætʲ nolʲ` for `pʲætʲ tˈɨsʲət͡ɕ`, and likewise `17 000` and `104 500` (the thousand word
dropped and the two groups read as separate numbers).

**Cause (mine, a dead end worth keeping).** I had read `GROUP_SPACE` through `cut -d'"' -f2 | od -c`, and
`od -c` prints an ASCII space as blank columns, so I took the literal for three characters (NBSP, NNBSP,
thin space, which is also all its comment names). It is FOUR: `" \xa0  "`, with an ASCII space
first. Re-read with Python `repr` and fixed `GROUP_SPACE`.

**After the fix.** `ru: 200/200 identical, 0 differ`; `--sync ru`: 200/200.

**Implication.** The golden passes on the second build. It reaches only a few normalizer arms (grouping,
the decimal comma, `США`), so the per-module differentials and the probes come next.

## Run 3 — 2026-10-10 20:45 (per-module differentials, end to end over FLEURS and probes)

**Question.** Do `normalize.rs`, the g2p + stress lookup, the number compositor and the Roman policy match
their TS twins beyond the golden?

**Command.** New `dump.mts` entries `ru-normalize`, `ru-g2p`, `ru-numbers`, `ru-roman` (and `ru: "ru_ru"` in
`FLEURS_DIR`), each replayed by a `fn-diff` arm: `npx tsx rust/tools/fn-diff/dump.mts <name> >
.probe/ru/<name>.jsonl`, then `./target/release/fn-diff <name> ../.probe/ru/<name>.jsonl`. Inputs: the golden,
FLEURS ru_ru columns 3 and 4, and the new synthetic `probes/ru.txt` (95 lines, one or more per normalize.ts
arm with the neighbour it must decline, plus g2p/number/Roman corners): 4,030 distinct texts.
- `ru-normalize`: `normalizeRussian`, `normalizeRussianInitialisms(normalizeRussian(t))` per text, and
  `isUnreadableRussian` over every letter run (as written and lowercased). 24,747 rows.
- `ru-g2p`: `phonemizeWord` over every Cyrillic run of the texts (both cases), every 1–3 letter string of the
  33-letter alphabet, every 4-letter string over `тдсзжчцьяеиоайн`, every 50th `stress.tsv` key and every
  `hard-e.tsv` key; plus `toIpa` over 11 words × 10 stress ordinals (0…3, −1, −0, 1.5, NaN, 99, ∞) × 9 hard
  lists (none, [], [0], [1], [0,1,2], [5], [−1], [1.5], [NaN]). 114,798 rows.
- `ru-numbers`: `numberToWords` and `russianOrdinal` over 0..20000, 10^e±, k·10³, k·10⁶ and the float/NaN/∞
  corners, and `numberToWords(Number(raw), raw)` for 8 raw strings (leading zeros, 20 digits, `1e3`,
  fullwidth and astral digits). 50,166 rows.
- `ru-roman`: `normalizeRomans(t, ROMAN_POLICY)`. 4,030 rows.
- `LANGS=ru phonemize-sync` / `phonemize-best`.

**Raw finding.** First build:
```
ru-normalize: 24747 identical, 0 DIFFER   (golden 232 / fleurs 7638 / probe 190 text rows)
ru-g2p: 114798 identical, 0 DIFFER
ru-numbers: 50166 identical, 0 DIFFER
ru-roman: 4030 identical, 0 DIFFER        (golden 116 / fleurs 3819 / probe 95)
phonemize-sync: 4030 identical, 0 DIFFER
phonemize-best: 4030 identical, 0 DIFFER
```

**JS semantics reproduced on purpose.**
- The stress ordinal is a JS number (`loadTsvMap(…, Number)`): `vowelIdx[ord]` reads only for a
  non-negative integer in range (`at_js`), −0 included, otherwise the last vowel. The probed NaN/1.5/−1/99
  ordinals and hard lists exercise it.
- The ё restoration walks UTF-16 units (`w[i]`), the g2p walks code points (`[...w]`).
- `numberToWords`' digit fallback maps `[...raw]` code points; an astral digit is two units and never a digit.
- `GROUP_SPACE` is space + NBSP + NNBSP + thin space (Run 2).

**Object.prototype audit.** `IRREGULARS[w]` is keyed by a lowercased Cyrillic word or number word,
`CONS[c]`/`letterNames[l]` by one code point, `CLAUSE_MARK` by one punctuation mark, `DEVOICE`/`VOICE` by an
IPA value, `CASE_ENDING`/`DOTTED_ABBREV` by a lowercased match of their own alternation. None can be an
`Object.prototype` name. ⚠ `phonemizeWord("constructor")` WOULD return a function in the TS, which is why the
g2p dump feeds Cyrillic only; no shipped path reaches it (TOKEN claims `[а-яёА-ЯЁ]+`).

## Run 4 — 2026-10-10 20:55 (per-arm coverage; what the haystack holds)

**Question.** Which normalize.ts arms do the three sources actually reach? A clean differential over a
haystack without the construct proves nothing.

**Command.** `npx tsx .probe/ru/coverage.mts`: each arm's TS pattern, copied, tested against the RAW text
(texts matched, golden / FLEURS / probe); the real passes for the "changed" rows.

**Raw finding.**
```
0 group 3/38/5        1 до н. э. 0/4/2     1 н. э. 0/7/3       1 т. е. 0/4/2      1 т. д. 0/2/2
1 т. п. 0/0/1         2 № 1/7/2            3 ordinal 0/44/14   3b в … г. 0/2/5
4 abbrev cont 0/8/13  4 abbrev end 0/7/2   5 км/ч 0/14/2       5 м/с 0/2/1        5 °C 0/2/1
5 °F 0/0/1            5 ° 0/2/2            6 clock 2/28/2      7 minus 0/0/1      7 ± 0/0/1
7 +glued 0/2/2        7 +initial 0/2/2     7b = < > ÷ 0/0/1 each                  8 fraction 0/2/4
decimal token 4/35/5  normalize changed 6/154/54   initialisms changed 4/62/3   roman changed 0/41/9
Latin run 7/354/18
```
FLEURS ru_ru (3,918 distinct texts): 0 lines with a letter outside Cyrillic/Latin/Common/Inherited, 0 with
і ї є ґ ў ѣ, 362 with a Latin run.

**Implication.** Every arm is reached at least once. Only the probes reach `т. п.`, `°F`, the minus, `±`
and the four relational/division signs. The golden reaches 5 arms and no Roman numeral, so here too the
golden is the weakest of the three gates. Every Latin run goes to the English reader (ported); no FLEURS or
golden text routes a run to an unported engine.

**Port-pending (synthetic only).** `.probe/ru/extra.mts` → `fn-diff phonemize-sync`: `Слово λόγος` (TS
`sɫˈovə loɣos`, Rust drops the Greek run), `Это 日本 и 한국` (Korean run dropped), `Это שלום` (Hebrew run
dropped): 1 identical, 3 DIFFER, each a run routed to el/ko/he, which are not ported. None occurs in the
golden or FLEURS, so they are kept out of `probes/ru.txt`.

## Run 5 — 2026-10-10 21:05 (TS findings from reading; reported, not fixed)

**Question.** Reading each file for correctness (csharp/PORTING.md's three questions): does the code do what
its docstrings promise, is every table reached, and which reading is wrong?

**Command.** `npx tsx .probe/ru/check.mts` (synthetic inputs through `normalizeRussian`, `phonemizeWord`,
`phonemize`); FLEURS reach by `grep -oP` over the 3,918 distinct texts.

**Raw finding (TS output, verbatim):**
1. **A dotted abbreviation eats a sentence end.** `К 1990 г. Затем пришли.` → `К 1990 года Затем пришли.`;
   `в 2007 г. Затем` → `в 2007 году Затем`; `5 тыс. Затем` → `5 тысяч Затем`. Step 1 (multi-dot) was fixed for
   exactly this with the case discriminator; steps 3b and 4 (`ABBREV_CONTINUES`, `(?=\p{L})`) still consume
   the dot before an uppercase word.
2. **A personal initial В. or Г. reads as века / года.** `В. Петров и Г. Иванов` → `века Петров и года
   Иванов`; `В. В. Набоков` → `века века Набоков`. normalizeRussian runs before the initialism pass, and
   `ABBREV_CONTINUES` carries `i`, so a capital initial before a capitalised name is taken for the
   lowercase abbreviation. 0 hits in FLEURS (`grep -oP '(?<![\p{L}])[ВГвг]\.\s?\p{Lu}'`), but В. and Г. are
   among the commonest Russian initials.
3. **A fraction's denominator ignores the numerator's count.** `2/3` → `две третья`, `3/4` → `три
   четвёртая`, `5/8` → `пять восьмая`, `22/5` → `двадцать две пятая`. Russian takes the genitive plural
   (`две третьих`, `пять восьмых`) for every numerator not ending in 1; only `1/5`, `21/100` are right. The
   docstring promises only the 1/5 case. FLEURS has `1/5` (×2), so it does not reach the defect.
4. **Clock minutes ignore минута's gender.** `9:21` → `двадцать один минута`, `1:01` → `один час один минута`,
   `3:02` → `два минуты`, `5:22` → `двадцать два минуты` (want одна / две). The hour is right (час is
   masculine). 32 FLEURS texts carry a clock-shaped `d:dd`.
5. **`N-х` is read as an ordinal where it is the cardinal genitive, and the cardinal suffixes are not
   claimed.** `в 4-х томах` → `в четвёртых томах` (want четырёх), `2-х комнатная` → `вторых`. `-ти`, `-мя` are
   not in `CASE_ENDING`, so `30-ти лет` and `34-мя годами` reach the tokenizer and read the suffix as a
   word. FLEURS: `4-х летнего` ×2 (read четвёртых), `30-ти` ×4, `50-ти`, `35-ти`, `20-ти`, `15-ти` ×2 each,
   `34-мя` ×2.
6. **`вся` reads with a hard с.** `phonemizeWord("вся")` → `fsa` (want fsʲa; `всё` → `fsʲɵ` is right). The
   reflexive rule (`-ся`/`-сь` after a consonant keeps hard с) takes any word ending consonant + ся, and
   `вся` (×4 in FLEURS) is not a reflexive.
7. **Cyrillic letters outside а–я/ё are dropped and split the word.** `Київ` → `kʲi f`, `хлѣбъ` → `xɫ p`.
   TOKEN is `[а-яёА-ЯЁ]+`, and the run of the other letter goes to the Cyrillic script reader, which is
   Russian itself, which claims nothing. 0 FLEURS texts carry one.
8. **Dead data: `softenTriggers`.** The manifest field is declared (`SOFTEN_TRIG`) and never read; g2p.ts
   hard-codes `"тд"` and `"тднч"` instead. Editing the jsonc changes nothing.

9. **Every 1xxx number reads `одна тысяча`.** `numberToWords(1900)` → `одна тысяча девятьсот`, so years read
   `одна тысяча девятьсот тридцать девять` and `1970-х` → `одна тысяча девятьсот семидесятых`. The news
   reading of a year is `тысяча девятьсот …`; `одна тысяча` is the formal register. This is a register
   choice rather than an error, but it reaches 162 FLEURS texts (`\b1\d{3}\b`) and 7 golden rows
   (`ɐdnˈa tˈɨsʲət͡ɕə`), so it is the most visible of the nine.

**Implication.** All nine are reported in the PR and reproduced in Rust (the bidirectional rule: TS first).
The Rust manifest still requires `softenTriggers` (the TS interface names it) and marks it unread.

## Run 6 — 2026-10-10 21:40 (every gate; what registering ru moves elsewhere)

**Question.** After the lint pass (collapsed `if`s, a type alias), are all the gates still green, and does
registering `ru` change any other language's output?

**Command.** `cargo fmt`, `cargo clippy --workspace --all-targets --release`, `cargo test --release
--workspace`, `cargo run --release -p regex-diff`, `./target/release/parity` (all 11) and `--sync ru`; the
six ru replays; `SYMBOLS_LANGS=ru symbols` dump + replay; `npx tsx tools/extract_regexes.mts` (no TS regex
was added, so this only checks the corpus is fresh). For the other languages, `LANGS=en,en-GB,ja,it,es,pt,
pt-BR,hi,cmn,fr phonemize-sync` (39,851 rows: their goldens, FLEURS and probes) replayed with `ru`
registered, and again with the `ru` build arm temporarily renamed so `ru` is unknown.

**Raw finding.**
- parity: en, en-GB, ja, it, es, pt, pt-BR, hi, cmn, fr, ru each `200/200 identical, 0 differ`; `--sync ru`
  200/200.
- ru replays unchanged: ru-normalize 24747, ru-g2p 114798, ru-numbers 50166, ru-roman 4030,
  phonemize-sync 4030, phonemize-best 4030, all 0 DIFFER. symbols: `7003 identical, 0 DIFFER` (russian tier
  3931, probes 3072).
- Other languages: `39838 identical, 13 DIFFER` without ru; `39841 identical, 10 DIFFER` with it. The 5
  rows with a Cyrillic run are probe rows in es, pt, pt-BR, cmn and fr. The pt, pt-BR and cmn ones now pass;
  the es and fr ones now read their Cyrillic word (`слово`, `Владимир`) but still differ on a Greek run. All
  10 remaining rows are el/th/ko runs (port-pending).
- regex-diff: `144898 probe results identical, 0 DIFFER, 0 patterns refused`. `extract_regexes.mts`: 2387
  patterns, no change to `csharp/regex-corpus.jsonl`.
- `cargo test --release --workspace`: 105 + 1 passed, 0 failed (4 new: the manifest test and 3 Russian
  tests, expectations taken from TS output in `.probe/ru/testvals.mts`).
- clippy: nothing in the new files except `module_inception` on `russian::russian`, which every language
  directory has (`italian::italian`, …). The workspace's other warnings are pre-existing and not touched.

**Implication.** Russian is done by the checklist. Registering it changes no golden; it fixes 3 off-golden
rows in other languages, where a Cyrillic run was dropped as port-pending before and is now read.
