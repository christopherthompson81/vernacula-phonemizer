# Rust port: Japanese (ja)

The ja engine (#1463): `src/languages/japanese/{japanese,counters,kana,kanji,manifest,normalize,numbers,pitch}.ts`
→ `rust/vernacula-phonemizer/src/languages/japanese/*.rs`. The import closure outside the directory is
`core/{normalizeSymbols (makeSymbolNormalizer), clauses, provenance, loadTsv, loadManifest, numbers (digitIndex)}`.
All are ported except `makeSymbolNormalizer`, which the es port owns (branch `rust-lang-es`); ja calls it
through a TODO identity stub (`japanese.rs::symbols`) until that commit is cherry-picked.

Embedded Latin goes to the registry's default foreign reader (English). No neural entry: `neuralRegistry.ts`
does not list `ja`. No Roman policy.

## Run 1 — 2026-10-09 16:40 (first golden gate, symbol tier stubbed)

**Question.** With every module ported except the shared symbol tier, how far is the golden?

**Command.** `cd rust && cargo run --release -p parity -- ja`

**Raw finding.** `ja: 195/200 identical, 5 differ`. Every one of the five is the symbol tier: `20 km`
reads the English letters `kʰˌeᶦˈɛm` where the TS reads キロメートル, `83 m` reads `ˈɛm`, `80%` drops パーセント.
The rest, kanji readings, counters, pitch, bunsetsu segmentation and the English Latin runs (`eu`), is
byte-identical. The whole 200 rows take about 1 s, data load included.

**Implication.** Stays at 195 until `makeSymbolNormalizer` is cherry-picked from `rust-lang-es`. The
per-module differentials come next.

## Run 2 — 2026-10-09 17:05 (per-module differentials)

**Question.** Does each ja module match its TS twin over the real data and the corpus, independently of the
end-to-end path?

**Command.** `npx tsx rust/tools/fn-diff/dump.mts <name> > .probe/ja/<name>.jsonl` for the seven `ja-*` dumps,
then `cargo run --release -p fn-diff -- <name> ../.probe/ja/<name>.jsonl` (wrapped in `.probe/ja/replay.sh`).
Texts are `textsFor(["ja"], "ja_jp", ["ja.txt"])`: golden 123 distinct, FLEURS ja_jp columns 3+4 3,453
distinct, probes 109 (3,685 in all).
- `ja-normalize`: `normalizeJapanese` on every text.
- `ja-kana`: `kanaToMorae` over every kana value in readings.tsv/fallback.tsv, every kana-only pitch key, every
  single kana and every ordered pair of kana and marks (lone surrogate and astral Han included), plus
  `segmentsToMorae` over two-way splits of every 13th word.
- `ja-kanji`: `applyReadingSegments` and `headsCompound` over every readings.tsv key, every fallback kanji
  (bare, +々, +の, +る), every TOKEN run of the texts, and astral/iteration-mark corners.
- `ja-segment`: `segmentText` over each text, raw and after `normalizeJapanese`.
- `ja-counters`: `readCounter(n, ctr)` for n = 0..1100 plus large, unsafe, negative, fractional and NaN
  values, over all 29 counters and four non-counters (間 生 の, astral 𠮟).
- `ja-numbers`: `numberToKana(Number(r), r)` for 0..20000, powers/mixed to 10^16 and unsafe digit strings.
- `ja-pitch`: `accentNucleus` and `phonemizeWord` over every readings.tsv row, every 5th with a
  particle/copula suffix, and every TOKEN run of the texts with its computed reading.

**Raw finding.**
```
ja-normalize: 3685 identical, 0 DIFFER   (golden 123, fleurs 3453, probe 109)
ja-kana: 384626 identical, 0 DIFFER
ja-kanji: 228294 identical, 0 DIFFER
ja-segment: 7370 identical, 0 DIFFER     (golden 246, fleurs 6906, probe 218)
ja-counters: 36894 identical, 0 DIFFER
ja-numbers: 20059 identical, 0 DIFFER
ja-pitch: 276242 identical, 0 DIFFER
```
These are not vacuous. 308 of the 3,685 normalize rows change the text. ja-kana has 261,425 distinct
outputs, 11,611 of them `none`. ja-counters has 4,617 `none` and 31,275 distinct.

**Implication.** Every module except the stubbed symbol tier is done. Two dialect notes:
- `segmentText`'s `unit[0]` and kana.ts's `next[0]` / `morae[k+1][0]` are first CODE UNITS. They are ported
  as such, so an astral kanji's high surrogate is not `isKanji` there.
- `/^[ァ-ー]$/` has no `u`, so an astral `prev` never matches it.

## Run 3 — 2026-10-09 17:20 (end to end and the trace, symbol tier still stubbed)

**Question.** Is every end-to-end difference the missing symbol tier, and does the trace match?

**Command.** `LANGS=ja npx tsx rust/tools/fn-diff/dump.mts {phonemize-sync,phonemize-best,trace}`, replayed
with `FN_DIFF_SHOW=1000` (a new env knob on the replay's print limit). Then the DIFFER texts were matched
against `.probe/ja/symbols.mts`, which lists the texts where the TS `makeSymbolNormalizer` built from
`MANIFEST.symbolTier` changes `prePass("ja", text)`. That is 84 texts.

**Raw finding.** `phonemize-sync: 3602 identical, 83 DIFFER`, `phonemize-best: 3602 / 83`, `trace: 3601 / 84`.
All 83 + 83 + 84 are in the symbol-tier set, so 0 are unexplained. The extra trace row moves only
`normalized` and spans; its IPA happens to agree.

**Per-arm coverage** (texts where the arm's replace CHANGED the string through `phonemize(text, "ja")`,
from `.probe/ja/coverage.mts`, which patches `String.prototype.replace`):
| arm | golden | fleurs | probe |
|---|---|---|---|
| 0 full-width digit / Latin fold | — | — | — (the registry's `foldFullwidthLatin`/digit fold claims them first: 6 fleurs, 3 probe) |
| 0a declared ruby | — | — | 3 |
| 0b parenthesised ruby | — | — | 3 |
| 1 comma thousands | 1 | 51 | 2 |
| 3 分の between digits | — | 8 | 1 |
| 4 slash fraction | — | 2 | 1 |
| 5 clock | — | 5 | 2 |
| 6 decimals | 2 | 16 | 3 |
| 7 ranges | — | 52 | 3 |
| 8 ℃ / ℉ / bare ° | — | 2 | 3 / 2 / 2 |
| 9 minus / ± / leading + / infix + | — | — / — / — / 2 | 2 / 1 / 1 / 2 |
| 9aa < / > / = / ÷ | — | — | 1 / 1 / 1 / 1 |
| 9b digit × digit | — | — | — (the symbol tier's `multiply` claims it first: 2 fleurs, 2 probe) |
| 10 initialisms | — | 125 | 8 |
| 10 `pH` replaceAll | — | 2 | 1 |
| japanese.ts number+counter fusion | 26 | 625 | 34 |

The width folds and 9b cannot be reached through `phonemize`, only directly: `ja-normalize` exercises them,
including the probe lines.

**Implication.** Once `makeSymbolNormalizer` lands, all three dumps should go to 0 and the golden to 200/200.
The ja trace already agrees on every row the tier does not touch.

## Run 4 — 2026-10-09 17:35 (TS findings from reading, checked against Node)

**Question.** Do the defects seen while reading the TS actually show in its output?

**Command.** `npx tsx .probe/ja/sokuon.mts` (kanaToMorae / phonemize on sokuon before each vowel), plus the
trace dump filtered to texts containing `pH`.

**Raw finding.**
1. **Sokuon before う/え/お geminates a bare vowel letter.** `kanaToMorae("あっお")` gives `["ä","o","o̞"]`,
   and `phonemize` gives `äoo̞`. The same happens for `あっう` (`ɯ`) and `あっえ` (`e`), while `あっあ` and `あっい`
   correctly give `ʔ`. Both kana.ts sites, the sokuon branch and `geminateSokuon`, test
   `isVowelChar(next[0])`. `next[0]` is one CODE UNIT, but ɯᵝ, e̞ and o̞ are two units, so only ä and i are ever
   recognised as vowels. The module's own docstring says a vowel-onset っ is ʔ. `うわっうそ` → `ɯᵝwäɯɯᵝso̞`.
2. **`pH` withdraws every input span of its row.** normalize.ts applies the mixed-case acronyms with
   `s.replaceAll(k, v)` rather than `rewrite`, so the provenance mapping is poisoned. In the trace dump,
   exactly 3 of 3,685 rows have tokens without `inputSpan`. All 3 are the `pH` rows, and in each of them
   EVERY token lacks it (13/13, 10/10, 2/2). Kokoro builds word spans from `input_span`, so those rows get
   none. Minimal repro: `phonemizeTrace("pHの値", "ja")`, where both tokens lack `inputSpan`. (`replaceAll`
   also matches inside a longer Latin word. That is a smaller issue.)
   Minimal repro of 1: `phonemize("あっお", "ja")` → `äoo̞` (expected `äʔo̞`).
3. **Unreachable arms on the shipped path.** normalize.ts's full-width digit and Latin folds never fire
   through `phonemize`, because the registry's fold pre-pass has already folded them. Its `digit × digit`
   rule (9b) never fires either, because the symbol tier's `multiply` runs first and claims every case. Both
   fire only when normalizeJapanese is called directly. Not a wrong reading, but 9b is dead code on the
   shipped path.
4. **Object.prototype lookups: none reachable.** `COUNTERS[ctr]` (ctr is one Han code point or つ),
   `WORD_ACRONYM[run]` (`[A-Z-]+`), `LETTER_KANA[ch]`, `MANIFEST.mora/foreign/youonOnset/smallY/vowelKana[...]`
   (keys of at most two code points) and `CLAUSE_MARK[m[3]]` (one character) can never be handed a
   prototype property name. `readCounter(1, "constructor")` would return `いちundefined`, but no caller can
   pass it. The `String(Math.abs(n))` fallback of `numberToKana` without `raw` is likewise unreachable.

**Implication.** The Rust port reproduces 1 and 2 byte-for-byte, as the bidirectional rule requires (no fix in
Rust alone). Both are reported for a TS-first fix. 2 matters for the Kokoro word spans.

## Run 5 — 2026-10-09 17:50 (state at hand-off)

**Question.** What is left once everything except the symbol tier is done?

**Finding.** Both TS defects from Run 4 are logged for the TS-first fix batch. The Rust port reproduces the
current behaviour of each byte-for-byte (`ja-kana` and `trace` are 0 DIFFER on those rows). The only open
item is `makeSymbolNormalizer`, from the es port. Its WIP commit on `rust-lang-es` was deliberately NOT
cherry-picked: the coordinator sends the final hash once es is green. Then `japanese.rs::symbols` is replaced
by `make_symbol_normalizer` over `MANIFEST.symbolTier`'s 8 fields, and the parity, sync, best and trace
dumps are re-run.

**Port-pending rows (symbol tier):** golden 5 of 200. Over the 3,685 golden+FLEURS+probe texts: 83 sync,
83 best, 84 trace. No row is port-pending on a foreign engine: the only embedded runs are Latin, and English
is ported.

## Run 6 — 2026-10-09 18:10 (symbol tier cherry-picked: the golden closes)

**Question.** With the real `makeSymbolNormalizer` (es commit 9aceb875, cherry-picked) over `symbolTier`'s
eight fields replacing the stub, do the golden, the end-to-end dumps and the trace close?

**Command.** `git cherry-pick 9aceb875` (clean). `japanese.rs::symbol_tier()` builds `SymbolData` from the
now typed `manifest::SymbolTier`. Then `cargo run --release -p parity` (all languages) and
`.probe/ja/replay.sh` for the module dumps and for `phonemize-sync`, `phonemize-best` and `trace`. The TS
dumps from Runs 2–3 were reused; the TS tree has not changed since.

**Raw finding.**
```
en: 200/200 identical, 0 differ
en-GB: 200/200 identical, 0 differ
ja: 200/200 identical, 0 differ
phonemize-sync: 3685 identical, 0 DIFFER
phonemize-best: 3685 identical, 0 DIFFER
trace: 3685 identical, 0 DIFFER
```
The seven module dumps are unchanged at 0 DIFFER. `cargo build --workspace` gives 0 warnings, and
`cargo test --workspace` passes.

**Implication.** ja is done. Nothing is port-pending. The two TS defects of Run 4 remain, and Rust
reproduces both, until the TS-first fix batch lands.

## Run 7 — 2026-10-09 (review fixes for #1467, all gates re-run)

**Question.** After the eight review fixes, are the gates still byte-identical?

**The fixes.**
1. The inherent `JapanesePhonemizer::text` is now private `render`, so every path goes through `Engine::text`.
   `Engine::text` and the public `phonemize_word{,_segmental}` (now `Result`) call `ensure_lexica()` first.
2. `try_manifest`, `try_readings`, `try_lex` and the symbol tier cache SUCCESS only (`japanese::load_once`
   over a `OnceLock<T>`). A failed load returns the error and the next call retries, which matches the TS
   assign-after-load and the registry's Data-error contract.
3. The manifest claim is now true. `symbolTier.exponentWords` and `bareExponent` deserialize into ja-local
   structs whose fields are required where the TS interface requires them, then convert to the shared
   all-optional types. Only `exponentWords.position` and `multiply.by`, which the TS marks optional, are
   `Option`.
4. `PositionDecl::Per` is now a named struct `PerPower` with `#[serde(deny_unknown_fields)]`. serde rejects
   the attribute on an enum variant, which was the first compile error.
5. `money()` reads a `saidAfter` regex precompiled per currency key (`cur_said`), as `pct_after` already was.
6. `is_kanji`, `is_kana` and `is_hiragana` are code-point range tables. `re.test(ch)` under `u` means "some
   code point is in the class", so `any_cp` is exact for any input, not only single characters. A unit test
   checks each table against its verbatim pattern over all 0x110000 code points, lone surrogates included.
7. One copy each of `to_katakana`, `to_hiragana` (code-point shifts, unit-tested against their TS regexes over
   U+3000–U+30FF plus an astral and a lone surrogate) and `strip_non_kana`, in `japanese/mod.rs`.
8. The unreachable `digit × digit` arm keeps its port, with a one-line comment.

**Command.** `cargo run --release -p parity`, `.probe/ja/replay.sh` (every module dump plus sync, best and
trace; the TS tree is unchanged since the dumps), `npx tsx rust/tools/fn-diff/dump.mts symbols` replayed with
`fn-diff symbols`, `cargo test --workspace`, and `cargo build --workspace` in both profiles.

**Raw finding.**
```
en: 200/200   en-GB: 200/200   ja: 200/200
ja-normalize 3685 · ja-kana 384626 · ja-kanji 228294 · ja-segment 7370 · ja-counters 36894
ja-numbers 20059 · ja-pitch 276242 · phonemize-sync 3685 · phonemize-best 3685 · trace 3685   (all 0 DIFFER)
cargo test: 47 + 1 passed; build: 0 warnings (debug and release)
```
symbols: 131 normalizers recorded, 130 distinct; fn-diff symbols: 50750 identical, 0 DIFFER
```
**Implication.** Every fleet tier still deserializes under `deny_unknown_fields`: a misspelt `position`
record would have failed the replay's load. No reading moved. ja stays done.

## Run 8 — 2026-10-09 18:45 (the two Run 4 defects, fixed TS-first)

**Question.** With the two Run 4 defects fixed in the TS first, do the goldens move, and do C# and Rust close
over the fixed behaviour?

**The fixes.**
1. kana.ts: `isVowelChar(next[0])` (one code unit) became `startsWithVowel(mora)`, which compares whole
   phonemes, at both sites (the sokuon branch of `kanaToMorae` and `geminateSokuon`). The geminate itself is
   still `next[0]`, the first code unit of a consonant onset. No other site uses the idiom:
   `assimilateMoraicN` compares `morae[k+1][0]` against `nasalAssimilation`'s onsets, which are all one unit.
2. normalize.ts: the mixed-case `WORD_ACRONYM` keys (`pH`) are applied through `rewrite`, each as a
   Latin-bounded regex (the same lookarounds as the all-caps initialism rule), so they no longer poison
   provenance or match inside a longer Latin word. The key is spliced verbatim, with a load-time check that it
   is ASCII letters. A first version escaped it with a regex literal, which added a row to
   `csharp/regex-corpus.jsonl` (`regex-corpus-fresh` failed). The letter check needs no new literal, so the
   shared corpus stays unchanged.

**Readings, from the fixed engine (`npx tsx .probe/ja/fix.mts`, before → after).**
```
あっう  äɯɯᵝ → äʔɯᵝ      あっえ  äee̞ → äʔe̞      あっお  äoo̞ → äʔo̞      (あっあ / あっい already äʔä / äʔi)
うわっうそ  ɯᵝwäɯɯᵝso̞ → ɯᵝwäʔɯᵝso̞        ちょっえ  t͡ɕo̞ee̞ → t͡ɕo̞ʔe̞        かった  kättäꜜ (unchanged)
pHの値   inputSpan [null,null] → [[0,3],[3,4]]          (IPA unchanged: piːe̞ːt͡ɕino̞ ätäi)
pH7の水  [null×4] → [[0,2],[2,3],[3,4],[4,5]]           水のpHは  [null×2] → [[0,2],[2,5]]
DepHiは  Deピーエイチiは (dˈiː piːe̞ꜜːt͡ɕi ˈaᶦ hä) → DepHiは (dˈɛfɪ hä)
ApHは    Aピーエイチは → ApHは (ˈʌf hä)    pHDは / pHéは  likewise now stay Latin
```

**Tests.** `test/japanese-rust-port-findings.test.ts` (10 tests): with the src fix reverted, 7 fail (あっう,
あっえ, あっお, the repro, geminateSokuon across a segment, pH spans, pH inside a Latin word). C#
`JapaneseRustPortFindingsTests` (16 cases): with the C# fix reverted, 14 fail (the 2 that pass are あ and い).
Rust `japanese::tests::sokuon_before_a_vowel_and_ph_spans`. No existing test in any engine pinned the old
reading.

**Commands and raw counts.**
- `npm run check:goldens`: `goldens fresh: 189 languages, 36495 rows, 0 stale`. **No golden row moved** in ja or
  in any other language, so nothing was regenerated. No golden text has っ before a vowel, and the 3 `pH` rows
  are FLEURS/probe text, not golden.
- `npx vitest run`: first run 6384 passed, 3 failed: `regex-corpus-fresh` (the escape literal, now removed)
  and two 5 s timeouts (`foreign-runs` th neural, `trace-token-source` #1452) while `dotnet test` and the dumps
  ran at the same time. All three pass on a rerun of those files (7 files, 108 tests). The final full run, on the settled tree
  after the dumps: `339 files passed, 6387 passed | 5 skipped`, and `check:goldens` is still 0 stale.
- `cd csharp && dotnet test` (full): `Passed: 7049, Failed: 0` (7033 + 16 new).
- `.probe/ja/replay.sh` (all ten ja dumps regenerated from the fixed TS, then replayed): every one 0 DIFFER
  (ja-normalize 3685, ja-kana 384626, ja-kanji 228294, ja-segment 7370, ja-counters 36894, ja-numbers 20059,
  ja-pitch 276242, phonemize-sync 3685, phonemize-best 3685, trace 3685).
- **The dumps see the fix.** With the Rust fix reverted against the new dumps: `ja-kana 30 DIFFER`,
  `ja-pitch 128 DIFFER`, `trace 3 DIFFER` (the three pH rows). `ja-normalize` and `phonemize-sync` stayed 0:
  no corpus text has a `pH` inside a Latin word or っ before a vowel, so those two dumps cannot witness either
  fix. The unit tests cover them.
- `cargo run --release -p parity`: en, en-GB, ja, it, es, pt, pt-BR, hi, cmn, fr all 200/200.
- `cargo test --workspace`: 66 + 1 passed. `cargo build --workspace` (debug and release): 0 warnings.
  `cargo fmt --check` is clean.

**Implication.** Both Run 4 defects are closed in all three engines, and no golden moved. Rust's reproduction
notes (the `next[0]` comment in kana.rs and the "`replaceAll`, NOT the provenance seam" note in normalize.rs)
are gone, along with the local `replace_all` helper.

## Run 9 — 2026-10-09 19:15 (review round on the Run 8 fixes, rebased onto main 944b4940)

**Question.** The review found the Run 8 sokuon predicate was still wrong ("not a vowel" instead of "a
consonant"), that kanaToMorae and geminateSokuon disagreed on っっ, that `pHpH` had stopped being read, that
the tests typed IPA, and that the load-time key check could take the normalizer down. With all of that fixed in
all three engines, are the gates still green, and do the dumps see the change?

**The fixes.**
1. `geminatesBefore(mora)` is now stated positively: the mora's first code unit is in `CONSONANTS` AND the mora
   ends in a vowel. `CONSONANTS` is derived from the manifest: the first unit of the onset of every
   consonant+vowel mora in `mora`/`foreign`, plus every `youonOnset`. It gives
   `k ɡ s ɕ z d t n h ç ɸ b p m j ɾ w v`. Both sites use the predicate. Under the old rule ー, ん and an
   earlier geminate counted as consonants: `あっー` read äːː through phonemize but äʔː through kanaToMorae, and
   `あっん` read äɴɴ. Both now give ʔ.
2. The "ends in a vowel" half makes the two paths agree on っっ. A sokuon's own geminate (`k`) and an
   assimilated ん (`n`) are lone consonants, so a ʔ before them stays ʔ. `segmentsToMorae(["あっ","っか"])` and
   `kanaToMorae("あっっか")` are both [ä,ʔ,k,kä].
3. kanaToMorae's sokuon branch now reads the next mora the way the loop does: foreign, then youon, then a
   single kana. Without that, `あっうぃ` was ʔ there but w in geminateSokuon. Now both give äwwi.
4. `pH` matches `(?:pH)+` between the Latin boundaries and is replaced once per repeat, so `pHpH` →
   ピーエイチピーエイチ again (`pH pH` too). `pHp` stays Latin.
5. The key is escaped character by character, with no regex literal, so building the pattern cannot throw. Rust
   `filter_map`s a pattern that does not compile instead of panicking, and a unit test in each engine
   iterates the table's mixed-case keys. `WORD_ACRONYM` is exported for that test. No regex-corpus row was
   added: `regex-corpus-fresh` passes.
6. One `VOWELS` list (`[U,O,E,A,I]` from the manifest) is shared by `vowelOf` and the old `startsWithVowel`,
   which is gone. `GLOTTAL` is exported.
7. Tests derive every IPA expectation from `kanaToMorae`, `MANIFEST.vowels` and `GLOTTAL`. Each engine has an
   idempotence test: `geminateSokuon(kanaToMorae(x)) == kanaToMorae(x)`. In TS the inputs are the ja-kana dump
   inputs plus っ + every pair (>100k words). In C# and Rust they are the singles, the pairs and っ + every
   pair.

**The new tests catch the old code** (`bash .probe/ja/mutate.sh`, `.probe/ja/mutate_cs.sh`). Against the TS,
each mutation applied alone:
| mutation | TS fails (of 15) |
|---|---|
| M1 Run 8 predicate (not a vowel) | 5: あっー, あっん, あっっか, segment っ/っ, idempotence |
| M2 original code-unit predicate | 9 |
| M3 no foreign lookup in the sokuon branch | 2: foreign geminate, idempotence |
| M4 no adjacent repeat | 1: the table-keys test |
| M5 original replaceAll | 2: spans, inside a Latin word |

C# (25 cases): C1 (not a vowel) fails 5, and C2 (no repeat) fails 1.

**Readings that moved since Run 8.** These are only in the ja-kana dump: the Rust kana.rs of e4b41d54 against
the new dumps gives `ja-kana 9 DIFFER`. All 9 rows are っ before ん: `っん`/`ッン`/`っン`/`ッん` were ɴ|ɴ and
are now ʔ|ɴ. The rest are one pitch-accent.tsv key, a colloquial emphatic spelling of a common adverb
(ぜ+っ+ん+ぜ+ん). It read `ze̞|ɴ|n|ze̞|ɴ` through kanaToMorae and `ze̞|n|n|ze̞|ɴ` through some segment splits,
and it now reads `ze̞|ʔ|n|ze̞|ɴ` on every path. Against origin/main's kana.rs/normalize.rs: `ja-kana 39`,
`ja-pitch 128`, `trace 3` DIFFER. `ja-normalize`, `phonemize-sync` and `phonemize-best` are 0 in both, since no
corpus text exercises these cases.

**Gates on the rebased tree.**
- `git rebase origin/main` (944b4940, the it fixes): clean, no regex-corpus conflict.
- `npm run check:goldens`: `goldens fresh: 189 languages, 36495 rows, 0 stale`. No golden row moved in any
  language.
- `npx vitest run`: `340 files passed; 6396 passed | 5 skipped`.
- `cd csharp && dotnet test`: `Passed: 7062, Failed: 0`.
- `.probe/ja/replay.sh` (dumps regenerated from the fixed TS): all ten at 0 DIFFER (ja-normalize 3685,
  ja-kana 384626, ja-kanji 228294, ja-segment 7370, ja-counters 36894, ja-numbers 20059, ja-pitch 276242,
  phonemize-sync 3685, phonemize-best 3685, trace 3685).
- `cargo run --release -p parity`: en, en-GB, ja, it, es, pt, pt-BR, hi, cmn, fr all 200/200.
- `cargo test --workspace`: 70 + 1 passed. Build warnings: 0 (debug and release). `cargo fmt --check` is
  clean.

**Implication.** The sokuon rule is now one positive predicate in each engine, applied identically on the
one-word and per-segment paths, and the idempotence test holds it there.
