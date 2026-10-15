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

## Run 7 — 2026-10-11 15:00 (fixing the Run 5 findings, #1525)

**Question.** Which of the seven Run 5 findings (#1525) can be fixed TS-first, and what does each fix move?

**Command.** `npx tsx .probe/uk/check.mts <synthetic inputs>` before and after each edit to `normalize.ts`;
`npx tsx tools/gen_parity_goldens.mts uk`; a FLEURS before/after diff (`.probe/uk/fleurs.mts`: HEAD's
`normalizeUkrainian` against the edited one over the 1,925 distinct uk_ua column-3 texts).

**Raw finding (before → after, synthetic text):**
1. Clock before `.`/`,`: `Це почалося о 6:30.` → `… о 6:30.` (*шість , тридцять*) → `… о шостій тридцять.`.
   Guard `(?![\d:.,])` → `(?![\d:]|[.,]\d)`; `о 6:30,5` and `о 6:30.5` still decline (unchanged output).
2. Abbreviation before a capital: `1990 р. Потім` → `1990 року Потім` → `1990 року. Потім` (the ` . ` pause is
   in the phonemes). `1990 р. потім` → `1990 року потім` (unchanged). The capital test is in code (`\p{Lu}`
   on the lookahead letter), as in Russian (#1513), because the pattern carries `i`. A new manifest list
   `preposedAbbrev: ["див", "стор"]` keeps `див. Петренко` → `дивись Петренко`: these two precede their
   object. Not taken: a capital single-letter `Р.` before a name is still read року (an initial); the issue
   does not list it, and 0 FLEURS rows have it.
3. Fractions: `2/3` дві третя → **дві третіх**, `5/8` п'ять восьма → п'ять восьмих, `22/5` → двадцять дві
   п'ятих, `11/5` → одинадцять п'ятих; `1/5` одна п'ята, `21/100` двадцять одна сота unchanged. The issue
   text suggested *дві треті* (nom. pl.) for 2–4; Ukrainian school grammars give the genitive plural for every
   numerator not ending in 1 (their example: «дві третіх гектара»), the same choice Russian took, so `genPl`
   is used. The nominative plural is a real variant; not chosen.
4. #1122 guard on the `,;:` arm: `ᲁив., далі` → `undefined, далі` → `ᲁив., далі`; `Див. ᲃтор., далі` →
   `дивись ᲃтор., далі`. C# had no guard on any of the three arms (`DOTTED_ABBREV[...]` would throw on a
   folded miss); all three now use `TryGetValue`.
5. `constructor`: `HOUR_CASE` is now a `Map`. `Constructor 10:30` → unchanged → `Constructor десята тридцять`
   (`toString 10:30` likewise). Rust had a special `Some("constructor") => return whole` arm reproducing the
   bug; removed. C# was already correct (a dictionary).
6. Feminine minutes (marked "needs a native speaker"): taken, because *хвилина* is feminine and Russian took
   the same reading (#1513). `О 1:01` → `О першій 1` (*один*) → `О першій одна`; `3:02` → `третя дві`;
   `о 20:21` → `о двадцятій двадцять одна`; `11:12` → `дванадцять` (not a 2). The minutes are now spelled
   in the normalizer (`feminine(cardinal(mv))`) instead of left as a digit for the number path. Declined: the
   leading zero (`1:01` could be *нуль одна*); that needs a native reader and isn't a gender question.
7. Stale comment: rewritten in `ukrainian.ts` (SYMBOLS docstring) and `normalize.ts` step 6, which said the
   same thing. `м` is declared in `symbolTier.units`, and the tier's own trailing guard rejects `'’ʼ` now
   (core/normalizeSymbols.ts). Output unchanged: `41 м'яч` → `… sɔrɔk ɔdɪn mjat͡ʃ .`, `3 м²` → `… kʋadratʲnʲi
   mɛtrɪ .`.

- Golden: `gen_parity_goldens.mts uk` moves **0 rows**. The golden's only clock texts are `Об 11:20` and
  `Близько 11:29`, mid-sentence, and their spelled minutes (двадцять) read the same as the digit did.
- FLEURS (normalizer output): **10 of 1,925 texts change**. 7 are the minutes spelled as words, mid-sentence
  (`о восьмій 46` → `о восьмій сорок шість`), and phonemize identically. The other 3 are finding 1's sentence-
  final times (`… до 07:30.`, `… о 23:35.`, `… о 20:30.`), which now read as times. 0 texts reach findings
  2–5 (as Run 5 counted).

**Implication.** Every finding fixed or declined with a reason, except the leading zero in item 6 (declined).
Next: mirror into C# and Rust and run the gates.

## Run 8 — 2026-10-11 15:40 (mirrors and gates)

**Question.** Do C# and Rust match the fixed TS, and is every gate green?

**Command.** `dotnet test csharp/Vernacula.Phonemizer.slnx` (full); new `probes/uk.txt` lines for #1525; `npx tsx
rust/tools/fn-diff/dump.mts uk-normalize` and `LANGS=uk … phonemize-sync`, replayed with `./target/release/
fn-diff`; `cargo test --release` for ukrainian.

**Raw finding.**
- C#: 7492 passed, 0 failed (full suite; 6 new `UkrainianPortFindingsTests`).
- fn-diff `uk-normalize`: 31926 identical, 0 DIFFER (fleurs 7516, probe 158, synthetic 7714).
  `phonemize-sync` (uk): 3950 identical, 0 DIFFER.
- Rust ukrainian tests: 5 passed (the old one updated: `О 20:30 і з 6:30.` and `2/3`; a new `port_findings_1525`).
- Each new TS test fails with HEAD's `normalize.ts` swapped back in (6 of 6 failed), and passes with the fix.

## Run 9 — 2026-10-11 16:10 (rebased onto main with the el/ko/ru/th/de fixes; every gate)

**Question.** After rebasing onto main (which now has the ru fix #1513, adding Ukrainian letter folds to the
*Russian* engine), is anything shared or broken?

**Command.** `git rebase origin/main` (the one conflict was the generated `csharp/regex-corpus.jsonl`,
regenerated with `npx tsx tools/extract_regexes.mts`: 2390 patterns); `npm run typecheck`, `npm test`, `npm
run check:goldens`; `dotnet test csharp/Vernacula.Phonemizer.slnx`; `dotnet run --project csharp/tools/parity`;
`cargo fmt --check`, `cargo test --release`, `cargo run --release -p parity`, `-p regex-diff`; fn-diff
`uk-normalize` again.

**Raw finding.**
- No overlap: #1513 folds ї є ґ inside `src/languages/russian/`; nothing in `ukrainian/` reads it, and uk does not
  route text to ru.
- TS: 6845 passed, 5 skipped (360 files). Goldens fresh: 189 languages, 36,495 rows, 0 stale.
- C#: 7528 passed, 0 failed (full). C# parity: 189 languages byte-identical, 36,495 rows.
- Rust: 198 + 1 tests pass; fmt clean. Parity: every language identical except the known mag 199/200
  (Arabic). uk 200/200. regex-diff: 145,096 identical, 0 DIFFER, 0 refused. fn-diff uk-normalize: 31,926
  identical, 0 DIFFER.

**Implication.** Ready for the PR.

## Run 10 — 2026-10-14 (#1551: the leading-zero minute, and `Р.` before a name — sourced)

**Question.** Run 8 left two items for "a native speaker": how `1:01` is read (with or without *нуль*), and
`Р. Шухевич` reading *року*. Can sources settle them?

**Command.** A research pass (web sources plus the FLEURS uk audio for the one leading-zero clock, transcribed by
ASR), then probes and `FLEURS_ROOT=… npx tsx rust/tools/fn-diff/dump.mts uk-normalize` before and after.

**Raw finding.**
- **Leading zero: sourced.**
  - The Kyiv Dictionary's language consultation (kyivdictionary.com, Випуск 5) gives the digital clock reading
    with an explicit zero: «о шостій п'ятдесят п'ять, о восьмій **нуль** п'ять».
  - СУМ-11 records *нуль-нуль* after an hour, for an exact time.
  - The corpus's one leading-zero clock (`о 22:08`) was recorded by two FLEURS speakers. ASR returned *нуль*
    before *вісім* for both.
  - The minutes stay feminine after *нуль* (*нуль одна*). That part is inference: *п'ять* and *вісім* show no
    gender.
  - The fix reads the zero: `1:01` → *перша нуль одна*, `о 8:05` → *о восьмій нуль п'ять*. `HH:00` stays the
    bare hour.
- **`Р.`: sourced.** Правопис 2019 §64 writes an initial as a capital and a period, and the year abbreviation
  lowercase after a numeral (`2008 р.`). The `i` flag on the abbreviation patterns let any capital `Р.` match the
  key `р`.
  - A key shaped like an initial (one letter, or that letter doubled: `р`, `рр`) now expands only as written.
  - `Р. Шухевич` falls through to the initialism speller (*ер Шухевич*).
  - `у 1990 р. Потім` / `… потім` and `Див. Петренко` are unchanged.
  - FLEURS has 0 `Р.` and 2 `р.`, both years.
- **Impact.**
  - uk-normalize: 836 of 31,926 rows change, every one only adding *нуль*. That is 418 distinct inputs, nearly
    all from the probe sweep; in FLEURS only the `22:08` text moves.
  - The uk golden is unchanged.
  - Rust replays uk-normalize (31,932 rows) and phonemize-sync (3,951 rows) identically, including the new
    synthetic probe line.
- **Tests.**
  - The #1525 pins `О 1:01` → *О першій одна* and `3:02` → *третя дві* (TS, C#, Rust) move to the *нуль*
    reading. The feminine agreement they guard stands.
  - New relational tests are `test/ukrainian-1551.test.ts`, C# `Ukrainian1551Tests` and Rust
    `the_1551_leading_zero_and_initial`. The clock expectation is the source's own example. With the fix
    reverted, TS fails 2/4 (the other two are pins).

**Implication.** Both uk items of #1551 are closed.
