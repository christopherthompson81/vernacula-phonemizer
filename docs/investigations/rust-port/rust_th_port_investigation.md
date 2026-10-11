# Rust port: Thai (th)

The Thai engine (`src/languages/thai/`: thai, manifest, thaiTone, syllabifier, segment, g2p, normalize) plus
the one core module it needs that was not yet ported, `core/segment.ts` (the shared DAG segmenter for the
spaceless scripts). Tracking issue #1463.

## Run 0 — 2026-10-10 19:49 (import closure, and what registering th can move)

**Question.** What does `createThai` reach that the Rust crate has not ported, and which already-ported goldens
could change once Thai runs stop being dropped?

**Command.** `grep "^import" src/languages/thai/*.ts`, then a read of `rust/vernacula-phonemizer/src/core/`;
`cut -f1 csharp/goldens/<l>.tsv | grep -cP '\p{Thai}'` for each ported language.

**Raw finding.** Already ported: `loadManifest`, `loadTsv` (`load_tsv_map`, `load_lines`), `clauses`
(`assembleClauses`), `normalizeSymbols` (`makeSymbolNormalizer`, with `unspacedScript`, `ampersand`,
`multiply`), `boundaries` (`NOT_LETTER_BEFORE`), `numbers` (`digitIndex`), `provenance` (`rewrite`).
NOT ported: `core/segment.ts` (`loadSegWords`, `segmentByDag`). `core/scripts.rs` already routes a Thai run to
`th`, so today such a run is recorded port-pending and dropped. Thai-script lines in the ported goldens: en 0,
en-GB 0, ja 0, it 0, es 0, pt 0, pt-BR 0, hi 0, cmn 0, fr 0.

**Implication.** Port `core/segment.rs` (mirrored, full). No ported golden carries a Thai run, so registering
`th` cannot move their parity; re-run all ten anyway to confirm. The C# twin (`csharp/.../Languages/Thai/`)
exists and is read for traps, but the TS is the spec.

## Run 1 — 2026-10-10 19:56 (first golden gate)

**Question.** With `core/segment.rs` and all seven thai modules ported (tables generated from the TS literals by
`.probe/th/gen_tables.mts`), how far is the golden?

**Command.** `cd rust && cargo run --release -p parity -- th`

**Raw finding.** `th: 200/200 identical, 0 differ`, on the first build.

**Implication.** A clean first gate says little on its own: 200 rows cannot reach most of normalize.ts's arms or
the segmenter's corners. Per-module fn-diff next, then a mutation check to show the replays can see a difference.

## Run 2 — 2026-10-10 20:00 (per-module differentials and end to end)

**Question.** Do normalize, the segmenter, the syllabifier's stages and the g2p match the TS call for call, and
does the public entry match over everything we have?

**Command.** `npx tsx rust/tools/fn-diff/dump.mts <name> > .probe/th/<name>.jsonl` for `th-normalize`,
`th-segment`, `th-word`, `th-syllabify`, `th-numbers`, `th-in-hosts` (and `BEST=1` for it), plus
`LANGS=th … phonemize-sync|phonemize-best`; replayed with `.probe/th/replay.sh` (`fn-diff <name> <dump>`).
- Texts: golden (121 distinct), FLEURS th_th columns 3+4 (2,326), `probes/th.txt` (98 synthetic lines).
- `th-segment`/`th-word`/`th-syllabify` items (77,997): every Thai-block run of the texts, raw and normalized;
  every seg-words entry (64,808) and dictionary key; and synthetic strings from a fixed-seed PRNG: 4,000
  concatenations of 2-5 seg-words, half of them with a random U+0E00-0E7F code point spliced in, and 2,000
  random Thai-block strings (unassigned code points included). `th-syllabify` emits fixup, reorder, strip and a
  serialized `thaiPrep` + `thaiScanSyllables` (units, fates, marks, per-syllable onset/nucleus/coda/tone).
- `th-numbers`: `phonemize(n, "th")` for 0..3000, magnitudes to 10^16, 2^53±1, 40- and 400-digit runs, `007`.
- `th-in-hosts`: `probes/th-in-hosts.txt` through en, en-GB, ja, it, es, pt, pt-BR, hi, cmn, fr.

**Raw finding.** `th-normalize: 2545 identical, 0 DIFFER`; `th-segment: 77997/0`; `th-word: 77997/0`;
`th-syllabify: 311988/0`; `th-numbers: 3394/0`; `th-in-hosts: 70/0` sync and `70/0` best.
`phonemize-sync: 2544 identical, 1 DIFFER` and the same for `phonemize-best`; the one row is the probe
`ไทยລາວไทย`: TS `tʰˈa˧j laː˧˥w tʰˈa˧j`, Rust `tʰˈa˧j tʰˈa˧j`. The Lao run is routed to `lo`, which is not
ported: port-pending, not a Thai divergence.

Per-arm coverage (`.probe/th/arms.mts`, texts matched, golden/fleurs/probe): thai digit 0/0/3, ฯลฯ 0/3/1,
ๆ 22/366/9, ๆ with no antecedent 0/0/4, ฯ 0/14/3, de-group 5/54/3, clock range 0/1/2, clock 2/16/5, hour 3/17/7,
decimal 6/49/8, unit abbreviation 2/40/5, era/title 0/49/4, plus 0/2/2, ± 0/0/1, minus 0/2/3, = 0/0/2, < 0/0/1,
> 0/0/1, ÷ 0/0/1, × 0/2/1, °C 0/2/1, ° 0/3/1, initialism 5/74/4, currency 0/0/2, % 1/5/1, & 0/2/1, digits
38/602/36, Latin 18/577/11, other script 0/0/4.

**Implication.** Every arm is reached; ±, the relational signs, Thai digits and currency are probe-only (FLEURS
th_th never writes them). Clean everywhere, so Run 3 checks the harness can see a difference.

## Run 3 — 2026-10-10 20:02 (mutation checks)

**Question.** Do the segmenter and normalize replays detect a real divergence?

**Command.** Three temporary edits, each rebuilt, replayed and reverted:
(a) `core/segment.rs` DAG tie-break `dp[j] + 1 < dp[i]` → `<=` (a later, shorter word wins a tie);
(b) `normalize.rs` `clock` drops minutes equal to 1 instead of 0;
(c) `thai/segment.rs` TCC step clamped to one code point (`count().min(1)`).

**Raw finding.** (a)+(b) together: `th-segment: 77199 identical, 798 DIFFER`, `th-word: 77199/798`,
`th-normalize: 2531 identical, 14 DIFFER`, `parity th: 150/200`. (c): `th-segment: 77159 identical, 838 DIFFER`.
After reverting: `th-segment 77997/0`, `th-normalize 2545/0`, `parity th 200/200`.

**Implication.** The tie-break and the TCC constraint are both load-bearing and visible to the probes, and so is
the clock arm. Next: the other ported languages, then the crate gates.

## Run 4 — 2026-10-10 20:05 (fleet parity, provenance, crate gates)

**Question.** Does registering `th` move any other ported language, is the provenance seam intact, and are the
crate gates clean?

**Command.** `cargo run --release -p parity -- en en-GB ja it es pt pt-BR hi cmn fr th`;
`npx tsx tools/provenance-poison.mts th`; `LANGS=th … dump.mts trace` replayed with `fn-diff trace`;
`cargo test --workspace --release`; `cargo run --release -p regex-diff`; `.probe/th/patterns_in_corpus.mts`
(is every `js_re!` in the port a corpus pattern, same source and flags); `cargo fmt`; `cargo clippy --workspace
--release --all-targets`.

**Raw finding.**
- parity: all eleven `200/200 identical, 0 differ`. As Run 0 predicted, no ported golden carries a Thai run.
  `th-in-hosts` (Run 2) is where the new dispatch shows: Thai runs inside the other ten hosts now read through
  `th`, 70/0 against the TS on both paths.
- provenance: TS `distinct poison sites: 0`; `fn-diff trace: 2544 identical, 1 DIFFER` (the Lao row again: the
  `lo` run has no `ipaSpan` in Rust because its reading was dropped). New test `thai_rewrites_never_poison_the_mapping`.
- `cargo test`: 104 + 1 passed. regex-diff: `144898 probe results identical, 0 DIFFER, 0 patterns refused`.
  Patterns: `28 in corpus, 0 missing`. No TS regex was added, so the corpus is not re-extracted. The two
  runtime-built patterns (`THAI_TCC_RE` from `tcc`, and the `ABBREV_RULES`) are not corpus entries; fn-diff
  covers them (Run 3c shows the TCC one is visible).
- clippy: on the new files only `module_inception` (`thai/mod.rs` → `thai::thai`), the crate-wide convention of
  mirroring the TS tree (12 such warnings, one per language). ⚠ The crate does not clippy clean at baseline:
  `normalize_symbols.rs:753` trips the deny-level `invisible_characters` (a ZWSP/ZWNJ in a raw-string class),
  which fails the lib build under clippy, and there are 109 pre-existing warnings. Not touched here (a shared
  file); with `-A clippy::invisible_characters` the workspace builds and nothing new is in a th or segment file.

**Implication.** Every gate holds. The clippy baseline is reported, not fixed in this PR.

## Run 5 — 2026-10-10 20:08 (TS readings worth reporting, by reading normalize.ts and thai.ts)

Each one derived by running the TS engine (`normalizeThai` and `phonemize(…, "th")`); Rust reproduces all of them.

- **A decimal before a Thai unit abbreviation leaves the abbreviation unread.** Step 8's comment says steps 5-7
  make the guard's digit adjacent, but step 7 rewrites `3.5` to `3 จุด ห้า`, so in `ยาว 3.5 กม.` the left neighbour
  of `กม.` is the word ห้า and the `(?<=\d\s?)` guard declines. The text becomes `ยาว 3 จุด ห้า กม.`, read as
  `… kˈo˧m .`: a nonsense syllable and a spurious clause pause, exactly the failure the header lists as fixed
  (`220 กม.`). Same for `2.5 กก.`. 3 FLEURS th_th utterances have the shape.
- **The clock arms have no left-digit guard.** `(\d{1,2})[.:](\d{2})\s*น\.` matches inside `123.45 น.`
  (→ `123 นาฬิกา 45 นาที`, "one hundred twenty-three o'clock") and the hour arm matches the `24` of `2024 น.`
  (→ `2024 นาฬิกา`). 0 FLEURS instances.
- **`numberToThaiWords` contradicts its comment.** thai.ts says "a FINAL 1 in any compound ≥11 is เอ็ด", but
  the code applies เอ็ด only after a tens digit: `101` reads หนึ่ง ร้อย หนึ่ง and `1001` หนึ่ง พัน หนึ่ง, while `111`
  ends in เอ็ด. Which one is right is a register question (ร้อยเอ็ด is the usual reading); either the code or the
  comment is wrong.
- **The baht sign is dropped silently.** `฿` is in the Thai block, so `TOKEN` takes it as a Thai run, the
  syllabifier finds no consonant, and `ราคา ฿100` reads exactly as `ราคา 100`. The symbol tier declares
  `$ € £ ¥` only. 0 FLEURS instances.
- **`°F` leaves an English letter behind.** Step 9 handles `°C`; `10°F` becomes `10 องศาF`, read with an
  English `ˈɛf`.
- **Step 1 (Thai digits) is unreachable from `phonemize`.** The registry's `foldNativeDigits` (core/unicode.ts,
  `0x0e50`) folds them before `text()`; only a direct `normalizeThai` call reaches it. Harmless; noted per
  csharp/PORTING.md question 3.

**Implication.** Reported in the PR, not fixed (the bidirectional rule: TS first, in its own change).

## Run 6 — 2026-10-11 14:05 (#1512: baseline of the Run 5 findings, and the sourcing)

**Question.** Do the Run 5 readings still reproduce on main, and is there evidence for the words a fix would
emit (เอ็ด after a magnitude, บาท, the Fahrenheit word)?

**Command.** `npx tsx .probe/th/fix1512.mts` (synthetic cases: `ยาว 3.5 กม.`, `2.5 กก.`, `123.45 น.`, `2024 น.`,
the clock controls, 101/1001/111/201/100001/1000001, `ราคา ฿100`, `100฿`, `10°F`, `10 °F`, `๑๒`); a substring
count over FLEURS th_th column 3 (1,906 unique); `npx tsx tools/normalization/attest.ts --lang th --words
"บาท,องศาฟาเรนไฮต์,ฟาเรนไฮต์,หนึ่งร้อยเอ็ด,หนึ่งร้อยหนึ่ง,ร้อยเอ็ด,ร้อยหนึ่ง,หนึ่งพันเอ็ด,หนึ่งพันหนึ่ง"`.

**Raw finding.**
- All six reproduce: `ยาว 3.5 กม.` → `ยาว 3 จุด ห้า กม.` → `… kˈo˧m .`; `123.45 น.` → `123 นาฬิกา 45 นาที` (the
  HH.MM arm matched `23.45`); `2024 น.` → `2024 นาฬิกา`; `101` → `nˈɯ˨˩ŋ rˈɔː˦˥j nˈɯ˨˩ŋ`; `ราคา ฿100` reads
  as `ราคา 100`; `10°F` → `10 องศาF` → `… ˈɛf`. `๑๒` through `phonemize` reads as 12 (the registry fold).
- FLEURS th_th: ร้อยเอ็ด / ร้อยหนึ่ง / พันเอ็ด / พันหนึ่ง / หมื่นเอ็ด / แสนเอ็ด / ล้านเอ็ด all ×0. `฿` ×0, `°F` ×0,
  องศาฟาเรนไฮต์ ×1. บาท ×6, but every one is บทบาท (role) or บาทวิถี (footpath): no currency บาท at all.
- th.wikipedia (substring, unspaced script; the examples are the evidence):
  - `หนึ่งพันเอ็ด` 1 hit, and it is the reading itself: the 1000 article, "…อยู่ก่อนหน้า 1001 (หนึ่งพันเอ็ด)".
    `หนึ่งพันหนึ่ง`, `หนึ่งร้อยหนึ่ง`, `ร้อยหนึ่ง` all 0.
  - `ร้อยเอ็ด` 245, mostly the province, but also "เมืองร้อยเอ็ดประตู" (city of 101 gates), the number in use.
  - `บาท` 254: "ในระบบเงินตรา บาท เป็นสกุลเงินตราของประเทศไทย", after a numeral ("4 บาท", "10 บาท").
  - `องศาฟาเรนไฮต์` 36: "องศาฟาเรนไฮต์เขียนย่อโดยใช้สัญลักษณ์ °F", the article naming the sign's word.
- ⚠ attest.ts rewrote `tools/corpus/attest/th.jsonc` with different indentation and DROPPED its `context`
  field ("4 earlier finding(s) kept", but the header was reformatted). Reverted with `git checkout`; the
  evidence is recorded here and in the code comments instead. Not fixed (a tool bug, not this issue's).

**Implication.** Fix 1-5; decline 6 (the step is reachable from a direct `normalizeThai` call, which fn-diff's
`th-normalize` makes, so it is kept and its comment now says so).

## Run 7 — 2026-10-11 14:20 (#1512: the TS fixes, the golden, the tests)

**Question.** Does each fix change only its own shape, and what does the golden do?

**Command.** Edits: normalize.ts (clock arms gain `(?<![\d.])`; a step 6b runs the `unitOnly` ABBREV rules
before the decimals, step 8 keeps the rest; `°F` → ` องศาฟาเรนไฮต์`), thai.ts (`if (r === 1 && n > 10)` →
เอ็ด, outside the tens block), thai.jsonc (`"฿": ["บาท"]`). Then the probe again; `npm run check:goldens`;
`npx tsx tools/gen_parity_goldens.mts th` with a before/after diff; `test/thai-port-findings.test.ts`, each fix
reverted in turn (`revert_loop.sh`).

**Raw finding.**
- Probe diff: exactly the six shapes move. `ยาว 3.5 กม.` → `ยาว 3 จุด ห้า กิโลเมตร` (no pause); `2.5 กก.` →
  `… กิโลกรัม`; `123.45 น.` → `123 จุด สี่ ห้า น.`; `2024 น.` → `2024 น.` (both read the number, then น plus a
  pause: the text is ill-formed and no reading is right, but neither invents a time); 101/1001/201/100001/
  1000001 end in `ʔˈe˨˩t`; `ราคา ฿100` and `100฿` end in `bˈaː˨˩t`; `10°F` → `… fˈaː˧reː˧nhˌa˧j`. The clock
  controls (`09.30 น.`, `เวลา 9 น.`, `22.00-23.00 น.`), `111`, `21`, `11`, `ยาว 3 กม.`, `10°C` are unchanged.
- ⚠ First cut of the clock guard was `(?<!\d)`. It refuses `23.45` inside `123.45 น.`, but then the hour-only
  arm claims the decimal's `45` (`123.45 นาฬิกา`). Guard is `(?<![\d.])` on every arm.
- check:goldens: `th 200 rows 3 stale`, 1 of 189 languages. Regenerated: 3 rows, one FLEURS sentence
  appearing 3 times, with a decimal before กม.; `… t͡ɕˈu˨˩t pˈɛː˨˩t kˈo˧m . rˈɯː˩˩˦ …` → `… t͡ɕˈu˨˩t pˈɛː˨˩t
  kˈi˨˩loː˧mˌeː˦˥t rˈɯː˩˩˦ …`. All fix 1 (the spurious clause pause is gone too). Run 5 counted 3 utterances.
- Tests: 5 new, each fails with only its fix reverted (5/5) and passes restored.

**Implication.** Mirror into C# and Rust; the Rust `rewrites_read_as_their_expansions` pins `101` as
`หนึ่ง ร้อย หนึ่ง` and must change, with the reason.

## Run 8 — 2026-10-11 15:30 (#1512: C# and Rust mirrors, revert proofs, gates)

**Question.** Do the C# and Rust mirrors match the TS, does each new assertion see its fix, and is every
gate clean?

**Command.** Mirrors in `Languages/Thai/Normalize.cs` + `Thai.cs` and `thai/normalize.rs` + `thai.rs` (same
three clock patterns, same 6b/8 split, same `°F` rule, same เอ็ด condition; `฿` is shared data). New
`ThaiPortFindingsTests.cs` (5 facts); the Rust `rewrites_read_as_their_expansions` updated (`101` now pinned
to `หนึ่ง ร้อย เอ็ด`, with the reason) and extended. Each fix reverted in turn in each engine
(`revert_cs.sh`, `revert_rs.sh`). `npx tsx tools/extract_regexes.mts`. Five synthetic lines added to
`probes/th.txt`. Then the full gates, and fn-diff `th-normalize`, `th-numbers` (replayed as phonemize-sync),
`LANGS=th phonemize-sync`.

**Raw finding.**
- Revert proofs: C# 5/5 facts fail with their own fix reverted (one fact each); Rust: the combined test fails
  on the matching assertion for all 5 (e.g. revert 5: `sˈi˨˩p ʔˈo˧ŋsaː˩˩˦ ˈɛf` vs `… fˈaː˧reː˧nhˌa˧j`).
- regex-corpus.jsonl: 2388 distinct patterns, 4 insertions / 3 deletions (the three clock arms, the °F rule).
- `npm run typecheck` clean. `npm test`: 6808 passed, 2 failed, 5 skipped; both failures were `Test timed out
  in 5000ms` (arabic neural diacritizer, trace-token-source) while sibling cargo builds loaded the machine.
  Re-run alone: 32/32 pass.
- `npm run check:goldens`: fresh, 189 languages, 36495 rows, 0 stale.
- C# full suite: 7484 passed, 0 failed. C# golden parity (`csharp/tools/parity`): 189 languages
  byte-identical, 36495 rows.
- Rust: `cargo fmt --check` clean; `cargo test` 186 + 1 passed; parity 51 languages, all identical except
  the known mag 199/200 (Arabic run); `th: 200/200`. regex-diff: 144956 identical, 0 DIFFER, 0 refused.
- fn-diff: `th-normalize 2550/0`; `th-numbers 3394/0`; `phonemize-sync 2549/1`, the one row being the
  known Lao probe `ไทยລາວไทย` (lo not ported).

**Implication.** Items 1-5 fixed in all three engines; item 6 declined (comment only). Done.
