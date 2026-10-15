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

## Run 4 — 2026-10-15 02:40 (after rebasing onto main 5b2bf359; as: an escape written back as a literal NBSP)

**Question.** After the rebase onto the second Turkic group (#1580), does the Assamese layer (its pre-pass, the
Bengali maker on `assamese.jsonc`, the geminate collapse) match the TS, and did its literals survive the write?

**What changed.** Rebase conflicts only in `registry.rs` (`LANGUAGES` and the `build` arms) and `dump.mts` (the
FLEURS map and the end of the dumps table), both sides kept; git had factored the shared `},` out of the dump.mts
hunk again, restored, then `npx esbuild rust/tools/fn-diff/dump.mts` parses. The `bengali-family` replay learned the
`as` engine and an `as-normalize` op (the pre-pass alone). `probes/as.txt`: one line per pre-pass arm and its
neighbour, with the precomposed and decomposed nukta spellings written as `\u{…}` escapes.

**Command.** `LANGS=as dump.mts bengali-family` → `fn-diff bengali-family`; `e2e.sh as`; `parity as bn`; the two
code-point audits over `languages/assamese`.

**Raw finding.** The audit found the second class of editor damage: both dotted-run patterns came back with a
LITERAL U+00A0 where the TS writes the escape `[  ]`. Same semantics (the differential was already green), not
the same code points; restored by a byte-level edit, after which `74 non-ASCII runs, 0 not found` and the four
remaining raw-pattern misses are `format!` templates checked by hand. Then: `bengali-family: 92488 identical, 0
DIFFER` (golden 351, fleurs 11529, probe 84, synthetic 3849); `phonemize-sync / phonemize-best / trace: 3988 / 3988 /
3988 identical, 0 DIFFER`; `as: 200/200`, `bn: 200/200`. The 39 calls test/assamese.test.ts makes (one more is an
object return, skipped) are pinned by extraction and pass.

**Implication.** as is done. The escape-to-literal failure is invisible to every differential, so the audit stays
mandatory after each write.

## Run 5 — 2026-10-15 02:44 (bpy)

**Question.** Does Bishnupriya, the Bengali maker on `bishnupriya.jsonc` with nothing of its own, match end to end?

**Command.** `LANGS=bpy dump.mts bengali-family` → `fn-diff bengali-family`; `e2e.sh bpy`; `parity bpy`; the audit.
Inputs: the bpy golden, `probes/bn.txt` (the shared normalizer's arms) and `probes/bpy.txt` (words whose bn reading
harmonizes or comes from the bn lexicon, which bpy skips). FLEURS has no bpy, so the golden, both probe files and the
synthetic grids carry it.

**Raw finding.** `bengali-family: 41324 identical, 0 DIFFER` (golden 400, probe 38, synthetic 2566 text rows; the rest
word level); `phonemize-sync / phonemize-best / trace: 219 identical, 0 DIFFER` each; `bpy: 200/200`. The 12 calls of
test/bishnupriya.test.ts pinned by extraction pass. Audit: no non-ASCII literal in the module.

**Implication.** bpy is done; the maker now serves three languages from one port.

## Run 6 — 2026-10-15 02:53 (syl: two more escape folds, and five port-pending golden rows)

**Question.** Does Sylheti (its own engine and normalizer) match, and what are the golden rows that do not?

**Command.** The code-point audits over `languages/sylheti`; `dump.mts syl` (normalize / text over the golden,
`probes/syl.txt` and synthetic grids: ranges over a value grid with each dash in both digit scripts, grouping shapes,
degree forms, decimals, percent, taka, each stray Bengali mark in and out of a Syloti run; phonemizeWord over every
Syloti run, every consonant × vowel-sign/hasanta tail in four frames, conjuncts and corners; numbers through text)
→ `fn-diff syl`; `e2e.sh syl`; `parity syl`. The BN_TO_SYL / INDEPENDENT tables were GENERATED from the TS source by
a script (`gen_syl_tables.mts`) and the ZERO_WIDTH class's seven literal Cf characters copied by code point, both
inserted by a byte-level edit rather than typed.

**Raw finding.**
- The audit caught two more escape folds in the hand-written parts: `BN_LETTER` (`ঀ-৥ৰৱ` in the
  TS) came back as four literal characters, and `YA_NUKTA`'s `য়` as literal য and ়. Restored. The run
  audit had missed the first (the literal characters also occur elsewhere in the TS), so a third audit now checks the
  reverse direction: every `\u` escape in the TS code must be an escape in the Rust (`escape_audit.py`: sylheti 9 TS
  escapes, assamese 2, bengali and bishnupriya 0; 0 short).
- `syl: 8515 identical, 0 DIFFER` (golden 400, probe 26, synthetic 414, number 3061), before and after the fix.
- `parity syl: 195/200`, and `phonemize-sync / phonemize-best / trace: 208 identical, 5 DIFFER` each: the same five
  golden rows. Each carries an Arabic-script gloss (four rows: Arabic or Persian words in parentheses) or a Hebrew one
  (one row, beside an Arabic one), which the TS script router reads with the `ar` / `he` engines. Rust drops the run
  and records the target as port-pending; the Rust readings are the TS readings with exactly those words missing.
- The 48 calls test/sylheti.test.ts makes are pinned by extraction and pass; a pinning test asserts `ar` and `he`
  are port-pending until each is in `LANGUAGES`.

**Implication.** syl is done apart from 5 golden rows port-pending on `ar` (5) and `he` (1), listed in the PR.
