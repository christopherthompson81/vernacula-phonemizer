# Rust port: English (en, en-GB)

English goes first because Kokoro TTS needs it (#1463). The path covers core (unicode, roman, initialisms,
clauses, provenance, trace, the loaders), english/* and english-gb, plus the neural OOV tagger (its runtime
is a separate investigation: rust_neural_runtime_investigation.md).

## Run 1 — 2026-10-09 (ARPABET → IPA differential)

**Question.** Does `english_arpabet.rs` reproduce `makeArpabetToIpa` over the real dictionary, with the
shipped syllabic and nasal-seam slot tables (english.ts's call) and with none (englishTagger.ts's call)?

**Command.** `npx tsx rust/tools/fn-diff/dump.mts arpabet > .probe/rust/arpabet.jsonl`, then
`cargo run --release -p fn-diff -- arpabet ../.probe/rust/arpabet.jsonl`. The dump covers every `g2p-dict.tsv`
row (135,321 words) plus the first 5,000 again with the bare converter.

**Raw finding.** `arpabet: 140321 identical, 0 DIFFER`.

**Implication.** The converter is done. The slot parser depends on JS `Number()` (`"".split(",")` →
`[""]` → `Number("")` = 0, a valid slot), so `core::js_string::js_number` now ports StringToNumber; its
expectations were checked against Node. `fn-diff` is the per-module differential for every English module
that follows, before the golden gate.

## Run 2 — 2026-10-09 (numbers, spellingVariants, posTagger differentials)

**Question.** Do the three leaf modules match their TS twins?

**Command.** `npx tsx rust/tools/fn-diff/dump.mts {pos,spelling,numbers}`, then `fn-diff` replays.
- `pos`: every whitespace-split golden sentence (en, en-GB, en-IN), 600 rows.
- `spelling`: every g2p-dict word plus the en-GB lexical-set tables and ~25 hand probes, with lexicon
  membership as `known`. 136,293 rows.
- `numbers`: 0..20000, then 10^e, 10^e−1, 10^e+7 and a mixed value for e = 3..36 (past the 10^33
  "say the digits" cap), as cardinal and ordinal. 40,274 rows.

**Raw finding.** `pos: 600 identical`, `spelling: 136293 identical`, `numbers: 40274 identical`, 0 differ
each. The spelling probe is not vacuous: 297 rows found a respelling, the rest correctly found none.

**Implication.** Leaves done. Three decisions recorded in the code:
- the `our` loop's early exit at index ≤ 1 is kept;
- BigInt becomes a canonical digit string (`BigNat`), so the > 33-digit branch stays reachable;
- POS feature duplicates count once, as the TS object's keys do.

## Run 3 — 2026-10-09 (Math.log, and the n-gram G2P)

**Question 1.** Does `f64::ln` (glibc) agree with V8's `Math.log` (fdlibm port)? The n-gram beam ranks
by sums of logs.

**Command.** Node dumps `Math.log` bit patterns for 2M random positive doubles, 2M random count ratios and
every count ratio in `g2p-model.json` (4,149,804 inputs). `fn-diff log` compares them against both
`core::js_math::log` (an fdlibm `e_log.c` port) and `f64::ln`.

**Raw finding.** `fdlibm port 4149804 identical, 0 DIFFER; f64::ln differs on 155865 (5586 of them
n-gram ratios)`.

**Implication.** `Math.log` must be `js_math::log`. `f64::ln` is off in the last bit on 3.8% of inputs,
including 5,586 of the model's own ratios. (Not yet shown at the word level. Do that once the full g2p
dump exists: swap in `f64::ln` and count changed words.)

**Question 2.** Does `english_g2p.rs` match `createEnglishG2p` as `createEnglish()` builds it?

**Command.** `dump.mts g2p` (every accent-lexicon word plus synthetic OOVs: glued pairs, `-ishness`,
`-ings`, doubled vowels, consonant-only strings) and `fn-diff g2p`. The TS dump runs at ~13 ms/word, so
the first 14,000 rows were checked while the rest generates.

**Raw finding, in order.**
- First port: `14000 identical, 0 DIFFER`, but 95 s for 14k words (≈6.8 ms/word in Rust).
- Indexing each context's count list: still 60 s.
- Interning tokens, a 4-slot history, back-pointers for phones: `11840 identical, 2160 DIFFER`. The bug:
  model keys were parsed by splitting on spaces, but a token's chunk can hold spaces (`n:AH0 N`).
- Parsing keys by token shape (every token starts `<letter>:` or is `^`; a load-time assert checks that
  every key parses into exactly `order` tokens): `14000 identical, 0 DIFFER`, 11.6 s with model load
  (~0.8 ms/word).

**Implication.** The G2P is correct on the first 14k, and the full-dump result is pending. `perf` cannot run
in this session: `perf_event_paranoid` is 4, so unprivileged `perf_event_open` fails even outside the
sandbox. The hot path was found by counting allocations instead.

## Run 4 — 2026-10-09 14:15 (normalize.ts)

**Question 1.** Are the Rust regexes the TS ones, character for character? 19 patterns are built at runtime
from table keys (UNIT_RE, the micro/rate/formula/designation/mixed-case tokens, the address pair, the
calendar range, the leading decimal, SPACE_GROUP, the five relationals) and 89 are literals.

**Command.** A scratch copy of `normalize.ts` (imports made absolute, the private patterns exported) printed
each runtime pattern's `.source`/`flags`; a temporary Rust test printed the port's; a script compared them
(`RegExp.prototype.source` writes `/` as `\/`, so that escape was undone first). A second script checked
every Rust `js_re!` literal against the TS file as `/pattern/flags`, and against the 68 `english/normalize`
rows of `csharp/regex-corpus.jsonl`.

**Raw finding.** First pass: `checked 19 patterns, 3 differ`. FORMULA_TOKEN, DESIGNATION_TOKEN and
MIXED_CASE_TOKEN differed because `core::initialisms::LATIN_MARK` held the literal combining characters,
while the TS constant is the escaped text `\u0300-\u036F…`. They mean the same thing inside a `u` class, but
the text is not verbatim. After changing the core constant to the TS text: `checked 19 patterns, 0 differ`.
Literals: `corpus literals: 68 missing from rust: 0`, `rust literals: 89 not found verbatim as a TS
literal: 0`. Table checks: `UNITS` has 78 keys and the folded index 65, the same as Node. The sorted
alternations (MONEY_MAG, MONTH_ABBREV, WEEKDAY_ABBREV, PLAIN_ABBREV, BARE_ABBREV, REGION_NAME) and
`UNIT_WORDS` are identical.

Dead end: the scratch fix script was first written with `\u0300` escapes in a Python raw string, and the
file tool decoded them on write, so the "fix" was a no-op that reported nothing. The script had to build the
backslash from `chr(92)`. Check the artifact (`od -c`), not the script's silence.

**Question 2.** Do `normalize_english` and `normalize_english_initialisms` match the TS?

**Command.** `npx tsx rust/tools/fn-diff/dump.mts normalize > .probe/rust/normalize.jsonl` (and
`initialisms`), then `cargo run --release -p fn-diff -- normalize ../.probe/rust/normalize.jsonl` (and
`initialisms`). Inputs, deduplicated and tagged with the first source they came from: column 1 of
`csharp/goldens/{en,en-GB,en-IN}.tsv`; FLEURS `en_us` train/dev/test COLUMNS 3 AND 4 (the first line is
"The main local beer is 'Number One', …", which is a sentence); and
`rust/tools/fn-diff/probes/en-normalize.txt`, 193 synthetic lines. `initialisms` is
`normalizeEnglishInitialisms(normalizeEnglish(t), w => lexicon.has(w))`, with accent-lexicon.tsv parsed as
`createEnglish` parses it.

**Raw finding.**
```
  golden: 114 identical, 0 DIFFER
  fleurs: 3839 identical, 0 DIFFER
  probe: 193 identical, 0 DIFFER
normalize: 4146 identical, 0 DIFFER
initialisms: 4146 identical, 0 DIFFER
```
The initialism pass changed the normalized text on 7 golden, 100 FLEURS and 18 probe inputs.

**Question 3.** Which arms did the inputs reach? A clean differential over text that never reaches an arm
proves nothing about that arm.

**Command.** The scratch copy's `rewrite` was wrapped to record, per pattern and per source, whether the
pattern matched the input and whether the output changed (src/ untouched). It was run over the same 4,146
inputs.

**Raw finding.** `arms: 93; matched by no probe: 0; matched by no corpus line: 59`. All 93 rewrite arms are
matched by at least one probe line. The corpus (golden + FLEURS) reaches only 34 of them, and most of those
are the common arms: the context-year rule matched 163 FLEURS lines, UNIT_RE 68, month+day 46, the dotted
initialism strip 30 and the clock 27. Arms reached ONLY by probes: Rev., TY, IR, both max arms, `et al.`
(changing), circa, the e.g./i.e. phrase-end forms, the dateless month-abbreviation and weekday arms, section
dots, `Re:`, both address arms, formula/designation/mixed-case, list markers, SI grouping, the leading
decimal, the scientific exponent, all four UTC-offset arms, negatives, ±, both numeric-date arms, money with
cents, the postfix and spaced plus, 24/7, fractions, DMS, feet-inches, the decimal-inch rule, the bare
rate and bare micro arms, `w/`, both bare-exponent arms, Greek letters, the ampersand initialism, `&amp;`, ÷,
=, <, >, the arrow, the digit-to-word dash, and all five relationals. Most probe-only arms are reached by
1–5 of the 193 lines, so the probe set is the only evidence for them and it is thin per arm. Branch-level
cases deliberately included: the `iu`-fold miss in PLAIN_ABBREV (`ſr.`), the Kelvin-sign fold into UNITS
(`5 Kg`), the credential decline (`Smith, MD`), the roman collision decline, the code-slot and
compound-part exponent declines, and the prototype reads below.

**Question 4.** Is key ORDER load-bearing, and would the differential see an order bug?

**Command.** Three temporary edits, each reverted, each followed by the `normalize` replay:
(a) equal-length keys reversed inside every length-sorted alternation (the sort is still longest-first,
but this is the "unstable sort" case); (b) shortest-first; (c) `UNITS_FOLDED` built last-write-wins instead
of the TS's first-declared-wins.

**Raw finding.**
- (a) `normalize: 4146 identical, 0 DIFFER` (initialisms the same), although 10 pattern sources changed (the
  source diff was checked to confirm the edit took effect). This cannot change a row. Two different keys of
  the SAME length can match the same text only under case folding (`l`/`L`, `Ω`/`Ω`/`kω`…). Either way
  the group captures the SUBJECT's text and consumes the same number of units, and the callback looks up
  that captured text, not the key. Stability is therefore not observable here. Length order is.
- (b) `probe: 191 identical, 2 DIFFER`, corpus 0: `50 BTU/hr/sf` → `b t u/hr/sf` and `BTU/hr/sf header` →
  `b t u per hour/sf`. `km/h` and `m/s` survive shortest-first by luck: the stranded `/h` is re-read as a
  rate by 6a3. Only the btu chain witnesses the length sort, and only in the probes.
- (c) `probe: 192 identical, 1 DIFFER`: `25 ΜM and 5 ΜS` reads micromolar/microsiemens under last-wins, and
  micro meters/microseconds under the TS's first-wins. The folded slot IS reachable (TS finding 2 below).

**TS findings (reported, not fixed; the Rust ports current behaviour).**
1. **Prototype reads in the slash rule (6a3).** `TIME_PERIOD[right.toLowerCase()]` and
   `resolveUnitSymbol(UNITS, UNITS_FOLDED, left|right)` are plain-object reads, so an inherited property
   counts as a hit. `litres/constructor` → "litres per function Object() { [native code] }", because the
   template literal stringifies `Object`. `toString/apples` → "toString per apples" and `valueOf/thing` →
   "valueOf per thing": the inherited method makes `rate` true. The Rust reproduces it (`is_proto_key`,
   `time_period`), and a revert test showed the probe catches its absence. The fix is `Object.hasOwn`, or
   `Map`s, in `resolveUnitSymbol` (it is shared core) and in `TIME_PERIOD`.
2. **Greek CAPITAL mu reaches the folded micro slots, which gives a wrong unit.** `µ`/`μ`.toUpperCase() is
   U+039C, which folds onto the micro keys under `iu`, so an upper-cased document reaches `UNITS_FOLDED`.
   That index keeps the first-declared key, so `25 ΜM` (micromolar) → "25 micro meters" and `5 ΜS`
   (microsiemens) → "5 microseconds". The UNITS comment says "nothing REACHES the folded slot for `µm`/`µs`
   today", and this contradicts it. It is the wrong-unit class the micro block exists to remove.
3. **`isoDate` accepts impossible dates.** Its docstring promises `undefined` "if the fields are not a real
   date", but it only range-checks 1–12 and 1–31: `2024-02-31` → "february 31st 20 24", `2/30/2024` →
   "february 30th 20 24".
4. Comment nit: step 0e says "⚠ AND BEFORE STEP 0e". It means 0f, the sign rule.

**Rust-side changes outside the new file.** `core::initialisms`: `LATIN_MARK` is now the TS text verbatim,
and `InitialismData` is generic over its `isRecorded` predicate. English builds the pass per call around a
borrowed lexicon predicate, as the TS does. Auto-traits still leak through `impl Fn`, so a `Send + Sync`
predicate still gives a normalizer that can live in a `static`. `cargo test --workspace`: 19 passed;
`cargo build` (debug and release): 0 warnings; `regex-diff`: `145140 probe results identical, 0 DIFFER, 0
patterns refused`.

**Implication.** `normalize.ts` is ported. The 59 arms that no corpus line reaches rest on one or a few
probe lines each, so a future TS change to one of them needs a probe line added with it, or this
differential will not see it.
