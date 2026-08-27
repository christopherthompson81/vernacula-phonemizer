# Sepedi / Northern Sotho (nso) — C# port investigation

Chronological log of the runs behind the nso port. nso was picked as the next language by the queue's own
rule — highest speaker population among unported codes with a golden: **14M (5M L1 + 9M L2)**. Its catalogue
verdict is ⛔, which means "cannot-verify — NO referee at all", not "do not port": `hne` carries the same
mark and is already ported, and the port's gate is the GOLDEN, not a referee.

⚠ **THIRD SOTHO-TSWANA LANGUAGE IN THIS SWEEP** (tn, st, nso), which is trap 55 at its strongest. Nothing was
carried across: the probe list was written from nso's own files, every count was re-measured on nso's own
artifacts, and the numeral compositor in particular is a DIFFERENT construction — Northern Sotho's compounds
are CONJUNCTIVE (`lesometee`, `masomepedi`, `makgolopedi`, one word) where Sesotho's are disjunctive with a
dummy noun and cl.4/cl.6 concord.

## Run 1 — 2026-08-27 13:40 — what is there to port?

    wc -l src/languages/sepedi/*.ts
        518 normalize.ts · 92 numbers.ts · 84 sepedi.ts = 694

No shared-core change was needed (`Clauses`, `LatinPhones`, `HostWord`, `NormalizeSymbols` incl.
`MakeBareUnitNormalizer`, `LoadManifest` were all already ported) and `Registry.cs` already routed
`case "nso": return Create("sepedi")`.

The structure: **the normalizer calls the shared tier on its own first line** (`SYMBOLS(input)`, the
Chichewa/Swahili order) and then runs nine local steps, because the DECIMAL spell-out must happen after the
percent/currency word is attached while the LOCAL UNIT step must still see the version dot that the decimal
step spends. The unit path is local rather than on the tier for three reasons the TS argues: the squared
compound RE-SHAPES its head (`disekwere-khilomithara`), the cubed word is unsourceable and the tier's
fallback would strand the superscript, and the one-letter key `s` must be a denominator only.

**Parity: `dotnet run --project csharp/tools/parity -- nso` → 200/200 byte-identical on the first run**,
0 differ, 0 BLOCKED. (200 rows, **141 unique texts**.)

## Run 2 — 2026-08-27 13:45 — ⚠ THE DIFFERENTIAL CAUGHT A PORTING BUG THE GOLDEN COULD NOT

nso HAS a FLEURS transcript — `nso_za`, 3,516 unique lines over train/dev/test — which is the corpus
`normalize.ts`'s header says does not exist (#1102, and see Run 4).

    .probe/nso/all.txt = 4,265 unique lines
        3,516  FLEURS nso_za, columns 3+4
          431  tools/corpus/mined/nso.jsonc + tools/corpus/attest/nso.jsonc
          313  hand-built (.probe/nso/gen_probes.mts)
          141  the golden's own unique text
    × sync AND async = 8,530 comparisons

**First run: 8,528 identical, 2 DIFFERENT** — one line, both modes:

    … ge e bapetšwa le 11-12 yuan bakeng sa 1&nbsp;kg ya letswele la kgogo …
      TS   … bakʼeŋ sa dikʰiloxrama tʼee ja let͡sʼwele …      the unit rule fires
      C#   … bakʼeŋ sa tʼee kx ja let͡sʼwele …                ⟨kg⟩ read as the Sepedi DIGRAPH /kx/

**The bug was mine, in the port.** The TS unit pattern is a TEMPLATE literal, so its separator class
`[    ]` reaches the regex as four CHARACTERS — space, NBSP, NNBSP, thin space. Written into
the C# through a shell heredoc, the three non-ASCII characters collapsed to plain spaces, leaving a class of
three ASCII spaces. `1 kg` still matched; `1 kg` did not. Fixed by substituting the class
programmatically, and audited: all five occurrences in that file, and every pattern in the tn/st/mn ports,
now carry the right bytes (verified by code point, not by eye).

⚠ **THE GATE COULD NOT HAVE FOUND THIS, and the numbers say why.** Measured with escape-only patterns
(a literal NBSP in a measurement script is the same trap):

| shape | FLEURS | mined+attest | golden |
|---|---|---|---|
| number + ASCII space + unit | 40 | 11 | 3 |
| number + NBSP/NNBSP/thin + unit | 0 | 0 | **0** |
| number + `&nbsp;` + unit | 0 | **1** | 0 |

`core/markup.ts` decodes `&nbsp;` to U+00A0 upstream, so that **single mined line** is the only row in
4,265 that reaches the unit rule with a non-ASCII separator. 200/200 on the golden, byte-identical, with the
bug live. `SepediTests.TheUnitSeparatorIsNotOnlyAnAsciiSpace` pins it — verified to FAIL 5/5 against the
buggy class before being kept.

**After the fix: 8,530 comparisons, 0 differ, 0 throws, 0 BLOCKED**, and a sweep of every output for a raw
digit or symbol returns **0 lines of 4,265**.

## Run 3 — 2026-08-27 13:48 — what the haystack contains

| construct | FLEURS (3,516) | mined+attest (431) | golden (141u) |
|---|---|---|---|
| any digit | 744 | 299 | 39 |
| comma / period / space grouping | 68 / 0 / 2 | 18 / 2 / 13 | 4 / 0 / 0 |
| decimal dot / comma | 36 / 0 | 34 / 3 | 4 / 0 |
| percent | 6 | 26 | 1 |
| `$` / `US$` | 14 | 14 | 2 |
| rand `R`+digit | **0** | 9 | **0** |
| unit key after a digit | 56 | 16 | 3 |
| rate (`key` + `/`) | 14 | 3 | **0** |
| exponent after a key | 8 | 3 | 1 |
| bare unit token | 34 | 11 | 2 |
| degree sign | 2 | 5 | **0** |
| dash range | 36 | 23 | **0** |
| spaced-hyphen year chain | 0 | 4 | 0 |
| clock `d:dd` | 24 | 6 | 1 |
| dotted capital run | 15 | 7 | 4 |
| English ordinal suffix | 2 | 3 | **0** |

The golden exercises **no** rand, no rate, no degree, no dash range and no English ordinal — five of the nine
local steps — so those rest entirely on FLEURS, the artifacts and the probes.

## Run 4 — 2026-08-27 13:50 — reading for correctness

**FINDING — the CLOCK refusal says it cannot be measured, and the corpus that measures it is the one the
same file says does not exist.**

`normalize.ts` step-by-step refusal list:

> · NO CLOCK RULE. The retained corpus contains no `N:NN` at all. The whole-corpus `clock` cell is 65, but
> with nothing retained **there is no instance to tabulate the marker distribution from**, and the ilo lesson
> is that a colon-number shape guessed from a sibling breaks more than it fixes (trap 55).

That is an honest refusal on the evidence it had. But the header opens by stating nso has **no FLEURS**, and
`nso_za` carries **13 distinct sentences with a `d:dd`, 16 instances, and every one is a time of day** — most
with an explicit marker the rule could key on:

    ka 11:35 pm · ka 8:46 mesong · ka bo 9:30 am · ka 10:08 p m · ka morago ga 11:00
    ka bo 11:00 nako ya selegae · ka 8:30 p m · ka 07:19 a m … 09:19 p m · ka 1:15 mesong
    ka 11:20 · gare ga 06:30 le 07:30 · gare ga 10:00 11:00 pm mdt · ka 10:00am

`0` sports times, `0` verse references, `0` census brackets — the exact tabulation the comment says was
impossible. And the cost is not neutral, because `:` is `clausePunctuation`:

    Sehlopa … se timile mollo ka 11:35 pm.  →  … kʼa lesometʼee , masometʰaro ɬano pʼm .
    Ka 8:46 mesong thwii setu …             →  kʼa seswai , masomenne t͡sʰela mesoŋ …

A spurious clause pause inside every time, and `pm` reaching the g2p as [pʼm].

⚠ **AND THE CONTRADICTION IS INSIDE ONE DIRECTORY.** `src/languages/sepedi/sepedi.ts` says, of this same
language: *"It is NOT unverifiable, though — 1,990 FLEURS utterances in the ASR-alignment corpus are a
referee in another modality, and they carried a quantified vowel defect for as long as this file said
otherwise."* The engine file knows the corpus exists and used it to fix a vowel; the normalizer two files
away says it does not exist and declines a rule for want of instances. Filed as **#1108**.

Per PORTING.md the C# ports the CURRENT behaviour and the finding is filed: a clock rule moves goldens, so
it is TS-first. **NO TYPESCRIPT WAS CHANGED BY THIS PORT.**

Questions 2 and 3 came back clean: all three manifest tables are reached (`ManifestMappingTests` pins it
structurally) and `text()` → `phonemizeWord` is the single entry point. The engine's own above-2^53 defect
(`2.658e+42` spelled digit-by-digit with the ⟨e⟩ voiced) is already recorded in the TS header as an engine
defect and is reproduced faithfully rather than worked around.

## Gates

    csharp tests            1,876 pass (89 new in SepediTests.cs), 0 fail
    parity, nso             200/200 byte-identical, 0 differ, 0 BLOCKED
    parity, fleet           128 languages, 25,227 rows, 0 differ, 0 BLOCKED
    differential            8,530 comparisons (sync + async), 0 differ, 0 throws — after the separator fix
    leak sweep              0 of 4,265 outputs carry a raw digit or symbol
    typescript              unchanged
