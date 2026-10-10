# Rust port: Portuguese (pt-BR, pt)

pt-BR is the European engine (`src/languages/portuguese/`) run with `dialect: "bp"` plus an open/close
override lexicon (`src/languages/portuguese-br/`). The whole pt directory is ported, so `pt` is registered too
once both goldens pass. Branch `rust-lang-ptbr`, off `rust-kokoro-core` (#1466).

## Run 1 — 2026-10-09 15:45 (scoping: the import closure)

**Question.** What does pt-BR need that the shared core does not have yet?

**Command.** Read `portuguese-br/*.ts`, `portuguese/*.ts` and their imports, against
`rust/vernacula-phonemizer/src/core/`.

**Raw finding.**
- Ported already: `latinPhones`, `initialisms` (`makeInitialismNormalizer`, `makeUnreadableTest`),
  `clauses` (`assembleClauses`), `provenance` (`rewrite`), `loadTsv`, `loadManifest`, `roman`.
- NOT ported: `makeSymbolNormalizer` (core/normalizeSymbols.ts, 1,469 lines). `core::normalize_symbols` holds
  only `folded_index`/`resolve_unit_symbol`. portuguese.ts's `SYMBOLS` tier needs it.
- No neural entry for pt or pt-BR (`neuralRegistry.ts`), so `phonemize-best` differs from `phonemize-sync`
  only by the registry's mixed-script English prewarm.
- pt-BR's `ROMAN_POLICY` is a re-export of pt's (`portugueseOrdinal` + an `ordinalAfter` noun list).

**Implication.** The coordinator assigned `makeSymbolNormalizer` to the es agent (`rust-lang-es`), to be
cherry-picked here. Until then the tier is an identity stub marked `TODO(normalizeSymbols)`, and every row
that carries %, a currency sign, a unit, `×`, `&` or a superscript is expected to differ end to end. The
per-module differentials (normalize, g2p, numbers) do not touch the tier and can go to 0 differ now.

## Run 2 — 2026-10-09 15:50 (per-module differentials: numbers, g2p, normalize)

**Question.** Do `numbers.rs`, the word path (`g2p.rs` + `portuguese.rs` + `portuguese_br.rs`) and
`normalize.rs` match their TS twins, before anything end to end?

**Command.** `npx tsx rust/tools/fn-diff/dump.mts {pt-numbers,pt-g2p,pt-normalize} > .probe/pt/<name>.jsonl`,
then `rust/target/release/fn-diff <name> .probe/pt/<name>.jsonl`.
- `pt-numbers`: 0..25000, powers of ten 10^5..10^12 with neighbours, a 10^6..10^9 stride, and -1, 1.5,
  2^53, 2^53+2, 1e21, NaN, Infinity; EP and BP, each with and without a `raw` digit string; four odd raws
  (`0001234567890`, `12x4`, a 20-digit run, `1 6`); `portugueseOrdinal` over -1..1002 and 2.5.
- `pt-g2p`: every key of lexicon.tsv, lexicon-manual.tsv and pt-br-openclose.tsv, every `[a-zà-ÿ]+` token of
  the BP-normalized goldens/FLEURS/probes, and ~70 synthetic corners (foreign letters, ñ, y, ß/æ/ð/þ, a lone
  surrogate, an astral letter, ſ, K, İ, ×, ÷, the empty word). Five ops each: pt EP, pt BP, the pt-BR shipped
  path, and `renderWord` without a correction in both dialects.
- `pt-normalize`: both goldens, FLEURS pt_br (columns 3 and 4), probes/pt-BR.txt; EP, BP, and the initialism
  pass over BP.

**Raw finding.**
- first `pt-numbers` run: `101751 identical, 2 DIFFER`. Both were `1e21` without `raw`: TS gives
  `um e + dois um` (`String(1e21)` is `1e+21`, and `e`/`+` survive as themselves), Rust spelled 22 digits,
  because my `String(Math.abs(n))` stand-in formatted the integer. Fixed to JS's exponent form; then
  `101753 identical, 0 DIFFER`. (Unreachable from the engine: every caller without `raw` passes a small
  integer.)
- `pt-g2p: 75625 identical, 0 DIFFER` (15,125 words × 5 ops).
- `pt-normalize: 11913 identical, 0 DIFFER`: golden 921, fleurs 10,749, probe 243.

**Implication.** The three modules are done. The symbol tier is outside all three, so these numbers do not
depend on the stub.

## Run 3 — 2026-10-09 15:53 (end to end, with the symbol tier stubbed)

**Question.** With `makeSymbolNormalizer` still an identity stub, is EVERY end-to-end difference a symbol-tier
row?

**Command.** `LANGS=pt-BR,pt npx tsx rust/tools/fn-diff/dump.mts phonemize-sync` (and `phonemize-best`), replayed
with `fn-diff`; `cargo run --release -p parity -- pt-BR pt`.

**Raw finding.** `phonemize-sync: 7734 identical, 204 DIFFER`; `phonemize-best: 7734 identical, 204 DIFFER`.
Parity: `pt-BR: 197/200 identical, 3 differ`, `pt: 191/200 identical, 9 differ`. Every printed row carries a
unit, `%` or `US$`: `160 km/h` is TS *kilˈometɾus poɾ ˈɔɾɐ* and Rust *km*; `80%` is TS *poɾ sˈẽtu* and Rust
nothing; `7,7 kg` reads *kɡ*; `US$ 11.000` loses *dˈɔlaɾis*. The 12 golden rows are 1040 km, 80%, 160 km/h,
20 km / 65 km, 3,50 m and 12,8 km.

**Implication.** Nothing outside the tier differs on the rows shown. The claim for all 204 waits on the
cherry-pick: the remaining count after it must be 0.

## Run 4 — 2026-10-09 15:54 (three TS findings, confirmed in Node)

**Question.** Reading normalize.ts for correctness: do the clock, fraction and degree rules do what they
promise in pt-BR?

**Command.** `npx tsx .probe/pt/q.mts` (`normalizePortuguese(t, true)` and `phonemize(t, "pt-BR")`).

**Raw finding.**
- `Às 16h17 em ponto` becomes `Às dezasseis horas e dezassete em ponto`, read *dezasˈejs … dezasˈet͡ʃi* in
  pt-BR. `feminineCardinal` and `fractionWords` call `numberToWords(n)` with no dialect, so pt-BR's clock and
  fractions read the EUROPEAN teens (dezasseis/dezassete/dezanove), while the number tokenizer in the same
  sentence reads *dezessete*.
- `Comeu 17/19 do bolo` becomes `dezassete décimo nonos`: the EP teen again, and the plural `s` lands only on
  the last word of a compound ordinal (*décimos nonos* expected).
- `Mediu 1.000 °C` becomes `1.000 grau Celsius`, read *mˈiw ɡɾˈaw*: `degreeWord` reads `Number("1.000")` = 1,
  so dot-grouped thousands take the SINGULAR.

**Implication.** Reported, not fixed in Rust (bidirectional rule): the port reproduces all three, and
pt-normalize stays at 0 differ over them. No reachable `Object.prototype` lookup: every plain-object index
(`DOTTED_ABBREV`, `letterNames`, `CLAUSE_MARK`, `DENOMINATOR`, the accent/vowel tables) is keyed by one
letter, a digit string or an alternation of the table's own keys, and no key folds onto a prototype name.

## Run 5 — 2026-10-09 15:56 (per-arm coverage of the haystack)

**Question.** A clean differential proves nothing about an arm the haystack never reaches. Which
normalize.ts arms does the corpus (both goldens + FLEURS pt_br: 307 + 3,583 distinct texts, from the pt-normalize row counts) exercise, and which rest
on the probes alone?

**Command.** `npx tsx .probe/pt/arms.mts`: each arm's TS pattern tested against every distinct text (raw input,
so a count approximates what reaches that step).

**Raw finding.** Texts matched, corpus / probe:
- reached by the corpus: a.C. 9/2, d.C. 4/1, número 1/2, abbrev-continue 11/5, abbrev-end 8/2, ordinal
  indicators 19/6, US$ 1/2, °C 6/2, bare ° 10/6, `NhNN` 11/3, `h:mm` 21/1, `+` after a space 2/1, fractions 2/3.
- PROBES ONLY (corpus 0): digit grouping by a space (5 probe lines), the NBSP/NNBSP/thin-space fold (4), R$ (1),
  °F (1), minus (1), ± (1), glued `+` (1), `=` `<` `>` `÷` (1 each), and the BP `1 de <month>` (1).

**Implication.** Eleven arms rest on synthetic lines, each with its declining neighbour in the same file
(`1 0000`, `0 000`, `R$ abc`, `25°Cölner`, `a-5`, `C++`, `11 de julho`, `1 de julhos`, …). All are inside
`pt-normalize: 11913 identical, 0 DIFFER`.

## Run 6 — 2026-10-09 16:01 (the symbol tier wired: golden gate and end to end)

**Question.** With the es port's `makeSymbolNormalizer` cherry-picked (9aceb875) and the stub commit
dropped, do the goldens close, and do the 204 end-to-end differences of Run 3 all go away?

**Command.** `SYMBOLS` is built from `symbolTier` + `signWords` (multiply, ampersand) as portuguese.ts builds
it. Then `cargo run --release -p parity` (every registered language), the `phonemize-sync` and
`phonemize-best` dumps re-generated for `LANGS=pt-BR,pt` and replayed, and the three module replays re-run.

**Raw finding.**
- parity: `en 200/200`, `en-GB 200/200`, `pt 200/200`, `pt-BR 200/200`, 0 differ.
- `phonemize-sync: 7932 identical, 6 DIFFER`; `phonemize-best: 7932 identical, 6 DIFFER`. The 6 rows are 3
  probe lines × 2 languages, and each has a foreign run in an UNPORTED script: `Москва` (TS *mɐskvˈa*, via
  ru), `λόγος` (*loɣos*, via el), `東京` (*tʊŋ˥˥ t͡ɕiŋ˥˥*, via cmn). Rust drops the run, and the registry
  records the target as port-pending. The Latin run beside it (`Tokyo` → *tukˈiu*) is identical.
- module replays unchanged: normalize 11913 / g2p 75625 / numbers 101753 identical, 0 differ.
- `cargo test --workspace` green; `cargo build` 0 warnings.

**Implication.** pt and pt-BR are done: golden byte-identical, and every corpus row (goldens + FLEURS
pt_br) identical on both paths. The only open rows are port-pending (ru, el, cmn), not port defects. No
golden or FLEURS row needs a foreign engine.

## Run 7 — 2026-10-09 17:32 (review round: rebase onto c64801a5, and the review's fixes)

**Question.** After rebasing onto main (#1467 ja + the symbol tier, #1468 cross-cutting fixes) and applying
the review, do all the gates still hold? And would the pt-numbers probes have caught the formatter the
review flagged?

**Command.** `git rebase origin/main`. The shared lists conflicted (registry `LANGUAGES` and `build`,
`languages/mod.rs`, fn-diff `dump.mts`/`main.rs`) and were resolved by keeping both sides. Git had factored
the shared closing `},` / `}),` out of the dump/replay hunks, so it was re-inserted between them. I then
checked every arm by hand: `LANGUAGES` is `[en, en-GB, ja, pt, pt-BR]`, with build arms for all five and
Roman arms for pt and pt-BR. The cherry-picked symbol commit was skipped (superseded by main's). Review
fixes:
- every `OnceLock<Result<…>>` (manifest, lexicon, open/close lexicon, symbol tier) is now `load_once`;
- `portuguese::phonemize_word`, `portuguese_br::{phonemize_word, phonemize_word_rules, open_close}` return
  `Result`. The engine holds its loaded tables (`lexicon`, `symbols`, and the BP open/close closure), so
  `text()` has no panic path once `create_*` has succeeded;
- `js_abs_string` was replaced by `core::js_string::js_number_to_string`, and `abbrev_alt` by
  `normalize_symbols::{sorted_by_length_desc, alternation}` (no `esc`: the TS joins the keys unescaped);
- g2p's accent→base and vowel→IPA tables are `IndexMap`s, and the hiatus accent set is built once in the
  static table;
- pt-numbers gained 2^54..2^70 (non-exact neighbours and /7), ±2^60, 2^64, 1e20, 1.5e21, 1e300,
  `MAX_VALUE`, 1e-7, 1.5e-7, 5e-324, 0.1+0.2, 1/3, 2/3, 1e9+0.5, -0.5, -0.

Gates: parity (every registered language), the five pt dumps re-generated and replayed, `cargo test
--workspace`, and `cargo build` (dev and release). Guard check: I re-ran pt-numbers with the old
formatter's integer branch (`a as u128`, Rust `{a}` for fractions) patched back in, then restored the fix.

**Raw finding.**
- parity: en, en-GB, ja, pt and pt-BR each `200/200 identical, 0 differ`.
- `pt-numbers: 101973 identical, 0 DIFFER`. With the old formatter swapped back in: `101901 identical,
  72 DIFFER`. So the new rows catch it: `String(2**60)` is `1152921504606847000`, not the exact
  `…846976`, and the small fractions print in exponent form.
- `pt-normalize: 11913 / 0`, `pt-g2p: 75625 / 0`, `phonemize-sync: 7932 / 6`, `phonemize-best: 7932 / 6`.
  The 6 rows are the same port-pending mixed-script probes (ru, el, cmn; `東京` reads as Mandarin, so it
  stays pending even though ja is ported).
- tests: 48 + 1 passed; 0 warnings in either profile.

**Implication.** The review round is closed with nothing moved. The probe extension is load-bearing:
proven by reverting the fix, not merely green after it.

## Run 8 — 2026-10-09 17:36 (rebase onto Italian, cd2492a8)

**Question.** Does the branch stay whole on top of #1469 (Italian)?

**Command.** `git rebase origin/main`, keeping both sides of `LANGUAGES`, `build`, `roman_policy`,
`languages/mod.rs`, `dump.mts` and `main.rs`. The `dump.mts` hunk had lost the `},` closing Italian's last
dump, so it was re-inserted. Then parity (every registered language), the five pt dumps re-generated and
replayed, `cargo test --workspace`, and `cargo build` (dev and release).

**Raw finding.** `LANGUAGES` = `[en, en-GB, ja, it, pt, pt-BR]`, with build arms for all six and Roman arms
for it, pt and pt-BR; `dump.mts` lists it-normalize/it-g2p/it-roman and pt-normalize/pt-g2p/pt-numbers.
Parity: en, en-GB, ja, it, pt and pt-BR each `200/200 identical`. pt-numbers 101973 / 0, pt-normalize
11913 / 0, pt-g2p 75625 / 0, phonemize-sync and -best 7932 / 6 (the same port-pending ru/el/cmn probes).
Tests 51 + 1 passed; 0 warnings.

**Implication.** Nothing moved; ready to merge.

## Run 9 — 2026-10-09 17:39 (rebase onto Spanish, 2b59b0a5)

**Question.** Does the branch stay whole on top of #1470 (Spanish)?

**Command.** `git rebase origin/main`. The conflicts were in `LANGUAGES`, `build`, `roman_policy` and
`languages/mod.rs`, with both sides kept; fn-diff merged cleanly. Then parity (every registered language),
the five pt dumps re-generated and replayed, `cargo test --workspace`, and `cargo build` (dev and release).

**Raw finding.** `LANGUAGES` = `[en, en-GB, ja, it, es, pt, pt-BR]`, with build arms for all seven and Roman
arms for it, es, pt and pt-BR; `dump.mts` lists the es-*, it-* and pt-* dumps. Parity: all seven
`200/200 identical`. pt-numbers 101973 / 0, pt-normalize 11913 / 0, pt-g2p 75625 / 0, phonemize-sync and
-best 7932 / 6 (port-pending ru/el/cmn probes). Tests 54 + 1 passed; 0 warnings.

**Implication.** Nothing moved; ready to merge.

## Run 10 — 2026-10-09 18:36 (Run 4's three findings, fixed TS-first)

**Question.** Fixed in TS, then C#, then Rust (branch `fix/pt-port-findings`, off 5acc6b73): does any golden
move, and do the dumps catch the old behaviour?

**Command.** In `normalize.ts`, `feminineCardinal`, `fractionWords` and `clockWords` now take the dialect
(`brazilian ? "bp" : "ep"`). A plural fraction pluralizes every word of the denominator. `degreeWord` strips
the tokenizer's thousands dots before `Number()`, using the same rule as TOKEN in portuguese.ts:
`(?<!(?<!\d)0)\.`, so every dot is a group except one after a lone 0, and the comma is the decimal point.
Then `test/portuguese-port-findings.test.ts`, with each fix reverted on its own; `npm run check:goldens`;
`npx vitest run`; the same fix in C# `Normalize.cs` plus `PortuguesePortFindingsTests.cs`, and the full
`dotnet test`; the same fix in Rust `normalize.rs` plus a `port_findings` test module. pt-BR.txt gained three
synthetic probe lines (a colon clock with teens, compound-ordinal fractions, and degree counts with dots). I
re-dumped the five pt dumps from the fixed TS, replayed them, and replayed them again against the
UNFIXED Rust. Last, `cargo run --release -p parity`, `cargo test --workspace`, and both regex-diffs.

**Raw finding.**
- Before → after (`normalizePortuguese`):
  - BP `Às 16h17 em ponto`: *dezasseis horas e dezassete* → *dezesseis horas e dezessete*.
  - BP `Às 19:16`: *dezanove … dezasseis* → *dezenove … dezesseis*.
  - EP `17/19`: *dezassete décimo nonos* → *dezassete décimos nonos*. BP: → *dezessete décimos nonos*.
  - `2/21`: *vigésimo primeiros* → *vigésimos primeiros*.
  - `1.000 °C`, `1.000 °F`, `1.000°`: *grau* → *graus*.
  - Unchanged: `1/19` *um décimo nono*, `3/100` *três centésimos*, `1 °C` *grau*, `1,5 °C` *graus*,
    `0.5 °C` *graus* (the tokenizer reads it as *zero . cinco*).
- Left alone: `1,0 °C` still reads *um vírgula zero grau*, because `Number("1.0")` is 1. That is the
  existing decimal reading, not one of the three findings.
- TS test with each fix reverted on its own: dialect 3 of 8 fail, plural 2 of 8, degree 1 of 8. C# test
  against the old `Normalize.cs`: 10 of 16 fail.
- `check:goldens`: `goldens fresh: 189 languages, 36495 rows, 0 stale`. NO golden moves in any language,
  pt and pt-BR included. The corpus never reaches these shapes: in the unfixed-Rust replay below, golden and
  FLEURS stay at 0 differ.
- The first full vitest run: 13 failed / 6,372 passed. Two failures were mine:
  - `portuguese-br.test.ts` pinned `07h19` as *dezanˈovi*. It is now *dezenˈɔvi*, with the reason in the test.
  - `regex-corpus.jsonl` was stale by one pattern, the new `(?<!(?<!\d)0)\.`. I re-extracted it (2,382
    patterns). C# regex-diff and Rust regex-diff: 145,198 identical, 0 differ.
  - The other 11 were environmental. `check-goldens-jobs` spawns `node_modules/.bin/tsx`, which the worktree
    lacks (9/9 pass with it linked). foreign-runs, phonemizeAsync and trace-token-source pass on their own:
    they were load timeouts while dotnet ran.
  - The re-run, with both fixes and `.bin` linked: 339/339 files, 6,385 passed, 5 skipped, 0 failed.
- `dotnet test` (full): 7,049 passed, 0 failed.
- Re-dumped replays: pt-normalize `11922 identical, 0 DIFFER` (golden 921, fleurs 10,749, probe 252),
  pt-g2p `75625 / 0`, pt-numbers `101973 / 0`, phonemize-sync and -best `7940 identical, 4 DIFFER` each.
  The 4 are the port-pending ru and el mixed-script probes × 2 languages; `東京` closed when cmn merged.
- The same dumps against the UNFIXED Rust: pt-normalize `11904 / 18 DIFFER`, all 18 of them probes;
  phonemize-sync `7929 / 15`.
- parity: en, en-GB, ja, it, es, pt, pt-BR, hi, cmn and fr each `200/200 identical`. `cargo test
  --workspace`: 68 + 1 passed. 0 warnings in both dev and release.

**Implication.** All three are fixed in all three engines and no golden moves. Only the new probe lines
witness them, and they catch the old Rust (18 rows). The Rust reproduction note in `feminine_cardinal` is
deleted. Shared files touched: `csharp/regex-corpus.jsonl` (the freshness gate requires it).

## Run 11 — 2026-10-09 20:15 (review round on Run 10; rebased onto b6629d83)

**Question.** The review raised six items:
1. the degree capture counts only the tail of a multi-group number;
2. `numberToWords`'s dialect should be required;
3. a decimal-comma count should be plural;
4. share the tokenizer's dot rule;
5. pin the clock hour;
6. one `Dialect` type.

Do the fixes move any golden, and do the probes see them?

**Command.** numbers.ts now exports `Dialect`, `NUMBER_TOKEN` (the TOKEN number group, still a literal so the
regex corpus keeps it) and `splitNumberToken`. TOKEN, `numberTokenToWords`, the three degree rules and
`degreeWord` all use them. The twins changed the same way: C# `Numbers.NUMBER_TOKEN` / `SplitNumberToken`;
Rust `numbers::{Dialect, NUMBER_TOKEN, split_number_token}`, with g2p re-exporting `Dialect` so the registry
and fn-diff paths stay unchanged. `numberToWords(n, dialect, raw?)` has no default in any engine. I proved the
TS guard by dropping one call's dialect: `tsc` reports `TS2554: Expected 2-3 arguments`. pt-BR.txt gained two
probe lines (multi-group numbers with a tail of 1, and decimal-comma counts). Then the gates on the rebased
tree.

**Raw finding.**
- Before (Run 10) → after:
  - `2.000.001°` and `1.000.001 °C`: *grau* → *graus*.
  - `1,0 °C` and `1,000 °C`: *grau* → *graus*. These read *um vírgula zero (zero zero)*.
  - `0.1 °C`: *graus* → *grau*. The tokenizer says *zero . um*, so the noun now agrees with the *um*
    that is spoken.
  - Unchanged: `1.001 °F`, `21.1 °C` (*duzentos e onze*, plural), `1 °C`, `01 °C`, `1,5 °C`, `0.5 °C`.
- Item 1: I widened the capture to the TOKENIZER's own shape, not to step 4's `[1-9]\d{0,2}(?:\.\d{3})+|\d+`.
  With step 4's shape, `21.1 °C` would match only `1` and say *grau*, while the tokenizer says *duzentos e
  onze*. The count has to be the token the tokenizer speaks.
- Item 4, step 4 disagrees with the tokenizer. Step 4 accepts strict 3-digit groups; the tokenizer accepts
  any `\.\d+` except after a lone 0. So `1.5º` becomes `1.quinto` (*um . quinto*), and `12.34º` becomes
  *doze . trigésimo quarto*. That is the same stranded head that step 4's own comment calls the worst
  outcome. Step 4's strict grouping is the right thousands rule. The tokenizer is too lax: in the corpus, the
  non-3-digit dotted numbers are `802.11`, `5.0`, `2.4`, `15.00` and `1.1`, and the tokenizer reads `5.0` as
  *cinquenta* and `2.4` as *vinte e quatro*. NOT changed here: it is a reading change on golden rows and
  belongs to its own issue. The corpus also has `802.11ª` ×3, which both rules misread.
- Regex corpus: −3 rows (`(?<!(?<!\d)0)\.` and the two one-separator degree patterns), +1 (`NUMBER_TOKEN`,
  flag `u`). TOKEN's literal row is gone, now that TOKEN is composed. The composed degree and TOKEN patterns
  are not literals, so regex-diff does not replay them; their only new fragment is NUMBER_TOKEN, which it
  does. Rebasing onto 944b4940 and then b6629d83 merged cleanly, and re-extraction made no further change.
  2,380 patterns. C# and Rust regex-diff: 145,060 identical, 0 differ.
- `check:goldens`: `goldens fresh: 189 languages, 36495 rows, 0 stale`, both before and after the rebase.
- New tests against the Run 10 normalize: TS 3 of 11 fail; C# 6 of 23 fail. Rust pt-normalize against the
  Run 10 normalize.rs: `11919 / 9 DIFFER`, all probes.
- Gates on b6629d83:
  - vitest: 341 files, 6,407 passed, 5 skipped. `.bin` was linked for the run and unlinked after.
  - `dotnet test` (full): 7,085 passed.
  - fn-diff, re-dumped: pt-normalize `11928 / 0` (golden 921, fleurs 10,749, probe 258), pt-g2p
    `75625 / 0`, pt-numbers `101973 / 0`, phonemize-sync and -best `7944 / 4` each (the port-pending ru and el
    probes).
  - parity: all ten languages `200/200`.
  - `cargo test --workspace`: 75 + 1. 0 warnings in dev and release.

**Implication.** All six items are closed and no golden moves. The lax tokenizer grouping (`5.0`, `2.4` read as
integers) is a separate, golden-moving finding, and I am reporting it, not fixing it.

## Run 12 — 2026-10-09 21:26 (#1490: the number tokenizer's dot rule)

**Question.** Run 11 left one finding open: the tokenizer takes any digits after a dot as a thousands group.
Step 4 takes only exact 3-digit groups. Which dots in the text are really thousands separators? What should
the others read as? And does the fix move a golden?

**Command.** A scratch probe (not committed) lists every `\d+(\.\d+)+` token, with any glued suffix. It reads
the pt and pt-BR goldens, FLEURS pt_br (train/dev/test, column 3, the raw transcript), the ledger's pt_br `read_text` (2,793
rows) and `tools/corpus/mined/pt.jsonc`. It classifies each number as thousands-shaped
(`^[1-9]\d{0,2}(?:\.\d{3})+$`) or OTHER, and prints the current pt-BR reading. It ran before and after the
fix. Then `gen_parity_goldens.mts pt pt-BR`, `check:goldens`, the fn-diff re-dumps, and the gates.

**Raw finding.**
- 39 distinct dotted numbers. 34 are thousands-shaped, and every one of them is a real group (`1.000 libras`,
  `5.000.000`, `104.500`, `1.000º` …). The other 5:

  | number | what it is | before | after |
  |---|---|---|---|
  | `802.11` (+`a`/`b`/`g`/`n`) | a standard designation | *oitenta mil duzentos e onze* | *oitocentos e dois ponto onze* |
  | `2.4` (`2.4Ghz`) | a clock-speed spec | *vinte e quatro* | *dois ponto quatro* |
  | `5.0` (`5.0Ghz`) | the same | *cinquenta* | *cinco ponto zero* |
  | `1.1` | a figure number | *onze* | *um ponto um* |
  | `15.00` | a dotted clock time (an hour against UTC) | *mil e quinhentos* | *quinze ponto zero zero* |

  None is a group. The reading after the fix was taken from the same probe. All 34 thousands rows are
  byte-identical before and after.
- The dotted numbers in the goldens are all thousands-shaped. The 5 OTHER numbers appear only in FLEURS, the
  ledger and the mined text. So no golden moves: `gen_parity_goldens.mts pt pt-BR` wrote no diff, and
  `check:goldens` reports `189 languages, 36495 rows, 0 stale`. Run 11 expected this fix to move golden rows,
  and it does not.
- The rule: a dot is a thousands separator only when the head is 1–3 digits with a non-zero first digit and
  every later group is exactly 3 digits. That is step 4's own shape. The non-zero head restates #1015's
  zero-head guard, so the old `(?<!(?<!\d)0)` lookbehind could go. `0.5` now reads *zero ponto cinco*, where
  it used to read *zero . cinco* with a pause.
- The reading of a non-grouping dot: *ponto*, a new `numbers.dotConnector` in the manifest. The group after
  it is read as a cardinal when it is `[1-9]\d?`, and digit by digit otherwise. A version or a designation
  is said *ponto onze*, not *ponto um um*. A group with a leading zero (`15.00`, `2.05`) or of 3+ digits
  (`1.0000`, `0.500`) has no cardinal reading. I rejected *vírgula*: it is the comma's word, and
  *oitocentos e dois vírgula onze* is wrong for a designation. The siblings ca/gl/es rewrite a dot followed
  by 1–2 digits to the comma decimal. gl records `802.11n` as the known exposure of doing that. All 5 corpus
  instances here are designation- or version-like, which is why *ponto* is the right reading for this text.
- Step 4 now matches `\b(NUMBER_TOKEN)\.?[ºª]` and classifies the match with `splitNumberToken`. Only a whole
  number gets an ordinal. A spoken dot or a decimal comma keeps its number and loses the indicator.
  `1.5º`: *um . quinto* → *um ponto cinco*. `1,5º`: *um , quinto* → *um vírgula cinco*. `1.000º` and
  `2.500º` are unchanged.
- The degree count is plural unless the token is a whole 1. `0.1 °C`: *grau* → *graus*. This reverses Run
  11's agreement with the *um* that was spoken after the pause, because the token is now read whole
  (*zero ponto um graus*).
- Residuals, recorded and not fixed:
  - `15.00 do Tempo Universal` is a clock time. It reads *quinze ponto zero zero*, and an anchor would say
    *quinze horas*. Reading `HH.MM` as a clock needs context (UTC, *horas*). One instance does not license
    that, and `2.40` could be a price.
  - (Closed in Run 13.) FLEURS column 4 (the normalized transcript, which fn-diff reads) writes `802.11a` as `802.11ª` ×3. It now reads *oitocentos e dois ponto onze*: the
    indicator is stripped and the letter is lost. Before, it read *oitocentos e dois . décima primeira*.
  - `2.4Ghz` reads its unit as *ɡs*. That is the symbol tier, and it is untouched.
- Proved by revert:
  - TS: with the three src files reverted, 5 of the 16 tests in `portuguese-port-findings.test.ts` fail.
    That is every new #1490 test except the thousands guard, plus the edited `0.1 °C` row.
  - C#: with Numbers/Portuguese/Normalize.cs reverted, 13 of 40 `PortuguesePortFindingsTests` cases fail.
  - Rust: with numbers/portuguese/normalize.rs reverted and only the tests re-applied, 3 of 8 portuguese
    tests fail.
- Regex corpus re-extracted with `tools/extract_regexes.mts`. Two rows went: step 4's alternation and the
  old NUMBER_TOKEN. Three came in: the new NUMBER_TOKEN, `THOUSANDS_GROUPED` and the `[1-9]\d?` group test.
  That makes 2,384 patterns. C# regex-diff and Rust regex-diff: `145276 identical, 0 DIFFER`.
- pt-BR.txt gained three probe lines (pt.txt is a symlink to it): designations, a dotted ordinal/decimal ordinal, and dotted
  degree counts with the edge shapes.
- Gates on the final tree:
  - fn-diff, re-dumped from the fixed TS: pt-normalize `11937 / 0` (probe 267), pt-numbers `101973 / 0`,
    pt-g2p `75630 / 0`, phonemize-sync and -best `7950 / 4` each. The 4 are the same port-pending ru and el
    probes as before.
  - Rust parity: all ten languages `200/200`.
  - `cargo test --workspace`: 91 + 1.
  - C# parity pt/pt-BR: `400 rows ok, 0 differ`.
  - vitest, full: 347 files, 6,517 passed, 5 skipped. `node_modules/.bin` was linked for the run and
    unlinked after. Without the link, `check-goldens-jobs.test.ts` fails 7 tests on a missing `tsx`.
  - `dotnet test`, full: 7,195 passed.
  - `check:goldens`: 0 stale.

**Implication.** The tokenizer, the degree count and the ordinal indicator now share one predicate. No golden
moved. What remains is the dotted clock time, which needs a context rule and evidence for one.

## Run 13 — 2026-10-09 21:58 (review on Run 12: the indicator as a letter; the ASCII `\b`; rebased onto 0c6a70c2)

**Question.** Review raised two items on Run 12, and a rebase.

1. After a non-whole number, Run 12 stripped the `º`/`ª`, which loses `802.11ª`'s letter. Should the
   indicator read as its base letter instead? Is there evidence that `º` after a decimal is a stray degree
   sign?
2. French found (#1494) that JS `\b` is ASCII-only even under `u`. Do pt's letter-edged rules have the same
   defect?
3. Rebase onto 0c6a70c2 (past d1fdb503) and re-extract the regex corpus.

**Command.**
- A grep for `\d+[.,]\d+\.?\s?[ºª°]` over FLEURS pt_br (all columns), the ledger, the mined pt text and both
  goldens.
- A scratch audit (not committed). For each letter-edged `\b` rule (the two era markers, *número*, the two
  abbreviation rules, the first-of-month rule), it counts the matches over the pt/pt-BR goldens, FLEURS
  columns 3 and 4 and the ledger: 3,923 unique texts. It flags every match whose edge-side neighbour is a
  letter, mark, digit or `_`.
- Rebased onto origin/main (first d1fdb503, then 0c6a70c2; both clean). `extract_regexes.mts` re-run on the
  combined tree, then `gen_parity_goldens.mts pt pt-BR` and the gates.

**Raw finding.**
- Item 1, the indicator after a non-whole number:
  - Instances: `802.11ª` ×3, every one the designation `802.11a`. `º` after a dotted or decimal number has
    0 instances, and `°` after one also has 0. So there is no evidence that it is a stray degree sign, and
    º is not treated differently.
  - The rule: the indicator reads as its letter's name from the manifest's `letterNames`. ª is `a` →
    *a*; º is `o` → *ó*.
  - `802.11ª` now reads byte-identically to `802.11a` (*… ponto ˈõzi a*); the test asserts the equality.
  - `1.5º` → *um ponto cinco ó*. `1,5º` → *um vírgula cinco ó*. `1.5ª` → *um ponto cinco a*.
  - How `802.11n` reads: the engine reads the glued letter as a bare WORD (*n*), not as its letter name
    (*ene*). For `a` the two coincide, because letterNames' `a` is the word *a*, which is why `802.11ª`
    and `802.11a` agree exactly. For `º` they differ: the letter name *ó* [ˈɔ] against the bare word *o*,
    the unstressed article [u]. *ó* is what review asked for.
  - Whole numbers are unchanged: `1.000º`, `7ª`, `1.º`, and `2.500º` (no ordinal word, indicator dropped).
- Item 2, the ASCII `\b`:
  - 36 matches. Two are edge-violating, both in `abbrev-end`, and both are the same shape: `Grécia.` and
    `Escócia.`. `\b` sits between `é`/`ó` and `c`, so `cia.` matched as *companhia*. `Grécia.` read
    *ɡɾˈɛkõpɐɲjɐ*.
  - Every other rule had 0 violations.
  - The fix is #1494's: `(?<![\p{L}\p{M}\d_])` / `(?![\p{L}\p{M}\d_])`. It is written out as a literal in
    the three literal rules (era markers, *número*) and held as `WORD_START`/`WORD_END` for the three
    template rules (the two abbreviation rules, first-of-month).
  - The digit-led rules (ordinal indicator, clock, fraction) keep `\b`: a digit is ASCII `\w`, so `\b`
    before it is already correct on the digit side. No violation was measured.
- Goldens: `pt` 2 stale, one sentence that appears twice. Only the token moved: `Grécia.` *ɡɾˈɛkõpɐɲjɐ* →
  *ɡɾˈɛsjɐ*. I regenerated it; pt-BR's golden does not contain the word. The ª change moved no golden.
- Regex corpus: 3 rows replaced (the era markers and *número* now carry the Unicode lookbehind). 2,385
  patterns. The template rules are composed, so they are not extracted.
- Proved by revert, each engine with only that item's src change undone:
  - Indicator letter: TS 1 of 16 fails; C# 6 of 42; Rust 2 of 8.
  - Word edge: TS 1 of 18 fails; C# 3 of 49; Rust 1 of 9.
- Probes: pt-BR.txt gained two word-edge lines; `802.11ª` was already a probe.
- Gates on the final tree (0c6a70c2 + this branch):
  - `check:goldens`: 0 stale.
  - vitest, full: 6,546 passed, 5 skipped. `.bin` linked for the run, unlinked after.
  - `dotnet test`, full: 7,232 passed.
  - C# parity pt/pt-BR: 400 ok, 0 differ.
  - C# regex-diff and Rust regex-diff: 145,206 identical, 0 differ.
  - `cargo test --workspace`: 94 + 1.
  - Rust parity: all ten languages 200/200.
  - fn-diff, re-dumped: pt-normalize `11943 / 0`, pt-numbers `101973 / 0`, pt-g2p `75625 / 0`,
    phonemize-sync and -best `7954 / 4` each. The 4 are the port-pending ru and el probes.

**Implication.** Both review items are closed. One golden token moved, and it moved toward correct. What
remains is Run 12's dotted clock time.
