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

## Run 7 — 2026-10-15 03:01 (or)

**Question.** Does Odia (its own engine, manifest and normalizer with its own symbol tier) match the TS?

**Command.** `dump.mts or` (normalize / text over the or golden, FLEURS or_in columns 3 and 4, `probes/or.txt` and
synthetic grids: ordinals 0–40 × each suffix spaced and glued plus magnitudes and an unsafe run, a clock grid, both
groupings, each unit abbreviation in three frames, the rate slash against a non-rate slash, each currency in five
frames, the guarded signs, the Latin I, initialisms; phonemizeWord over every Odia run, every consonant ×
matra/virama/sign tail in four frames, conjuncts, nukta letters precomposed and decomposed; numbers through text in
both digit scripts) → `fn-diff or`; `e2e.sh or`; `parity or`; the three audits. Mutation check together with syl:
syl's final-coda threshold `>= 2` → `>= 3`, and `ɾr` dropped from Odia's geminate class.

**Raw finding.** `or: 23834 identical, 0 DIFFER` (golden 328, fleurs 5118, probe 32, synthetic 1250, number 3063);
`phonemize-sync / phonemize-best / trace: 2739 identical, 0 DIFFER` each; `or: 200/200`. Audits: 98 non-ASCII runs,
18 raw patterns, 0 TS escapes, nothing missing. The 39 calls of test/odia.test.ts pinned by extraction pass. Mutation:
`syl: 8145 identical, 370 DIFFER`, `or: 23816 identical, 18 DIFFER`; both reverted, back to 0.

**Implication.** or is done. All five ported; next the full gate set on the combined tree.

## Run 8 — 2026-10-15 03:07 (every gate on the combined tree, e6cc559d on main 5b2bf359)

**Command.** `gates.sh` (scratchpad): `cargo fmt --check`, `cargo build --release --workspace`, `cargo run --release -p
parity` (all languages), `cargo run --release -p regex-diff`, `cargo clippy --workspace --release`, `cargo test
--workspace --release`; `e2e.sh bn,as,bpy,syl,or` (phonemize-sync, phonemize-best and trace over all five in one
process, so the process-wide foreign memo is shared as in a real run); a TS print of each group script inside `en`
and `hi` text, pinned as a Rust test (`group_scripts_inside_other_hosts_are_read_by_their_engines`).

**Raw finding.**
- fmt clean; build 0 warnings.
- parity: every language line 200/200 (hil 112/112, ilo 94/94, nog 68/68: their full goldens) except mag 199/200 and
  tt 199/200 (their known Arabic rows) and syl 195/200 (Run 6's five rows, port-pending on ar / he). bn, as, bpy, or
  200/200.
- regex-diff: `146326 probe results identical, 0 DIFFER, 0 patterns refused` (no TS regex was added, so the corpus
  was not regenerated).
- clippy: the only warnings in the five new modules are the five `module_inception`s every language module has; none
  in fn-diff.
- cargo test: 274 + 1 passed, 0 failed (275 + 1 once the cross-host script test was added).
- combined end to end: `phonemize-sync / phonemize-best / trace: 11167 identical, 5 DIFFER` each, the five syl rows.
- The script router targets bn, or and syl for their scripts inside any other host; the readings match the TS and
  none of the three is port-pending any more.

**TS findings, reported and not fixed (Rust reproduces each).**
1. bn best path: `bengaliNeural.ts` reads embedded Latin with `getPhonemizer("en").text`, not `readAsEnglish`, so the
   prewarmed neural English reading is ignored on exactly the path that prewarmed it (Run 3).
2. bn: the phôla class `[ক-হড়-য়]` spells ড়/য় precomposed, a range NFC input can never contain, so a phôla after
   ড়/ঢ়/য় never geminates (Run 1).
3. `BengaliDef` declares `symbolTier` and `ordinals` required, but assamese.jsonc and bishnupriya.jsonc omit both (the
   engine only reads Bengali's), the same contract-versus-data gap Hindi's `irregularOrdinals` had.
4. as: the pre-pass header says every rule must accept both digit scripts because it runs before the Bengali digit
   fold, but step 9's `<`, `>` and `×` rules key on `\d`; unreachable through `phonemize` (the registry folds native
   digits first), live for a direct `normalizeAssamese` call.

**Port-pending.** syl: 5 golden rows, on `ar` (5) and `he` (1); pinned by `arabic_and_hebrew_runs_are_pending_until_ported`.

**Implication.** Ready for the PR.

## Run 9 — 2026-10-15 20:40 (fixing #1584 TS-first, mirrored to C# and Rust)

Question: which of the four #1584 items are real, and what does each fix move?

1. **bn best ignored neural English.** Probe (`phonemizeAsync`, synthetic):
   `en Quexington → kwˈɛksɪŋtən`; `bn "আমি Quexington যাব" → ami kjˈuːʃɪŋtˌʌn d͡ʒabo` (the rule reading).
   Fixed by building the bn neural engine with the registry's `readAsEnglish` (now exported in TS; already public in
   C# and Rust), not `getPhonemizer("en").text`. After: `ami kwˈɛksɪŋtən d͡ʒabo`. This is not the
   `askedWordsNeuralPrepass` shape (#1603): the Bengali words reach the tagger correctly, and only the foreign
   reader was wrong. Golden: 1 bn best row, where `METI` goes from *mˈɛt̬ɪ* to *mˈɛt̬i*, en best's own reading.
2. **The phôla class never matches its nukta letters.** Real at the regex level: after NFC, ড় ঢ় য় stay decomposed
   (U+09DC/09DD/09DF are composition exclusions), so `[ক-হড়-য়]` cannot match them. But making it match is WRONG for
   every attested word of the shape. A search of the bn lexicon, the bn/as mined corpora, the goldens and the
   referees for `[ড ঢ য]়্[য ব ম]` finds only loans with য়্যা: `সফটওয়্যার`, `হার্ডওয়্যার` (wikipron
   `ʃ ɔ pʰ ʈ w æ r`, `h a r ɖ w æ r`) and `রয়্যাল` (corpus). wikipron reads য়্যা as *wæ*, with no gemination.
   With the class fixed, sync `সফটওয়্যার` goes from `ʃɔpʰʈɔojd͡ʒaɾ` to `ʃɔpʰʈɔojːaɾ`, a geminated /j/ that the
   referee contradicts. **Declined.** The real defect is that য়্যা should read *æ* after the glide, and that is a
   separate rule.
3. **`BengaliDef` vs the data.** `symbolTier` and `ordinals` are now optional on `BengaliDef`. `MANIFEST` is typed
   `BengaliManifest` (`BengaliDef` with both required), so the readers stay checked. Rust already had `Option<…>`
   and C# had defaults, so only the TS type was wrong. Type-only; typecheck is the guard.
4. **as `<` `>` `×` ASCII-only.** `normalizeAssamese("৩ < ৫")` came back unchanged. The class is now
   `[0-9০-৯]`, kept as a literal so the corpus still extracts it. After: `৩ তকৈ সৰু ৫`.

Guard proof: each new test (TS 2, C# 6, Rust 2) fails with its fix reverted. Corpus: +3 patterns; both
regex-diffs report 153,086 identical.
