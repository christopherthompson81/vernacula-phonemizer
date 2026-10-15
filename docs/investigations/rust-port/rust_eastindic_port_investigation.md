# Rust port: the East Indic group (bn, as, bpy, syl, or)

Bengali (`src/languages/bengali/`, with its neural OOV tagger), the two engines that reuse its maker
(Assamese `as`, Bishnupriya `bpy`), and two standalone abugida engines: Sylheti (`syl`, Syloti Nagri) and Odia
(`or`). One log for the group: as and bpy are thin layers on the Bengali maker, and syl and or are small.

## Run 0 — 2026-10-15 02:11 (import closure)

**Question.** What do the five engines reach that the Rust crate does not already have?

**Command.** `grep -h "^import" src/languages/{bengali,assamese,bishnupriya,sylheti,odia}/*.ts | sort -u`, then a
read of each named Rust core module (`rust/vernacula-phonemizer/src/core/`).

**Raw finding.** Every core import is already ported: `abugida`, `schwa` (`deleteMedialSchwa` with the ɔ schwa),
`postposedSign`, `markers` (`PUA_SENTINEL_2`), `normalizeSymbols`, `numbers` (`indicNumberWords`, `renderNumber`,
`spellDigits`), `clauses`, `provenance` (`rewrite`, `renormalize`), `unicode` (`BENGALI_WORD`, `BENGALI_DIGITS`,
`IPA_VOWELS`, `foldNativeDigits`), `hostWord` (`LATIN_RUN`), `loadTsv`, `loadManifest`, `phonology`, `trace`
(`noteRewrite`, for Assamese's whole-string geminate pass), `foreign` (`withHost`) and `structuralTagger`
(`createWordStructuralTagger`, `wordLevelNeuralPrepass`, both from the da/nb port). No new core module is needed.

Shape of the TS:
- `bengali/`: `bengali.ts` (the `makeNativeBengali` maker, lexicon, harmony, final/medial inherent deletion,
  phôla gemination), `normalize.ts`, `manifest.ts`, `bengaliTagger.ts` (NFC preprocess, no postprocess) and
  `bengaliNeural.ts` (the word-level pre-pass keyed on the raw `BENGALI_WORD` run).
- `assamese/`: `assamese.ts` (the maker with `assamese.jsonc`, plus a whole-string geminate collapse reported to the
  trace as non-positional) and `normalize.ts` (a pre-pass before the Bengali normalizer).
- `bishnupriya/bishnupriya.ts`: the maker with `bishnupriya.jsonc`, nothing else.
- `sylheti/`: `sylheti.ts` (own engine, own token class), `normalize.ts` (stray-Bengali fold, ranges, degrees,
  decimals, percent, taka).
- `odia/`: `odia.ts`, `manifest.ts`, `normalize.ts` (its own symbol tier, units, initialisms, rate slash, grouping,
  decimals, clock, ordinals, abbreviations, Latin-I danda, degrees, signs).

Goldens exist for all five; FLEURS has `bn_in`, `as_in` and `or_in`, and nothing for bpy or syl (their probes carry
the weight there).

**Implication.** Port order bn → as → bpy → syl → or. The Bengali maker is ported once as `NativeBengali`; as and
bpy build it from their own manifests. `makeNativeBengali` MUTATES its def (registers the [æ] sentinel in
`vowelSigns`/`independentVowels`): the Rust takes a clone and inserts there.

## Run 1 — 2026-10-15 02:16 (bn: the code-point audit catches an NFC fold on the first write)

**Question.** Did the Rust literals survive the write with the TS's code points?

**Command.** `audit_regex.py` (every raw-string pattern in the Rust must occur verbatim in the TS) and a second audit
over every non-ASCII run inside any Rust string literal, both from the scratchpad; then a code-point dump of the one
miss against `bengali.ts:234`.

**Raw finding.** The phôla class came back folded. TS `[ক-হড়-য়]` is `0995 002D 09B9 09DC 002D 09DF` (PRECOMPOSED ড়
and য়, a range U+09DC–U+09DF); the written Rust was `0995 002D 09B9 09A1 09BC 002D 09AF 09BC`, the NFC (decomposed)
form, which is a different class whose `়-য` range is REVERSED and would throw at first use (`js_re!` compiles
lazily, so the build was clean). Restored the code points by a byte-level edit; both audits then report 0 misses
outside the five `format!` templates, which were checked by hand against the TS template strings.

**Implication.** Every literal with a nukta letter, ZWJ/ZWNJ or other Cf/Mn mark is audited after each write for
the rest of the group. (Note on the TS itself: since `wordRules` NFC-normalizes first and these letters are
composition exclusions, the precomposed range can never match there; the class is effectively `[ক-হ]`, and a phôla
after ড়/ঢ়/য় never geminates, because the nukta sits between the base letter and the virama. Reproduced; reported as
a TS observation (a dead range), not fixed.)

## Run 2 — 2026-10-15 02:22 (bn: per-module differentials, first run)

**Question.** Do the normalizer, the engine's text(), the raw g2p, wordRules, word and number() match the TS, call for
call, and does the BiLSTM tagger match ORT in the pure-Rust runtime?

**Command.** `LANGS=bn npx tsx rust/tools/fn-diff/dump.mts bengali-family` (normalize / text / g2p / rules / word /
number over the bn golden, FLEURS bn_in columns 3 and 4, `probes/bn.txt`, and synthetic grids: ordinals 0–40 × 12
suffixes in both digit scripts, a clock grid, fractions, every currency sign in six frames, the relational signs; every
Bengali run, every consonant × matra/virama/sign/conjunct tails, the nukta letters precomposed and decomposed, 3000+
digit strings), replayed with `fn-diff bengali-family`; `dump.mts bn-tagger` (every Bengali run of the texts, every
10th lexicon key, consonant × tail grids, corners) replayed with `fn-diff bn-tagger`.

**Raw finding.** `bengali-family: 80734 identical, 0 DIFFER` (golden 220, fleurs 7772, probe 32, synthetic 2566 text
rows; the rest word level). `bn-tagger: 11917 identical, 0 DIFFER`; 10 of the 11917 TS outputs are empty (declined).
Mutation check: `n_between != 1` → `!= 2` in `harmony` gives `69576 identical, 11158 DIFFER` (golden 101, fleurs
3536); reverted.

**Implication.** Module level clean, and the harness sees a harmony change everywhere. On to end to end.

## Run 3 — 2026-10-15 02:26 (bn: end to end, sync, best, trace; and a TS drift in the best path)

**Command.** `e2e.sh bn` (scratchpad): `LANGS=bn dump.mts phonemize-sync | phonemize-best | trace`, each replayed;
`cargo run --release -p parity`; `bestvs.py` over the sync and best dumps; `npx tsx tools/provenance-poison.mts bn as
bpy syl or`; a TS probe of four made-up English names inside bn, hi and en (`latin-drift.mts`).

**Raw finding.**
- `phonemize-sync 4012/0`, `phonemize-best 4012/0`, `trace 4012/0`. 4003 of the 4012 best rows differ from the sync
  rows, so the best differential exercises the tagger on nearly every line.
- parity: `bn: 200/200`; every other line unchanged (mag 199/200 and tt 199/200 are the known Arabic rows).
- TS provenance poison over all five group languages: `distinct poison sites: 0`.
- `bengaliNeural.ts` builds its engine with `getPhonemizer("en").text` as the foreign reader, NOT the registry's
  `readAsEnglish` (which consults the prewarmed foreign-OOV memo). So on the BEST path an embedded English OOV word gets
  the sync RULE reading, although `phonemizeAsync` has just prewarmed the neural one: `Quexington` reads `kwˈɛksɪŋtən`
  in `en` best and in `hi` best (and in `bn` sync once the process-wide memo is warm), but `kjˈuːʃɪŋtˌʌn` in `bn`
  best; `Zorblatt` likewise (`zˈɔːɹblˌæt` vs `zˌɔːɹblˈæt`).

**Implication.** Reproduced on purpose (a commented `bn_engine()` with `phonemize_in("en", …)`), reported as a TS
defect, and pinned by two synthetic probe lines in `probes/bn.txt`. Not fixed here.
