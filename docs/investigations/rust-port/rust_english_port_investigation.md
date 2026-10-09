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
