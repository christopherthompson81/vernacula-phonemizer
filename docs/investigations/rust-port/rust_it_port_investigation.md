# Rust port: Italian (it)

Italian is a rule-based g2p with no lexicon and no neural model (`neuralRegistry.ts` does not list it), so
`phonemize_best` is `phonemize`. The import closure: `italian/{italian,manifest,normalize,romanOrdinals}.ts`,
plus `core/boundaries.ts` (ported here as `core/boundaries.rs`). It also needs core `makeSymbolNormalizer`,
which the es port owns (see Run 3). Everything else it imports (`clauses`, `hostWord`, `initialisms`,
`roman`, `provenance`) was already ported.

## Run 1 — 2026-10-09 15:55 (per-module differentials)

**Question.** Do `normalize.rs`, the g2p and number compositor in `italian.rs`, and the Roman policy in
`roman_ordinals.rs` match their TS twins?

**Command.** `npx tsx rust/tools/fn-diff/dump.mts {it-normalize,it-g2p,it-roman} > .probe/it/<name>.jsonl`,
then `./target/release/fn-diff <name> ../.probe/it/<name>.jsonl`. The inputs are the golden, FLEURS it_it
(columns 3 and 4) and `probes/it.txt`: 4,031 distinct texts.
- `it-normalize`: `normalizeItalian`, `normalizeItalianInitialisms(normalizeItalian(t))` and
  `normalizeItalianDecimals` per text (12,093 rows).
- `it-g2p`: `phonemizeWord` over every letter run in the texts, every 1–3 letter string over the 36-letter
  inventory, and every 4-letter string over `aeiouìcgshlnqz`; then `numberWords` and `ROMAN_POLICY.ordinal`
  over 0..20000 plus 10^e, 10^e−1, 3·10^e+23 and 1234567·10^(e−4) for e = 4..21 (past 2^53, where JS float
  arithmetic shows). 138,257 rows.
- `it-roman`: `normalizeRomans(t, ROMAN_POLICY)` per text (4,031 rows).

**Raw finding.** `it-normalize: 12093 identical, 0 DIFFER`, `it-g2p: 138257 identical, 0 DIFFER`,
`it-roman: 4031 identical, 0 DIFFER`, on the first build.

The haystack is not empty: `normalizeItalian` changed 195 of 4,031 texts, the initialism pass (on top of it)
269, the decimal comma 32, and the Roman pass 67.

**Implication.** The modules are done, apart from the symbol tier. These JS semantics are reproduced on
purpose:
- `VOWEL_LETTERS.includes(x ?? "")` is TRUE for a missing letter. That decides the word-final ⟨gn⟩
  gemination, the word-final ⟨qu⟩ glide and the ⟨s⟩ voicing (see the TS findings below).
- `VOWEL_PH.includes(ph[0] ?? "")` reads the FIRST UTF-16 UNIT of a segment.
- The number compositor and `italianOrdinal` stay in f64. normalize.ts passes `Number(digits)` unbounded,
  and `IRREGULAR[String(n)]` can only hit an integer from 1 to 10.
- `ABBREV_ALT`'s sort is stable, so keys of equal length keep the manifest's order (`IndexMap`).

**Object.prototype audit.** None of the plain-object lookups can reach the prototype. `consonants`/`vowels`/
`accented`/`clausePunctuation`/`compass`/`letterNames`/`CURRENCY` are keyed by a single code point (no
prototype member has a one-character name). `ordinals`/`denominators` are keyed by `String(integer)`.
`dottedAbbrev` is keyed by a match of the alternation built from its own keys (a fold miss returns `m0`).

## Run 2 — 2026-10-09 16:05 (end to end, symbol tier stubbed)

**Question.** With `SYMBOLS` as an identity stub, is every remaining divergence a symbol-tier row?

**Command.** `LANGS=it npx tsx rust/tools/fn-diff/dump.mts phonemize-sync > .probe/it/phonemize-sync.jsonl`,
then `fn-diff phonemize-sync`.

**Raw finding.** `phonemize-sync: 3912 identical, 119 DIFFER`. Every shown row is a `%`, `km`, `km/h` or
`km²` the TS reads as *per cento* / *chilometri* / *chilometri orari* / *chilometri quadrati*, and the
stub leaves it bare.

**Implication.** Blocked on core `makeSymbolNormalizer` (Run 3).

## Run 3 — 2026-10-09 16:05 (symbol tier ownership)

**Question.** Who ports `makeSymbolNormalizer` (core/normalizeSymbols.ts)? It is about 740 of the module's
1,469 lines, and most of the parallel language ports need it.

**Finding.** The coordinator assigned it to the es port, which commits it alone on `rust-lang-es` for every
other port to cherry-pick. Until then `normalize::symbols` is a marked TODO identity stub.

## Run 4 — 2026-10-09 16:15 (per-arm coverage, and TS findings from reading)

**Question.** Which normalize.ts arms does the differential actually exercise, per source? This guards
against a clean differential that proves nothing.

**Command.** `npx tsx .probe/it/coverage.mts`. Each arm's TS pattern, copied, is tested against the RAW
text, so an earlier arm that consumes a later arm's match is not modelled. The Roman row runs the real
`normalizeRomans`.

**Raw finding** (texts matched, golden / FLEURS / probe):
```
1 de-group 3/75/4      2 era a.C. 0/7/1     2 era d.C. 0/2/1     3 numero 0/2/2
4 abbrev cont 0/8/5    4 abbrev end 0/4/2   5 °C 0/2/2           5 °F 0/2/1        5 compass 0/2/1
6 ordinal ind 0/22/9   7 clock : 2/28/1     7 clock . 0/2/2      8 ± 0/0/1
8 +digit glued 0/2/1   8 +digit initial 0/0/1  8 minus 0/0/1     8b = < > ÷ 0/0/1 each
9 fraction 0/2/2       9b word+word 1/1/1   10 preposed currency 0/0/4   decimal comma 2/27/3
roman pass changed 0/56/11 (54/9 in an ordinal context)
```

**Implication.** Every arm is reached at least once. Only the probes reach ±, the initial `+`, the minus,
the four relational/division signs and the preposed currency. The golden alone reaches only 5 arms and no
Roman numeral, so for this language the golden is the weakest of the three gates.

**TS findings (reported, not fixed in Rust; checked with `npx tsx .probe/it/check.mts`):**
1. **Word-final ⟨s⟩ after a vowel is voiced.** `gas` → ɡˈaz, `autobus` → awtˈobuz, `virus` → vˈiruz,
   `lapis` → lˈapiz. The cause is `isVowelLetter(nx ?? "")`: `"…".includes("")` is true, so "no next
   letter" counts as a vowel and the intervocalic-voicing rule fires word-finally. The same idiom makes a
   word-final ⟨gn⟩ geminate (`magn` → mˈaɲɲ) and a word-final ⟨qu⟩ take its glide (`qu` → kw), but those
   two are corners. The ⟨s⟩ case occurs in ordinary loanwords.
2. **Every composed ordinal is stressed on the wrong syllable.** `italianOrdinal` builds `-esimo`, and the
   g2p's default penultimate stress then reads `ventunesimo` as ventunezˈimo (`il XXI secolo` → ˈil
   ventunezˈimo sekˈolo, `XXIII` → ventitreezˈimo, `MMM` → tremillezˈimo). Italian stresses -ˈɛsimo. The
   normalizer emits these words itself, so their stress is fully predictable: an accented `-ésimo`/`-èsimo`
   spelling, or a stress hint, would fix every one. This reaches 54 FLEURS texts through the Roman pass, plus
   the `º`/`°` ordinal arm.
3. The documented hiatus losses (`bugia` → bˈud͡ʒa, `via` → vjˈa) are as their comments describe, so they
   are not new findings.

## Run 5 — 2026-10-09 16:45 (symbol tier in; every gate)

**Question.** With the es port's `make_symbol_normalizer` cherry-picked (9aceb875) and the stub dropped, is
Italian byte-identical everywhere?

**Command.** I cherry-picked 9aceb875 and built `SYMBOLS` from `symbolTier` and `signWords` as italian.ts
does. The tier is now a field of the engine, so a bad manifest fails `create_italian` and does not panic
later. I regenerated every dump, then ran `fn-diff it-normalize|it-g2p|it-roman|phonemize-sync|phonemize-best`,
`parity it` and `parity --sync it`, `cargo test --workspace --release` and `cargo build --workspace`.

**Raw finding.**
- `it-normalize: 12093 identical, 0 DIFFER` (golden 324 / fleurs 11556 / probe 213)
- `it-g2p: 138257 identical, 0 DIFFER`
- `it-roman: 4031 identical, 0 DIFFER` (golden 108 / fleurs 3852 / probe 71)
- `phonemize-sync: 4031 identical, 0 DIFFER`, `phonemize-best: 4031 identical, 0 DIFFER`
  (up from 3912 with the stub, so the 119 symbol-tier rows of Run 2 are now exercised and pass)
- `parity it`: `200/200 identical, 0 differ`. `--sync`: also 200/200.
- tests green (44 + 2 new Italian ones), 0 warnings.

**Port-pending.** None. The golden and both FLEURS columns contain ZERO lines with a non-Latin,
non-Common letter (`grep -cP '[^\p{Latin}\p{Common}\p{Inherited}]'` → 0 and 0), and the probes are Latin
too. So no foreign run is routed to an unported engine, and the script-reader path is not exercised for
`it` at all. Embedded English-looking words (`South Pole Traverse`, `McMurdo`) are claimed by Italian's own
Latin TOKEN class and never reach the foreign reader.

**Implication.** Italian is done by the checklist.

## Run 6 — 2026-10-09 17:40 (review round: rebase onto c64801a5, no panics on data)

**Question.** After rebasing onto main (#1467 ja + the symbol tier, #1468 cross-cutting fixes) and
addressing the review, is every gate still byte-identical? And is Run 5's claim, that a bad manifest
fails `create_italian` and never panics later, now true? It was NOT true when Run 5 wrote it. Only the
symbol tier had moved into the engine. `MANIFEST` was still a panicking `LazyLock`, and
ABBREV_CONT/ABBREV_END, CURRENCY_WORD and the unreadable vowel class were `LazyLock`s that `.unwrap()`ed
inside `text()`. `m.compass[...]` and the compositor's `units[n]` could also panic on a short table.

**Changes.**
- **Rebase.** I dropped my cherry-pick of the symbol commit, which main supersedes. The shared lists were
  resolved by keeping both sides, and each arm was checked whole: git had factored the shared
  `.map(...)/.map_err(...)` tail out of the `build` hunk and the closing `},` out of the dump.mts hunk.
  `LANGUAGES` is now `["en", "en-GB", "ja", "it"]`.
- **Manifest loading.** `try_manifest` goes through `core::data_source::load_once`, so it caches only on
  success. It validates `numbers.{units,teens,tens}` (≥ 10 each) and `compass.{n,s,e,w}`. The panicking
  `MANIFEST` static is gone.
- **Normalizer data.** Everything normalize.ts builds at module load is now one `NormalizeData`: the
  abbreviation map and patterns, CURRENCY_WORD, the unreadable test and the initialism normalizer. It is
  built through `load_once`, with every runtime-built pattern compiled with `?`. `create_italian` builds it,
  together with the g2p `Tables` and the symbol tier, so a bad manifest is a `PhonemizeError::Data` at build
  time.
- **Fallible public functions.** `phonemize_word`, `number_words`, `italian_ordinal`, `normalize_italian`,
  `normalize_italian_initialisms`, `normalize_italian_decimals` and `is_unreadable_italian` return
  `Result`. The engine calls `pub(crate)` versions that take the tables it already holds.
- **Core helpers.** I now use `sorted_by_length_desc` + `alternation` (ABBREV_ALT), `js_number_to_string`
  (`String(n)` for the ordinal, denominator and numerator keys) and `is_safe_integer`. `esc` and
  `provenance::escape` do not apply: the TS joins `dottedAbbrev` keys and `currencyStems` UNESCAPED, and
  the port keeps that.
- **CURRENCY / magnitude alternation.** normalize.ts HARD-CODES both: `export const CURRENCY` beside the
  manifest's `symbolTier.currency`, and the literal `(?:miliardi|miliardo|milioni|milione|mila)` in step 10.
  The port stays faithful, with a comment pointing at the TS. The duplication itself is a TS cleanup
  candidate. It is not a divergence: today the two tables agree.
- **Roman policy.** The ordinal closure reads the manifest through `try_manifest().ok()`. The registry now
  caches policies, and the Roman pass runs only after `create_italian` has succeeded.

**Commands.** I regenerated all five dumps on the new main and replayed them. Then I ran
`parity it en en-GB ja`, `parity --sync it`, `cargo test --workspace --release` and
`cargo build --workspace --all-targets`. For the manifest check I used two broken data roots under
`.probe/it/` (core symlinked): `currencyStems` with an unbalanced `(`, and `compass` without `n`. Each ran
through `examples/missing_data.rs`, which I pointed at `it` temporarily and then reverted.

**Raw finding.**
- `it-normalize 12093/12093` (golden 324 / fleurs 11556 / probe 213), `it-g2p 138257/138257`,
  `it-roman 4031/4031`, `phonemize-sync 4031/4031`, `phonemize-best 4031/4031`, all 0 DIFFER.
- `it 200/200`, `en 200/200`, `en-GB 200/200`, `ja 200/200`, `--sync it 200/200`.
- 50 tests passed, 0 warnings.
- Broken roots: `Err(Data("italian.jsonc: pattern ^\s*(?:di\s+)?(?:(dollar|…: … Unbalanced parenthesis"))`,
  `Err(Data("italian.jsonc: compass.n missing"))`, and a missing root gives `Err(Data("data key
  \"languages/italian/italian.jsonc\" not readable: …"))`. No panic in any of them.

**Implication.** Run 5's claim now holds. The `unwrap`s left in the Italian sources fall into two kinds.
Some are compile-time-constant patterns (era markers, numero, the Roman context regexes). The others read
capture groups that always take part in a match, or index digit tables already validated to length 10.

## Run 7 — 2026-10-09 18:30 (Run 4's TS findings 1 and 2, fixed TS-first)

**Question.** Fix the word-final `?? ""` idiom and the -esimo stress in the TypeScript, then carry both to C#
and Rust. Which layer should own the ordinal stress, and what does each fix move over FLEURS?

**Choice of layer for the stress.** The investigation suggested an accented `-ésimo` in the normalizer's
generated words. I put the rule in the g2p's `stressIndex` instead: a word matching `/.esim[oaie]$/u` with
no written accent and ≥ 3 nuclei is stressed on its antepenult nucleus. The reasons:
- `test/italian-manifest-lifted.test.ts` holds the invariant that a generated ordinal reads like the typed
  word (`say("XI secolo")` contains `say("undicesimo")`). A normalizer-only accent breaks it, because the
  typed word would still read penultimate.
- The typed family has the same defect. FLEURS writes `cristianesimo` ×7, `medesimo` ×3, `undicesimo`,
  `sedicesimo`, `quindicesimo` ×3 each and so on: 34 tokens, every one proparoxytone.
- The stem must be non-empty, so the verb form *esimi* is left alone. The rule keeps the default close
  ⟨e⟩. Wikipron ita gives -esimo as e in 130 rows and ɛ in 128 (one of each per word), and the eval folds
  ɛ→e, so the quality is not something this run measures. Wikipron carries no stress marks at all (0 rows
  with ˈ), and the eval strips stress. **The referee is blind to both fixes.** Its folded backbone is
  87675/89608 (97.8%) before the change.

**Final-⟨s⟩ evidence.** Of the wikipron ita headwords ending in vowel + ⟨s⟩, 107 end in s and 1 in z
(`awk` over `it.wikipron-ita-broad.tsv`). `gas`, `autobus`, `virus`, `lapis` and `coronavirus` are all s.

**Commands.**
- I phonemized every distinct FLEURS it_it text (columns 3 and 4, 3,956 texts) before and after
  (scratch `fleurs.mts`) and classified the word diffs (scratch `diff.py`).
- To prove each new test, I reverted each fix separately and ran `npx vitest run test/italian-port-findings.test.ts`.
- Then `npm run check:goldens`, `npx tsx tools/gen_parity_goldens.mts it`, `npx vitest run`, `npm run typecheck`,
  `npx tsx tools/extract_regexes.mts` (+1 pattern, `.esim[oaie]$`), and the regex-diff on both sides.
- `cd csharp && dotnet test`.
- I regenerated all five Rust dumps from the fixed TS (`it-normalize`, `it-g2p`, `it-roman`, and
  `LANGS=it phonemize-sync`/`phonemize-best`) and replayed them. Then `cargo run --release -p parity`,
  `cargo test --workspace` and `cargo fmt --check`.

**Raw finding.**
- FLEURS: **294 of 3,956 texts moved**, with 0 changes outside the two classes.
  - 218 texts are final ⟨s⟩: awtˈobuz→awtˈobus ×22, vˈiruz→vˈirus ×14, ɡalapˈaɡoz ×12, ɡˈaz ×12, jˈamez ×10,
    tˈeksaz, kˈarlez, lˈaz/lˈoz, stˈatuz, koronavˈiruz and so on.
  - 78 texts are -esimo stress: sedit͡ʃezˈimo→sedit͡ʃˈezimo ×12, kwindit͡ʃ- ×12, dit͡ʃottezˈimo ×8,
    kristjanezˈimo→kristjanˈezimo ×6, medezˈimo→medˈezimo and so on. By source: 44 come through the Roman
    pass, 26 are typed -esim words, and 8 come from the º/°/ª indicator or a fraction.
  - 4 word changes are a final ⟨gn⟩: `design` dˈeziɲɲ→dˈeziɲ. No final ⟨qu⟩ occurs in FLEURS.
- Repros: `gas` ɡˈaz→ɡˈas, `autobus` awtˈobuz→awtˈobus, `virus` vˈiruz→vˈirus, `magn` mˈaɲɲ→mˈaɲ, `qu`
  kw→kˈu. `il XXI secolo` ˈil ventunezˈimo→ˈil ventunˈezimo, `XXIII` ventitreezˈimo→ventitreˈezimo, `MMM`
  tremillezˈimo→tremillˈezimo, `21°` →ventunˈezimo, `21ª` →ventunˈezima, `3/20` ventezˈimi→ventˈezimi.
  `casa` kˈaza and `magno` mˈaɲɲo are unchanged.
- Each new test fails with its fix reverted: 2 failed / 2 passed for each revert.
- `check:goldens`: `it 200 rows 8 stale`, 1 of 189 languages, so no other language moved. The 8 rows are 4
  texts, each in 2 rows: t͡ʃentezˈimo→t͡ʃentˈezimo (×2), stˈatuz→stˈatus, erˈektuz→erˈektus (×2),
  ɡalapˈaɡoz→ɡalapˈaɡos, versˈajllez→versˈajlles (×2). Every one is an intended change. I regenerated `it` only.
- Pinned old readings I updated in TS: `test/italian.test.ts` ×8 and `test/roman.test.ts` ×2. One of them,
  `not.toContain("trentat͡ʃinkwezˈimo")` for `35°W`, would have passed VACUOUSLY under the new stress, so it is
  now the stress-agnostic `not.toMatch(/zˈ?imo/u)`. No C# test pinned either reading. The Rust
  `js_empty_includes_is_reproduced` test pinned `gas` ɡˈaz, `magn` mˈaɲɲ and `qu` kw. It is now
  `a_missing_next_letter_is_not_a_vowel`, plus an -esimo test.
- TS 6,381 passed / 5 skipped. C# 7,037 passed. Rust fn-diff: it-normalize 12093, it-g2p 138257, it-roman
  4031, phonemize-sync 4031, phonemize-best 4031, all identical with 0 DIFFER. Rust parity: all 10 languages
  200/200. Regex-diff: 0 DIFFER on both sides.

**Implication.** Both findings are closed in all three engines. Run 1's "reproduced on purpose" bullet for
`VOWEL_LETTERS.includes(x ?? "")` no longer holds: the helpers now take the raw neighbour and return false
when it is missing (`isVowelLetter` / `IsVowelLetter` / `is_vowel_opt`, and `isVowelSeg` for the `ph[0]`
site, whose behaviour does not change because a segment is never empty).

**Left open (not in scope, reported):**
- The irregular ordinals `settimo` and `decimo` (italian.jsonc `ordinals`) are also proparoxytone, and they
  still read penultimate: `10ª` → det͡ʃˈima.
- The same `x ?? ""` + `includes` idiom appears outside Italian: `swahili.ts:81`, `yoruba.ts:98`,
  `slovenian.ts:108`, `swedish/g2p.ts:48`, `wu.ts:81` and `latvian/g2p.ts:60`, plus `ph[0] ?? ""` sites in
  tagalog/cebuano/hiligaynon/totontepecmixe/dutch and `germanicMorphology.ts:53`. C#'s Italian comment named
  German and Swahili as earlier instances. None of them is checked here.

## Run 8 — 2026-10-09 19:30 (review round: settimo/decimo, the open ɛ, one guard convention)

**Question.** The review of Run 7 asked for five changes. The irregular head's proparoxytones (`settimo`,
`decimo`) should take the same antepenult rule. The stressed ⟨e⟩ should be open. The 35°W guard should be
anchored so that it cannot pass vacuously. There should be one guard convention for `isVowelLetter`. C#
`IsVowelSeg` should stop allocating. What do these move?

**⚠ Decision: the stressed ⟨e⟩ is OPEN (ɛ), and this is a choice, not a measurement.** Wikipron ita is
split on -esimo, with e in 130 rows and ɛ in 128, and the eval folds ɛ→e and strips stress. So no
instrument here can witness the quality. The repo rule for real speaker variation is to take the standard,
news-anchor reading, which is the open ɛ: ventunˈɛzimo, sˈɛttimo, dˈɛt͡ʃimo. The call covers the whole
family, the -esimo nouns included (kristjanˈɛzimo, medˈɛzimo). I have not checked whether dictionaries give
some of those nouns a close é. If one does, that is a per-word exception for later, and this rule would not
measure it either.

**Changes (TS, then C# and Rust).**
- `ESIMO` became `OPEN_ANTEPENULT = /.esim[oaie]$|^(?:settim|decim)[oaie]$/u`. `stressIndex` now returns
  `{at, open}`, and `phonemizeWord` writes ɛ for an open ⟨e⟩. The settim-/decim- arm is anchored on the
  whole word, so `settimana` and `decimetro` are untouched.
- The `x !== undefined &&` / `is not null &&` / `.is_some_and(is_vowel_letter)` pre-guards are gone. In
  all three engines the one helper takes the optional neighbour (TS `string | undefined`, C# `string?`,
  Rust `Option<u32>`; Rust's two helpers are merged into `is_vowel_letter`).
- C# `IsVowelSeg` is now `sg.Ph.Length > 0 && VOWEL_PH.IndexOf(sg.Ph[0]) >= 0`, the first UTF-16 unit, as
  in the TS.
- The 35°W guard is `not.toMatch(/trentat͡ʃˈ?inkw\S*imo/u)`. Checked: it matches the ordinal
  trentat͡ʃinkwˈɛzimo, and both old readings (-ezˈimo, -ˈesimo). It does not match the cardinal
  trentat͡ʃˈinkwe.
- `test/italian.test.ts:183` now expects `10ª` → dˈɛt͡ʃima, with the reason given in the test.

**Commands.** Scratch `fleurs.mts` + `diff2.py` over FLEURS it_it, against both the original baseline and
Run 7. For the reverts, I dropped the settim/decim arm, then separately dropped the ɛ output, and ran the
findings test after each. Then `extract_regexes.mts` (the pattern row is replaced), `check:goldens`,
`gen_parity_goldens.mts it`, `npx vitest run`, `typecheck`, `dotnet test`, the five Rust dumps regenerated
and replayed, `parity`, `cargo test --workspace`, `cargo fmt --check`, and regex-diff on both sides.

**Raw finding.**
- FLEURS against the original baseline: **305 of 3,956 texts moved**, with 0 OTHER.
  - final-s 218 texts, -esimo 78, settimo/decimo 13, final ⟨gn⟩ 4 word changes.
- Against Run 7: 91 texts moved, the 78 -esimo texts (ezˈimo→ˈɛzimo now) plus 13 settimo/decimo.
  - settimo/decimo examples: det͡ʃˈima→dˈɛt͡ʃima ×4, settˈimo→sˈɛttimo ×4, det͡ʃˈimo→dˈɛt͡ʃimo ×3,
    settˈima→sˈɛttima ×2.
  - By source of the 13: 10 are typed words, and 3 are generated (`X secolo`, and `10ª Armata` in both
    columns).
- Before the Rust rebuild, the old binary against the regenerated dumps gave `it-g2p 19 DIFFER`
  (e.g. ts millˈɛzimo / rust millˈezimo) and `phonemize-sync`/`best` 103 DIFFER each. So the dumps carry the
  change.
- Each revert fails the findings test 2 of 4.
- `check:goldens` before the regen: `it 2 stale`, no other language. Against main, the `it` golden still
  moves the same 8 rows as in Run 7, with t͡ʃentezˈimo now →t͡ʃentˈɛzimo. Regenerated `it` only; then
  `goldens fresh: 189 languages, 0 stale`.
- TS 6,381 passed / 5 skipped, and typecheck is clean. C# 7,037 passed. Rust 67 passed, 0 warnings, fmt clean.
  fn-diff it-normalize 12093, it-g2p 138257, it-roman 4031, phonemize-sync/best 4031: all 0 DIFFER.
  Parity: 10 languages 200/200. Regex-diff: 0 DIFFER on both sides.

**Open (not in scope):**
- Compound ordinals of the `ventesimoprimo` type. They are not generated, and a typed one still falls to
  the penultimate rule.
- The `includes(x ?? "")` idiom in other languages. The coordinator is filing it separately (Run 7 lists
  the sites).
