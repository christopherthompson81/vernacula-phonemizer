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
