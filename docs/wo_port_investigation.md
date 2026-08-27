# Wolof (wo) — C# port investigation

Chronological log of the runs behind the wo port. wo was picked as the next language by the queue's own
rule — highest speaker population among unported codes with a golden: **12M (5M L1 + 7M L2)**, the first
below the 14M Sotho-Tswana trio (tn, st, nso).

## Run 1 — 2026-08-27 13:55 — what is there to port?

    wc -l src/languages/wolof/*.ts
        22 manifest.ts · 411 normalize.ts · 79 numbers.ts · 94 wolof.ts = 606

No shared-core change was needed (`Clauses`, `LatinPhones`, `HostWord`, `NormalizeSymbols`, `LoadManifest`
were all already ported) and `Registry.cs` already routed `case "wo": return Create("wolof")`.

Two rules live in CODE rather than the grapheme table, and both had to be ported as written:

  · **CONSONANT GEMINATION** — a doubled consonant letter is a geminate [Cː], tested BEFORE the greedy
    table scan and gated on the letter not being a vowel (a doubled VOWEL is length, and the table has its
    own `aa`/`ée`/`óo` keys). The guard is `!VOWEL_LETTERS.has(c) && w[i+1] === c && G[c]` — the last
    conjunct is a JS TRUTHINESS test on the grapheme, so an empty mapping declines; ported as
    `TryGetValue(...) && g.Length > 0`.
  · **NASAL PLACE ASSIMILATION** — ⟨n⟩ → ŋ before g/k, consuming ONE letter so the velar is still read.

The normalizer **invokes the shared tier from inside its sequence** (step 4): the HTML-entity fold must
precede it (`km&sup2` has to present a real `²`) while de-grouping and the decimal spell-out must follow it.

⚠ **THE SEPARATOR CLASSES WERE AUDITED BY CODE POINT BEFORE THE FIRST RUN**, because the nso port had just
shipped a bug there (#1109): every one of wo's is a regex LITERAL in the TS, so the escapes ` ` etc.
carry through as escapes, and the audit found no all-ASCII-space class in any of the four new files.

**Parity: `dotnet run --project csharp/tools/parity -- wo` → 200/200 byte-identical on the first run**,
0 differ, 0 BLOCKED. (200 rows, **129 unique texts**.)

## Run 2 — 2026-08-27 14:00 — the differential

wo HAS a FLEURS transcript — `wo_sn`, 3,312 unique lines.

    .probe/wo/all.txt = 4,059 unique lines
        3,312  FLEURS wo_sn, columns 3+4
          433  tools/corpus/mined/wo.jsonc + tools/corpus/attest/wo.jsonc
          310  hand-built (.probe/wo/gen_probes.mts)
          129  the golden's own unique text
    × sync AND async = 8,118 comparisons

**Result: 8,118 comparisons, 0 differ, 0 throws, 0 BLOCKED**, and a sweep of every output for a raw digit
or symbol returns **0 lines of 4,059**.

What the haystack contains:

| construct | FLEURS (3,312) | mined+attest (433) | golden (129u) |
|---|---|---|---|
| any digit | 424 | 226 | 21 |
| comma / period / space grouping | 16 / 2 / 32 | 14 / 13 / 16 | 0 / 0 / 4 |
| decimal dot / comma / zero-head | 5 / 14 / **0** | 4 / 17 / 2 | 0 / 2 / 0 |
| percent | 8 | 23 | 1 |
| currency `$` / `US$` | 8 | 8 | 1 |
| unit key after a digit | 34 | 24 | 2 |
| exponent `²`/`³` | 2 | 15 | 1 |
| degree sign | 2 | 10 | **0** |
| dash range | 6 | 39 | **0** |
| `N:NN` | 18 | 12 | 2 |
| dotted era (`x.Y`) | **0** | 24 | **0** |
| semicolon-less entity | **0** | 4 | **0** |
| bare `&` | **0** | 2 | **0** |
| English ordinal suffix | **0** | **0** | **0** |
| Wolof ordinal `-eel`/`-eem` | 28 | 6 | 0 |
| geminate consonant | 2,991 | 370 | 120 |

The golden exercises **no** degree, no dash range, no dotted era, no entity and no bare `&` — five of the
nine steps — and the English-ordinal step (7) is ×0 in ALL THREE sources, so the probes carry it alone.

## Run 3 — 2026-08-27 14:03 — reading for correctness

**FINDING — the CLOCK refusal's premise is corpus-scoped, and the second corpus is 8 for 8 the other way.**

`normalize.ts`:

> · NO CLOCK. 33 `\d{1,2}:\d{2}` shapes in the retained text and **33 of 33 are SCRIPTURE REFERENCES** —
> `Pe 2:1-3:22`, `Jëf 19:26-27`, `Ge 1:26-30`, `Ex 6:20`, `suraat 2:30-38`, `1Ki 15:8-24`. **Zero clocks.**
> A ceb-shaped bare-colon rule would have fixed 0 and broken 33.

True of the mined corpus. Measured over FLEURS `wo_sn` (punctuation-normalised distinct sentences):

    8 distinct sentences carry a d:dd — 8 instances
    8 of 8 are a TIME OF DAY.  0 scripture references.

    ay booru 11:29 way fippu yi …        bi 11:00 toftale ay simili …
    bi 11:20 jotee poliis bi …           ci bi 8:46 ci suba joté dëkk bi …
    fippu gi door ci 11:00 ci whitehall  … rapooram tay ci ci 12:00 gmt
    … dignu tambali ci 10:00 ci suba     … faye lakk bi ci 11:35 ci ngoon

⚠ **THE REFUSAL'S CONCLUSION SURVIVES; ITS PREMISE DOES NOT.** A bare-colon rule would now fix 8 and break
33, so declining that rule shape is still right. But "Zero clocks" is a statement about Wolof text and it is
false: **four of the eight carry an explicit right-hand marker** — `ci suba` ("in the morning") ×2,
`ci ngoon` ("in the evening"), `gmt` — and no scripture reference in either corpus carries one. A
marker-keyed rule of the shape tn already ships would fix 4 and claim 0.

And the cost today is a comma pause inside the time, plus `:00` read as the zero word:

    Ci bi 8:46 ci suba joté …        →  ci bi ɟuroːm ɲɛtː , ɲɛːnt fukː ak ɟuroːm bɛnː ci suba ɟɔte …
    … rapooram tay ci ci 12:00 GMT.  →  … taj ci ci fukː ak ɲaːr , tus ɡmt .

For contrast, the scripture reading the header defends is unchanged and still defensible:
`Jëf 19:26-27` → *ɟəf fukː ak ɟuroːm ɲɛːnt , ɲaːr fukː ak ɟuroːm bɛnː ɲaːr fukː ak ɟuroːm ɲaːr*.

⚠ This is the #1102 family seen from a different angle: wo's header never claims FLEURS does not exist — it
simply argues a refusal from one corpus without consulting the other. Filed as **#1111**.

Per PORTING.md the C# ports the CURRENT behaviour and the finding is filed. **NO TYPESCRIPT WAS CHANGED.**

Two things checked because they have been defects elsewhere, both clean:

  · `NATIVE_CLASS` `[a-zàéëóñŋ]` covers every grapheme key the table declares.
  · The gemination rule and the `mm` unit key genuinely interact — `150mm` reads *…fukː milimɛt* now and
    read *…fukː mː* before — which is the trap-56 case the TS records; the port reproduces the fixed
    behaviour and the test pins it.

Questions 2 and 3 came back clean: all three manifest tables are reached and `text()` → `phonemizeWord` is
the single entry point.

## Gates

    csharp tests            1,880 pass (88 new in WolofTests.cs), 0 fail
    parity, wo              200/200 byte-identical, 0 differ, 0 BLOCKED
    parity, fleet           128 languages, 25,227 rows, 0 differ, 0 BLOCKED
    differential            8,118 comparisons (sync + async), 0 differ, 0 throws
    leak sweep              0 of 4,059 outputs carry a raw digit or symbol
    separator audit         0 all-ASCII-space classes in the four new files (by code point)
    typescript              unchanged
