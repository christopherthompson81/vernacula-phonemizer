# Albanian (sq) — C# port investigation

Chronological log of the runs behind the sq port.

## Run 1 — 2026-08-29 ~05:35 — scope

    wc -l src/languages/albanian/*.ts data/languages/albanian/albanian.jsonc
        114 albanian.ts · 359 normalize.ts · 82 numbers.ts · 73 albanian.jsonc

No shared-core change was needed: `Clauses`, `LatinPhones`, `HostWord`, `NormalizeSymbols` (the full
symbol tier, including `RateDenominators`, `UnitPer` and `ExponentWords`), `LoadManifest` and `JsRegex`
are all ported, and `Registry.cs` already routes `case "sq": return Create("albanian")` — only the
factory was missing. `csharp/goldens/sq.tsv` (200 rows) exists, so the parity gate applies from the first
run.

The g2p is a longest-match scan over the nine two-letter digraphs then the single graphemes, with
penultimate stress placed by the sonority-sequencing principle plus the sibilant-initial (`st`, `sht`,
`str`) and nasal-initial (`mp`, `nd`, `mpr`) exceptions, but NOT the invalid `⟨tl dl⟩` onsets. The
numbers are decimal and regular except for the obligatory `⟨e⟩` connector, which is why `Numbers.cs`
keeps its own composer instead of the shared Western one.

The normalizer is the load-bearing half: de-grouping must run FIRST because in Albanian both the comma
and the period serve both roles, and the discriminator (three digits after the separator = grouping,
one or two = decimal) is read off the corpus, not assumed.

⚠ **THE SEPARATOR CLASSES WERE AUDITED BEFORE THE FIRST RUN** (the nso lesson): every separator class in
the four new files is a regex literal in the TS (`[.,\u00a0\u202f\u2009 ]` in `GROUP_SEPARATED` and the
de-grouping replacement), so the escapes carry through verbatim; no class relies on `\s` for a space.

## Run 2 — 2026-08-29 ~05:45 — first test run: 48/51

    dotnet test --filter "FullyQualifiedName~Albanian"
    Failed: 3, Passed: 48

Three failures, two of them one real defect:

1. **My test's wrong expectation** (not an engine bug): `Norm("5.09")` is `5 presja zero 9`, not
   `5 presja 0 9` — the TS speaks each LEADING ZERO of the fraction as the word `zero`, so the
   expected values were corrected, not the engine.
2. **REAL: the degree rule eats the ⟨C⟩ of *Celsius*.** `Say("+7° Celsius")` came out
   `ˈplus ˈʃtatə ˈɡɾadə t͡sɛlˈsius ɛlˈsius` — the scale letter consumed, the word added AND the original
   truncated, the exact defect the TS header's trap-12 note warns about. `+ 24° Celsius` the same.
   Root cause: the port wrote the scale guard as `(?!\p{L}\p{M})` — the TS pattern is
   `(?![\p{L}\p{M}])`, WITH THE CLASS BRACKETS. Brackets off, the JS pattern is a two-CHARACTER
   sequence (a letter followed by a mark), so after `C` the lookahead sees `Ce`, is not a letter+mark,
   and passes. Node confirmed on the TS pattern: group 2 is `undefined` for `+7° Celsius`; a scratch
   compile of the C# pattern showed group 2 = `C`. One character of pattern, and the whole guard is a
   different machine.
   This is the class the `regex-diff` corpus exists to catch, and it did not catch it here because the
   corpus replays recorded (pattern, input) pairs and this pattern's failing input was not among them —
   the unit test caught it instead. Noted rather than papered over.
3. Same defect as 2, on the spaced-plus row.

## Run 3 — 2026-08-29 ~05:50 — after the bracket fix

    dotnet test --filter "FullyQualifiedName~Albanian"   51/51
    dotnet run --project csharp/tools/parity -- sq       OK 200 rows
    dotnet test (full suite)                            2818 passed

Parity is byte-identical on all 200 sq rows. The golden exercises the digraphs, the stress rule, the
`⟨e⟩`-connector numerals, comma/period/space grouping, the degree+scale rows and the loan-unit
singulars; the unit tests pin the rest, including the four-defect figure `-38,3 °C` and the
zero-headed-precision rows (`0,375`, `p = 0,001`, `0.500 g`).
