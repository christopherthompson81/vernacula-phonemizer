# Georgian (ka) — C# port investigation

Chronological log of the runs behind the ka port. ⚠ This port also **unblocks `bal`** — see run 7.

## Run 1 — 2026-08-29 ~23:10 — scope

    wc -l src/languages/georgian/*.ts data/languages/georgian/georgian.jsonc
        84 georgian.ts · 41 manifest.ts · 711 normalize.ts · 94 numbers.ts · 87 georgian.jsonc

The g2p is small and the normalizer is the port: Georgian orthography is essentially
ONE-LETTER-ONE-PHONEME, so `georgian.ts` is a greedy scan over 33 single-letter graphemes plus ONE context
rule (word-final voiced-stop devoicing ბ/დ/გ→pʰ/tʰ/kʰ, categorical in the 20,894-word referee). The
numerals are VIGESIMAL — scores of twenty, 30 = 20+10, 99 = 4×20+19, with local truncation of the final ⟨ი⟩
from 100 up. `normalize.ts` is 12 numbered steps over a stem-alternation table and an ordinal circumfix.

No shared-core change was needed; `Registry.cs` already routed `case "ka": return Create("georgian")`.

⚠ **TWO HAZARDS WERE AUDITED BEFORE A LINE WAS WRITTEN**, because both would fail silently:

  1. **`\p{Script=Georgian}`.** .NET has no `\p{Script=…}` — it has `\p{IsGeorgian}`, which is the U+10A0–10FF
     BLOCK and would miss Mtavruli (U+1C90–1CBF) and the Georgian Supplement. Checked `Core/JsRegex.cs`
     first: it translates `\p{Script=X}` into explicit classes generated from the same Unicode data, and
     five other ported languages already rely on it. Safe, and the pattern ports verbatim.
  2. **THE MTAVRULI CASE FOLD.** The g2p lowercases so that Mtavruli titlecase reaches the Mkhedruli keys —
     the TS comment says outright that without it "those codepoints miss the scan and are silently
     dropped". So `Js.ToLowerCase` had to agree with JS `toLowerCase` across the whole block. Tested all 48
     codepoints against node's actual output:

         Js.ToLowerCase MATCHES JS on all 48 Mtavruli codepoints

     ⚠ My first cut of that probe reported "2 MISMATCHES" at U+1CBB/U+1CBC — which was my own *expected*
     mapping being wrong, not the fold: those two positions are UNASSIGNED (Mkhedruli U+10FB/U+10FC are the
     paragraph separator and a modifier letter, which have no Mtavruli forms), and JS leaves them unchanged
     too. Comparing against JS's real behaviour rather than an assumed offset is what settled it.

## Run 2 — 2026-08-29 ~23:50 — build + parity: 200/200 on the first run

    dotnet build csharp/Vernacula.Phonemizer          clean
    dotnet run --project csharp/tools/parity -- ka    ka  OK  200 rows

One compile error on the way, worth recording because it is a real API gap rather than a typo: `JsRe` has
no `Split`, so the TS's `fig.split(/[.,]/u)` has no direct mirror. The class has exactly two members, so a
`fig.Split('.', ',')` is the same partition (empty pieces included) — noted at the call site rather than
left to look like a shortcut.

## Run 3 — 2026-08-30 ~00:05 — mechanical comparison, patterns then tables

Every regex in both trees extracted and diffed by codepoint, with the interpolated fragments normalised to
placeholders so the comparison is of the PATTERNS and not of the templating:

    TS 53   C# 46   matched byte-identically: 46  —  every C# pattern matches its TS original

The 7 TS-only entries are four comment fragments my extractor caught, plus the two the C# expresses
differently and one truncation artefact: `[$]` (the TS escapes the currency sign with a regex replace; the
C# uses a conditional, equivalent for the two signs) and `[.,]` (the `FigureToWords` split above).

Then every hand-copied table, by membership AND by order where order is load-bearing:

    WRITTEN   (ORDER MATTERS — it becomes an alternation)   TS 18 / C# 18   MATCH
    ENDINGS keys                                            TS 16 / C# 16   MATCH
    UNITS     (ORDER MATTERS — longest-key-first)           TS 13 / C# 13   MATCH
    SCALES    (ORDER MATTERS)                               TS  3 / C#  3   MATCH
    CURRENCY                                                TS  2 / C#  2   MATCH
    ABBREV    (ORDER MATTERS)                               TS  8 / C#  8   MATCH
    MAG_WORD · MONTHS · GEO                                                 MATCH

## Run 4 — 2026-08-30 ~00:20 — the tests, pinned to the reference

`GeorgianTests.cs` is the portable half of `test/georgian.test.ts` — 92 cases: the three-way stop contrast
and the uvulars, the final-devoicing rule and its non-application medially, the Mtavruli fold, the whole
vigesimal band with its truncation, the ordinal circumfix including the suppletive ONE, the de-grouping,
percent/per-mille with the ending on the WORD, the degree scales, the units with the PREPOSED measure
word and the attributive truncation, the rates, currency, the era markers, the clock with its required
context, the fractions, and the century-as-ordinal through the roman pass.

    dotnet test --filter "FullyQualifiedName~Georgian"   92/92 on the first run
    all 98 hard-coded expectations re-run against the TypeScript engine directly:
        ALL TEST EXPECTATIONS AGREE WITH THE TS ENGINE

## Run 5 — 2026-08-30 ~00:35 — the differentials, under the corrected harness

Both references built the way `gen_parity_goldens.mts` builds one — ONE process, `clearForeignOov()` once
for the language, rows in order, through `phonemizeAsync` — which is the `bpy` lesson. The haystack carries
foreign Latin runs (the `ba` lesson) and walks all 12 normalizer steps: every one of the 18 WRITTEN endings
in both the hyphenated and bare spellings, the units crossed with ², ³, rates and endings, the degree signs
including the folded `º`, the ordinal circumfix from both halves, the clock with and without its context,
the currency in both positions, the era markers, the fractions against the dates they must decline, the
sign rules against the ranges and ISBNs they must not claim, and the numeral boundaries.

    mined corpus  tools/corpus/mined/ka.jsonc → 380 texts     0 differ, 0 throws
    generated     10,000 rows                                 0 differ, 0 throws

## Run 6 — 2026-08-30 ~00:45 — the full gates

    dotnet test (full suite)     3,220 pass, 0 fail  (92 Georgian + 1 manifest mapping)
    provenance ka                3,865/3,865 tokens mapped (100%)
    ipaspans ka                  0 spans wrong
    poison ka                    0 sites
    typescript                   unchanged

## Run 7 — 2026-08-30 ~00:50 — ⚠ AND `bal` UNBLOCKS

`bal` (#1169) shipped with one golden row it could not compare: a Balochi sentence about Georgia that
gives the country's name in three scripts at once, `გურჯისტან(بی گرجی زبانا-საქართველო…`. The script router
handed that Georgian run to the Georgian engine, `Create("georgian")` threw `PortPending`, and the parity
runner reported the row BLOCKED — correct behaviour, and it named the dependency rather than hiding it.

    before this port    bal   OK 77 rows, 1 BLOCKED on georgian
    after               bal   OK 78 rows                        ← 0 blocked

    fleet before        142 byte-identical + 1 language with a BLOCKED row
    fleet after         145 languages byte-identical, 28,505 rows, 0 differ, ZERO BLOCKED

Three languages move in that count, not one: `ka` itself, `bal` crossing from the blocked bucket into
byte-identical, and `bpy` from the previous port. ⚠ **The fleet now has no blocked rows at all** — every
gated row in every language is compared, which is the first time that has been true in this batch.

## Run 8 — 2026-08-30 ~01:20 — review of #1171: the ending × stem-kind matrix

The port's generator fed the stem-alternation table NUMERALS, and numerals only end in -ი or -ა. But
`Attach` is called on unit nouns and currency nouns too, which is where the -ე and -ო stems live (ევრო is
o-stem; an ordinal ends in -ე), and the table branches on exactly that letter. So the review's haystack is
the MATRIX rather than more of the same:

  * all 18 WRITTEN endings × 14 head types — i- and a-stem numerals (100, 8, 9, 20, 1000), the unit nouns
    (მ, კმ, წმ, სთ), the o-stem currency (€), the percent and degree words, and the attributive
    `კმ²` which must truncate its adjective before the ending;
  * MTAVRULI reaching the NORMALIZER, which is a distinct question from the g2p's fold: the normalizer
    keys on Mkhedruli literals (`მე-`, `საათ`, `ძვ. წ.`) and runs BEFORE the g2p lowercases, so an
    all-caps heading takes a different path through it. Both engines must agree on that path;
  * combining marks, since the TOKEN class is `[\p{Script=Georgian}\p{M}]+`;
  * each guard's boundary on both sides — 23:59/24:00/25:00, 1/1 vs 1/2 vs 100/101, 9999-ე vs 10000-ე,
    1 საუკუნე vs 21 vs 22, `-0`/`+0`/`0=0`;
  * and the refusals the file names, with their adversarial neighbours: the year ranges, the ISBN, the
    dimension cross, `AT&T`, the European-grouped `$2.500`, the formula `E = mc²`.

    329 inputs, 0 differ, 0 throws

## Run 9 — 2026-08-30 ~01:35 — one thing fixed: the per-table patterns were compiled inside the loops

Not a defect — `JsRegex.Compile` caches by (pattern, flags), so the SCALES, CURRENCY and ABBREV loops were
correct. But they took the cache's lock on every call for every row, and they read as though these were
the only dynamic patterns in a file that hoists every other one to a static field.

Hoisted into three compiled tables (`SCALE_RULES`, `CURRENCY_RULES`, `ABBREV_RULES`), which also gave the
currency arm's "not said twice" guard somewhere to be commented. 16 of the per-call compiles were the
ABBREV pair alone.

    dotnet test --filter Georgian    92/92
    generated 10,000 rows            0 differ
    review probe 329 rows            0 differ
    mined corpus 380 rows            0 differ

## Read for correctness — filed, not fixed

- **`JsRe` has no `Split`**, so a TS `String.split(regex)` has no direct mirror. Here the class is two ASCII
  characters and a char split is provably the same partition, but a language whose split class is wider
  would need a real helper. Worth knowing before the next port hits it.
- **The clock's `hourWord` slice** uses `hourWord[Math.Min("საათ".Length, hourWord.Length)..]`, where the TS
  writes `hourWord.slice("საათ".length)`. JS `slice` past the end yields `""`; C# range indexing THROWS, so
  the bound is explicit. The regex cannot actually produce a shorter match — the literal `საათ` is in the
  pattern — but the guard costs nothing and the alternative is an exception class that only fires on input
  nobody has yet written.
