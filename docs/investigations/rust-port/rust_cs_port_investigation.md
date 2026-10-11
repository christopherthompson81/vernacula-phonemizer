# Rust port: Czech (cs)

Part of #1463, the Slavic group (cs, sk, be, bg, mk; ported in that order). The method is the earlier ports'
(rust_pl_port_investigation.md, rust_uk_port_investigation.md): per-module `fn-diff` differentials, then the
public entry end to end, then the golden gate.

Czech is a rule g2p (`g2p.ts`: scan, syllabic r̩/l̩, degemination, voicing, nasal assimilation) with fixed
first-syllable stress and secondary stress on even non-final nuclei, a loanword lexicon (`loanwords.tsv`), a
cardinal compositor, and a dense normalizer (`normalize.ts`: grouping, era and dotted abbreviations, the clock,
`N. N.` dates, version dots, ordinal ranges, century / decade / month / place / hour ordinals with case endings,
the general ordinal, regnal ordinals, ranges, `mil/h`, signs, fractions, `pH`/`Ghz`), then the initialism pass
and the shared symbol tier. No neural entry (`neuralRegistry.ts` does not list cs), no `ROMAN_POLICIES` entry.

## Run 1 — 2026-10-10 21:30 (baseline, the import closure, what the golden holds)

**Question.** What does `src/languages/czech/` need that the Rust core lacks, and what do the gates read before
any Czech code exists?

**Command.** Read czech.ts, g2p.ts, normalize.ts, numbers.ts, manifest.ts and their imports; `grep -n cs
src/registry.ts src/neuralRegistry.ts`; `cd rust && cargo build --release -p parity -p fn-diff -p regex-diff &&
./target/release/parity` then `parity cs`; a Python scan of `csharp/goldens/{cs,sk,be,bg,mk}.tsv` by script;
`npx tsx .probe/cs/t.mts <texts>` (phonemize through the TS, printing a throw).

**Raw finding.**
- Imports: core `clauses`, `hostWord` (LATIN_RUN, makeNativiser), `loadTsv` (loadTsvMap, optional),
  `normalizeSymbols` (makeSymbolNormalizer), `initialisms`, `numbers` (digitIndex), `loadManifest`,
  `provenance` (rewrite). All already ported, so this port adds no core module. The symbol tier's argument is an
  object literal in czech.ts, not manifest data.
- parity: the 20 ported languages each `200/200 identical, 0 differ`; `parity cs` panics `UnknownLanguage("cs")`.
- cs golden: 200 rows, 117 distinct texts, every letter Latin (12,454). So no foreign run can route to another
  engine except through the Latin reader path, which Czech handles itself (the TOKEN is all of Latin).
- ⚠ The TS THROWS on five ordinal shapes. Steps 7–10 of normalize.ts call `inflectOrdinal(ordinal(n)!, …)`, and
  `ordinal` is `undefined` outside 1–999:
  ```
  "Ve 1000. století."  THROWS TypeError: Cannot read properties of undefined (reading 'split')
  "V 0. letech"        THROWS (same)
  "1000. září"         THROWS (same)
  "na 1000. místě"     THROWS (same)
  "po 1000. hodině"    THROWS (same)
  ```
- Also seen in passing: `"Ahoj 1,5 a 19,500 km²"` → `ˈaɦoj pˈr̩vɲiː , pjˈɛt …`: the regnal rule (step 12) reads
  the `1` of a decimal `1,5` after ANY capitalised word as the ordinal *první*.

**Implication.** Port manifest → numbers → g2p → normalize → czech. The throw is TS behaviour, so the Rust
normalizer returns an error on exactly those inputs and the engine maps it to `PhonemizeError::Input` (the
variant registry.rs keeps for "the TS engine THROWS on this input"); the normalize dump records a throw as its
own output so the differential pins it.

## Run 2 — 2026-10-10 21:38 (first end-to-end build, golden)

**Question.** With the five modules ported (`languages/czech/{manifest,numbers,g2p,normalize,czech}.rs`) and `cs`
registered (one `build` arm, `cs` appended to `LANGUAGES`, no `roman_policy` arm), what does the golden gate say?

**Command.** `cd rust && cargo build --release -p parity && ./target/release/parity cs`, then `--sync cs`. The
symbol tier's argument is the TS object literal from czech.ts, recorded through the `symbols` dump's wrapper
(`SYMBOLS_LANGS=cs … dump.mts symbols`, the `def` row whose stack is czech/) and embedded as that row's
`JSON.stringify`; `countForm` is attached as `cs_count_form`.

**Raw finding.** `cs: 200/200 identical, 0 differ` on the first build; `--sync cs` the same.

**Implication.** The golden has 117 distinct texts and (Run 4) reaches only 13 of the normalizer's 37 rewrite
sites. The per-module differentials carry the weight.

## Run 3 — 2026-10-10 21:42 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `cs-normalize`, `cs-g2p`, `cs-numbers` (and `cs: "cs_cz"` in `FLEURS_DIR`), each
replayed by one `fn-diff` arm: `FLEURS_ROOT=<external-drive>/omnivoice_ipa/corpus/fleurs_transcripts/data npx tsx
rust/tools/fn-diff/dump.mts <name> > .probe/cs/<name>.jsonl`, then `./target/release/fn-diff <name>
../.probe/cs/<name>.jsonl`. Inputs: the cs golden (117 texts), FLEURS cs_cz columns 3 and 4 (first row checked: a
sentence, not a WAV name) and the new synthetic `probes/cs.txt` (one or more lines per normalize.ts arm with the
neighbour it must decline, plus g2p, number, initialism and foreign-name corners).
- `cs-normalize`: per text `normalizeCzech` (a throw recorded as `\0throw <message>`), `normalizeCzechInitialisms` on
  its output, and the symbol tier on that, the tier being the very normalizer czech.ts built (recorded by the
  wrapper, so this also proves the generated JSON); `isUnreadableCzech` over every letter run (as written and
  lowercased); synthetic rows: 17 numbers around the 1–999 ordinal domain × 19 followers (století, let, letech,
  months, místě, místo, hodině, …) × 4 heads (none, ve, V, a capitalised name); the clock grid 0–25 h × 7 minute
  values; 36 fractions.
- `cs-g2p`: `phonemizeWord` and `toSegments` over every letter run, every `loanwords.tsv` key (as written, upper
  case, and with a suffix so it misses), every 1–3 letter string of the 41 letters, every 4-letter string over
  `ěinmdtbvrlhkzsux`, and edge strings (empty, lone surrogates, `İ`, `ſ`, decomposed `ě`, `nně`, `rrr`);
  `nat` over all of them plus foreign names.
- `cs-numbers`: `numberToWords` over 0…20,000, powers of ten to 10²¹, k·10³/10⁶/10⁹ shapes, float/NaN/∞/−0 corners,
  and 12 raw strings both as `Number(raw)` and through the 10¹² digit fallback; `csCountForm` over the same.
- end to end: `LANGS=cs` `phonemize-sync`, `phonemize-best`, `phonemize-trace`; `SYMBOLS_LANGS=cs symbols`.

**Raw finding.** First build, every one (re-run on the final probe list):
```
cs-normalize: 32199 identical, 0 DIFFER  (golden 351 / fleurs 11391 / probe 237 / synthetic 4146 / words 16074)
cs-g2p: 458599 identical, 0 DIFFER
cs-numbers: 54190 identical, 0 DIFFER
phonemize-sync: 3993 identical, 0 DIFFER
phonemize-best: 3993 identical, 0 DIFFER
phonemize-trace: 3993 identical, 0 DIFFER
symbols: 6982 identical, 0 DIFFER  (probe 3072 / czech 3910)
```
192 of the synthetic normalize rows are TS throws, and the Rust errs on exactly those 192.

**JS semantics reproduced on purpose.**
- the scan walks CODE POINTS of the lowercased word; `prev` is `""` word-initially and `"bpvf".includes("")` is
  TRUE, so the `prev !== ""` guard (#1476) is what keeps a word-initial ě from reading jɛ;
- `degeminate` splices right to left, and `markSyllabic` runs left to right so a liquid made syllabic one step
  earlier counts as a nucleus for its right neighbour;
- `readDigits` maps code points; `digitIndex` compares strings, so a two-unit code point is never a digit;
- `agree` keys on the whole count (2–4), `csCountForm` on its final digits (`%` is fmod, NaN for ∞ → plural);
- steps 7–10 throw on an ordinal outside 1–999 (`inflectOrdinal(undefined)`), mid-replace; the Rust returns `Err`
  and discards the partial output;
- `phonemizeWord`'s output is NOT NFC-normalized (unlike pl); the lexicon is tried as written, then lowercased.

**Guard check (reverting what the port claims to reproduce).** Two mutations at once, then restored:
- `threw.set(false)` (the throw not reproduced): `cs-normalize: 31986 identical, 192 DIFFER`, all synthetic
  (golden / FLEURS / probe 0: no real text reaches the throw).
- the `!prev.is_empty()` guard removed: `cs-g2p: 446938 identical, 11646 DIFFER` (`Ěcho` ts `ˈɛxo`, rust `jˈɛxo`).
- Restored: both back to 0 DIFFER.

**Implication.** Every module matches on every source. Next: what the haystacks reach.

## Run 4 — 2026-10-10 21:47 (per-arm reach: what each source actually exercises)

**Question.** Which normalize.ts rewrite sites do the golden, FLEURS and the probes reach?

**Command.** `FLEURS_ROOT=… npx tsx .probe/cov/run.mts cs cs_cz czech normalizeCzech`: a resolve hook swaps
provenance.ts for a counting wrapper under the language's normalize.ts only; per caller LINE, the distinct raw
texts whose string that rewrite changed.

**Raw finding.** (distinct texts golden 117 / FLEURS 1947 / probe 74; counts golden/FLEURS/probe)
```
213 group 5/40/3      214 group space 0/38/2   222 era 0/9/5          227 abbrev cont 3/27/6   235 abbrev end 0/4/2
244 s. 0/1/1          263 clock 2/15/5         274 N. N. date 0/1/3   284 version dot 1/5/3    288 ord range 0/1/2
300 century 0/27/3    310 decade 0/8/2         316 month 3/29/2       322 a … místě 0/1/1      325 místě 0/1/1
327 místo 0/1/1       331 hodin… 0/1/2         339 general ord 1/7/5  348 regnal 1/4/14       358 range 1/16/2
364 mil/h 0/3/1       368 °C 0/1/1   369 °F 0/0/1   370 ° 0/2/1   375 ± 0/0/1   376 + 0/1/1   377 × 0/1/0
381 minus 0/0/1       386 = 0/0/1    387 < 0/0/1    388 > 0/0/1   389 ÷ 0/0/1   393 & 0/1/1   397 fraction 0/1/2
406 pH 0/2/1          407 Ghz 0/1/2
```
The golden reaches 9 of 37 sites. Only the probes reach `°F`, `±`, the minus and the four relational signs. The
`×` probe was 0: `Kus 6 × 6 cm` never reached step 15 because the REGNAL rule had already turned `Kus 6` into
*Kus šestý* (Run 5, finding 2). The probe line was changed to `Je to 6 × 6 cm` (reaches it) and the regnal
case kept as a defect witness.

**Implication.** Every arm is reached by at least one source. Nothing in the golden, FLEURS or the probes routes a
run to another engine (Czech's TOKEN is all of Latin), so there are no port-pending rows.

## Run 5 — 2026-10-10 21:50 (reading for correctness: TS findings, reported not fixed)

**Question.** Read against csharp/PORTING.md's three questions: does each docstring's promise hold, is every table
reached, which path does the instrument measure?

**Command.** `npx tsx .probe/cs/t.mts <texts>` (phonemize through the TS; `\u{…}` escapes decoded); FLEURS reach by
`grep -P` over the 1,947 distinct column-3 texts and a re-run of the hits through `normalizeCzech`
(`.probe/cs/regnal.mts`).

**Raw finding (TS output, verbatim):**
1. **Five ordinal steps throw on a number outside 1–999.** `Ve 1000. století.`, `V 0. letech`, `1000. září`,
   `na 1000. místě`, `po 1000. hodině` → `TypeError: Cannot read properties of undefined (reading 'split')`. Steps
   7–10 index `ordinal(n)!`; steps 6, 11, 12 and 16 check for `undefined`, these four do not. 0 FLEURS hits.
2. **The regnal rule fires after ANY capitalised word, including the first word of a sentence.** `Mám 3 psy` →
   *Mám třetí psy*; `Ahoj 1,500 l` → *ˈaɦoj pˈr̩vɲiː , pjˈɛtsɛt* (it also splits the grouped number); `Kus 6 × 6
   cm` → *kˈus ʃˈɛstiː ʃˈɛst …* (the `×` is then dropped in silence, since step 15 no longer sees a digit before
   it). FLEURS: 4 of the 1,947 texts are misread today — `Standardní 35` → *třicátý pátý*, `Celých 20` →
   *dvacátý*, `Turecka 37` → *třicátý sedmý*, `Formule 1` → *první*; the golden's one hit (`Greely 9.`) is a date.
   The rule's guard (≤ 39, a following break) does not distinguish a name from any capitalised word.
3. **The `N. N.` date eats the sentence-final period.** `Bylo to dne 5. 5.` → `… dnˈɛ pˈaːtɛːɦo pˈaːtɛːɦo` (no
   final `.`). Step 4 consumes the month's dot and appends a space; it is the one dot-consuming rule that does not
   call `keepFinal`, which step 1's own comment says "is applied to every dot-consuming rule below".
4. **A dotted abbreviation before a capitalised word eats the sentence end.** `slovo atd. Potom.` → *… dˈaːlɛ
   pˈotom .* (no pause). The continuation rule's lookahead admits `\p{L}` of either case. The same defect ru and uk
   have (their logs, Run 5).
5. **The century's locative test has no left boundary.** `Město Kyjev 12. století` → *dvˈanaːt͡stɛːm* (locative,
   as if after the preposition *v*): `/(?:v|ve)\s+$/iu` matches the end of ANY word ending in v/ve. 0 FLEURS hits.
6. **A fraction with a numerator other than 1 drops its slash.** `2/3` → *dvˈa tr̝̊ˈɪ*, `5/8` → *pjˈɛt ˈosm*,
   `22/5` → *dvˈat͡sɛddva pjˈɛt*: two bare numbers, the fraction lost. The docstring promises only `1/5`.
7. **Decomposed input is read as if the háček were absent.** `děti` (NFD *děti*) → *dˈɛcɪ* (vs *ɟˈɛcɪ*),
   `Něco` → *nˈɛt͡so* (vs *ɲɛ*): nothing between the registry and `scan()` composes, and the scan skips the
   combining mark as an unknown character.
- Every table the manifest declares is read: `consonants.x` is dead by design (the comment in g2p.ts says so and
  why); the loanword lexicon is reached (`python3 -I .probe/lexreach.py data/languages/czech/loanwords.tsv
  <FLEURS cs_cz>`: 403 keys, 111 of the 14,148 distinct FLEURS words covered, e.g. `Ministr`, `Kolonie`).

**Implication.** All seven go in the PR body. Rust reproduces each (the bidirectional rule: TS first). One probe
line per finding was appended to probes/cs.txt, and Run 3's dumps were regenerated with it (the numbers above).

## Run 6 — 2026-10-10 21:54 (tests, and every gate)

**Changes.** czech.rs gains a test module: test/czech.test.ts's 20 `phonemizeWord`, 22 `normalizeCzech`, 4
`phonemize(…, "cs")` `toBe` and 4 `toContain` pins, extracted MECHANICALLY by `.probe/pins.mjs` (which parses each
string literal with `JSON.parse`; no reading typed by hand), plus that file's relational 22-digit pin and one test
that the out-of-range ordinal is an `Input` error. To prove the pin test bites, the n→ŋ assimilation was disabled:
`the_ts_suite_pins_hold` FAILED on `venku` (`vˈɛnku` vs `vˈɛŋku`); restored, it passes.

**Command.** `cargo fmt --check`, `cargo clippy --workspace --release`, `cargo test --release --workspace`,
`cargo run --release -p regex-diff`, `./target/release/parity` (all 21).

**Raw finding.**
- parity: en, en-GB, ja, it, es, pt, pt-BR, hi, cmn, fr, el, ko, th, ru, de, pl, tr, nl, uk, sv, cs each `200/200
  identical, 0 differ`.
- `cargo test`: 133 + 1 passed, 0 failed. regex-diff: `144898 probe results identical, 0 DIFFER, 0 patterns
  refused`. fmt clean.
- clippy: one new warning (`manual_is_multiple_of` on the stress test), fixed; afterwards nothing in the new files
  but `module_inception` on `czech::czech`.
- No TS regex was added, so `csharp/regex-corpus.jsonl` needs no re-extraction.

**Implication.** Czech is done by the checklist, with no port-pending rows. The cross-language check (does
registering cs move any other language) is run once for the whole group at the end (the bg log, final run).

