# Rust port: Mandarin (`cmn`) — investigation log

Branch `rust-lang-cmn`, now on `origin/main` c64801a5 (first cut on `origin/rust-kokoro-core`, PR #1466). Scope:
`src/languages/mandarin/*.ts` → `rust/vernacula-phonemizer/src/languages/mandarin/*.rs`. Contract:
`rust/PORTING.md` + `csharp/PORTING.md`.

Import closure of `mandarin.ts`, checked against `rust/vernacula-phonemizer/src/core/`: `clauses`, `trace`,
`foreign`, `loadTsv`, `provenance` (`rebuilt`, `tracing`, `rewrite`), `numbers` (`digitIndex`) and
`loadManifest` were ported already. `normalizeSymbols.makeSymbolNormalizer` was not: Runs 1–4 ran with a marked
identity stub, Run 5 cherry-picked the es port's version, and since the Run 6 rebase it is main's (#1467).
`create_mandarin` builds it from exactly the nine `symbolTier` fields mandarin.ts passes.

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

## Run 5 — 2026-10-09 17:50

**Context.** `git cherry-pick 9aceb875` (core `makeSymbolNormalizer`, from the es port), clean. Stub removed:
`create_mandarin` deserializes `MANIFEST.symbol_tier` into `SymbolData` and builds the normalizer once (after
the manifest check, so a missing manifest is a `Data` error, not a panic). Every dump regenerated from this
tree (the probe list now carries the FRACTION-asymmetry lines).

**Question.** With the real symbol tier, is cmn byte-identical everywhere?

**Commands.** `cargo run --release -p parity -- cmn`; `fn-diff <name> .probe/cmn/<name>.jsonl` for each dump;
`.probe/cmn/lister` over sync and best; `cargo test --workspace --release`; `cargo build --workspace` (debug and
release) for warnings; `parity en en-GB` for the regression check.

**Raw finding.**
- golden: `cmn: 200/200 identical, 0 differ` (en 200/200, en-GB 200/200 unchanged)
- `cmn-normalize: 12537 identical, 0 DIFFER` · `cmn-segment: 16716 identical, 0 DIFFER` ·
  `cmn-pinyin: 54919 identical, 0 DIFFER` · `cmn-numbers: 20608 identical, 0 DIFFER`
- `phonemize-sync: 4165 identical, 7 DIFFER` · `phonemize-best: 4165 identical, 7 DIFFER` ·
  `trace: 4172 identical, 7 DIFFER`
- The 7 are exactly Run 4's port-pending foreign-script probes (el, th, ru, hi, ja, ko). All 43 symbol-tier rows
  from Run 2 now agree, ipa and trace alike.
- Tests: 46 + 1 passed, 0 failed. Build: no warnings.

**Implication.** Done per the checklist. Port-pending: 7 probe rows, none in the golden or FLEURS. Re-check
ja and hi after those ports merge.

## Run 6 — 2026-10-09 19:10 (review round)

**Context.** Rebased onto `origin/main` c64801a5 (#1467 ja + the symbol tier, #1468 cross-cutting fixes);
`git rebase --skip` dropped the cherry-picked symbol commit (88ae5cee), superseded by main's. Conflicts in
`registry.rs` / `languages/mod.rs` / fn-diff resolved keeping both sides. ⚠ git had factored ja's closing
`.map_err(PhonemizeError::Data),` out of the hunk; both arms checked complete by hand.

Review changes:
- `trace` collided with main's (ja's JSON form). Switched to main's `trace`; its serializer is now one function
  each side (`traceJson` in dump.mts, `trace_json` in main.rs), and the lone-surrogate texts moved to a new
  `cmn-trace-extras` dump (main's trace serializer plus each text's reading). The Rust `trace` replay now goes
  through a new guarded `phonemize_trace_js` (lib.rs; `phonemize_trace` shares it), so it carries a JsString.
- `manifest.rs`: `load_once`, not `OnceLock<Result>`, so a failure is retried. `symbolTier` is typed with the nine
  fields mandarin.ts passes, and `create_mandarin` hands `make_symbol_normalizer` exactly those: an extra key in
  cmn.jsonc can no longer move the Rust alone.
- Symbol tier and pinyin tables cached with `load_once` (once per process, not per engine build).
- Deduped: `JsString::join(parts, "")`, one `is_han` (segment.rs), `js_number_to_string` for `String(tone)`.
  No escape helper applies: the TS builds `^一十` from data UNescaped, and so does the port.
- Public entry points: every data read goes through `try_manifest` / `load_once` before `MANIFEST` is touched, so
  `phonemize*` returns `PhonemizeError::Data` on missing data instead of panicking.

**Question.** Are all gates still green on the rebased tree, and do the ja port-pending rows clear?

**Commands.** All dumps regenerated from this tree (`cmn-normalize`, `cmn-segment`, `cmn-pinyin`, `cmn-numbers`,
`cmn-trace-extras`; `LANGS=cmn` `phonemize-sync`, `phonemize-best`, `trace`; `LANGS=ja trace`), replayed by
`rust/target/release/fn-diff`; `parity cmn en en-GB ja`; `cargo test --workspace --release`;
`cargo build --workspace` (debug and release); `.probe/cmn/lister` for the full list of differing rows.

**Raw finding.**
- parity: `cmn 200/200`, `en 200/200`, `en-GB 200/200`, `ja 200/200`.
- `cmn-normalize 12537/0` · `cmn-segment 16716/0` · `cmn-pinyin 54919/0` · `cmn-numbers 20608/0` ·
  `cmn-trace-extras 14/0`.
- `phonemize-sync 4166 identical, 6 DIFFER` · `phonemize-best 4166, 6` · `trace (cmn) 4166, 6` ·
  `trace (ja) 3685 identical, 0 DIFFER` (the JsString-level replay did not move ja).
- **The ja row cleared:** `日语 ひらがな 和 カタカナ` now matches in sync, best and trace. The 6 left are the
  remaining port-pending probes: el ×2 (`Ελλάδα`, lone `α`), th, ru, hi, ko.
- The tiling mutation from Run 3, re-applied against main's JSON serializer: `trace: 3210 identical, 962 DIFFER`;
  reverted → 4166/6. The serializer switch did not blind the instrument.
- Tests: 50 + 1 passed, 0 failed. Build: 0 warnings, debug and release.

**Implication.** Done. Port-pending: 6 synthetic probe rows (el, th, ru, hi, ko), none in the golden or FLEURS;
the hi row should clear when hi merges.

**One more TS note, from typing the manifest.** `CmnManifest.symbolTier.exponentWords.position` is typed
`"before" | "after"` in manifest.ts, but cmn.jsonc says `"compound"`, which the shared tier reads; the jsonc is
untyped at runtime, so only the TS type is wrong.

## Run 7 — 2026-10-09 21:30 (rebase onto f663b714)

**Context.** `git rebase origin/main` (f663b714: ja, it, es, pt, pt-BR, hi merged). Conflicts in
`registry.rs`, `languages/mod.rs` and `dump.mts`, resolved keeping both sides. Two traps, both caught by checking:
- git factored the last pt dump entry's closing `},` out of the hunk, leaving `pt-numbers` unclosed in front
  of `cmn-normalize`; restored by hand, and `dump.mts nosuch` lists every entry (it parses).
- my own resolver script truncated `languages/mod.rs` to 0 bytes (`open(p, "w")` evaluated before the read);
  rewritten as main's list + `mandarin`, compared against `git show origin/main:…`.
`LANGUAGES` = en, en-GB, ja, it, es, pt, pt-BR, hi, cmn. The new `PhonemizeError::Input` needs nothing in cmn:
its `text` has no input it refuses.

**Question.** Is everything still green, and does the hi port-pending row clear?

**Raw finding.**
- parity (all registered): en, en-GB, ja, it, es, pt, pt-BR, hi, cmn each `200/200 identical, 0 differ`.
- `cmn-normalize 12537/0` · `cmn-segment 16716/0` · `cmn-pinyin 54919/0` · `cmn-numbers 20608/0` ·
  `cmn-trace-extras 14/0` · `trace (ja) 3685/0`.
- `phonemize-sync 4167 identical, 5 DIFFER` · `phonemize-best 4167, 5` · `trace (cmn) 4167, 5`.
- **The hi row cleared** (`印地语 नमस्ते`). The 5 left are port-pending: el ×2 (`Ελλάδα`, lone `α`), th, ru, ko.
- `cargo test --workspace --release`: 63 + 1 passed. `cargo build --workspace`: 0 warnings, debug and release.
  (`cargo fmt --check` already fails on main; left alone as instructed.)

**Implication.** Done. Port-pending: 5 synthetic probe rows needing el, th, ru, ko.

## Run 8 — 2026-10-09 18:40 (the Run 3 findings, fixed TS-first)

**Context.** Branch `fix/cmn-port-findings` on `origin/main` 5acc6b73. Four TS defects from Runs 3 and 6, fixed
in the TS with a test, then in C# and Rust (csharp/PORTING.md, "THE PORT IS BIDIRECTIONAL").

**Question 1. Before choosing a fix for the Han leak: which leaking code points exist, and would NFKC rescue them?**

**Command.** `npx tsx .probe/cmn/leak-measure.mts`: every golden (189 languages, column 1) and every FLEURS corpus
(column 3 and 4, 100 dirs mapped to an engine; `fil_ph`, `ny_mw` have none). For each text holding a Han code point
missing from chars.tsv, run `phonemize(text, lang)` in its own language and check whether that code point appears in
the output. `npx tsx .probe/cmn/fold-check.mts` checks NFKC against chars.tsv and against the whole Han repertoire.

**Raw finding (before the fix).**
- 383,329 texts, 11,623 with Han: cmn 4,009, ja 3,576, yue 3,466, wuu 198, gan 190, hsn 67, cdo 45, cjy 26, za 18,
  hak 13, ko 6, ilo 4, bo 2, mag/syl/ti 1 each.
- **Only 2 distinct Han code points are missing from chars.tsv in the whole haystack:**
  `U+3005 々` (117 texts: ja 116, gan 1), leaks in 0 of 117 (ja and gan read it with their own engines), and
  `U+2114F 𡅏`, a Min dialect character, 3 texts, all in the **cdo golden**, and it **leaks in 3 of 3**: cdo routes Han
  to cmn through the script reader, so the cdo golden carries the raw character (`復加𡅏北韓` → `fu˥˩ t͡ɕiɑ˥˥ 𡅏 peⁱ˨˩˦ xan˧˥`).
- NFKC changes neither. **Corpus fold count: 0 of 2 missing code points, and 0 of 1 leaking one, fold to a known character.**
- Repertoire (U+0000–U+3FFFF, `\p{Script=Han}`): 99,030 Han code points, 57,177 missing from chars.tsv. Of those, NFKC
  changes 1,219, and **1,141 fold to a character chars.tsv has** (all of U+2F00 Kangxi 214/214, U+F900 256/256,
  U+FA00 198/215, U+2F800–2FA1F 468/541, U+2E00 2/115, U+3000 3/14). No fold yields more than one code point.
  chars.tsv itself has 2 NFKC-unstable keys, both with readings identical to their folds. No phrase key is NFKC-unstable.

**Decision.**
1. **Fold first.** In `segment`, a Han code point with no chars.tsv entry whose NFKC is a single Han character reads as
   that character (⼀ → 一). The corpus never needs it; the repertoire count says it rescues 1,141 variant forms
   that are canonically or compatibly the same character, and it costs nothing where chars.tsv has an entry.
2. **々 repeats its predecessor** (人々 = 人人), after folding; with no Han predecessor it is unknown. Wu already reads it
   this way (wu/normalize.ts, rule 13: dropping it deletes a syllable from a name). No cmn-routed text carries it.
3. **Anything still unknown is dropped**, in `pinyinToIpa`, where every unknown token went through as text. It keeps
   its slot in the tone sequence, so it still separates its neighbours for 3-3 sandhi, as the unread syllable does.
   Why drop: no reading is derivable for it (𡅏 is not in pypinyin, and the cmn engine has no other source),
   any spelled-out stand-in would be a Mandarin syllable the text does not contain, and raw text in the phoneme
   stream is what the downstream tokenizer cannot use. The scanner already drops other unreadable marks.
   Trace shape: the run is still ONE token, and its ipa_span has one group per syllable READ, so a dropped character
   contributes no group (`𠮷野家`: 3 code points, 2 groups). A consumer that pairs groups with hanzi by position must
   not assume they are equal when a character is unreadable. Pinned by a Rust test.

**Question 2. What do the four fixes move?**

**Commands.** `npx vitest run test/mandarin-port-findings.test.ts` with and without the src change (`git diff -- src`,
`git checkout -- src`, re-apply); `npx tsc --noEmit` the same; `npm run check:goldens`; `npx tsx .probe/cmn/golden-diff.mts cdo`;
`npx vitest run`; `npx tsx tools/extract_regexes.mts` + `dotnet run -c Release --project csharp/tools/regex-diff`;
`cd csharp && dotnet test` (full) and the same test file with the C# fix reverted; `dotnet run -c Release --project
csharp/tools/parity -- cmn cdo`; all dumps regenerated from the fixed TS (`.probe/cmn/dumps.sh`) and replayed;
`.probe/cmn/mutate.py` (reverts each Rust half) for the bite check; `cargo run --release -p parity`;
`cargo run --release -p regex-diff`; `cargo test --workspace --release`; `cargo build --workspace` (debug and release).

**Raw finding.**
- Readings, before → after (from the engine):
  `𠮷野家` `𠮷 jiɛ˨˩˦ t͡ɕiɑ˥˥` → `jiɛ˨˩˦ t͡ɕiɑ˥˥` · `⼀` `⼀` → `ji˥˥` · `⼀个` `⼀ kɤ˥˩` → `ji˧˥ kɤ˥˩` · `𪛖` `𪛖` → `` ·
  `人々` `ʐən˧˥ 々` → `ʐən˧˥ ʐən˧˥` · `1/2.5` `ər˥˩ fən˥˥ ʈ͡ʂʐ̩˥˥ ji˥˩ tiɛn˧˥ wu˨˩˦` → `ji˥˥ ər˥˩ tiɛn˧˥ wu˨˩˦` (declined, as
  `1.5/2` already was) · `3/4,5` `sɹ̩˥˩ fən˥˥ ʈ͡ʂʐ̩˥˥ san˥˥ , wu˨˩˦` → `san˥˥ sɹ̩˥˩ , wu˨˩˦` · `mp3` `mp3` → `ˌɛmpˈiː san˥˥` ·
  `ipv4` `ipv4` → `ˈɪv sɹ̩˥˩` · `web3` `web3` → `wˈɛb san˥˥` · `a4 paper` `ɑ˥˩ paper` → `ˈə sɹ̩˥˩ pʰˈeᶦpɚ`.
  Declined pinyin reads as embedded Latin does (`我有mp3` already read `… ˌɛmpˈiː san˥˥`): letters to English, the
  digit to a Chinese numeral. Unchanged: `ni3 hao3`, `ni3 hao`, `lv4`, and `a4` → `ɑ˥˩` (a real syllable, à).
  `ipv4`'s `ˈɪv` is the English reader's reading of `ipv`, not this engine's.
- The test: 7 of 9 fail with the TS fix reverted (the 2 that pass are the unchanged-pinyin regression check and the
  manifest test, whose failure is at the type level: `tsc` reports TS2322 `"compound"` not assignable to
  `"before" | "after" | undefined`). The C# twin: 11 of 20 fail with the C# fix reverted.
- `check:goldens`: **1 of 189 languages stale, 3 rows: cdo** (rows 168, 174, 190). Each differs ONLY by the dropped 𡅏:
  168 `… ʐan˧˥ 𡅏 , …` / `… ʈ͡ʂoᵘ˥˩ 𡅏 t͡sɹ̩˥˩ …` / `… ku˥˩ 𡅏 weⁱ˥˩ …` → the same without `𡅏`;
  174 `fu˥˩ t͡ɕiɑ˥˥ 𡅏 peⁱ˨˩˦ xan˧˥` → `fu˥˩ t͡ɕiɑ˥˥ peⁱ˨˩˦ xan˧˥`; 190 `jiɛ˨˩˦ xɑᵘ˥˩ 𡅏 xu˧˥ jyæn˧˥` → `jiɛ˨˩˦ xɑᵘ˥˩ xu˧˥ jyæn˧˥`.
  **cmn's golden did not move**, and no other language did. cdo NOT regenerated (left for review, as instructed).
  C# parity: `cmn OK 200`, `cdo` 197 ok / 3 differ, the same 3 rows, C# matching the fixed TS.
- After the fix, the leak measurement: `leaking=0` (𡅏 0 of 3).
- `csharp/regex-corpus.jsonl`: 1 pattern added / 1 dropped (the FRACTION lookahead). C# regex-diff `145140 identical,
  0 DIFFER`; Rust regex-diff `145140 identical, 0 DIFFER, 0 refused`.
- TS full suite: `6384 passed, 2 failed, 5 skipped` on the first run: regex-corpus freshness (fixed by the extraction
  above) and `foreign-runs > th delegates …` timing out at 5 s under full-suite load; that file re-run alone passes
  (4 files, 89 tests). C# full: `7053 passed, 0 failed`.
- Dumps from the fixed TS: `cmn-normalize 12588/0` · `cmn-segment 16784/0` · `cmn-pinyin 54940/0` · `cmn-numbers 20608/0` ·
  `cmn-trace-extras 14/0` · `phonemize-sync 4184, 5 DIFFER` · `phonemize-best 4184, 5` · `trace 4184, 5`; the 5 are
  Run 7's port-pending probes (el ×2, th, ru, ko). The probe list gained the new arms and lost its "TS finding" note.
- Bite check, all four Rust halves reverted: `cmn-normalize 4 DIFFER`, `cmn-segment 16`, `cmn-pinyin 5043`,
  `cmn-trace-extras 2`, `phonemize-sync/best/trace 19`; restored → back to the numbers above.
- Rust parity: all 10 registered languages `200/200`. `cargo test --workspace --release`: 69 + 1 passed. Build: 0 warnings.

**Not fixed here (siblings, reported).** urdu/normalize.ts has the same lopsided fraction guard (`(?![\d/])` right,
`(?<![\d.,/])` left). cdo's own engine emits Latin as text: `（IUPAC）承認` in cdo → `iupac˥˥ ʈ͡ʂʰəŋ˧˥ ʐən˥˩`.

**Implication.** The four findings are closed in all three engines. The cdo golden needs regenerating (3 rows, each
only the dropped 𡅏) once the drop decision is accepted.

## Run 9 — 2026-10-09 18:55 (decision accepted; cdo regenerated)

**Context.** The coordinator accepted the Run 8 decision (fold, 々 repeats, drop the rest). The trace consequence is
safe for Kokoro: its `FromTrace` splits a Han run per hanzi ONLY when the group count equals the hanzi count, so a
dropped character makes it fall back to one span for the whole run, never to a misaligned per-hanzi split. The two
sibling findings (urdu's fraction guard, cdo's Latin passthrough) are being filed as issues by the coordinator.

**Commands.** `npx tsx tools/gen_parity_goldens.mts cdo`; a row-by-row check against the committed cdo.tsv (text
column equal, and the IPA column equal to the old one with every ` 𡅏` removed); `dotnet run -c Release
--project csharp/tools/parity -- cdo cmn`; `npm run check:goldens`.

**Raw finding.** `csharp/goldens/cdo.tsv`: 3 lines changed (168, 174, 190), 5 `𡅏` removed (3 + 1 + 1), text columns
unchanged, and each new IPA is exactly the old one minus ` 𡅏`. Nothing else moved. C# parity: `cdo OK 200 rows`,
`cmn OK 200 rows`. `check:goldens`: `goldens fresh: 189 languages, 36495 rows, 0 stale`.

**Implication.** Goldens fresh fleet-wide on this branch. Next: rebase onto main (Italian fixes, #1479) and re-gate.

## Run 10 — 2026-10-09 19:20 (rebase onto 944b4940)

**Commands.** `git rebase origin/main` (clean, no conflicts, regex-corpus.jsonl included); `npx tsx tools/extract_regexes.mts`
(2,382 patterns, no diff: the merged corpus is fresh); `npm run check:goldens`; `npx vitest run`; `dotnet test` (full);
C# `regex-diff` and `parity -- cdo cmn it`; Rust `parity` (all), `regex-diff`, `.probe/cmn/dumps.sh`,
`cargo test --workspace --release`, `cargo build --workspace`.

**Raw finding.** Goldens: `fresh: 189 languages, 36495 rows, 0 stale`; vs main only `csharp/goldens/cdo.tsv` differs
(the 3 rows). TS `6390 passed, 5 skipped, 0 failed` (340 files). C# `7057 passed, 0 failed`. regex-diff C#
`145198 identical, 0 DIFFER`, Rust `145198 identical, 0 DIFFER, 0 refused`. C# parity cdo/cmn/it 200/200. Rust parity
all 10 languages 200/200. Dumps: cmn-normalize 12588/0, cmn-segment 16784/0, cmn-pinyin 54940/0, cmn-numbers 20608/0,
cmn-trace-extras 14/0, phonemize-sync/best/trace 4184 / 5 (the port-pending el ×2, th, ru, ko). Rust tests 70 + 1,
0 warnings.

**Implication.** Ready for review.
