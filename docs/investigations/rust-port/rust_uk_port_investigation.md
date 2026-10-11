# Rust port: Ukrainian (uk)

Ukrainian is a flat left-to-right rule g2p (no stress, no lexicon) over the manifest's letter tables, plus a
dense normalizer (digit grouping, multi-dot and dotted abbreviations, the numeral+suffix notation read as an
ordinal or an oblique cardinal, units, the clock as a feminine ordinal, signs, fractions, dot decimals). It
has no neural model (`neuralRegistry.ts` does not list it). The import closure is
`ukrainian/{ukrainian,manifest,normalize,numbers,romanOrdinals}.ts` plus core `clauses`, `numbers`
(`renderNumber`, `spellDigits`, `westernNumberWords`), `normalizeSymbols` (`makeSymbolNormalizer`,
`slavicCountForm`), `initialisms`, `loadManifest`, `provenance` and `roman`. All of those are already
ported, so this port adds NO core module.

Host routing: `core/scripts.ts` has `uk: { Cyrillic: "uk" }`, so inside a uk host a Cyrillic run reads as
Ukrainian; every other host's Cyrillic run still defaults to `ru`. `scripts.rs` already carries the
override, so registering `uk` changes nothing for other hosts. Nothing else in `src/` builds
`createUkrainian`; `belarusian/` imports `numbers.ts` (`eastSlavicNumberWords`), which is why that module is
parameterised by its table.

## Run 1 — 2026-10-10 22:10 (baseline, before any Ukrainian code)

**Question.** What do the gates read before uk is registered, and what does the uk golden contain?

**Command.** `cd rust && cargo build --release -p parity -p fn-diff && ./target/release/parity`, then
`./target/release/parity uk`; a Python scan of `csharp/goldens/uk.tsv` for scripts.

**Raw finding.**
- en, en-GB, ja, it, es, pt, pt-BR, hi, cmn, fr, el, ko, th, ru, de: each `200/200 identical, 0 differ`.
- `parity uk`: panics, `UnknownLanguage("uk")`.
- uk golden: 200 rows, 113 distinct texts. 4 carry a Latin run (`Audi`, `r`/`rr`/`caro`/`carro`, `H`/`N`,
  `X`), read by the English foreign reader (ported). No letter outside Cyrillic/Latin. Cyrillic letters
  used: the 33 Ukrainian letters; none of ё ы э ъ.
- ⚠ `/mnt/data/omnivoice_ipa` (the `FLEURS_ROOT` that `dump.mts` hard-codes) no longer exists on this
  machine; the transcripts now live on an external drive (uk_ua: 3,885 rows over train/dev/test). Rather than recreate a shared symlink outside the worktree, I
  give `dump.mts` a `FLEURS_ROOT` environment override (default unchanged).

**Implication.** Port all five modules, then register. The golden reaches the English reader four times, so
the en engine is on the critical path, and it is already ported.

## Run 2 — 2026-10-10 22:45 (first end-to-end build, golden)

**Question.** With the five modules ported (manifest, numbers, romanOrdinals, normalize, ukrainian) and `uk`
registered (`build`, `roman_policy`, `LANGUAGES`), what does the golden gate say?

**Command.** `cd rust && cargo build --release && ./target/release/parity uk`, `--sync uk`, then
`./target/release/parity` (all 16).

**Raw finding.** First build (after one compile error: `gen` is a reserved keyword in edition 2024, renamed):
`uk: 200/200 identical, 0 differ`; `--sync uk` 200/200. All 15 other languages stay 200/200.

**Implication.** The golden passes first time, but it is a narrow probe (Run 4 measures which arms it
reaches). Next: per-module differentials over the golden, FLEURS and synthetic probes.

## Run 3 — 2026-10-10 23:05 (per-module differentials, end to end over FLEURS and probes)

**Question.** Do `normalize.rs`, `phonemize_word`, the East-Slavic compositor and the Roman policy match their
TS twins beyond the golden?

**Command.** New `dump.mts` entries `uk-normalize`, `uk-g2p`, `uk-numbers`, `uk-roman` (and `uk: "uk_ua"` in
`FLEURS_DIR`), each replayed by a `fn-diff` arm:
`FLEURS_ROOT=<transcripts dir> npx tsx
rust/tools/fn-diff/dump.mts <name> > .probe/uk/<name>.jsonl`, then `./target/release/fn-diff <name>
../.probe/uk/<name>.jsonl`. Inputs: the golden, FLEURS uk_ua columns 3 and 4, and the new synthetic
`probes/uk.txt` (one or more lines per normalize.ts arm with the neighbour it must decline, plus g2p,
number and Roman corners).
- `uk-normalize`: `normalizeUkrainian` and `normalizeUkrainianInitialisms(normalizeUkrainian(t))` per text,
  `isUnreadableUkrainian` over every letter run, plus generated synthetic rows: 47 numbers × every written
  suffix the ordinal paradigm can end in (1–3 letters of each hard/soft ending, plus `от`, `ох`, `ть`, upper
  case), every hour 0–24 × 4 minute values after each of the 17 governing prepositions, and fractions
  0–23 / 13 denominators.
- `uk-g2p`: `phonemizeWord` over every Cyrillic-block run of the texts (both cases), every 1–3 letter string
  of the 33 letters + apostrophe + ё ы э ъ, every 4-letter string over `вйьяюєїіоаитлнсц'`, and corners (the
  empty string, a lone surrogate, triple consonants).
- `uk-numbers`: `renderNumber(n, DEF.numbers, identity, eastSlavicNumberWords)` over 0..20000, 10^e±,
  k·10³ … k·10¹² + 22000 and MAX_SAFE_INTEGER; `ROMAN_POLICY.ordinal` over 0..120, −1, 1.5, NaN, ∞, 1000.
- `uk-roman`: `normalizeRomans(t, ROMAN_POLICY)`.
- `LANGS=uk phonemize-sync` / `phonemize-best`.

**Raw finding.** First build, every replay clean:
```
uk-normalize: 31908 identical, 0 DIFFER   (golden 226 / fleurs 7516 / probe 144 / synthetic 7714 text rows)
uk-g2p: 155553 identical, 0 DIFFER
uk-numbers: 26170 identical, 0 DIFFER
uk-roman: 3943 identical, 0 DIFFER        (golden 113 / fleurs 3758 / probe 72)
phonemize-sync: 3943 identical, 0 DIFFER
phonemize-best: 3943 identical, 0 DIFFER
```

**JS semantics reproduced on purpose.**
- `group()` in numbers.ts maps a gap to the STRING `"?"` (then phonemized, i.e. read as nothing), while
  `renderNumber` renders a top-level gap as a literal `?`. Unreachable with this table; kept distinct.
- `ordinalBase` and `genitiveCardinal` take the JS number of a `\d+` run, so a 20-digit suffix notation is
  `Number.isInteger` but ≥ 10⁶ and declines (`12345678901234567890-й` stays as written).
- `caseIndex` is a `Map` built from the endings, so a repeated case name keeps its LAST index (`rposition`).
- `HOUR_CASE[prev]` is a plain-object lookup, and `constructor` is the one `Object.prototype` name that
  survives the `toLowerCase` before it: it reads the inherited function, `forms[fn]` is undefined, and the
  clock is left as written. Reproduced (Run 5, finding 3).
- The middle dotted-abbreviation arm (`(?=\s*[,;:])`) indexes with `!`, so a fold-widened miss stringifies
  `undefined`. Reproduced (Run 5, finding 1).
- `phonemizeWord` walks code points (`[...s]`), `palatalise` keys on the exact string `ɫ`, and the result is
  NFC-normalized off the provenance seam.

**Implication.** Every module matches. Next: measure what the haystacks actually reach.

## Run 4 — 2026-10-10 23:15 (per-arm coverage; what the haystack holds)

**Question.** Which normalize.ts arms do the three sources actually reach? A clean differential over a
haystack without the construct proves nothing.

**Command.** `FLEURS_ROOT=… npx tsx .probe/uk/coverage.mts`: each arm's TS pattern, copied, tested against
the RAW text (texts matched, golden / FLEURS / probe), and the real passes for "changed".

**Raw finding.** (distinct texts 113 / 3850 / 72)
```
0 group space 3/30/3      0 group comma 0/2/1     1 до н. е. 0/3/2      1 н. е. 0/6/4      1 т. п. 0/1/1
1 т. д. 0/0/1             2 № 1/6/1               3 кв. км 0/2/2        3 кв. миль 0/2/1
4 numeral+suffix 3/79/7   5 abbrev cont 0/8/3     5 abbrev ,;: 0/2/1    5 abbrev end 0/1/2
6 м/с 0/2/1   6 м 1/8/1   6 /год 0/4/1   6 °C 0/2/2   6 °F 0/0/1   6 ° 0/2/4   7 clock 2/25/4
8 minus 0/0/3   8 ± 0/0/1   8 plus 0/4/3   8b = < > ÷ 0/0/1 each   9 range 2/36/1   10 fraction 0/2/2
11 dot decimal 0/4/1      comma decimal token 4/28/9   Latin run 4/150/7   ё ы э ъ 0/0/1   ’ ʼ 0/14/0
normalize changed 11/202/41   initialisms changed 6/88/3   roman changed 0/8/2
```

**Implication.** Every arm is reached at least once. Only the probes reach `т. д.`, `°F`, the minus, `±` and
the four relational/division signs; the golden reaches 9 arms and no Roman numeral, so it is again the
weakest of the three gates. The typographic apostrophes were reached by FLEURS only, so I added a probe line
for them (and for the two reproduced defects) and re-ran: `uk-normalize 31917`, `uk-g2p 155558`, `uk-roman /
phonemize-sync / phonemize-best 3946`, all 0 DIFFER. Every Latin run goes to the English reader (ported);
nothing in the golden, FLEURS or probes routes a run to an unported engine, so there are no port-pending rows.

**Guard check (reverting the reproduction).** Renaming the `constructor` arm and the `"undefined"` literal
(`constructorX`, `undefinedX`) and re-running `uk-normalize`: `31909 identical, 8 DIFFER` (probe 4,
synthetic 4: `rust constructor десята 30` etc.). Restored; back to 0 DIFFER. So the probes do pin both.

## Run 5 — 2026-10-10 23:30 (TS findings from reading; reported, not fixed)

**Question.** Reading each file for correctness (csharp/PORTING.md's three questions): does the code do what
its docstrings promise, is every table reached, and which reading is wrong?

**Command.** `npx tsx .probe/uk/check.mts <synthetic inputs>` (through `normalizeUkrainian`,
`phonemizeWord`, `phonemize(t, "uk")`); FLEURS reach by `grep -oP` over the 1,925 distinct column-3 texts.

**Raw finding (TS output, verbatim):**
1. **The #1122 miss guard is missing from one of the three dotted-abbreviation arms.** `Див. ᲃтор., далі`
   (U+1C83 WIDE ES, which `iu` folds onto с) → `дивись undefined, далі`; `ᲁив., далі` (U+1C81) →
   `undefined, далі`. The first and third arms check `w === undefined`; the middle arm
   (`(?=\s*[,;:])`) still has `DOTTED_ABBREV[ab.toLowerCase()]!`. 0 FLEURS hits (no Cyrillic Extended-C in
   the corpus); synthetic only.
2. **A dotted abbreviation before a capitalised word eats the sentence end.** `1990 р. Потім` → `1990 року
   Потім` (phonemized: no `.` pause between *року* and *потім*). `ABBREV_CONTINUES` looks ahead for
   `[\p{L}\d(]` without a case test; the multi-dot arm (step 1) solved the same problem for its final dot,
   step 5 did not. The same defect Russian has (rust_ru_port_investigation.md Run 5, finding 1). FLEURS: the
   one `див. П…` hit is a genuine continuation, so 0 corpus rows lose a pause today.
3. **`constructor` before a clock time blocks the clock rule.** `Constructor 10:30` → unchanged, which then
   reads `kənstɹˈʌktɚ dɛsʲatʲ , trɪdʲt͡sʲatʲ` (the colon as a pause). `HOUR_CASE` is a plain object built by
   `Object.fromEntries`, so `HOUR_CASE["constructor"]` is the inherited function, not `undefined`, and the
   `?? FEM_NOM` default never applies. Cosmetic; a `Map` or `Object.hasOwn` fixes it.
4. **A fraction's ordinal ignores the numerator's count.** `2/3` → `дві третя`, `5/8` → `п'ять восьма`,
   `22/5` → `двадцять дві п'ята`. Ukrainian takes the plural (`дві треті`, `п'ять восьмих`) for every
   numerator not ending in 1; only `1/5`, `21/100` are right. The docstring promises only the `1/5` case.
   FLEURS has `1/5` ×1, so it does not reach the defect. (Russian has the same defect, ru Run 5 finding 3.)
5. **A stale comment in ukrainian.ts.** The `SYMBOLS` docstring says "`м` is NOT declared here on
   purpose", but `ukrainian.jsonc` `symbolTier.units` DOES declare `м` (normalize.ts reads its `METRE` forms
   from that very key), and the tier reaches it: `Площа 3 м².` → `… trɪ kʋadratʲnʲi mɛtrɪ .`. The hazard
   the comment describes does not occur (`Він купив 41 м'яч.` → `… sɔrɔk ɔdɪn mjat͡ʃ .`), so this is a
   docstring/data disagreement, not a behaviour bug.
6. **(Unverified, for a native reader.) Clock minutes are read as bare masculine cardinals.** `О 1:01` →
   `О першій 1` (read *один*), `3:02` → `третя 2` (*два*). The elided noun *хвилина* is feminine, so
   *одна*/*дві* may be wanted, and the leading zero is dropped. 0 FLEURS times end in 1 or 2 minutes (the
   25 clock texts are :00 :08 :15 :19 :20 :29 :30 :35 :46).

7. **A clock time before a comma or a full stop is not read as a time.** `Це почалося о 6:30.` →
   `… ɔ ʃʲisʲtʲ , trɪdʲt͡sʲatʲ .` (*шість , тридцять*: the colon becomes a pause), and likewise before `,`.
   The rule's trailing guard is `(?![\d:.,])`, which refuses ANY following `.` or `,`, not only a decimal
   or dot-time continuation (`(?![\d:]|[.,]\d)` would be the mirror of what the leading guard means). Found
   while deriving the unit-test values (`О 20:30 і з 6:30.` → `О двадцятій 30 і з 6:30.`). FLEURS: 3 of the
   25 clock texts (`07:30.`, `23:35.`, `20:30.`) take this path today — the most visible of the seven.

Every table the manifest declares is read by some path (checked field by field against the five modules).

**Implication.** All seven are reported in the PR and reproduced in Rust (the bidirectional rule: TS first).
Findings 1 and 3 are pinned by probes (Run 4's guard check).

## Run 6 — 2026-10-10 23:50 (every gate; what registering uk moves elsewhere)

**Question.** After `cargo fmt` and the unit tests, are all the gates green, and does registering `uk` change
any other language's output?

**Command.** `cargo fmt --check`, `cargo clippy --workspace --all-targets --release`, `cargo test --release
--workspace`, `cargo run --release -p regex-diff`, `./target/release/parity` (all 16); `SYMBOLS_LANGS=uk
symbols` and `reader` dumps + replays; `npx tsx tools/extract_regexes.mts` (no TS regex was added, so this
only checks the corpus is fresh). For the other languages, `LANGS=en,en-GB,ja,it,es,pt,pt-BR,hi,cmn,fr,el,ko,
th,ru,de phonemize-sync` (their goldens, FLEURS and probes) replayed with `uk` registered, and again with the
`uk` build arm temporarily renamed so `uk` is unknown.

**Raw finding.**
- parity: en, en-GB, ja, it, es, pt, pt-BR, hi, cmn, fr, el, ko, th, ru, de, uk each `200/200 identical,
  0 differ`.
- symbols: `6938 identical, 0 DIFFER` (ukrainian tier 3866, probes 3072); reader: `602 identical, 0 DIFFER`.
- Other languages: `58047 identical, 1 DIFFER` both with and without uk. The one row is a Lao run inside a
  Thai probe (`ไทยລາວไทย`, lo not ported), unrelated to uk. Registering uk moves nothing, as expected: only the
  uk host routes a Cyrillic run to uk.
- regex-diff: `144898 probe results identical, 0 DIFFER, 0 patterns refused`. `extract_regexes.mts`: 2387
  patterns, no change to `csharp/regex-corpus.jsonl`.
- `cargo test --release --workspace`: 120 + 1 passed, 0 failed (4 new: the manifest test and 3 Ukrainian
  tests, expectations copied from TS output via `.probe/uk/check.mts`).
- clippy: nothing in the new files except `module_inception` on `ukrainian::ukrainian`, which every language
  directory has. The workspace's other warnings (core/schwa.rs, core/abugida.rs, registry.rs:307,
  fn-diff main.rs:617, regex-diff) are pre-existing and not touched.

**Implication.** Ukrainian is done by the checklist, with no port-pending rows. The 68 MB cross-language dump
was deleted after the replay.
