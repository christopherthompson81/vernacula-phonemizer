# Basque (eu) — C# port investigation

Chronological log of the runs behind the eu port.

## Run 1 — 2026-08-29 ~15:10 — scope

    wc -l src/languages/basque/*.ts data/languages/basque/basque.jsonc
        134 basque.ts · 422 normalize.ts · 62 basque.jsonc

TWO modules, not four: there is no `numbers.ts` (the vigesimal compositor lives in `basque.ts`, beside the
scan that phonemizes its output) and no `romanOrdinals.ts`. `normalize.ts` is three-quarters of the port.

No shared-core change was needed: `Clauses`, `HostWord` (`LATIN_RUN`, `MakeNativiser`), `LoadManifest`,
`NormalizeSymbols` (the full tier — `PercentPrefix`, `RateDenominators`, `UnitPer`, `ExponentWords`,
`Magnitudes`, `CountForm`), `JsRegex` and `Rewriter.Renormalize` are all ported, and `Registry.cs` already
routes `case "eu": return Create("basque")` — only the factory was missing. `csharp/goldens/eu.tsv`
(200 rows) exists, so the parity gate applies from the first run.

The g2p is a greedy scan over a digraph + letter table with two context rules in code: the ⟨r⟩ TAP/TRILL
split (tap only between vowels) and the ⟨h⟩ choice. The hallmark is the THREE-WAY sibilant/affricate
contrast — ⟨z s x⟩ → [s̻ s̺ ʃ] and ⟨tz ts tx⟩ → [t͡s̻ t͡s̺ t͡ʃ] — which lives entirely in the jsonc.
The numerals are VIGESIMAL: scores of 20 with ⟨-ta⟩ SUFFIXED for a remainder (hogeita hamar = 30) and
⟨eta⟩ FREE before the final sub-100 group.

The normalizer's defining class is the CASE ENDING GLUED TO A FIGURE (×296, the corpus's largest). ⚠ AND
THE THING THAT MAKES IT TRACTABLE is that the author has already chosen the allomorph — the suffix is
written in the text, harmonised to the spoken form, so the rule ATTACHES rather than derives. The one
exception is the HYPHENATED form, where the ending is written bare and the linking vowel is supplied in
speech; the TS claims it only after a vowel-final head and declines it otherwise, and that asymmetry had
to be ported exactly.

⚠ **TWO CONFUSABLE-CHARACTER CLASSES WERE AUDITED BEFORE THE FIRST BUILD** (the ab/rup/ba lesson): the
`º`→`°` fold (U+00BA → U+00B0, two characters that render near-identically and where the TS notes that
`º` is category `Lo` and therefore also satisfies a `\p{L}` guard), and the negative sign's `[−-]`
(U+2212 then the ASCII hyphen, with the EN DASH deliberately EXCLUDED — it is this corpus's range and
parenthesis mark).

## Run 2 — 2026-08-29 ~15:40 — first build + parity: 200/200 on the first run

    dotnet build csharp/Vernacula.Phonemizer         clean (one pre-existing Marathi warning)
    dotnet run --project csharp/tools/parity -- eu   eu  OK  200 rows

Byte-identical on the first run, with no intermediate failure to record. Stated rather than celebrated:
the golden has been blind to a real defect in three of the last four ports, so the runs below are what
this port actually rests on.

## Run 3 — 2026-08-29 ~15:50 — mechanical comparison, patterns then tables

Every regex extracted from both files and diffed by codepoint:

    TS 19   C# 16   matched byte-identically: 16

The three "TS-only" hits are two comment fragments my extractor caught and `/^0*/u`, which the C# writes
as a `LeadingZeros` counting loop — identical for a digit string, which is the only thing it is ever
given. **No pattern differs, in escape spelling or otherwise.**

Then every hand-copied table, by membership rather than by eye:

    CASE_ENDINGS       TS 12 / C# 12   MATCH   ⚠ ORDER-sensitive (longest-first alternation:
                                               `ean` must be tried before `an`, `etik` before `tik`)
    UNITS pairs        TS  4 / C#  4   MATCH
    RATE_DENOMINATORS  TS  2 / C#  2   MATCH
    SCALES             TS  2 / C#  2   MATCH
    currency           TS  3 / C#  3   MATCH   (the TS writes the `$` key unquoted)
    magnitudes         TS  3 / C#  3   MATCH   ⚠ ORDER-sensitive
    PERCENT · SQUARED · CUBED · DEGREE · DECIMAL_WORD · ZERO   all MATCH

## Run 4 — 2026-08-29 ~16:00 — the tests, pinned to the reference

`BasqueTests.cs` is the portable half of `test/basque.test.ts` — 73 cases: the three-way sibilant and
affricate contrasts (including the `zu`/`su` minimal pair), the ⟨r⟩ tap/trill split, the palatal digraphs,
the vigesimal numerals across every band up to `mila milioi`, the grouping period against a dotted
CITATION, the decimal comma, the prefixed percent, the units and the squared modifier, the rate
denominator, the degree+scale, the glued case ending on both the figure and the unit, and all six of the
defects the TS review found.

    dotnet test --filter "FullyQualifiedName~Basque"   73/73 on the first run

⚠ AND PASSING MY OWN TESTS ONLY PROVES SELF-CONSISTENCY. All 79 hard-coded expectations were extracted
and re-run against the TypeScript engine directly (word g2p, cardinal compositor, normalizer, raw engine
and the registry path, whichever the case uses):

    ALL TEST EXPECTATIONS AGREE WITH THE TS ENGINE

⚠ **AND THE VERIFIER ITSELF FOUND SOMETHING, by crashing.** Its first cut called `cardinalWords(Number(x))`
on every fixture, including non-numeric ones — and `cardinalWords(NaN)` recurses forever in the TS
(`NaN < 20` is false at every branch, and `Math.floor(NaN/1e9)` is NaN). The C# does the same thing, but a
C# stack overflow is **process-fatal and uncatchable** where the JS `RangeError` is catchable. Unreachable
through the engine — every call site is behind an `isSafeInteger` guard — and recorded below rather than
"fixed", since guarding it would be a divergence from the reference.

## Run 5 — 2026-08-29 ~16:20 — the differential, 12,000 rows, THROUGH THE ASYNC ENTRY

⚠ **THE REFERENCE IS GENERATED WITH `phonemizeAsync`, WHICH IS THE `ba` LESSON APPLIED.** That port's
review spent a run chasing 21 "differing" mined rows that turned out to be sync-vs-async in the harness:
the parity runner invokes the neural-capable entry, and sync `phonemize()` falls back to rule g2p for
every neural language, English included. Generating the reference the same way the runner reads it
removes the whole class of false positive.

⚠ **AND THE HAYSTACK CARRIES FOREIGN LATIN RUNS THIS TIME**, which is the other half of that lesson — the
`ba` generator contained none, so it could not gate the foreign path at all. 24 foreign forms are in the
fixed set (`NASA`, `Shakespeare`, `München`, `Zürich`, `Dvořák`, `Łódź`, a URL, an email, CJK and Cyrillic
runs) plus the generator emits one in roughly a fourteenth of fragments.

The rest of the haystack enumerates what the golden cannot: all 12 case endings crossed with
glued/hyphenated and integer/decimal heads, plus five NON-endings that must fall through (`m`, `x`, `e`,
`ak`, `ari` — the closed-list guard); the unit+ending and rate+ending arms; `°` against `º` crossed with
C/F/c/f and the refused bare sign; the negative sign against all four of its refusals (subtraction, the
spaced ordinal range, the en-dash parenthetical, the label-value dash); the grouping period against a
dotted citation; the decimal comma with leading zeros; percent, currency and the magnitude-between-figure-
and-unit shape; and the numeral boundaries (0, 10⁶, 10⁹, 10¹², 2⁵³+1).

    12,000 unique inputs, 16 shards over xargs -P, ~17s wall for the TS reference side
    eu  OK  12000 rows      0 differ, 0 throws

## Run 6 — 2026-08-29 ~16:30 — the mined corpus, also async

Real running text is a different distribution from anything generated, and in `ba` it was the mined
corpus that exercised the path the generator missed.

    tools/corpus/mined/eu.jsonc → 390 unique texts
    eu  OK  390 rows      0 differ, 0 throws

## Run 7 — 2026-08-29 ~16:40 — the full gates

    dotnet test (full suite)                 3,084 pass, 0 fail  (73 Basque + 1 manifest mapping)
    parity, fleet                            142 languages, 28,027 rows, 0 differ
    provenance eu                            5,350/5,350 tokens mapped (100%)
    ipaspans eu                              0 spans wrong
    poison eu                                0 sites (SUBSTRING 0, desync 0)
    typescript                               unchanged

`eu` is the 142nd gated language; nothing moved in the other 141. `ManifestMappingTests` gained
`BasqueManifestIsFullyMapped` — every key in `basque.jsonc` is consumed by the C# type.

## Run 8 — 2026-08-29 ~17:30 — review of #1168: a probe set shaped unlike the port's own

The port's generator and the port were written by the same hand, so the review's haystack was built from
a different axis list rather than a bigger version of the same one:

  * **CASING** — the port's fixtures were almost all lowercase native plus capitalised foreign; here every
    native word appears lowercased, ALL-CAPS, capitalised and alternating, plus bare `Ñ ñ Ç ç`.
  * **NFD INPUT** — the engine renormalizes to NFC precisely because `⟨ñ ç⟩` decompose out of the
    `[a-zñçA-ZÑÇ]` token class and NFD input would shatter the word and drop the letter. The port's
    generator emitted no NFD at all; here every `ñ`/`ç` fixture appears in both forms, including
    `Iruñea 1980an` and `5 km²ko`.
  * **THE NATIVISER BOUNDARY** — words carrying letters outside NATIVE_CLASS (`Müller`, `Ångström`,
    `Dvořák`, `Łódź`, `Škoda`, `naïve`, `über`, `coração`) and the hyphenated compounds Basque writes.
  * **EVERY NUMERAL BAND EDGE** the vigesimal composer crosses — 19/20, 39/40, 59/60, 79/80, 99/100,
    999/1000, 10⁶−1/10⁶, 10⁹−1/10⁹, 10¹²−1/10¹², 2⁵³±, each also with `an`, `-ko` and ` km`.
  * **THE MALFORMED CORNERS** of each rule: `5-`, `5- ko`, `5--ko`, `5ko-ko`, `,5a`, `1980ann`,
    `km/h-ko-ko`, `akm-ko`, `km/x-ko`, `5°CC`, `--5`, `-−5`, `%%`, `1.000.00`, `1 0000`.

    373 inputs, 0 differ, 0 throws

And a separate 23-row Unicode-casing probe, because `Js.ToLowerCase` against JS `toLowerCase` is a
divergence no Basque fixture would expose: the Turkish dotted `İ`, dotless `ı`, `ẞ`/`ß`, the `Ǆǅǆ`
title-case triple, the `ﬁ ﬂ` ligatures, Roman-numeral codepoints, fullwidth and Arabic-Indic digits.

    23 inputs, 0 differ

Cumulative differential coverage for `eu`: **12,786 rows** (12,000 generated + 390 mined + 373
second-angle + 23 casing), every one byte-identical against an `phonemizeAsync` reference, plus the
standing 200-row golden.

## Run 9 — 2026-08-29 ~17:45 — the TypeScript side, checked rather than assumed

The port changes no TypeScript, but the review ran the TS structural gates anyway, since the scratch
generators lived under `tools/` while they existed:

    npm run typecheck        clean
    npm run check:package    ok — 729 files, no docs/ tools/ test/

## Read for correctness — filed, not fixed

- **`CardinalWords(NaN)` recurses until the stack dies**, in both engines — but the C# failure is
  process-fatal where the JS one is a catchable `RangeError`. Every call site is guarded by
  `isSafeInteger` (the engine's number branch, step 5's figure+ending rule, and `GlueFraction`), so it is
  unreachable through the engine. The same latent class as #1165, and adding a guard would be a
  divergence from the reference rather than a fix to it.
- **`FractionDigits` returns the fraction's tail as DIGITS, not words**, and that is deliberate in the TS:
  step 6 emits `93 koma 55` and the engine's own number branch reads the `55`. Only `GlueFraction` (step
  5) spells it, because there the case ending has to glue to the last spoken word. Two functions that look
  like duplicates and are not; ported as two.
- **The hyphenated-ending asymmetry is the one place the file's central claim does not hold**, and the TS
  says so in its own comment. `26-en` is claimed (vowel-final head) and `995-ko` is declined. Mirrored
  exactly, including the vowel test on the composed head rather than on the digits.
