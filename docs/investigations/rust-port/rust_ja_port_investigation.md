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
