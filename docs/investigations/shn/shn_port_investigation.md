# Shan (shn) TS → C# port — investigation log

Port of `src/languages/shan/{shan,normalize}.ts` (418 lines, 2 modules) to
`csharp/Vernacula.Phonemizer/Languages/Shan/`. Contract: `csharp/PORTING.md`.

## Run 1 — 2026-08-31 — read the source, write the three files

**Question.** What is the module shape, and what does the golden gate say on a first pass?

Read `shan.ts` (275), `normalize.ts` (143), `shan.jsonc` (78), `test/shan.test.ts` (179).
No `numbers.ts` — the compositor lives in `shan.ts`, so it stays there in C# (one TS module =
one C# file). Files written: `Manifest.cs`, `Normalize.cs`, `Shan.cs`, plus the `Bootstrap.cs`
registration. `Registry.cs` already routed `shn` → `Create("shan")`.

Closest existing template is `Languages/Lao` — same `numberToXWords` shape (units / ten / twenty /
finalOne / `[number,string][]` magnitudes), same `[[…]]`-in-JSON problem, and the same
`AssembleClauses` tail. `Languages/Burmese` is the model for the syllable scan itself.

**Finding.** `dotnet build` clean.

    $ dotnet run --project csharp/tools/parity -- shn
    shn      OK    200 rows
    1 languages byte-identical, 0 differ (200 rows ok, 0 differ)

200/200 on the first run. That is the narrow probe, not the gate — see Run 2.

## Run 2 — 2026-08-31 — what corpus actually exists for the widening

**Question.** PORTING.md wants a corpus-wide differential (1) and off-golden probes (2). Does Shan
have FLEURS text?

    $ ls $ASR_ALIGN_ROOT/work/phonemized_vernacula/byid/ | grep -i shn
    (nothing)
    $ find <data root> -ipath "*fleurs*" -name "*shn*"
    (nothing)

**Finding — NEGATIVE, and it changes the plan.** *There is no FLEURS transcript for Shan.* Per
PORTING.md that removes widening (1) in its usual form and puts the weight on (2). What does exist
is `tools/corpus/mined/shn.jsonc` — the shn.wikipedia mining artifact, 43,435 paragraph segments
sampled down to 434 distinct retained strings (31 of 35 cells covered). Those are real running text
from the same source the normalizer's evidence header cites, so they stand in for (1) at ~2x the
golden rather than the usual 10-20x, and the synthesized probes have to carry more than they
normally would. Stated here rather than left implicit.

## Run 3 — 2026-08-31 — the differential, and a contamination I caught in my own harness

**Question.** Do the two engines agree off the golden?

Probe project in `.probe/shn/` (gitignored, own `<lang>` subdirectory per PORTING.md), pointed at
`../../csharp/Vernacula.Phonemizer/Vernacula.Phonemizer.csproj` with
`VERNACULA_DATA_DIR=$PWD/data`. Both sides emit `phonemize(l,"shn")`, `normalizeShan(l)` and
`phonemizeWord(l)` per line, so one run exercises all three entry points.

Probe set (25,858 distinct lines):
- 434 mined-corpus strings + 200 golden inputs (the real text, standing in for FLEURS — see Run 2);
- one line per arm of `normalize.ts` PLUS the adversary each arm must decline (`3 779,8` against the
  de-grouper, `ADD`/`A.Dx` against the era marker, `10:00 မူင်း` against the clock doubling,
  `ၸၢႆး-1,226` against the range rule, the four refusals);
- an exhaustive abugida sweep — 24 onsets × 5 medials × 16 vowel signs × 11 codas, plus a 2% tone
  cross — and the ⟨ꧦ⟩ mark in every position including leading and doubled;
- the numeral walk: 0–130, every power boundary ±1 for 10⁰…10¹⁵, a stride through 20,000, the
  safe-integer edge, a 41-digit run, and the non-integer/negative fallbacks.

**⚠ FIRST RUN WAS CONTAMINATED AND I ALMOST SHIPPED IT.** The generator was a `python3 - <<PY`
heredoc with the delimiter UNQUOTED, so bash expanded the positional parameters inside the currency
probes before python ever saw them: `US$70` → `US0`, `$579` → `79`, `CA$5` → `CA`, `AU$10.6million`
→ `AU0.6million`. The differential came back 25,836/0 differ — GREEN — while testing nothing about
the `$` tier or the `US$` strip. The failure mode is exactly the silent one PORTING.md describes for
a shared `.probe/`; the mechanism here was different (my own quoting) and the symptom identical: a
clean number that describes the wrong inputs. Fixed by moving the generator to `.probe/shn/gen.py`
and passing paths as argv. **Nothing in this document rests on that first run.**

**Finding — the clean re-run.**

    rows 25858 | TS throws 0, C# throws 0
    phonemize      differ: 0
    normalize      differ: 0
    phonemizeWord  differ: 0

77,574 comparisons, 0 divergent.

## Run 4 — 2026-08-31 — the four seam gates, and what the haystack actually contains

    $ dotnet run --project csharp/tools/parity -- shn
      shn OK 200 rows · 0 differ
    $ … -- shn --poison
      distinct poison sites: 0  (SUBSTRING 0, desync 0)
    $ … -- shn --provenance
      tokens 5216/5216 (100.0%)
    $ … -- shn --ipaspans
      tokens with IpaSpan 4119/4119 (100.0%) · spans not covering what the token emitted: 0
    $ npx tsx tools/seam-parity.mts --all | grep '^  shan '
      shan  14  14  0  1  1

14 `rewrite` sites either side, gap 0. The one raw replace on each side is the same site — the inner
`rest.replace(/,/gu,"")` in the de-grouper, which acts on a CAPTURED GROUP and not on the pipeline
string, so it is correctly off the seam (`JsRegex.Replace`, not `Rewrite`).

Whole fleet after the port: **184 languages byte-identical, 35,495 rows, 0 differ.** C# suite
6,115/6,115 (6,077 before; +37 `ShanTests` + 1 manifest gate).

**⚠ WHAT FRACTION OF THE REAL TEXT EXERCISED THE NEW CODE** (634 corpus + golden lines) — PORTING.md
asks this before a clean differential is allowed to mean anything:

| construct | lines | share |
|---|---|---|
| any Myanmar-block character | 600 | 94.6% |
| Shan letter block U+1075–1081 | 585 | 92.3% |
| any digit | 400 | 63.1% |
| the four voiced loan letters ⟨ၷ ၹ ၻ ၿ⟩ | 48 | 7.6% |
| comma-grouped number | 43 | 6.8% |
| decimal | 42 | 6.6% |
| A.D era marker | 21 | 3.3% |
| Burmese-only consonant (the router branch) | 21 | 3.3% |
| percent (a REFUSAL — must pass through) | 19 | 3.0% |
| degree sign | 9 | 1.4% |
| clock | 6 | 0.9% |
| ⟨ꧦ⟩ reduplication mark | 6 | 0.9% |
| currency sign | 5 | 0.8% |
| ± | 2 | 0.3% |

So the abugida scan is genuinely corpus-exercised; every normalization arm below ~7% is thin, and
the reduplication mark (6 lines), the clock (6) and ± (2) are effectively **probe-only**. That is
the reason for the exhaustive synthetic sweep in Run 3 and not a formality — with 6 real lines the
⟨ꧦ⟩ branch could have been wrong in a way no corpus line reaches.

## Run 5 — 2026-08-31 — reading for correctness, not only fidelity

PORTING.md's three questions, asked against `shan.ts` and `normalize.ts`:

1. **Does the code do what the docstring promises?** Yes throughout. The header's "ໆ-style repetition
   mark" claim — which the TS comment itself records as having gone unimplemented from bring-up —
   is implemented and now has a C# test.
2. **Is every table reached?** All seven manifest slices are consulted: `onsets`, `codas`, `tones`,
   `unmarkedTone`, `palatal`, `vowelSigns`, `numbers`. `ManifestMappingTests` now diffs the JSON key
   set against the round-tripped object, so an unclaimed key fails as a test rather than as a
   phoneme. ⟨ၹ⟩ (z) has 0 corpus instances by the manifest's own account and is reached only by the
   synthetic sweep — deliberate on the TS side (closing the block), and now covered.
3. **Which path does the instrument measure?** `phonemizeWord` (the tests' entry) and `text()` (the
   golden's) are the same scan; `text()` adds only the normalizer, the symbol tier and the router.
   Verified directly rather than assumed: the differential runs both per line and they agree, and the
   Burmese-router test asserts `Say(w) == Word(w)` for Shan words on the branch that could differ.

**One finding, filed not fixed.** `src/languages/shan/shan.ts:8` imports `foldNativeDigits` and
never calls it — the fold happens in `normalize.ts`, which `text()`'s own comment accurately says
runs first. Dead import, zero behaviour, so there is nothing for the C# to mirror and no golden to
regenerate; `npx tsc --noEmit` does not flag it. Noted here rather than swept into a port commit.
