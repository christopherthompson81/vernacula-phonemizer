# Sinitic hosts: the shared Han-compatibility fold (#1481) and cdo's Latin leak (#1478)

Both issues were found by the Mandarin follow-up to the Rust port (#1463, PR #1487), which added the core
`foldHanCompatibility` and an iteration-mark rewrite for cmn alone. This log measures adopting them across the
Sinitic hosts, and closing cdo's Latin leak.

Instruments (all in the session scratchpad, not committed):

- `measure.mts <out> [langs]` — phonemizes, with `phonemizeAsync` and `clearForeignOov()` per language exactly as
  `tools/gen_parity_goldens.mts` does, every row of: the language's golden (`csharp/goldens/<code>.tsv`, column 1),
  its FLEURS transcripts (all three splits, raw column — only cmn and yue have FLEURS), and its mined artifact
  (`tools/corpus/mined/<code>.jsonc`, `sample` + `hard`). Writes `lang · source · text · ipa`.
- `diff.py before after` — rows whose IPA changed, per language × source.
- `reach.mts` — per engine table, how many Han compatibility code points are absent from it but fold to a
  character it has.
- `cdo_latin.mts` / `cdo_route.mts` — census of the Latin runs cdo's tokenizer claims.

## Run 1 — 2026-10-09 21:10

**Question.** Which engines are Sinitic hosts that look Han up in a table, where does cmn call the fold, and is
the iteration rewrite core or cmn-only?

**Command.** `grep` over `src/languages/*/` for `\p{Script=Han}`, chars/dict loaders, `foldHanCompatibility`,
`々`; read `src/core/hanDictIpa.ts`, `src/core/scripts.ts`, `src/core/clauses.ts`.

**Finding.**

- Sinitic hosts: cmn (mandarin), yue (cantonese), wuu (wu), nan (minnan), gan, hsn (xiang), hak (hakka),
  cjy (jin) — the last four on the shared `core/hanDictIpa.ts` engine — and cdo (mindong), which has NO Han
  table: it is a Bàng-uâ-cê (Latin) converter and its Han reaches the script router's Mandarin reader through the
  gap pass.
- Non-Sinitic engines that also read Han: ja (`japanese/kanji.ts`, its own per-kanji 々/〻 handling) and ko (Han →
  `ko` by router override, but its g2p drops non-Hangul). Out of scope; noted as open items.
- cmn calls `foldHanCompatibility` as step 5 of `normalizeMandarin` (the end of the engine-specific normalize,
  before the shared symbol tier and the tokenizer), then a LOCAL `ITERATION` rewrite as step 6. The iteration
  rewrite was cmn-only — and wu had its own copy (`normalizeWu` step 13), covering 々 but not 〻.
- ⚠ The gap pass's `FOREIGN_RUN` is `[\p{L}\p{M}]…`, and a Kangxi radical (U+2F00 block) is `\p{So}`. So in cdo a
  radical was never offered to the router at all — dropped. In every other host it is `Script=Han`, tokenized
  into the Han run, and then skipped as a dict miss.

**Implication.** Move the iteration rewrite into core (`repeatHanIterationMarks`, beside the fold) so there is
one copy; cmn and wu call it; every other host calls the pair at the end of its normalize — the point cmn uses.
cdo needs the fold too, for a different reason (to make the radical a letter the gap pass can route).

## Run 2 — 2026-10-09 21:15

**Question.** How many code points does each engine's table newly reach via the fold, and can the fold orphan a
dict key?

**Command.** `npx tsx reach.mts`; a Python pass over each table listing keys inside the compatibility blocks, with
the unified form's own reading.

**Finding.**

    compat code points folding to one Han char: 1221
    cmn  single-char keys 41923  compat absent 1219  newly reached 1141
    yue  single-char keys 27022  compat absent 1208  newly reached 1085
    wuu  single-char keys 11714  compat absent 1219  newly reached  902
    gan  single-char keys  2083  compat absent 1221  newly reached  398
    hsn  single-char keys  2658  compat absent 1221  newly reached  482
    hak  single-char keys  3470  compat absent 1221  newly reached  545
    nan  single-char keys  6974  compat absent 1221  newly reached  814
    cjy  single-char keys  2616  compat absent 1221  newly reached  461

(cmn's 1,141 reproduces the issue's number.) Tables that KEY a compatibility ideograph: yue 13, wuu 2, cmn 2,
all others 0. Of those 17, 15 have a unified twin in the same table with the same reading. Two do not:

- wuu U+F995 (gni6): its unified twin is NOT a key. Folding the input would turn a reading into a silence.
- yue U+2F9BC: reads sip3, its unified twin reads dip6. Folded, the compatibility form now reads dip6.

**Implication.** wu's loader gets `fold: foldHanCompatibility` (loadTsv's existing alias rule: an unfolded key
already in the file wins), which aliases the one orphan. yue's is a SHADOWED key — it resolves, to the other
row's value — and is accepted: the compatibility form is the same character by Unicode's own definition, and
0 corpus rows contain it (Run 4). A test asserts every compatibility-form key in every table still reads.

## Run 3 — 2026-10-09 21:20

**Question (#1478).** cdo's own script is Latin, so its tokenizer claims every Latin run. What separates a BUC
word from a foreign one in its corpus?

**Command.** `npx tsx cdo_latin.mts before.tsv 60` — over the cdo golden + mined rows, split each claimed run at
`-`/`·`, and per syllable ask: does it PARSE as BUC (syllabic nasal, or [initial] + a rime either register of
`mindong.jsonc` has, by `baseToIpa`'s own split), and does it carry a BUC tone diacritic?

**Finding.**

    syllables 23,895 · parse 22,480 · parse but untoned 613
    all-parse + toned     14,496 runs  3,070 types   (the BUC prose)
    all-parse, untoned       343 runs    116 types   (`gah`, `nguok`, `siu`, `Ge̤ng`, `n`, `ng`, `A`, `I`, `SO`)
    none parse             1,358 runs    563 types   (`County`, `Harry`, `Potter`, `and`, `of`, `ISBN`, `CD`,
                                                      `Unix`, `nbsp`, lone `C` `s` `h` `p` `y`, `bĭh`, `bih`)
    mixed + a toned part      30 runs     19 types   (`Kavalan-cŭk`, `Kazakh-ngṳ̄`, `siŏh-bĭh`, `Gā̤-bá̤ek`)
    mixed, nothing toned       5 runs      3 types   (`Il-sung`, `BY-SA`, `m·s`)

So the phonotactic test alone is nearly enough, as it was for nan (#1048), with two refinements the census
forced:

- `bĭh` (×26) and `bá̤ek` are toned BUC whose rime the table lacks. Parse alone would send them to English — a
  confident misreading where there had been a raw leak. So a TONED part is BUC too.
- Among the toned non-parsing types: `Québec`, `êxitos`, `être`, `légèrté`, `bytí` — a French/Portuguese/Czech
  accent is a BUC tone mark to a diacritic test. Only the alphabet tells them apart: BUC never writes
  ⟨f j q r v w x y z⟩ (no initial or rime in the manifest contains one). A toned part carrying one is foreign.
- A mixed run follows nan's rule: only a TONED part is native inside it (`Kavalan-cŭk` splits; `Il-sung`, whose
  `sung` merely parses, is foreign whole).

**Implication.** `latinParts` in `mindong.ts`, the registry passes `readAsEnglish`. Negative results kept:

- untoned `bih` ×12 (the same syllable as `bĭh`, written without its mark) and untoned `mih` cannot be told from
  English `in`/`and` by any test here: ⟨b i h⟩ are all BUC letters and the rime is absent. They now go to
  English. Both readings were wrong (it was a raw `bih˥˥` leak), and the real fix is the missing rime — out of
  scope, an open item.
- lone `h` (×10) is the day abbreviation `h.` in `n. ng. h.` dates — now an English letter name where it was a raw
  `h˥˥`. Equally wrong; the abbreviation belongs to the normalization layer. Open item.
- IPA quoted in running text (`/syŋ˨˩/`) now reaches English rather than leaking raw. Garbage either way.

## Run 4 — 2026-10-09 21:24

**Question.** How many rows move per language over goldens + FLEURS + mined, with the fold, the iteration
rewrite and cdo's foreign routing in place?

**Command.** `measure.mts before.tsv` on the base tree (65637ee3), `measure.mts after.tsv` on the fix,
`diff.py before.tsv after.tsv`. (cdo re-measured as `after2.tsv` after the ⟨f j q r v w x y z⟩ refinement.)

**Finding.**

    lang  golden    FLEURS     mined     what moved
    cmn   0/102     0/1999     0/144     —  (behaviour unchanged; the rewrite moved to core)
    yue   0/145     0/1726     0/79      —
    wuu   0/200     —          0/436     —  (its 9 iteration rows were already handled by its own 々 copy)
    gan   0/200     —          0/368     —  (2 iteration rows, both 佐々木 — 佐 is not in gan's dict)
    hsn   0/67      —          0/72      —
    hak   0/200     —          0/411     —
    nan   0/200     —          6/447     6 iteration rows (Japanese names / titles), each gains its syllable
    cjy   0/29      —          0/36      —
    cdo   92/200    —          175/393   all Latin routing (#1478); 0 from the fold

Rows containing a Han compatibility code point, across all nine corpora: **0**. The fold's value is the 400–1,140
code points per table it reaches (Run 2), not any row these corpora carry.

**Implication.** Regenerate only `cdo`. nan's movers are mined rows, not golden rows, so its golden does not
move — to be confirmed by `check:goldens`, not by this probe (the foreign-OOV memo is process-wide).

## Run 5 — 2026-10-09 21:30

**Question.** Do the new tests fail when each fix is reverted (a guard that passes after a fix has proved
nothing)?

**Command.** On a WIP commit, `git show origin/main:<file> > <file>` for one file at a time, then
`npx vitest run test/sinitic-fold-and-latin.test.ts`, then restore from HEAD. Same for C# with
`dotnet test --filter SiniticFoldAndLatin` (the filter is for the revert probe only; the gate runs the full suite).

**Finding.**

    revert cantonese/normalize.ts + mindong/normalize.ts + wu/wu.ts   6 fail: yue radical, yue compat ideograph,
                                                                     yue iteration, cdo radical, cdo iteration,
                                                                     wuu orphaned key
    revert registry.ts (cdo built with no foreign reader)            4 fail: every cdo Latin-routing test
    drop the ⟨f j q r v w x y z⟩ test from bucToned                  1 fail: the Québec test
    C#: revert Cantonese/Normalize.cs + Wu/Wu.cs, unwire cdo         5 fail (the same shapes)

One expected PASS under revert: cdo's compatibility-ideograph test, because `text()`'s NFD fold already maps
the U+F900 block (canonical singletons). Only the Kangxi radicals need the new fold there — Run 1's finding.

**Implication.** Every guard bites. Proceed to goldens and gates.

## Run 6 — 2026-10-09 21:35

**Question.** Which goldens actually move under the golden generator (not an ad-hoc probe)?

**Command.** `npx tsx tools/gen_parity_goldens.mts cdo`, then `npm run check:goldens`.

**Finding.** `cdo.tsv`: 92 rows changed (matches Run 4's 92/200). `check:goldens`: `189 languages, 36495 rows,
0 stale` — so no other golden moves, nan included (its 6 movers were mined rows only).

**Implication.** Only cdo regenerated.

## Run 7 — 2026-10-09 21:40

**Question.** Does the C# mirror and the Rust core/cmn change stay byte-identical?

**Command.** `dotnet run -c Release --project csharp/tools/parity -- cmn yue wuu gan hsn hak nan cjy cdo`;
`npx tsx tools/extract_regexes.mts` then `dotnet run -c Release --project csharp/tools/regex-diff` and
`cargo run --release -p regex-diff -- ../csharp/regex-corpus.jsonl`; `cargo test --workspace`;
`cargo run --release -p parity` (all ten ported languages).

**Finding.**

    C# parity     9 languages byte-identical, 0 differ (1496 rows)
    regex corpus  3 added / 2 removed: the iteration pattern now lives in core/unicode.ts (one copy where
                  cmn and wu had two), plus cdo's two new patterns; 145,292 probe results identical in
                  BOTH C# and Rust, 0 differ, 0 refused
    cargo test    89 + 1 passed (a direct test of the new core function added)
    Rust parity   en en-GB ja it es pt pt-BR hi cmn fr: 200/200 identical each

⚠ The goldens carry 0 rows with a compatibility form and 0 golden rows with an iteration mark outside cmn
(Run 4), so parity being green says nothing about the fold in the seven non-cmn hosts. The C# twin of the TS
test (`SiniticFoldAndLatinTests`) is what covers it, and Run 5 shows it fails on revert.

## Run 8 — 2026-10-09 21:55

**Question.** Does the cross-port TRACE gate agree? (Not on the issue's list, but every change here adds traced
rewrites.)

**Command.** `npm run check:trace-parity`.

**Finding.** `1 rows differ between ports`: wuu row 1 — the TS trace carried NO input spans for any of its 46
tokens; the C# kept them all. Bisected by restoring `src/` from origin/main (spans present) and then one file at
a time: not wu's normalize, but wu's LOADER. The dict loads lazily inside the first `text()` that needs it, which
under `phonemizeTrace` has a trace open — and the loader's `fold` was the TRACED `foldHanCompatibility`, so every
key fold was recorded as a rewrite of the utterance and the provenance fell out of step. Only the first row of a
cold process shows it, which is why nothing but the trace gate saw it.

Fix: `foldHanCompatibilityKey` — the same fold through plain `String.replace`, untraced — for the loader (TS and
C#). A cold-process test in its own file (`test/sinitic-fold-cold-trace.test.ts`) fails with the traced fold and
passes with the key fold. Re-run: `traces identical across ports`.

⚠ A second hazard found on the way, worth keeping: the first draft of the key fold carried its own copy of the
`HAN_COMPAT` class, and the editing round-trip NFC-normalized the literal U+F900 at the start of the
compatibility range to its unified twin U+8C48. The class silently became `豈(U+8C48)–U+FAFF` — most of the
unified block. `regex-diff` caught it (2 DIFFER on astral probes, the .NET translator splitting surrogates in the
widened range), not any phonemizer test, because the fold leaves a unified character unchanged. The key fold now
REUSES `HAN_COMPAT` (one literal, one corpus pattern); a test asserts the two folds agree on every code point
U+2E80–U+2FA1F.

**Implication.** Never retype a CJK compatibility character as a literal — reference the existing constant or
write it as an escape.

## Gates on the final tree — 2026-10-09 22:00

    npm run check:goldens          189 languages, 36495 rows, 0 stale
    npx vitest run                 349 files, 6563 passed, 5 skipped
    dotnet test (full)             7219 passed, 0 failed
    C# parity (9 Sinitic)          byte-identical, 1496 rows
    regex-diff C# / Rust           145,292 identical, 0 differ, 0 refused (corpus re-extracted)
    cargo test --workspace         89 + 1 passed
    Rust parity (10 ported)        200/200 each
    check:trace-parity             identical across ports

Re-run after rebasing onto origin/main 2f3818d3 (five sibling fixes landed meanwhile; rebase clean, regex corpus
re-extracted with no change): check:goldens 0 stale · vitest 352 files, 6652 passed · dotnet test 7304 passed ·
C# parity 9 Sinitic byte-identical · regex-diff C#/Rust 145,212 identical, 0 differ · trace parity identical ·
cargo test 93 + 1 passed · Rust parity 10 × 200/200.

## Open items

- **Placement.** The fold runs at the END of each normalize, where cmn runs it, as asked. A rule matching a Han
  character (a `年`/`月`/`日` lookahead) cannot see a Kangxi-radical spelling of that character, because the fold
  comes after it. 0 corpus rows contain a compatibility form, so this is unmeasurable here; moving the fold to the
  start (in cmn too) is the change if a corpus ever shows it.
- **cdo's missing rime.** Untoned `bih` (×12) and `mih` are BUC with a rime `mindong.jsonc` lacks; they now go to
  English instead of leaking raw. The fix is the rime, not the router.
- **cdo's date abbreviations.** Lone `h` (×10, the day in `n. ng. h.` dates) reads as an English letter name where
  it leaked raw — a normalization-layer gap.
- **cdo async prewarm.** `phonemizeAsync` prewarms the English neural OOV only for text that mixes Latin with a
  non-Latin script. A cdo row with no Han therefore reads its foreign words with English's sync OOV path. Same as
  nan; the goldens record whatever the generator produced.
- **ja / ko.** Japanese's kanji class excludes the Kangxi radicals, so ⼈ is dropped there too; Korean drops Han
  outright. Neither is Sinitic; not touched.
- **yue's shadowed key.** U+2F9BC (sip3) now reads as its unified twin (dip6). 0 corpus rows; accepted.
