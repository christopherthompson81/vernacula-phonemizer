# Rust port: Indonesian (`id`) and Standard Malay (`ms`/`zsm`)

Branch `worktree-agent-a5a40cba5874eaeda`, from main f04b471e. Part of #1463. One log for both codes: Malay is the
Indonesian engine behind a Malay normalization pre-pass (`createMalay` wraps `createIndonesian`), so the two share
every module but one. The method is the earlier ports' (rust_tr_port_investigation.md): per-module `fn-diff`
differentials, then the public entry end to end, then the golden gate.

## Run 1 — 2026-10-10 21:32 (the import closure of the Austronesian group)

**Question.** What do `src/languages/{indonesian,malay,tagalog,cebuano,hiligaynon,ilocano}/` need that the Rust
core lacks; which of them share a TS module; does any have a neural entry or a Roman policy; where are the FLEURS
transcripts?

**Command.** `grep -h import` over the six directories; `grep -nE` for each code in `src/registry.ts` and
`src/neuralRegistry.ts`; `ls rust/vernacula-phonemizer/src/core/`; `ls <external-drive>/…/fleurs_transcripts/data`.

**Raw finding.**
- Core imports across the group: `provenance` rewrite, `clauses` assembleClauses, `loadManifest`, `loadTsv`
  (loadTsvMap, loadLines), `normalizeSymbols` makeSymbolNormalizer, `initialisms` makeUnreadableTest, `boundaries`,
  `hostWord` (hostWordRun, LATIN_RUN, makeNativiser), `numbers` digitIndex. Every one is already in
  `rust/vernacula-phonemizer/src/core/`. No new core module.
- The ONLY cross-language import is `malay/malay.ts` → `indonesian/indonesian.ts` (createIndonesian,
  ForeignPhonemizer). The four Philippine languages import nothing from each other.
- Registry: `id` → `createIndonesian(readAsEnglish)`, `ms` and `zsm` → `createMalay(readAsEnglish)`, `tl`, `ceb`,
  `hil`, `ilo` → their own `create…()` with no foreign reader. None is in `ROMAN_POLICIES` and none has a
  neuralRegistry entry.
- Goldens: `id ms tl ceb hil ilo` (no `zsm` golden; it is the same engine as `ms`). FLEURS: `id_id`, `ms_my`,
  `fil_ph` (Filipino, for tl), `ceb_ph`; nothing for hil or ilo.

**Implication.** Port `id` (indonesian.ts, normalize.ts) first, then `ms` on top of it, reusing the Indonesian
engine rather than forking it. hil and ilo have no FLEURS text, so their synthetic probes carry more weight.

## Run 2 — 2026-10-10 21:38 (the golden gate, first look)

**Command.** `cd rust && cargo run --release -p parity -- id ms` (and `--sync id ms`), after porting
`languages/indonesian/{indonesian,normalize}.rs` and `languages/malay/{malay,normalize}.rs`, one `build` arm for `id`
(`create_indonesian(Some(read_as_english))`) and one for `"ms" | "zsm"` (`create_malay`, which wraps
`create_indonesian` — the Indonesian engine is reused, not forked). Indonesian has no manifest.ts, so the
`IndonesianDef` struct lives in indonesian.rs, as the TS declares it there. The object literals (DOTTED_ABBREV,
UNIT_WORD, COMPASS, RATE_WORD, FREQ_WORD, CURRENCY_WORD, CUBED, ACRONYM_LEXICON) were copied key for key in source
order.

**Raw finding.** `id: 200/200 identical, 0 differ`, `ms: 200/200 identical, 0 differ`, both modes, first build.

One manifest mismatch surfaced while writing the struct: the TS `IndonesianDef` types `exponentWords.cubed` as
REQUIRED, but indonesian.jsonc declares `squared` only. A required Rust field would refuse the file the TS loads,
so `cubed` is `Option` with a note (the TS type is wrong, not the data: Malay's normalize.ts says "the tier Malay
inherits is Indonesian's, whose `exponentWords` has `squared` only").

**Implication.** The goldens have 119 (id) and 114 (ms) distinct texts. The per-module differentials must carry the
clock/decimal/range arms and the acronym gate.

## Run 3 — 2026-10-10 21:44 (per-module differentials, and are they sensitive?)

**Commands.** `FLEURS_ROOT=<external-drive>/omnivoice_ipa/corpus/fleurs_transcripts/data npx tsx
rust/tools/fn-diff/dump.mts <name> > .probe/id/<name>.jsonl`, replayed by `cd rust && cargo run --release -p fn-diff
-- <name> ../.probe/id/<name>.jsonl`. Inputs: each golden, FLEURS id_id / ms_my columns 3 and 4 (first row checked: a
sentence, not a WAV name) and new synthetic `probes/id.txt` (one or more lines per normalize.ts arm with the
neighbour it must decline, the tokenizer's number shapes, the acronym classes, diacritic names, lone surrogates) and
`probes/ms.txt` (the same per arm of malay/normalize.ts, including the clock fixed-point pass, the magnitude/currency
reordering, the M2/M3 neighbours and the all-zero thousands exclusion).
- `id-normalize`: `normalizeIndonesian` per text, then the symbol tier on its output, the TS tier rebuilt from
  indonesian.ts's own `makeSymbolNormalizer({…})` literal evaluated from source with the manifest in scope.
- `ms-normalize`: `normalizeMalay` per ms text, then `normalizeIndonesian` on its output.
- `id-g2p`: `phonemizeWord` and `phonemizeWordRules` over every ⟨e⟩-lexicon key (and uppercased), every letter run of
  the id and ms texts (as written, lower, UPPER, Capitalised), every 1–3 letter string over a–z and the same
  UPPERCASED (the acronym gate and the unreadable test), every 4-letter string over a 12-letter context set (both
  cases), and edge strings (empty, lone surrogates, ſ, İ, ﬁ, `constructor`, `__proto__`, …).
- `id-numbers`: `numberWords` is module-private, so `phonemize(<digits>, "id")` over 0…12,000, scaled samples to 10¹²,
  powers of ten to 10²², 2⁵³±1 and the separator shapes.

**Raw finding.**
```
id-normalize: 7824 identical, 0 DIFFER   (golden 238, fleurs 7510, probe 76)
ms-normalize: 7692 identical, 0 DIFFER   (golden 228, fleurs 7408, probe 56)
id-g2p:       222758 identical, 0 DIFFER
id-numbers:   12764 identical, 0 DIFFER
```
**Is the replay sensitive?** Two deliberate breaks, built and replayed, then reverted (and re-replayed green):
- the schwa-penult stress shift disabled (`segs[penult].ph == "ə"` never true): `id-g2p: 203111 identical, 19647
  DIFFER`.
- the Malay clock pass limited to ONE iteration instead of four: `ms-normalize: 7689 identical, 3 DIFFER` (1 probe,
  2 FLEURS): the coordinated second clock (`pukul 06.30 dan 07.30`) is in the haystack, so the fixed point is
  witnessed.

**Implication.** The modules match. Next: end to end, and the trace.

## Run 4 — 2026-10-10 21:47 (end to end, the trace, and the symbol tier)

**Commands.** `LANGS=id,ms npx tsx rust/tools/fn-diff/dump.mts phonemize-sync | phonemize-best | trace` and
`SYMBOLS_LANGS=id,ms … symbols`, each replayed by fn-diff.

**Raw finding.**
```
phonemize-sync: 7758 identical, 0 DIFFER
phonemize-best: 7758 identical, 0 DIFFER
trace:          7758 identical, 0 DIFFER
symbols:        10764 identical, 0 DIFFER  (probe 3072, indonesian 7692)
```
The symbols dump records ONE Indonesian tier for both codes (Malay has no tier of its own: it is a pre-pass over
Indonesian's engine, which is why its percent/unit/exponent rules pre-empt the tier rather than configure it). The
foreign-script probe line (Cyrillic, Greek, Han, Katakana) and every diacritic name match: en, ru, el, cmn, ja are
ported, so nothing is port-pending for id or ms.

**Implication.** id and ms meet the parity definition on this machine. Remaining: reading for correctness, pins.

## Run 5 — 2026-10-10 21:50 (reading for correctness: TS findings)

**Command.** `npx tsx .probe/id/findings.mts`: the TS engine's own `phonemize` on synthetic inputs chosen while
reading each file against its docstring; corpus counts by `grep` over FLEURS id_id. Rust reproduces every one; none
is fixed here.

**Raw finding.**
1. **id: a decimal after dot-grouped thousands loses its decimal word** (indonesian.ts TOKEN). The grouped
   alternative `[1-9]\d{0,2}(?:\.\d{3})+` has no `(?:,\d+)?` tail, so Indonesian's OWN convention for 1000.5 splits:
   `1.000,5` → *sərˈibu , lˈima* (the comma becomes a clause PAUSE and `koma` is never said), and `Rp 1.000,50` →
   *sərˈibu , lˈima pˈuluh rupˈiah*. The ungrouped `1000,5` reads *sərˈibu kˈoma lˈima* correctly. FLEURS id_id has
   one `d.ddd,` shape (a list comma), so the corpus does not witness it; prices with sen would.
2. **id: every `H:MM` / `H.MM` in range is a clock, with no context** (normalize.ts step 1): `skor 21:20` →
   *… dˈua pˈuluh sˈatu lewˈat dˈua pˈuluh* ("twenty-one PAST twenty"), and a dot-decimal `2.50 meter` → *dˈua lewˈat
   lˈima pˈuluh mɛtˈər*, `pasal 3.15` likewise. FLEURS id_id has 0 such colon pairs outside the race times the guards
   already handle, and Indonesian writes decimals with a comma, so this is low priority; Malay's own pre-pass
   documents the same misreading of `21:20` by "the inherited rule".
3. **ms: `US$30` keeps the code and the engine reads it as a WORD** (malay/normalize.ts step 3): the rule leaves
   `US $30` on the stated principle that "`US` is written, so it stays written", but Indonesian's acronym gate finds
   `US` readable (VC) and not in `SPELLED_ANYWAY`, so it reads *ˈus tˈiɡa pˈuluh dˈolar*, not the letters U-S. (`AS`
   is in the list; `US` is not.) Indonesian itself folds `US$` to the bare sign, so only Malay says *ˈus*.
4. **ms: an Indonesian-convention number with two grouping dots is read as a decimal** (malay/normalize.ts step 15):
   the exclusion covers only a single all-zero group, so `12.345.678 orang` → `12 perpuluhan 3 4 5.678 orang` →
   *dˈua bəlˈas pərpulˈuhan tˈiɡa əmpˈat lˈima rˈibu ənˈam rˈatus …*. ms_my writes comma grouping, so this needs a
   translated Indonesian-style sentence to trigger; reported for completeness.
5. Not a defect, a lexicon gap of the documented class: `UNICEF` is readable and unlisted, so native ⟨c⟩ gives
   *unˈit͡ʃəf*; the ACRONYM_LEXICON note's reasoning (borrowings keep /k/) applies to it as it does to UNESCO.
6. No `Object.prototype` read is reachable: `digraphs`/`diphthongs` get a ≤2-code-point string, `consonants`/`vowels`/
   `letterNames` one code point, `clausePunctuation` one of its own keys, `DOTTED_ABBREV`/`COMPASS` handle the miss,
   and `UNIT_WORD`/`RATE_WORD`/`FREQ_WORD`/`CUBED`/`CURRENCY_WORD` are indexed only by a capture their own pattern
   restricts to their keys.

**Implication.** Reported in the PR, not fixed (TS first, in a separate change).

## Run 6 — 2026-10-10 21:56 (the TS suites as Rust tests, and every gate)

**Changes.** `.probe/pins.mjs` extracts a test file's literal pins mechanically: it finds every `expect(…)`, evaluates
each string literal, resolves `const g = phonemize(…)` bindings, the `cases` arrays and their `for` loop, and a
metacharacter-free `toMatch(/…/)` as a substring test; it PRINTS what it could not reduce. test/indonesian.test.ts
gives 13 `phonemizeWord`, 1 `phonemizeWordRules`, 35 `phonemize`, 9 contains, 3 not-contains and 4 relational pins
(the one unreduced loop, `RUMAH YANG BESAR DENGAN` read as their lowercase, is written as the same relation over the
test's own word list); test/malay.test.ts gives 49 `normalizeMalay`, 24 `phonemize`, 7 contains, 2 not-contains;
test/malay-alias.test.ts's relations and two literals are a second test. To prove the pins bite: the Malay p.m.
boundary narrowed from 1–6 to 1–2 → `the_ts_suite_pins_hold ... FAILED`; restored → ok.

`zsm` is built (same arm as `ms`) but NOT in `LANGUAGES`: the parity tool iterates `LANGUAGES` and reads one golden
per code, and there is no zsm golden (the first full parity run panicked `zsm: No such file or directory`). The
`LANGUAGES` doc comment says so.

**Raw finding.**
```
parity (all):   en en-GB ja it es pt pt-BR hi cmn fr el ko th ru de pl tr nl uk sv id ms: 200/200 identical each
cargo test --workspace --release: 132 passed + 1 doc-test crate, 0 failed
regex-diff:     144898 probe results identical, 0 DIFFER, 0 patterns refused
cargo fmt --check: clean
cargo clippy --workspace: only module_inception on indonesian/mod.rs and malay/mod.rs in the new files
```
No TS regex was added or changed, so the regex corpus needs no re-extraction. Nothing is port-pending.

**Implication.** Done on this machine. One commit for both codes: test/indonesian.test.ts itself pins `ms` (`NATO`,
`Cañitas`), so an id-only commit could not carry its own suite.
