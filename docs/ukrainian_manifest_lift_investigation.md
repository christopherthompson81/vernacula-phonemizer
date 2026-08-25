# Ukrainian manifest lift — investigation log

Ukrainian is the language that prompted the manifest-lifting work ("I think I saw Ukrainian have phonemic,
normalization, or number data that could have been lifted to its manifest") and the one language
`docs/manifest_lifting_survey.md` never reached — it covers 51 of 52 ported languages, and `uk` is the gap.

## Run 1 — 2026-08-24 20:15

**Question.** What hand-authored data does `uk` hold in code rather than in `ukrainian.jsonc`?

**Command.** Read `src/languages/ukrainian/{normalize,ukrainian,romanOrdinals,numbers}.ts` end to end.

**Finding (raw).** The manifest was 82 lines: phoneme maps, number words, clause punctuation, `acronymLetters`.
Everything else was inline — four masculine ordinal tables, the ordinal ending paradigm, three genitive-cardinal
tables, two neuter ordinal tables for the Roman-numeral century reading plus its context-noun alternation,
letter names, phonotactics (onsets + codas), the clock's preposition→case map, the degree noun, the metre forms,
the squared adjective, the dotted and multi-dot abbreviations, nine sign/math words, and the ENTIRE symbol tier
(percent, currency, units, rate denominators, exponent words, magnitudes).

**Implication.** Lift all of it, per the standing preference that the manifest hold these things.

## Run 2 — 2026-08-24 20:22

**Question.** Which of these are genuinely two tables, and which are one fact written twice?

**Finding (raw).** Two genuine duplicates, both byte-identical:

| inline constant | manifest key it duplicated |
|---|---|
| `METRE = ["метр","метри","метрів","метра"]` | `symbols.units.м` |
| `SQUARE = ["квадратний","квадратні","квадратних"]` | `symbols.exponentWords.squared[0..2]` |

Two sources for one fact, with nothing keeping them together — the same shape as the Marathi `£` split.
`normalize.ts` now reads both from the tier's own data.

Three that LOOK like duplicates and are not, recorded so a later sweep does not merge them:
- `ordinals` is MASCULINE, `romanOrdinals` is NEUTER. Ukrainian's century noun (століття) is neuter, unlike
  Russian's and Polish's. Merged, `XIX століття` would read *дев'ятнадцятий століття*.
- `ordinals` and `genitiveCardinals` both answer digits-hyphen-letters; which is right depends on the suffix
  (`1970-х` ordinal, `3-х` oblique cardinal).
- `romanOrdinals.context` omits **вік** deliberately — a masculine noun read from a neuter table is wrong, so
  `XX вік` stays a cardinal. Enumerating the context nouns rather than writing a stem+suffix pattern makes the
  exclusion visible as an absence.

## Run 3 — 2026-08-24 20:31

**Question.** Did the lift move any reading?

**Command.** 158-line probe over every rule in the file; Node before (stashed) vs after, sync and async.

**Finding (raw).** One row moved on the first pass:

```
у XVIII столітті.
-  u ʋʲisʲimnadʲt͡sʲatɛ stɔlʲitʲːi .
+  u ʋʲisʲimnadʲt͡sʲatʲ stɔlʲitʲːi .
```

I had expanded `століт(тя|тю|ті|…)` by hand and written **століті** and **столітю** for стол**іт**+ті and
+тю — the stem ends in т and the suffix begins with т, so the correct forms are **столітті** and **століттю**.
The locative is the commonest case a century appears in ("у XVIII столітті"), so the enumeration dropped the
most frequent context noun in the set.

**Implication.** Enumerating an alternation by hand is a transcription task and gets transcription errors.
The probe is what catches them; nothing in the type system or the tests would have. Fixed, then **0 of 158
readings moved** in both sync and async.

## Run 4 — 2026-08-24 20:34

**Question.** Is every lifted key actually read?

**Command.** Sabotage sweep — wreck each key in turn, re-probe, count moved readings.

```
ordinals.oneToNineteen 21   genitiveCardinals.oneToNineteen 4   romanOrdinals.oneToNineteen 4
ordinals.tens           4   genitiveCardinals.tens          3   romanOrdinals.tens          3
ordinals.hundreds       2   genitiveCardinals.hundreds      1   romanOrdinals.hundredth     1
ordinals.thousands      2   ordinals.endings[hard/soft]    29   romanOrdinals.context       7
letterNames             2   clock.prepositionCase[remap]    6   clock.defaultCase[remap]    6
phonotactics.vowels     2   phonotactics.onsets             3   phonotactics.codas          1
degree                  7   temperatureScales               5   dottedAbbrev                5
multiDotAbbrev          5   numberSign                      2   rangeWord                   5
acronymLetters          1   symbols.units                  12   symbols.magnitudes          5
symbols.percent         3   symbols.currency                3   symbols.unitPer             4
symbols.rateDenominators 4  symbols.exponentWords           4
signWords: plusMinus 2 · plus 3 · minus 2 · ampersand 2 · equals 1 · lessThan 1 · greaterThan 1 · times 2 · dividedBy 1
```

**Finding (raw).** Six keys swept at **0** on the first pass: `ordinals.hundreds`, `ordinals.thousands`,
`romanOrdinals.hundredth`, `phonotactics.onsets`, `phonotactics.codas`, `symbols.magnitudes`. Every one was a
gap in the PROBE, not a dead key — no round-hundred or round-thousand ordinal (`300-й`, `2000-й`), no `C
століття`, no all-caps word whose readability turns on cluster legality (`СТОП`, `ПАРК`), and no
number+magnitude+unit adjacency (`$5 мільйонів`, `10 тисяч км`). Fifteen probe lines later all six moved.

**Implication.** This is the sixth consecutive lift where the sweep's zeros were probe gaps. The sweep measures
the probe at least as much as it measures the key; a zero is a question, not an answer.

## Run 5 — 2026-08-24 20:45

**Question.** Does the coupling test actually fail when the code is decoupled?

**Command.** Sabotage the CODE (not the data) three ways and re-run the test.

**Finding (raw).**
- `romanOrdinals` "deduplicated" onto the masculine table → **fails** ✓
- squared adjective read from `exponentWords.cubed` → **fails** ✓
- clock wired back to hardcoded indices → **passed**. ✗

The clock assertion compared `say("о 20:30")` with `say("з 20:30")`, and **the preposition is spoken too** —
the two strings differ on their first word no matter what the clock rule does. It would have passed with every
preposition mapped to one ending. Fixed by dropping the first token before comparing; the sabotage then fails
as it should. (Also worth recording: my first attempt at applying this sabotage was a `sed` that silently
matched nothing, and the resulting green run looked like the same "test is weak" answer. Two different causes,
one indistinguishable symptom — assert the pattern was found before believing the result.)

## Run 6 — 2026-08-24 20:52 — an unrelated defect the lift exposed

**Question.** Why does `dotnet test` now fail intermittently on an ENGLISH row —
`The word λόγος means word` losing the Greek word — about one run in three, when `main` passes 6/6?

**Command.** Log every `Foreign.ReadForeignRun` decline to a file (xUnit swallows stderr).

**Finding (raw).**

```
FOREIGN-NULL run=λόγος reader=True host=en depth=4 stack=[el,ja,ru,en] tid=5
FOREIGN-NULL run=B     reader=True host=hi depth=4 stack=[el,ja,ru,hi] tid=22
```

`Core/Foreign.cs` holds the host stack in a process-global `List<string>`. Four languages from four threads
are on one stack. The depth cap (3) trips, `ReadForeignRun` declines, and **the embedded run is dropped with
no exception** — the failure mode the router's own comment describes for an unported target, reached here by a
data race instead.

The TS field is a plain module-level array and is *right* to be: JavaScript has one thread. So this is
C#-only, and the bidirectional bug policy does not apply — there is nothing to fix in the TypeScript. Adding
eight Ukrainian tests did not cause it; it added a parallel actor and made a latent race observable.

Fixed with `[ThreadStatic]`, which preserves the "push and pop in the same synchronous turn" invariant the TS
relies on, per thread. **8/8 clean runs afterwards.**

The same file's neural-OOV memo has the same exposure but needs the opposite fix: it is *deliberately*
process-wide (a warm cache across languages), so it takes a lock, not thread-local storage.

## Result

`ukrainian.jsonc` 82 → 305 lines, 21 new keys. 0 of 158 probe readings moved in Node; 316 C#-vs-Node probe
readings identical in sync and async, 0 threw; parity 55 languages / 11,000 rows / 0 differ; 379 C# tests,
5,039 TS tests.
