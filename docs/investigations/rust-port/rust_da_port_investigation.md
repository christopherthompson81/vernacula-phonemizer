# Rust port: Danish (da)

Part of #1463, the "germanic" group (da, nb, af, lb, bar). Method as in rust_sv_port_investigation.md and
rust_fo_port_investigation.md: per-module `fn-diff` differentials, then the public entries end to end (sync, best,
trace), then the golden gate.

Danish is a lexicon-first engine: the ~37k-row NST lexicon (`da-lexicon.tsv`, each key also filed under its
nativised spelling), then — on the best path only — the per-grapheme BiLSTM OOV tagger, then a left-to-right rule
g2p with a first-syllable / unstressed-prefix stress model. A normalizer for the period-thousands / decimal-comma
convention, the shared symbol tier for units and rates, and numbers through the shared units-first compositor
(`danish/unitsFirstNumbers.ts`, already ported for Faroese and reused here, not forked).

## Run 1 — 2026-10-14 23:55 (the import closure, baseline)

**Question.** What does `src/languages/danish/` need that the Rust core lacks, and what is on the neural side?

**Command.** Read danish.ts, normalize.ts, numbers.ts, manifest.ts, danishTagger.ts, danishNeural.ts and their
imports; `grep -n da src/registry.ts src/neuralRegistry.ts`; `ls <FLEURS_ROOT> | grep da`.

**Raw finding.**
- Core imports: `clauses`, `hostWord` (`makeNativiser`; `LATIN_RUN` is imported by danish.ts and never used),
  `loadTsv` (with `fold`), `loadManifest`, `normalizeSymbols`, `provenance`, `foreign` (`withHost`) and
  `structuralTagger` — all ported except **`oneStress`** in structuralTagger.ts (the tagger's postprocess). It is
  added to `core/structural_tagger.rs`, the module that already mirrors that file.
- `unitsFirstNumbers.ts` is already at `languages/danish/units_first_numbers.rs` (Faroese); numbers.rs reuses it.
- `da` has a neural entry (`phonemizeDaNeural`), no `ROMAN_POLICIES` entry. FLEURS has `da_dk`.
- The symbol tier's literal, recorded through the fn-diff hook (`.probe/G/symdata.mts`):
  `{"multiply":{"times":"gange"},"percent":["procent"],"units":{"km":["kilometer"],"m":["meter"]},"unitPer":"i","rateDenominators":{"t":"timen","h":"timen","s":"sekundet"}}`.
- test/danish.test.ts: 86 calls / 85 expects extracted, 0 failures; test/daNeural.test.ts: 17 calls / 13 expects
  (the extraction shim gained async tests and `describe.skipIf` for it).

**Implication.** Port manifest → numbers → normalize → danish → danish_tagger → danish_neural, plus `one_stress`.

## Run 2 — 2026-10-15 00:10 (first build, the golden gate)

**Command.** `cd rust && cargo build --release -p parity && ./target/release/parity da` after one `build` arm and
`da` appended to `LANGUAGES` (no `roman_policy` arm). The engine implements `neural` / `has_neural`, as fr does.

**Raw finding.** `da: 200/200 identical, 0 differ` on the first build. The golden is the BEST path, and it exercises
the tagger: its first row reads `Stanford` *ˈsdanˌfɒːd* (tagger) where the sync path reads *stˈanfoʁd* (rules).
The shipped `da-g2p-tagger.int8.onnx` loads in the pure-Rust runtime with no new op.

**Implication.** The golden has 121 distinct texts; the differentials carry the rest.

## Run 3 — 2026-10-15 00:15 (per-module differentials, then end to end)

**Commands.** New `dump.mts` entries `da-normalize`, `da-g2p`, `da-tagger`, a `FLEURS_DIR` entry `da: "da_dk"`, one
`fn-diff` arm; `.probe/G/e2e.sh <wt> da da da-normalize da-g2p da-tagger phonemize-sync phonemize-best
phonemize-trace trace`. Inputs: the golden (121 texts), FLEURS da_dk columns 3 and 4 (3,637 texts; first row checked
to be a sentence) and the new synthetic `probes/da.txt` (31 lines, one or more per normalize.ts arm with its
neighbour, plus tokenizer and g2p corners).
- `da-normalize`: per text, `normalizeDanish` (symbol tier included) and `createDanish().text`; synthetic families
  for every arm (423 rows: thousands-dot shapes, colon clocks, each abbreviation × 3 casings × 4 tails, every degree
  form, squared units, ordinal ranges / coordinated / single for 0…40 and zero-padded, ranges, each currency sign in
  every position, signs, relational signs, `&`).
- `da-g2p`: `phonemizeWordRules`, `phonemizeWord` and `nat` over every letter run (as written and lowercased), every
  1–3 letter string of 35 letters, every 4-letter string over `aeiodtrcgnkhjvlf`, prefix × suffix grids, corners
  (lone surrogates, `İ`, `ſ`, decomposed vowels, ligature); `phonemizeWord` over every lexicon key (incl. the folded
  aliases); `numberToWords` over 0…20,000, magnitudes, 2⁵³ neighbours and raw strings.
- `da-tagger`: `tagger.tag` over every nativised `DA_WORD` match of the texts, every 25th lexicon key and corners;
  `oneStress` over 15 synthetic mark arrangements.

**Raw finding.** First build:
```
da-normalize: 8424 identical, 0 DIFFER   (golden 242 / fleurs 7274 / probe 62 / synthetic 846)
da-g2p: 417183 identical, 0 DIFFER
da-tagger: 13030 identical, 0 DIFFER
phonemize-sync: 3789 identical, 0 DIFFER
phonemize-best: 3789 identical, 0 DIFFER
trace: 3789 identical, 0 DIFFER
phonemize-trace: 3788 identical, 1 DIFFER
```
The one `phonemize-trace` row is the FIRST text of the run: TS gives its first token `Mandag` the field
`nativised: "joao"`, Rust none. `.probe/G/trace-first.mts` (phonemizeTrace twice in one process):
```
da run 1: first token "Mandag" nativised="joao"     run 2: nativised=undefined
sv run 1: first token "Måndag" nativised="a"        run 2: nativised=undefined
```
The TS lexicon is lazy, so it is built inside the first traced call while that call's first token is open, and the
`fold: nat` alias pass runs `makeNativiser`'s `noteNativised` for every key it rewrites — the last one (`joão`)
lands on the open token. The Rust engine loads its lexicon in `create_danish` (as every Rust port does), outside
any token. **A TS defect, not reproduced** (it is a load-order artifact of one process's first call, and sv shows it
too); reported.

**JS semantics reproduced on purpose.**
- `"eiyæø".includes(next)` with `next === ""` at the word end is TRUE, so a word-final ⟨c⟩ reads [s].
- the rule scan walks CODE POINTS (`[...lw]`) while `lw[2] !== "r"` reads a code UNIT.
- the ordinal-range arm canonicalises its keys (`ORDINALS[String(Number(a))]`), the coordinated and single arms do
  not (`ORDINALS[a]`).

**Guard check (reverting a reproduction).** `includes("")` made false: `da-g2p: 406585 identical, 10598 DIFFER`.
The range arm keyed without `String(Number(…))`: `da-normalize: 8416 identical, 8 DIFFER`. Restored: 0 DIFFER each.

## Run 4 — 2026-10-15 00:25 (reading for correctness: TS findings, reported not fixed)

**Commands.** `WT=<wt> N=languages/danish/normalize.ts FN=normalizeDanish npx tsx .probe/G/t.mts da <texts>`;
`npx tsx .probe/G/best.mts da <texts>` (sync and best side by side); `.probe/G/da-normwords.mts` (which words the
normalizer and the number words can create, against the lexicon).

**Raw finding (TS output, verbatim):**
1. **A number's words never reach the tagger.** The neural pre-pass scans the PRE-normalization text with `DA_WORD`,
   which matches no digit, while `text()` sends every number word through `phonemizeWord(wd, oovOverride)`. 82 of
   the 181 words the normalizer / number words can create are not in the lexicon — every compound tens word
   (`treogtyve` … `nioghalvfems`) and ordinals 16–31 — so on the BEST path they are read by the rule engine:
   `47` → best *sˈyvoɡfyʁə*, while the same word written out, `syvogfyrre`, best → *ˈsywˀɐwfœːɐ*. Likewise
   `Den 21. maj.` best *ˈenoɡtyvenə* against `Den enogtyvende maj.` best *ˈeːˀnɐwˌtyːvənə*. (The same class fr fixed
   for itself in #1463 by scanning the normalized text.)
2. **A zero-padded ordinal is not claimed.** `Den 07. og 08. maj.` → normalized unchanged → *ˈdɛnˀ ˈsywˀ . ˈɐw
   ˈɔːdə . ˈmɑjˀ .* (a cardinal, then a SENTENCE BREAK mid-date), while `Den 7. og 8. maj.` reads *syvende og
   ottende*. Steps 9 and 10 index `ORDINALS[a]` with the raw digits; only step 8 canonicalises.
3. **The lazy lexicon's fold notes leak into the first traced token** (Run 3): `nativised: "joao"` on a native word.
   Affects any language whose lexicon is folded through a nativiser and loaded lazily (sv too).

**Implication.** Reported in the PR; the Rust reproduces 1 and 2 byte for byte and does not reproduce 3.

## Run 5 — 2026-10-15 00:30 (TS suite pins, gates)

**Changes.** danish.rs gains a test module: every call test/danish.test.ts and test/daNeural.test.ts make (103:
32 `phonemize`, 27 `normalizeDanish`, 22 `numberToWords` incl. the raw-string 2⁵³ rows, 5 `phonemizeWordRules`,
9 `phonemizeDaNeural`, …), extracted by `.probe/G/pins.mts`; danish_tagger.rs pins the Cyrillic decline.

**Raw finding.**
- `cargo test danish`: 3 passed. The regex audit (`.probe/G/audit_regex.py`, its literal matcher fixed to skip
  a word ending in `r` before a quote, which it had read as a raw-string opener): 36 raw patterns, 3 not verbatim —
  the TOKEN `format!` template, the currency `format!` template and the symbol-data JSON, checked by hand.
- `parity` (all languages): every language byte-identical but mag at its known 199/200; `da: 200/200`.
- clippy: only `module_inception` on `danish::danish` in the new files.

**Implication.** No port-pending rows.

## Run 6 — 2026-10-15 03:40 (the gates, rebased onto main after the Turkic group landed)

**Commands.** `git rebase origin/main` (conflicts in registry.rs and dump.mts only, rebuilt by
`.probe/G/resolve.py` from upstream plus this language's own block; dump.mts parse-checked with esbuild); then on the
combined tree: `cargo fmt --check`; `cargo run --release -p parity` (all); `cargo test --release`;
`cargo run --release -p regex-diff`; `cargo clippy --workspace --release`; every germanic per-module dump and
`LANGS=da,nb,af,lb,bar` `phonemize-sync` / `phonemize-best` / `phonemize-trace` / `trace`, re-dumped and replayed.

**Raw finding.**
```
fmt: clean
parity: all 67 language lines byte-identical except mag 199/200 and tt 199/200 (both known port-pending Arabic rows)
cargo test: 260 passed, 0 failed (+1 doc test)
regex-diff: 146326 probe results identical, 0 DIFFER, 0 patterns refused
clippy: in the new files only module_inception (registry.rs collapsible_if and structural_tagger.rs type_complexity predate)
phonemize-sync / phonemize-best / trace: 14128 identical, 0 DIFFER; phonemize-trace 14126 / 2 DIFFER — the first da
  and the first nb text (`nativised: "joao"` / `"marta"`), the lazy-lexicon trace note of da Run 3, not reproduced
```

## Run 7 — 2026-10-15 18:33 (#1578: fixing Run 4's findings 1 and 2)

**Question.** Do Run 4's two TS defects close in all three engines, and what moves in the golden?

**Commands.** A best-path probe (`phonemize` and `phonemizeAsync` side by side) over the Run 4 texts;
`npx tsx tools/check-goldens.mts --show 40 da` before the rewrite; `test/germanic-defects-1578.test.ts`, with
each fix reverted in turn.

**Raw finding.**
1. *Number words.* The pre-pass now records the words `text()` asks `oovOverride` for
   (`askedWordsNeuralPrepass`, core/structuralTagger.ts) instead of scanning the raw text. `47` best →
   *ˈsywˀɐwfœːɐ*, the same as `syvogfyrre`; `Den 21. maj.` best → *ˈeːˀnɐwˌtyːvənə*, the same as
   `Den enogtyvende maj.`.
2. *Zero-padded ordinal.* Steps 9 and 10 now key `ORDINALS[String(Number(n))]`, as step 8 already did.
   `Den 07. og 08. maj.` → *ˈdɛnˀ ˈsyːˀvənə ˈɐw ˈɐdənə ˈmɑjˀ .*, the same as `Den 7. og 8. maj.`. `00.` is
   still declined (it has no ordinal).
3. *Golden:* 19 da rows went stale, every one a number word now read by the tagger:
   `femoghalvtreds` *fˈemoɡhalvtʁeds* → *ˈfɛmˀɐwhaltʁes*, `sekstende` *sˈekstenə* → *ˈsɑjsdənə*,
   `nioghalvfems`, `treogfirs`, `otteoghalvfjerds`, `syvogtyve`, `niogtyve`, `niogtres`, `femogfyrre`,
   `fireogtres`. Each new reading has the stød and r-vocalisation of the NST convention, which the rule
   g2p never produces. Rewritten with `--write`.
4. Reverting `danishNeural.ts` fails the best-path test; reverting `normalize.ts` fails both ordinal rows.

**Implication.** Both closed in TS, C# and Rust. Finding 3 (the lazy-lexicon trace note) was fixed separately.
