# Turkmen (tk) TS → C# port — investigation log

Port of `src/languages/turkmen/{turkmen,normalize,numbers,romanOrdinals}.ts` (590 lines, 4 modules) to
`csharp/Vernacula.Phonemizer/Languages/Turkmen/`. Contract: `csharp/PORTING.md`.

## Run 1 — 2026-08-31 — read the source, write the five files

Read `turkmen.ts` (161), `normalize.ts` (319), `numbers.ts` (52), `romanOrdinals.ts` (58),
`turkmen.jsonc` (47), `test/turkmen.test.ts` (139). Files written: `Manifest.cs`, `Numbers.cs`,
`Normalize.cs`, `RomanOrdinals.cs`, `Turkmen.cs`, plus the `Bootstrap.cs` registration.
`Registry.cs:585` already routed `tk` → `Create("turkmen")`.

⚠ **AND THIS ONE HAS A GOLDEN**, unlike the Totontepec Mixe port immediately before it —
`csharp/goldens/tk.tsv`, 200 rows. The definition of done from PORTING.md is available again.

    $ dotnet run --project csharp/tools/parity -- tk
      tk       OK    200 rows
    1 languages byte-identical, 0 differ (200 rows ok, 0 differ)

200/200 on the first run.

**Structure.** The nearest template is Uzbek — the same `NumbersDef`-bound-from-jsonc plus
`RenderNumber(n, DEF.Numbers, PhonemizeWord, <composer>)` shape, and the same
`Registry.RegisterRomanPolicy` in `RegisterSelf`. Three things needed care and are NOT what the Kipchak
siblings (ba, tt) do:

1. **`VOWEL.has(seg)` is an EXACT segment lookup here**, not "does this segment contain an IPA vowel".
   Bashkir and Tatar both spell their vowel test as `[...s].some(c => IPA_VOWEL.has(c))`; Turkmen's is
   `VOWEL.has(seg)` against the whole segment. Porting the sibling's spelling would have changed which
   segments count as nuclei.
2. **The stress walk has THREE cluster tests, not two** — `obstruentLiquid`, `fricStop` *and*
   `nasalStop`. Tatar has the first two under different names and no nasal branch at all.
3. **`for (const ch of w)` iterates by CODE POINT** and `at0` counts those, so the `initial` flag handed
   to `latinPhone` is a code-point index. Ported as `Js.CodePoints`.

## Run 2 — 2026-08-31 — the sources that exist

No FLEURS split for `tk` (checked `fleurs_transcripts/data/` and the `byid/` phonemized tree — neither
carries it), so widening (1) again has no FLEURS form. What does exist, and is more than the last two
ports had: `tools/corpus/mined/tk.jsonc` (tk.wikipedia, **28,836 paragraph segments**) *and*
`tools/corpus/attest/tk.jsonc`, the attestation artifact the normalizer's sourcing rests on. Extracted
together they give the real-text half of the differential.

## Run 3 — 2026-08-31 — the differential

Probe project in `.probe/tk/` (gitignored, own `<lang>` subdirectory), generator a script file taking
paths as argv. **Eight** entry points per line, so one run covers the whole surface:
`phonemize(l,"tk")`, `normalizeTurkmen(l)`, `phonemizeWord(l)`, `foldTurkmenTildes(l)`,
`numberToWords(n)`, `ordinalOf(n, true)`, `ordinalOf(n, false)` and `ROMAN_POLICY.ordinal(n)`.

⚠ **BOTH BACKNESSES ARE PROBED SEPARATELY**, because `ordinalOf` takes the backness as a PARAMETER —
the writer's choice — and a probe that only ever passes one value would leave half the linking-vowel
table untested. That is the axis this language turns on.

Probe set (6,251 distinct lines): 457 mined+attest corpus strings and 200 golden inputs; one line per
normalizer arm plus its adversary (all five era spellings and the sentence-end dot, the four-group
de-grouping case, `3 779,8`, both fraction orders and the year spans that share the notation, the `4:1`
football score the deliberately-absent clock rule must NOT read, `München`/`Cañón`/`señor` against the
tilde guard); every letter of the alphabet alone and in context; the ⟨y⟩/⟨ý⟩ minimal pairs; 23 loan
onset clusters through all three of the stress walk's cluster tests; 3,500 random walks; and a numeral
walk with **every reachable ordinal in all six written suffix spellings**.

**Finding.**

    rows 6251 | TS throws 0, C# throws 0
    phonemize · normalizeTurkmen · phonemizeWord · foldTildes ·
    numberToWords · ordinalOf(front) · ordinalOf(back) · romanOrdinal
    TOTAL differ: 0 of 50,008 comparisons

## Run 4 — 2026-08-31 — the four seam gates, all of which actually speak this time

    $ dotnet run --project csharp/tools/parity -- tk              → tk OK 200 rows · 0 differ
    $ … -- tk --poison       → distinct poison sites: 0  (SUBSTRING 0, desync 0)
    $ … -- tk --provenance   → tokens 5590/5590 (100.0%)
    $ … -- tk --ipaspans     → 4821/4821 (100.0%) · spans not covering what the token emitted: 0
    $ npx tsx tools/seam-parity.mts --all | grep '^  turkmen '
      turkmen   26   26   0    5   5

26 `rewrite` sites either side, gap 0. The five raw replaces each side are the same five — the four
tilde substitutions inside `FoldTurkmenTildes`, which act on a MATCHED WORD, and the de-grouper's inner
space strip, which acts on a captured group. All correctly off the provenance seam, and `--poison`
agrees.

⚠ Worth stating plainly after the previous port: **these numbers are real here.** `mto` had no golden,
so its provenance and ipaspans read `0/0 (NaN%)` — the absence of a measurement. Turkmen has
`csharp/goldens/tk.tsv`, so 5,590 and 4,821 are counts of actual tokens.

Whole fleet after the port: **186 languages byte-identical, 35,895 rows, 0 differ** (+200 from tk).
C# suite **6,238/6,238** (6,198 before; +39 `TurkmenTests` + 1 manifest gate). Three languages remain
unported: `cy`, `hyw`, `sk`.

**⚠ WHAT FRACTION OF THE REAL TEXT EXERCISED THE NEW CODE** (657 corpus + golden lines):

| construct | lines | share |
|---|---|---|
| any Latin letter | 652 | 99.2% |
| a Turkmen-specific letter ⟨ä ç ž ň ö ş ü ý⟩ | 582 | 88.6% |
| any digit | 417 | 63.5% |
| **numeral + ordinal suffix** | **167** | **25.4%** |
| a caps run (initialism) | 147 | 22.4% |
| a Roman numeral | 131 | 19.9% |
| decimal comma | 78 | 11.9% |
| **the TILDE defect ⟨ñ⟩/⟨ÿ⟩** | **52** | **7.9%** |
| percent | 31 | 4.7% |
| mln / mlrd | 24 | 3.7% |
| currency sign | 22 | 3.3% |
| degree sign | 17 | 2.6% |
| fraction / year span | 14 | 2.1% |
| era marker | 13 | 2.0% |
| space-grouped number | 12 | 1.8% |
| prime / double prime | 5 | 0.8% |
| the `ý.` year abbreviation | 3 | 0.5% |
| colon (the UNREAD clock) | 1 | 0.2% |
| number sign `№` | 1 | 0.2% |
| **±** | **0** | **0.0%** |

This is the best-exercised of the four ports in this sweep: the two classes the language is actually
defined by — the ordinal suffix at 25.4% and the tilde defect at 7.9% — are both well represented in
real text rather than probe-only. `±` is again reached only by the synthesized probes, and the single
colon instance is the football score the header names, which is why there is no clock rule.

## Run 5 — 2026-08-31 — reading for correctness, and the three places the Kipchak siblings would have lied

PORTING.md's three questions:

1. **Does the code do what its docstring promises?** Yes throughout. The three places where copying the
   already-ported Kipchak siblings (ba, tt) would have been wrong, each taken from the Turkmen TS:
   - **`VOWEL.has(seg)` is an EXACT segment lookup.** ba and tt both spell their vowel test as
     `[...s].some(c => IPA_VOWEL.has(c))` — "does this segment contain a vowel character". Turkmen tests
     the whole segment against the set. Different question, different answer for any multi-character
     segment.
   - **The stress walk has THREE cluster tests** — `obstruentLiquid`, `fricStop` *and* `nasalStop`.
     Tatar has two and no nasal branch.
   - **`for (const ch of w)` iterates by CODE POINT**, and `at0` — which feeds `latinPhone`'s `initial`
     flag — counts those, not UTF-16 units. Ported as `Js.CodePoints`.
2. **Is every table reached?** Four of five. `graphemes`, `nasals`, `numbers` and `clausePunctuation`
   are all consulted; **`digraphs` is not**. It is declared on `TurkmenDef`, written `{}` in
   `turkmen.jsonc`, and no line of `turkmen.ts` reads `DEF.digraphs` — which is consistent with the
   module header's own "Near-phonemic (no digraphs — one sound per letter)", so it is a vestigial slot
   rather than a missing rule. It is EMPTY, so nothing is at stake. ⚠ And it still has to be declared on
   the C# side: `ManifestMappingTests` diffs the file's key set against the round-tripped object, so an
   undeclared `digraphs` would fail the gate as an unclaimed key. Recorded because the question was
   asked, and because "declared so the gate passes" is a different reason from "read by the engine".
3. **Which path does the instrument measure?** `PhonemizeWord` (the tests' entry) and `Text()` (the
   golden's) are the same scan and are compared per line in Run 3. ⚠ The Roman policy is reachable ONLY
   through `Phonemize` — the Registry wraps `Text()` — so both the differential and `TurkmenTests` go
   through `Phonemize` for every Roman case.

**No findings to file against the TypeScript.** The unread `digraphs` slot is documented above rather
than filed: it is empty, the header explains why, and removing it would be a change to the data
contract for no behavioural gain.

## Run 6 — 2026-08-31 — review pass: a second, adversarial differential

Re-ran the Run 3 harness (`.probe/tk/`) over two probe sets built independently of the port, to test
the classes the original 6,251-line set could not reach — throw-shaped inputs and case hazards rather
than well-formed Turkmen.

    adv.txt   3,098 lines — lone surrogates ("1\ud83d000", "ýüz\ud800", "a\udfff-nji ýyl"), astral
                            characters, the Turkish case pair İ/ı against the `giu` flags and
                            `Js.ToLowerCase`, "1-NJİ ýyl", `9007199254740993`, a 22-digit run, a
                            1e21 run, every ordinal in six written spellings, 3,000 random walks
    adv2.txt  4,502 lines — the symbol tier (units, `km/sag`, `m/s`, currency, `km²`/`km³`, `&`,
                            the three magnitudes), the initialism runs, all five era spellings,
                            both fraction orders, the degree/coordinate family, 4,500 random walks
                            over the full symbol alphabet and a word-salad generator

    rows 7,600 | TS throws 0, C# throws 0
    TOTAL differ: 0 of 60,800 comparisons (8 entry points)

Negative result, and the useful kind: the three hazards specifically hunted — `string.Concat(segs)
.Normalize()` (plain, not `Js.Normalize`) on a word carrying an unpaired surrogate, `Js.ToLowerCase`
vs .NET casing on İ/ı in `AttachOrdinal`, and `d.Units[(int)n]` / `d.Tens[key]` throwing where the TS
yields `undefined` — are all UNREACHABLE. `LatinPhones.LatinPhone` declines a lone surrogate so no
non-IPA segment ever reaches the join; the ordinal regex is anchored on `nj` so no dotted-I path
exists; and both index sites are entered only from `\d+` runs.

`--fix`: the only change applied is a reuse cleanup — the `Number.isSafeInteger` predicate was
inlined with its magic constant twice (`Turkmen.cs` `Number`, `Normalize.cs` `AttachOrdinal`). Hoisted
to `Numbers.IsSafeInteger`, which is where the rest of the fleet keeps it. Suite 6,238/6,238, `tk`
golden still 200/200 byte-identical.
