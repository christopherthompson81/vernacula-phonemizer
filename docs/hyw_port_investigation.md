# Western Armenian (hyw) TS → C# port — investigation log

Port of `src/languages/westarmenian/{westarmenian,manifest,normalize}.ts` (344 lines, 3 modules) to
`csharp/Vernacula.Phonemizer/Languages/WestArmenian/`. Contract: `csharp/PORTING.md`.

## Run 1 — 2026-08-31 — read the source, write the three files

⚠ **THE ENGINE WAS ALREADY PORTED.** hyw is not a new g2p — it is a second manifest for the shared
Armenian engine, which landed with Eastern (`Languages/Armenian/Armenian.cs`, `MakeArmenianEngine`).
So the port is three files, not five: `Manifest.cs` (bind westarmenian.jsonc to the SHARED
`ArmenianDef`), `Normalize.cs` (the sibling normalization layer), `WestArmenian.cs` (the Western symbol
tier + the engine wiring). `Registry.cs:665` already routed `hyw`.

    $ dotnet run --project csharp/tools/parity -- hyw
      hyw      OK    200 rows
    1 languages byte-identical, 0 differ (200 rows ok, 0 differ)

200/200 on the first run.

**⚠ AND THE PORT FALSIFIED A COMMENT IN THE ALREADY-MERGED EASTERN FILE.**
`Armenian.cs:184` read *"`pre` is the dialect's own text-normalization pass; hyw deliberately passes
none."* That was true when it was written — hyw had no C# port — and this commit makes it false: hyw
passes `s => SYMBOLS(NormalizeWestArmenian(s))`, exactly as the TS does. It is also a C#-ONLY claim; the
TS at `armenian.ts:100` says nothing of the kind. Rewritten to state the rule that is actually load-
bearing there (the ՛ ՜ ՞ marks belong to the ENGINE, not to a dialect's `pre`, because TOKEN is shared).
PORTING.md's phrase for what this was: a stale comment is a fork that documents itself as fidelity.

## Run 2 — 2026-08-31 — the sources, and one that no previous port in this sweep had

`csharp/goldens/hyw.tsv` (200 rows) · `tools/corpus/mined/hyw.jsonc` (hyw.wikipedia, **140,044**
paragraph segments) · `tools/corpus/attest/hyw.jsonc`. Together 473 distinct retained strings.

⚠ **AND THERE IS FLEURS TEXT FOR THE SCRIPT — 3,970 lines of it.** There is no `hyw` split, but there is
`hy_am`: **Eastern** Armenian, the same alphabet. Extracted with `cut -f3,4`, and sanity-checked as
PORTING.md demands — the first line is a SENTENCE and the file contains **zero** `.wav` strings, so the
column-2 trap did not fire.

⚠ **WHAT THAT IS AND IS NOT EVIDENCE OF, stated before it is used.** For a TS↔C# DIFFERENTIAL it is
first-class: both engines read the identical bytes through the identical code path, and disagreement is
disagreement whatever variety the text is. It is **not** evidence about Western Armenian *correctness* —
`hy_am` is the other standard, and reading it through the hyw manifest deliberately produces the Western
values for Eastern prose. It widens the differential; it does not widen the referee.

## Run 3 — 2026-08-31 — the differential

Probe project in `.probe/hyw/`, generator a script file taking paths as argv. Four entry points:
`phonemize(l,"hyw")`, `normalizeWestArmenian(l)`, `phonemizeWord(l)`, `ordinalWords(n)`.

Probe set (8,914 lines): 473 corpus + **3,970 FLEURS** + 200 golden inputs; one line per normalizer arm
plus its adversary (both decimal conventions in the corpus's own three-decimal sentence, `445,000`
against the grouping comma, `1915-1923` and `13-11-2020` against the suffix rule, `ρ =1260` against the
digit-gated equals, `20 °-Ը` against the lowercase-only suffix class); every letter of the alphabet alone
and in context; all five digraph/glide sequences in every position; the ՛ ՜ ՞ marks and the կ՛ proclitic;
3,000 random walks; and a numeral walk to 10¹² with **six written suffix spellings per value**.

**Finding.**

    rows 8914 | TS throws 0, C# throws 0
    phonemize · normalizeWestArmenian · phonemizeWord · ordinalWords
    TOTAL differ: 0 of 35,656 comparisons

## Run 4 — 2026-08-31 — the seam gates, and the coverage table

    $ … -- hyw              → hyw OK 200 rows · 0 differ
    $ … -- hyw --poison     → distinct poison sites: 0  (SUBSTRING 0, desync 0)
    $ … -- hyw --provenance → tokens 4608/4608 (100.0%)
    $ … -- hyw --ipaspans   → 3910/3910 (100.0%) · 0 wrong
    $ npx tsx tools/seam-parity.mts --all | grep '^  westarmenian '
      westarmenian   24   24   0    1   1

Whole fleet: **188 languages byte-identical, 36,295 rows, 0 differ.** Suite **6,412/6,412**.

**⚠ WHAT FRACTION OF THE REAL TEXT EXERCISED THE NEW CODE** (4,643 lines — the largest real-text base of
any port in this sweep, and that is the FLEURS import):

| construct | lines | share |
|---|---|---|
| any Armenian letter | 4,604 | 99.2% |
| any digit | 1,283 | 27.6% |
| **the BOUND SUFFIX on a figure** | **401** | **8.6%** |
| …of which the ORDINAL suffix | 90 | 1.9% |
| a decimal (either mark) | 138 | 3.0% |
| numeric range | 104 | 2.2% |
| the over-the-vowel marks ՛ ՜ ՞ | 92 | 2.0% |
| space-grouped number | 45 | 1.0% |
| equals sign | 37 | 0.8% |
| percent | 31 | 0.7% |
| currency sign | 19 | 0.4% |
| degree sign | 18 | 0.4% |
| magnitude abbreviation | 13 | 0.3% |
| era marker | 12 | 0.3% |
| ÷ (a RANGE here) | 3 | 0.1% |
| ± | 2 | 0.0% |
| the astronomical unit | 2 | 0.0% |

The g2p is exercised as thoroughly as any in this sweep. The normalization arms read as small SHARES
because FLEURS is continuous prose, but the absolute counts are healthier than the percentages suggest —
401 bound-suffix lines and 92 lines carrying the ՛ ՜ ՞ marks, the latter being the class the TS test file
notes has **zero** golden instances.

## Run 5 — 2026-08-31 — reading for correctness

1. **Does the code do what its docstring promises?** ⚠ **No — one claim is false in three places.**
   See the finding below.
2. **Is every table reached?** Yes: `vowels`, `consonants`, `digraphs`, `postConsonantDigraphs`,
   `numbers` and `clausePunctuation` by the shared engine, `irregularOrdinals` by `Normalize.cs`.
   `ManifestMappingTests` now gates the key set — with the same four exclusions Eastern uses, since
   ⚠ hyw has its own jsonc but NOT its own shape.
3. **Which path does the instrument measure?** `PhonemizeWord` and `Text()` are compared per line in
   Run 3. The over-the-vowel marks are handled in the ENGINE rather than in `pre`, which is what makes
   them reachable from both dialects — the point Run 1's rewritten comment now records.

### FINDING (filed, not fixed) — the ⟨յո⟩→[œ] digraph that does not exist

Three places assert a front-rounded ⟨յո⟩→[œ] digraph:

- `westarmenian.ts`'s module header — "the ⟨յու/իւ⟩→[ʏ] / ⟨յո⟩→[œ] digraphs";
- `westarmenian.jsonc:11` — "FRONT-ROUNDED vowels from the palatal sequences ⟨յու⟩/⟨իւ⟩→[ʏ] and ⟨յո⟩→[œ]";
- `westarmenian.jsonc:19` — the **`provenance` string**, which is the field the sourcing gate reads.

**It does not exist.** Twenty lines below the second of those, the same jsonc says so outright: *"⟨յո⟩ is
NOT a digraph: it falls out as ⟨յ⟩→j + ⟨ո⟩→o = [jo] (յոթ→jotʰ 'seven'); the rare [œ] cases are
Turkish-loan surnames (lexical, not modelled)."* The `digraphs` table has no `յո` entry, no table in the
file maps to `œ`, and `test/westarmenian.test.ts` pins `յոթ` → `jotʰ` precisely to hold the line.

So the file contradicts itself and the provenance string over-claims a feature. Nothing behavioural is at
stake — the code is right and the tests pin it — but the `provenance` field is the one a reader trusts
without checking. **Not copied into the C# header**, which claims only the ⟨իւ⟩→[ʏ] digraph that is
actually there. Filed rather than fixed: it is a TS/data-side edit, and PORTING.md wants those TS-first.

Welsh (`cy`) is now the ONLY unported language.

## Run 6 — 2026-08-31 — independent review differential (adversarial, not corpus)

Question: does the port diverge anywhere the Run 3 probe set did not reach — specifically the
JS-vs-.NET regex seams (`\s` membership, `$` vs `\z`, nested lookbehind in `GROUP_COMMA`, the
`[^\S\n]` negated class) and the unbounded `(\d+)` operand in `BOUND_SUFFIX`?

Reused `.probe/hyw` with two hand-written adversarial files (100 lines total, no corpus text):
degenerate grouping (`0,000`, `1,0000`, `445,000,000`, `12.34.56`, `1 377 808,5`), the four-group
space-grouping shape trap 63 names (`80 239 800 000`), suffix operands past 2^53
(`9007199254740993-ին`, `999999999999999999-ին`), every era/astro/magnitude abbreviation in isolation
and uppercased, the degree arms with a Cyrillic С and a lowercase scale letter, and a whitespace file
carrying U+FEFF and U+0085 (the two characters where .NET `\s` and JS `\s` disagree in opposite
directions) inside `մ.թ.`, the WS_RUN collapse and the grouping separators.

    $ npx tsx .probe/hyw/run.mts extra.txt ts.tsv && dotnet run --project .probe/hyw/hywprobe.csproj -- extra.txt cs.tsv
    $ diff ts.tsv cs.tsv
    NO DIFF   (both files, 4 entry points, 0 throws either side)

**Implication.** JsRegex is already normalising both `\s` sets and `$`→`\z`, and the nested negative
lookbehind evaluates identically under .NET's right-to-left lookbehind. No behavioural finding; the
review's three fixes are all non-behavioural (unused `using`, a `.ToList()` the Eastern sibling does
not take, and a header that under-claimed the ⟨յու⟩ digraph while the jsonc over-claims ⟨յո⟩).
