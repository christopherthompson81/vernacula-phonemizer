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
