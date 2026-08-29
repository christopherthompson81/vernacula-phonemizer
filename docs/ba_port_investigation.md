# Bashkir (ba) — C# port investigation

Chronological log of the runs behind the ba port.

## Run 1 — 2026-08-29 ~12:10 — scope

    wc -l src/languages/bashkir/*.ts data/languages/bashkir/bashkir.jsonc
        197 bashkir.ts · 334 normalize.ts · 59 numbers.ts · 41 romanOrdinals.ts · 53 bashkir.jsonc

FOUR modules, not the usual three: `romanOrdinals.ts` is a fifth file the recent Romance ports did not
have, and it is wired from `registry.ts`'s own policy map rather than from the engine.

No shared-core change was needed. `Clauses`, `Ipa` (`IPA_VOWEL`), `NormalizeSymbols` (the full tier —
`RateDenominators`, `UnitPer`, `ExponentWords`, `Multiply`, `Magnitudes`), `LoadManifest`, `Boundaries`,
`JsRegex`, **`Initialisms`** (`MakeInitialismNormalizer` + `MakeUnreadableTest`) and **`Roman`**
(`RomanPolicy`, `Registry.RegisterRomanPolicy`) are all ported, and `Registry.cs` already routes
`case "ba": return Create("bashkir")` — only the factory was missing. `csharp/goldens/ba.tsv` (200 rows)
exists, so the parity gate applies from the first run.

⚠ **THE ONE CROSS-LANGUAGE DEPENDENCY: this engine calls the RUSSIAN g2p.** Real Bashkir text is
saturated with Russian loanwords and Bashkir speakers read them Russian-style, so `phonemizeWord` routes a
detected loan to `russian.ts`'s word function entirely. Checked before writing anything:
`Languages/Russian/Russian.cs` exposes `public static string PhonemizeWord` — so the dependency is
satisfied and the port is not blocked. Kazakh (Turkic, Cyrillic, roman policy) was read as the structural
model for the file layout.

The g2p is a Cyrillic grapheme scan with four position rules in code — dark/clear ⟨л⟩ by whole-word
harmony, the ⟨у ү⟩ glide-vs-vowel split, ⟨е⟩ iotation, and the legacy-codepage fold — plus word-final
(oxytone) stress. The normalizer is the load-bearing half: ten steps whose defining class is the WRITTEN
SUFFIX ON THE FIGURE (`1-се`, `100-ҙән`, `8:30-ҙа`, `°C-тан`), with the ordinal DERIVED from vowel
harmony rather than tabulated.

⚠ **THE CONFUSABLE CLASSES WERE AUDITED BEFORE THE FIRST BUILD** (the ab/rup lesson). Three of this
file's classes mix Latin and Cyrillic letters that render identically — `[CСcс]`, `[CС]`, `[FФ]` — which
is the whole reason they exist (the Latin ⟨C⟩ was falling to `core/foreign.ts` and reading as the ENGLISH
letter name, `+28 °C` → [sˈiː]). They are spelled as `\u` escapes in the C# rather than typed, so the
pair is legible at the call site: C U+0043 / С U+0421, c U+0063 / с U+0441, F U+0046 / Ф U+0424. Same for
the separator class `[    ]`, the dash classes, and the sentence-end `["»)']` — the class
whose two mis-transcribed members were the defect found in #1166 the same day.

## Run 2 — 2026-08-29 ~12:40 — first build + parity: 200/200 on the first run

    dotnet build csharp/Vernacula.Phonemizer          clean (one pre-existing Marathi warning)
    dotnet run --project csharp/tools/parity -- ba    ba  OK  200 rows

Byte-identical on all 200 golden rows on the FIRST run, with no intermediate failure to record. Noted
rather than celebrated: the last three reviews all found the golden blind to at least one class, so the
gate below is what the port actually rests on.

## Run 3 — 2026-08-29 ~12:50 — mechanical pattern comparison, TS against C#

Not a read-through — every regex in both files extracted and diffed by codepoint, which is the check that
found the dropped Cyrillic К in `ab` and the curly-quote class in `rup`:

    TS patterns: 33   C# patterns: 29   matched byte-identically: 16

The 13 that did not match textually were each verified by hand to differ ONLY in escape spelling, and
they are exactly the classes that were deliberately escaped:

    [ \xa0  ]  ↔  [    ]           the grouping separators
    ["»)']               ↔  ["»)']                     the sentence-end guard
    [-−–]                ↔  [-−–]                 the minus (U+002D, U+2212, U+2013)
    [–—]                 ↔  [–—]                  the range dashes
    [CС] [CСcс] [FФ]     ↔  [CС] …                the Latin/Cyrillic scale letters
    ±  ×                 ↔  ±  ×
    [${Object.keys(LEGACY_CODEPAGE).join("")}]  ↔  [ѳѲӊӉ]   U+0473 U+0472 U+04CA U+04C9

⚠ THE LEGACY CLASS IS BUILT FROM THE TABLE'S OWN KEYS IN THE TS, so the C# literal has to reproduce the
key ORDER as well as the membership; checked by codepoint, and it does (ѳ Ѳ ӊ Ӊ). The remaining four
"TS-only" hits were my extractor matching comment prose, not patterns.

## Run 4 — 2026-08-29 ~13:00 — the tests, and pinning them to the reference

`BashkirTests.cs` is the portable half of `test/bashkir.test.ts` — 79 cases: the interdental hallmark and
the vowel shift, the Turkic numerals (Bashkir's own lexemes, not Tatar's), the loan router, the
legacy-codepage fold, all four ordinal-harmony branches plus the glue fallback and its two refusals, the
degree suffix on the SIGN including the uppercase-suffix guard, the clock, the abbreviations, the
percent/unit tier with Turkic SINGULAR agreement, the decimal comma, the dot that is not a decimal, the
signs and the two refusals, the ranges, the Roman-ordinal seam, and the initialisms.

    dotnet test --filter "FullyQualifiedName~Bashkir"   79/79 on the first run

⚠ AND PASSING MY OWN TESTS ONLY PROVES SELF-CONSISTENCY, which is the trap the last three reviews turned
up. All 77 hard-coded expectations were extracted from the C# file and re-run against the TypeScript
engine directly (native g2p, word g2p, normalizer, raw engine and the registry path, whichever the case
uses):

    ALL TEST EXPECTATIONS AGREE WITH THE TS ENGINE

## Run 5 — 2026-08-29 ~13:10 — the differential, 12,000 generated rows

The golden is 200 rows of running prose; the classes this language is DEFINED by are one or two
characters wide. So the haystack was generated to enumerate them: the written suffix on the figure (25
suffix spellings × ordinal/case/one-letter/`-е`/`-й`/uppercase), the clock with and without a suffix and
past hour 24, all seven degree arms crossed with Latin/Cyrillic C/c/С/с and F/Ф and letter-first order,
the four grouping separators, the decimal comma against the dot that is not a decimal, every sign
including ± and the refused ÷, all three range dashes, the multi-dot abbreviations, `й.` against `г.`
against bare `г`, caps runs, Roman numerals in and out of the `быуат` context, the legacy-codepage
letters, loans against natives, and the numeral boundaries (0, 10⁹, 10¹², 2⁵³+1, a 20-digit run).

    12,000 unique inputs, 16 shards over xargs -P, ~12s wall for the TS reference side
    dotnet run --project csharp/tools/parity -- ba (swapped golden)   ba  OK  12000 rows

**0 differ, 0 throws.**

## Run 6 — 2026-08-29 ~13:20 — the full gates

    dotnet test (full suite)                 3,011 pass, 0 fail  (79 Bashkir + 1 manifest mapping)
    parity, fleet                            141 languages, 27,827 rows, 0 differ
    provenance ba                            5,391/5,391 tokens mapped (100%)
    ipaspans ba                              4,618/4,618 (100%), 0 wrong
    poison ba                                0 sites (SUBSTRING 0, desync 0)
    typescript                               unchanged

`ba` is the 141st gated language; nothing moved in the other 140. `ManifestMappingTests` gained
`BashkirManifestIsFullyMapped` — every key in `bashkir.jsonc` is consumed by the C# type, so no
`metadataOnly` exclusion was needed.

## Read for correctness — filed, not fixed

- **The digit-by-digit fallback is not in this language's numbers module**, so #1165 does not apply here:
  `bashkir.ts` handles the above-2⁵³ case in the ENGINE (`number()`), reading the digits out one at a time
  THROUGH the same composer, so the fallback cannot invent a word and there is no `ONES[Number(d)]` hole
  to inherit. Ported as written.
- **`numberToWords` returns an ARRAY here**, not a joined string, because the words are phonemized
  individually. The C# returns `List<string>` rather than flattening — the shape is load-bearing, since
  `normalize.ts`'s `cardinal()` joins it while the engine maps the g2p over it.
- **`isRussianLoan` lowercases internally but the caller passes the FOLDED, un-lowercased word** to the
  Russian g2p. Mirrored exactly: `PhonemizeWord` folds, tests, and hands the folded original to
  `RussianPhonemizer.PhonemizeWord`, which does its own lowercasing.
