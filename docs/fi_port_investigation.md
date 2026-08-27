# Finnish (fi) — C# port investigation

Chronological log of the runs behind the fi port. fi was requested directly rather than drawn from the
population queue.

## Run 1 — 2026-08-27 14:05 — what is there to port?

    wc -l src/languages/finnish/*.ts
        143 finnish.ts · 37 manifest.ts · 618 normalize.ts · 54 numbers.ts = 852

`normalize.ts` is three quarters of it. No shared-core change was needed (`Clauses`, `LatinPhones`,
`HostWord`, `NormalizeSymbols`, `LoadManifest`, and both halves of `Initialisms` were already ported) and
`Registry.cs` already routed `case "fi": return Create("finnish")`.

Three rules live in CODE rather than the grapheme table, and the ORDER between them is load-bearing:

  · **⟨ng⟩ → ŋː** (a LONG velar nasal), consuming both letters — tested FIRST so the ⟨n⟩ is not mishandled;
  · **⟨nk⟩ → ŋk**, emitting ŋ and consuming only the ⟨n⟩, so a following ⟨kk⟩ can still geminate;
  · **CONSONANT GEMINATION**, gated on the letter not being a vowel (a doubled VOWEL is length, and the
    table has its own `aa`/`ää`/`uo` keys). The JS guard's last conjunct is a TRUTHINESS test on the
    grapheme, ported as `TryGetValue(...) && g.Length > 0`.

The pipeline is `SYMBOLS(NormalizeFinnishInitialisms(NormalizeFinnish(raw)))` — the normalizer keeps its
rewrites in DIGITS precisely so the tier can still see number–unit adjacency (`13,6 cm` leaves it as
`13 pilkku 6 cm`).

⚠ **THE SEPARATOR CLASSES WERE AUDITED BY CODE POINT BEFORE THE FIRST RUN** (the nso lesson, #1109): every
one of fi's is a regex LITERAL in the TS, so the ` ` escapes carry through, and the audit found no
all-ASCII-space class in any of the four new files.

Ported with care, each because it is a place a port can silently diverge:

  · the `ABBREV` table's `keepFinal` callback reads JS's `offset` and `whole` arguments — ported by freezing
    the subject per pattern, since the table replaces in a loop;
  · `Ordinal()` returns `undefined`/`null` outside 1–999, and three separate call sites depend on the
    null-coalescing fall-through to the ORIGINAL text;
  · `ResolveColonInflection` maps the LAST letter through `LETTER_NAME_LONG` and every other through
    `LETTER_NAME`, then requires ALL of them to resolve before emitting.

**Parity: `dotnet run --project csharp/tools/parity -- fi` → 200/200 byte-identical on the first run**,
0 differ, 0 BLOCKED. (200 rows, **110 unique texts**.)

## Run 2 — 2026-08-27 14:12 — the differential

    .probe/fi/all.txt = 4,740 unique lines
        3,920  FLEURS fi_fi, columns 3+4
          430  tools/corpus/mined/fi.jsonc + tools/corpus/attest/fi.jsonc
          385  hand-built (.probe/fi/gen_probes.mts) — one line per arm plus its adversarial neighbour
          110  the golden's own unique text
    × sync AND async = 9,480 comparisons

**Result: 9,480 comparisons, 0 differ, 0 throws on either side, 0 BLOCKED**, and a sweep of every output
for a raw digit or symbol returns **0 lines of 4,740**.

⚠ **PLUS A 48-LINE CASE-FOLDING PROBE, ADDED BECAUSE THE wo REVIEW FOUND EXACTLY THAT CLASS** (#1112: a
`gi`-flagged pattern matched `&ſup2` through JS's long-s fold and the C# threw where the TS yielded
"undefined"). fi has six case-insensitive patterns, so all of them were probed with `ſ`, `İ`, `ẞ`, `ﬁ`, an
astral run and an emoji, in both cases: **96 comparisons, 0 differ, 0 throws.** None of fi's callbacks
indexes a dictionary by the matched text — the two `MONTHS[...]` indexers are guarded by `IsMonth` in the
same `&&` chain — which is what makes that class unreachable here rather than merely untested.

⚠ **THE GOLDEN IS NEARLY BLIND TO THIS NORMALIZER**, which is the measurement worth recording:

| construct | FLEURS (3,920) | mined+attest (430) | golden (110u) |
|---|---|---|---|
| any digit | 772 | 342 | 31 |
| space-grouped thousands | 79 | 52 | 5 |
| decimal comma | 28 | 61 | 3 |
| bare `N.` ordinal | 34 | 125 | 3 |
| ordinal range `N.–N.` | 2 | 19 | **0** |
| dotted date | 6 | 9 | **0** |
| clock shape | 27 | 2 | 2 |
| colon suffix on digits | 22 | 11 | **0** |
| colon on an initialism | 28 | 33 | 4 |
| apostrophe genitive | 12 | 7 | **0** |
| dotted abbreviation | 21 | 72 | **0** |
| degree sign | **0** | 9 | **0** |
| minus / plus before a digit | 2 | 22 | **0** |
| relational sign | **0** | **0** | **0** |
| ampersand | **0** | 12 | **0** |
| percent | 2 | 20 | **0** |
| currency `$`/`€` | **0** | 5 | **0** |
| unit after a digit | 28 | 28 | **0** |
| exponent | 5 | 16 | **0** |
| multiply `×` | 4 | 3 | **0** |

**Fourteen of the rules have ZERO golden coverage** — the whole symbol tier included. The parity gate
proves the two engines agree about 110 sentences of running prose; everything else in this port rests on
the corpus differential and the probes.

## Run 3 — 2026-08-27 14:15 — reading for correctness

**FINDING — the clock's marker gate is RIGHT and its ADJACENCY is too tight: FLEURS has 37 clock instances
and the rule claims 29.**

`normalize.ts` step 4 gates the clock on `kello`/`klo` immediately before the figure, and argues it from
the retained text: five `\d{1,2}\.\d{2}` shapes, three preceded by `kello` and two the fractional part of a
SPORTS time. "A bare-colon/bare-period clock rule would have fixed 3 and broken 2."

Measured over FLEURS `fi_fi` — a corpus that carries 27 clock-bearing sentences against the artifact's 2:

    37 clock-shaped instances with a valid hour and minute
    29 claimed by the `kello`/`klo` adjacency gate
     8 NOT claimed — and all 8 are genuine clock times

The gate's DISCRIMINATOR is confirmed handsomely (24 of the 26 `d.dd` sentences carry the marker), but the
adjacency misses three recurring shapes, all of them in sentences where the rule ALREADY FIRED once:

    kello 9.30 paikallista aikaa (2.30 UTC)      the parenthetical UTC gloss — marker on the FIRST time
    kello 6.30 ja 7.30 välisenä aikana           a range's second operand
    Noin 11.29 protesti eteni                    marked by `Noin`, not by `kello`

And the cost is the defect the rule exists to close, inside the same clause:

    … noin kello 9.30 paikallista aikaa (2.30 UTC) ja räjähti.
      → … kelːo yhdeksæn kolmekymːentæ pɑi̯kɑlːistɑ ɑi̯kɑː kɑksi **.** kolmekymːentæ uː teː seː jɑ …

— the first time reads correctly and the second takes a SENTENCE BREAK mid-number.

⚠ **AND WIDENING LOOKS FREE, because the sports times are excluded by a DIFFERENT guard.** `9.29,43` is
declined by the trailing `(?![\d.,])` — the comma after the minutes — not by the marker, so extending the
marker context (a preceding `ja`/`Noin`, or an open paren after a marked time) cannot let a sports time in.
Filed as **#1114**, not fixed: it moves goldens, so it is TS-first.

Two claims checked and CONFIRMED rather than overturned, recorded because a check that passes is also a
measurement:

  · **"NO ENGLISH-STYLE COMMA-GROUPING ARM"** — the header argues every `\d,\d{3}` in the retained text is a
    genuine three-place decimal. FLEURS carries **ZERO** `d,ddd` shapes, so the second corpus does not
    challenge it. The refusal stands.
  · **"zero sentence-final pauses are lost"** — the ordinal rule's lookahead requires a lowercase letter or
    a month name, and month names are lowercase, so no capital-followed period is reachable. Confirmed by
    construction and by the 9,480-line differential.

Questions 2 and 3 came back clean: every manifest table is reached (`ManifestMappingTests` pins it
structurally), and `Text()` → `PhonemizeWord` is the single entry point.

## Gates

    csharp tests            1,870 pass (78 new in FinnishTests.cs + 1 ManifestMappingTests case), 0 fail
    parity, fi              200/200 byte-identical, 0 differ, 0 BLOCKED
    parity, fleet           128 languages, 25,227 rows, 0 differ, 0 BLOCKED
    differential            9,480 comparisons (sync + async), 0 differ, 0 throws
    case-folding probe      96 comparisons over 48 adversarial lines, 0 differ, 0 throws
    leak sweep              0 of 4,740 outputs carry a raw digit or symbol
    separator audit         0 all-ASCII-space classes in the four new files (by code point)
    typescript              unchanged
