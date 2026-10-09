# Rust port: Mandarin (`cmn`) — investigation log

Branch `rust-lang-cmn`, off `origin/rust-kokoro-core` (PR #1466). Scope: `src/languages/mandarin/*.ts` →
`rust/vernacula-phonemizer/src/languages/mandarin/*.rs`. Contract: `rust/PORTING.md` + `csharp/PORTING.md`.

Import closure of `mandarin.ts`, checked against `rust/vernacula-phonemizer/src/core/`:
`clauses` (ClauseSink: ported), `trace` (begin/end/enter: ported), `foreign` (readForeignRun: ported),
`loadTsv` (ported), `provenance` (`rebuilt`, `tracing`, `rewrite`: ported), `numbers` (`digitIndex`: ported),
`loadManifest` (ported). **`normalizeSymbols.makeSymbolNormalizer` is NOT ported** — the es port owns it and
the coordinator will hand over a commit to cherry-pick. Until then `symbols()` in `mandarin.rs` is a marked
identity stub.

## Run 1 — 2026-10-09 16:05

**Question.** With the six modules ported and the symbol tier stubbed as the identity, how close is the golden?

**Command.** `cd rust && cargo run --release -q -p parity -- cmn`

**Raw finding.** `cmn: 198/200 identical, 2 differ`. Both differing rows are the same sentence twice
(`… 有 80% 的 国 外 …`): the TS reads `paⁱ˨˩˦ fən˥˥ ʈ͡ʂʐ̩˥˥ pɑ˥˥ ʂʐ̩˧˥` (百分之八十), the Rust `pɑ˥˥ ʂʐ̩˧˥`
— the `%` is dropped because the percent rule lives in the unported symbol tier. Build is warning-free.
Engine build + 200 rows: 1.2 s wall.

**Implication.** Nothing else in the golden is wrong; the remaining gap is exactly the stub. Next: per-module
fn-diff differentials, the probe list, and the trace dump, all before the cherry-pick so that the symbol tier is
the only open variable afterwards.

## Run 2 — 2026-10-09 16:40

**Context.** Rebased onto `origin/main` 78174e0a (#1466 merged). Iteration switched to the shared
`JsString::code_point_strings()` (`[...s]`). New fn-diff dumps: `cmn-normalize`, `cmn-segment`, `cmn-pinyin`,
`cmn-numbers`, and a generic `trace` (per token `[span, inputSpan, ipaSpan, source, surface]` plus `ipa`,
`traced`, `normalized`, replayed at the JsString level so a lone surrogate survives). Probes:
`rust/tools/fn-diff/probes/cmn.txt` (synthetic) + seven lone-surrogate `CMN_EXTRAS` in dump.mts.

**Question.** Do the modules agree with the TS, and what is left end to end with the symbol tier stubbed?

**Commands.** `npx tsx rust/tools/fn-diff/dump.mts <name> > .probe/cmn/<name>.jsonl`, then
`rust/target/release/fn-diff <name> …`; `LANGS=cmn` for `phonemize-sync`, `phonemize-best`, `trace`.
A probe binary (`.probe/cmn/lister`) lists EVERY differing e2e row with `port_pending()` (fn-diff caps at 15).

**Raw finding.**
- `cmn-normalize: 12522 identical, 0 DIFFER` (4,174 texts × normalize / initialisms / both)
- `cmn-segment: 16696 identical, 0 DIFFER` (× masked/unmasked × before/after 一不 sandhi)
- `cmn-pinyin: 54914 identical, 0 DIFFER`
- `cmn-numbers: 20608 identical, 0 DIFFER`
- `phonemize-sync: 4117 identical, 50 DIFFER`; `phonemize-best: 4117 identical, 50 DIFFER`;
  `trace: 4124 identical, 50 DIFFER` (the 7 extras all agree).
- The 50: **43 symbol tier** (`%`, fullwidth `％`, `°`/`℃`, `mm`/`cm`/`m/s`/`mph`, `6x6cm`, `²`) and **7 port-pending**
  foreign-script probes — `port_pending()` grows el → th → ru → hi → ja → ko over exactly the Greek, Thai,
  Cyrillic, Devanagari, kana, Hangul and lone-`α` lines. No other row differs.

**Implication.** Every module is clean first time; the e2e gap is exactly the stub plus unported foreign
engines. A clean differential needs proof it can fail — next run mutates the port.

## Run 3 — 2026-10-09 17:05

**Question 1. Can these differentials fail?** (A clean first run proves nothing until it is shown to bite.)

**Commands / raw finding.**
- Mutated `apply_yi_bu_sandhi` (不 before a non-4th tone → 3 instead of 4): `cmn-segment: 16042 identical, 654 DIFFER`.
- Mutated `substitute_numbers` so each number's piece starts one unit late (a tiling error):
  `trace: 3212 identical, 962 DIFFER` while `phonemize-sync` stayed at its 50 — **the IPA dumps are blind to a
  provenance bug, and only the trace dump sees it.** Both mutations reverted; back to 16696/0 and 4124/50.

**Question 2. What does the haystack actually exercise?** `npx tsx .probe/cmn/coverage.mts` (patterns copied
verbatim from the TS), texts per source that hit each arm — golden / FLEURS / probes (102 / 3,998 / 158 texts):

| arm | golden | FLEURS | probes |
|---|---|---|---|
| FRACTION | 0 | 2 | 2 (+6 declines) |
| BELOW_ZERO | 0 | 0 | 5 |
| NEGATIVE | 0 | 0 | 3 |
| signs ± × ÷ = < > + | 0 | 0/0/0/0/0/0/2 | 2/1/1/3/1/1/3 |
| AMP_LATIN / AMP_ELSEWHERE | 0 / 0 | 2 / 0 | 3 / 2 |
| BARE_EXPONENT | 0 | 0 | 3 |
| initialism 2–3 / Roman declined | 2 / 0 | 52 / 1 | 6 / 2 |
| lone capital by Han | 0 | 0 | 5 |
| direct pinyin path | 0 | 0 | 5 |
| year before 年 / 2 before measure word | 6 / 0 | 236 / 6 | 4 / 3 |
| comma grouping / decimal / oversized | 2 / 1 / 0 | 32 / 26 / 0 | 2 / 4 / 3 |
| Latin run → en / non-Latin foreign run | 14 / 0 | 700 / 0 | 42 / 8 |
| 一 / 第一 / 不 | 34 / 0 / 11 | 1372 / 39 / 670 | 15 / 3 / 10 |
| astral Han / Han missing from chars.tsv | 0 / 0 | 0 / 0 | 4 / 2 |

The corpus carries NONE of: negatives, six of the seven signs, `&` outside Latin, bare exponents, lone
capitals, the pinyin path, oversized numbers, non-Latin foreign runs, astral Han. Those arms rest on probes
alone. Every arm has at least one probe line.

**Question 3. TS findings from reading (reported, not fixed in Rust; the Rust reproduces each):**
1. **Raw Han leaks into the IPA.** A Han code point missing from chars.tsv and from every phrase passes through
   `segment` as its own `py`, `parseSyllable` cannot parse it, and `pinyinToIpa` pushes the unknown token
   VERBATIM: `phonemize("𠮷野家","cmn")` = `𠮷 jiɛ˨˩˦ t͡ɕiɑ˥˥`; U+2F00 (KANGXI RADICAL ONE, Script=Han) → `⼀`;
   U+2A6D6 → itself. The same passthrough emits any unparseable pinyin token (`xyz9`) as text.
2. **FRACTION's guards are asymmetric.** Left `(?<![\d.,/])`, right only `(?![\d/])`, against a docstring that
   promises "nothing numeric adjacent": `1/2.5` → `2分之1.5`, `3/4,5` → `4分之3,5`, while `1.5/2` and
   `3,4/5` are declined. Probes pin all four.
3. **No reachable `Object.prototype` hit.** `CLAUSE_MARK[ch]` and `letterNames[c]` are keyed by ONE code point
   and `POWER[e]` by `²`/`³`; `tones[String(n)]` by a tone number. No prototype key is one character long.
4. `007` reads 七 (`Number()` drops the leading zeros of what is usually a designation) — noted, not a defect claim.

**Implication.** Port complete except the symbol tier. Commit, then wait for the es agent's
`make_symbol_normalizer` commit.

## Run 4 — 2026-10-09 17:20

**Question.** Which rows are port-pending, not wrong, and what will the symbol-tier hand-over need?

**Raw finding.** Port-pending: the seven foreign-script probes, each dropped because `read_foreign_run` reached an
unported engine. `port_pending()` after each, cumulative:
`這個詞 Ελλάδα 意即` → el · `泰语 เด็กๆ 和 คนอ้วน ๆ` → th · `俄语 Москва 是首都` → ru · `印地语 नमस्ते` → hi ·
`日语 ひらがな 和 カタカナ` → ja · `韩语 한국어` → ko · `α` → el (the lone-Greek-letter name). The FLEURS corpus and
the golden have none (no non-Latin foreign run anywhere in them). The ja and hi rows should clear once those
ports merge: re-check them then.

`rust-lang-es` holds only `5de81514 wip symbols`. The coordinator says do not cherry-pick it. Its API, read
for the hand-over: `SymbolData` (serde, camelCase, every field `Option`) + `make_symbol_normalizer(&SymbolData)
-> Result<SymbolNormalizer, String>` + `.apply(&JsString)`. cmn's `symbolTier` names exactly the nine fields
mandarin.ts passes (percent, currency, units, exponentWords, bareExponent, magnitudes, unspacedScript,
multiply, percentPrefix), and none of its currency/units keys is integer-like, so the JS object order is
insertion order: `serde_json::from_value::<SymbolData>` of the manifest value is the faithful build.

**Implication.** Waiting on the final es hash; then swap the stub, regenerate all dumps (the probe file gained
the FRACTION-asymmetry lines after Run 2's dumps), and re-run every gate.
