# Tatar (tt) TS → C# port — investigation log

Port of `src/languages/tatar/{tatar,normalize,numbers,romanOrdinals}.ts` (682 lines, 4 modules) to
`csharp/Vernacula.Phonemizer/Languages/Tatar/`. Contract: `csharp/PORTING.md`.

## Run 1 — 2026-08-31 — read the source, write the five files

**Question.** What is the module shape, and what does the golden gate say on a first pass?

Read `tatar.ts` (195), `normalize.ts` (375), `numbers.ts` (60), `romanOrdinals.ts` (52),
`tatar.jsonc` (38), `test/tatar.test.ts` (169). Files written: `Manifest.cs`, `Numbers.cs`,
`Normalize.cs`, `RomanOrdinals.cs`, `Tatar.cs`, plus the `Bootstrap.cs` registration.
`Registry.cs:587` already routed `tt` → `Create("tatar")`.

The template is **Bashkir**, which is already ported and is Tatar's closest sibling — same
`RomanOrdinals` + `Normalize.OrdinalOf` division, same `Registry.RegisterRomanPolicy` wiring in
`RegisterSelf`, same `MULTI` abbreviation loop capturing `full = s` before the `Rewrite` so the
callback can test what follows the match. Following it saved re-deriving all of that, but the
**three places Tatar is not Bashkir** are the whole risk of the port and each is called out in the
TS:

1. **Tatar has no labial harmony in the ordinal.** ba rounds after ⟨ө о⟩ (`өс` → *өсөнсө*); tt does
   not — `өч` is *өченче*, `йөз` is *йөзенче*. Porting ba's `ROUNDING` set across would have wrecked
   the two commonest low ordinals in the language. `OrdinalOf` here is the simpler front/back split.
2. **Tatar fuses its teens** (унбер 11 … унтугыз 19, one word each) where ba writes two — so
   `Numbers.cs` carries a `TEENS` array ba has no equivalent of, and `TENS` is keyed 20..90 rather
   than 10..90.
3. **The case suffix is a CLOSED SET, not `SFX{1,5}`.** That is what lets tt claim the SPACED
   attachment (`1917 нче елда`) that ba's hyphen-only corpus never needed; an open alternation after
   a bare space would eat the following noun.

**Finding.** `dotnet build` clean.

    $ dotnet run --project csharp/tools/parity -- tt
      tt       OK    200 rows
    1 languages byte-identical, 0 differ (200 rows ok, 0 differ)

200/200 on the first run. That is the narrow probe, not the gate.

## Run 2 — 2026-08-31 — what corpus exists for the widening

**Question.** Does Tatar have FLEURS text for the corpus-wide differential?

    $ ls $ASR_ALIGN_ROOT/work/phonemized_vernacula/byid/ | grep -i '^tt'
    (nothing — 102 languages there, tt is not one)
    $ ls $ASR_ALIGN_ROOT/corpus/fleurs_transcripts/data/ | grep -i 'tt\|tatar'
    (nothing)

**Finding — NEGATIVE, the same shape as the Shan port two commits ago.** *No FLEURS transcript for
Tatar.* What exists is `tools/corpus/mined/tt.jsonc` — the tt.wikipedia mining artifact, **1,014,015
paragraph segments** sampled to 33 of 35 cells — plus `tools/corpus/attest/tt.jsonc`, together
yielding 489 distinct retained strings. Stated explicitly rather than left implicit: widening (1)
is unavailable in its usual form and the synthesized probes have to carry more weight.

⚠ **AND THE CORPUS IS BILINGUAL IN A WAY THAT MATTERS HERE.** The very first extracted lines include
full Zamanälif (Latin-orthography) Tatar — `"Sağınuğa däwa yuq" (Z. Ğíbadulla'in köye) kebek…`. The
TS header says this outright: the adversarial tier reads 63% Latin while the uniform stride reads 95%
Cyrillic, and the Latin is a **recorded refusal** — `tatar.ts` is a Cyrillic grapheme scan, so
Zamanälif falls to `core/foreign.ts` and is read as English. Those lines are kept in the differential
(both engines must agree on the refusal too) but they exercise the foreign path, not the Tatar one,
and Run 4 measures how many of them there are before any clean number is trusted.

## Run 3 — 2026-08-31 — the differential

**Question.** Do the two engines agree off the golden?

Probe project in `.probe/tt/` (gitignored, own `<lang>` subdirectory), pointed at
`../../csharp/Vernacula.Phonemizer/Vernacula.Phonemizer.csproj` with `VERNACULA_DATA_DIR=$PWD/data`.
Generator is a **script file** (`.probe/tt/gen.py`) taking paths as argv, not a heredoc — the Shan
port's first differential was contaminated by an unquoted heredoc expanding `$70`/`$5` inside the
currency probes, and it came back green. Verified afterwards that the 17 `$` probes survived intact.

Five entry points per line, so one run covers everything: `phonemize(l,"tt")`, `normalizeTatar(l)`,
`phonemizeWord(l)`, `ordinalOf(n)` and `ROMAN_POLICY.ordinal(n)`.
⚠ **`phonemize`, never `createTatar()`** — `core/roman.ts` runs in the registry WRAPPING `text()`, so
an engine built by the constructor never exercises the Roman policy at all (trap 16, which the TS
test file calls out by name).

Probe set (8,893 distinct lines):
- 489 mined+attest corpus strings and 200 golden inputs;
- one line per normalizer arm PLUS its adversary — all four spellings of the negative era marker and
  the sentence-end dot, the four-group de-grouping case, `3 779,8` against the trailing guard,
  out-of-range clocks, `рәс. 12.1а` and `4-е изд.` against the closed suffix set, `613-ө` against the
  ordinal/possessive collision, `aba=«ölkän ir tuğan»` against the digit-gated `=`;
- the harmony scan exhaustively: ⟨к г⟩ against **both** vowel classes at every distance and on both
  sides, every consonant × every vowel, the ⟨е⟩ iotation in all three environments, the hard and soft
  signs, 19 loan onset clusters through the maximal-onset stress walk, and a 4,000-word random walk
  over the Cyrillic alphabet;
- the numeral walk: 0–140 (crossing the fused-teen boundary at 10/20 in both directions), every power
  boundary ±1 for 10⁰…10¹⁵, a stride through 20,000, the safe-integer edge, a 41-digit run, and every
  reachable ordinal in both attachments.

**Finding.**

    rows 8893 | TS throws 0, C# throws 0
    phonemize       differ: 0
    normalizeTatar  differ: 0
    phonemizeWord   differ: 0
    ordinalOf       differ: 0
    romanOrdinal    differ: 0

44,465 comparisons, 0 divergent.

## Run 4 — 2026-08-31 — the seam gates, and what the haystack actually contains

    $ dotnet run --project csharp/tools/parity -- tt          → 200 rows, 0 differ
    $ … -- tt --poison       → distinct poison sites: 0  (SUBSTRING 0, desync 0)
    $ … -- tt --provenance   → tokens 3780/3780 (100.0%)
    $ … -- tt --ipaspans     → 3189/3189 (100.0%) · spans not covering what the token emitted: 0
    $ npx tsx tools/seam-parity.mts --all | grep '^  tatar '
      tatar   22   22   0    1   1

22 `rewrite` sites either side, gap 0. The one raw replace on each side is the same site — the
de-grouper's inner `rest.replace(/[ …]/gu,"")`, which acts on a CAPTURED GROUP and not on the
pipeline string, so it is correctly off the seam.

Whole fleet after the port: **185 languages byte-identical, 35,695 rows, 0 differ.** C# suite
**6,157/6,157** (6,115 before; +41 `TatarTests` + 1 manifest gate).

**⚠ WHAT FRACTION OF THE REAL TEXT EXERCISED THE NEW CODE** (689 corpus + golden lines):

| construct | lines | share |
|---|---|---|
| any Cyrillic | 497 | 72.1% |
| ⟨к⟩ or ⟨г⟩ (the harmony backing) | 475 | 68.9% |
| a Tatar-only letter ⟨ә ө ү җ ң һ⟩ | 439 | 63.7% |
| any digit | 414 | 60.1% |
| **Latin-only line (Zamanälif — the refusal path)** | **189** | **27.4%** |
| a Roman numeral | 77 | 11.2% |
| a caps run (initialism) | 52 | 7.5% |
| decimal comma | 42 | 6.1% |
| percent | 23 | 3.3% |
| hyphenated numeral+suffix | 20 | 2.9% |
| GLUED numeral+suffix | 19 | 2.8% |
| currency sign | 19 | 2.8% |
| degree sign | 12 | 1.7% |
| space-grouped number | 12 | 1.7% |
| clock | 10 | 1.5% |
| era marker | 9 | 1.3% |
| three-field timestamp | 9 | 1.3% |
| coordinate prime | 8 | 1.2% |
| SPACED ordinal | 5 | 0.7% |
| × or = | 1 | 0.1% |
| номер | 1 | 0.1% |
| **±** | **0** | **0.0%** |

The harmony scan — the actual engine — is well exercised at 69%. Two things the table says that a
clean differential alone would not:

- **27.4% of the retained lines are Latin-only**, and they exercise `core/foreign.ts`, not Tatar.
  That is the recorded refusal from Run 2 showing up as a measurement: over a quarter of this
  "corpus differential" is a differential over the *English reader*. Real coverage of the Tatar path
  is the 72% Cyrillic slice, not the 689 lines.
- **`±` has ZERO instances in the real text** and the SPACED ordinal has five. Those two arms are
  reached only by the synthesized probes, which is why Run 3's arm-by-arm list is not a formality.

## Run 5 — 2026-08-31 — reading for correctness, and the three places the sibling would have lied

PORTING.md's three questions:

1. **Does the code do what its docstring promises?** Yes throughout. The one place worth recording
   is where **copying Bashkir would have been wrong and the TS is the authority**: ba's C# `Attach`
   guards the ordinal branch with `suffix.Length >= 2 ? OrdinalOf(n) : null`, because a one-letter
   Bashkir suffix is always the possessive and `613-ө` would otherwise win against *өсөнсө*. **Tatar's
   TS has no such guard** — it computes the ordinal unconditionally and relies on the `k >= 2` floor
   in the overlap loop instead. Ported as the TS has it, not as the sibling has it; `613-ө` is in the
   probe set and both engines agree.
2. **Is every table reached?** All six manifest slices are consulted and `ManifestMappingTests` now
   diffs the JSON key set against the round-tripped object. **One redundancy, present in the TS too
   and not a defect:** `vowels["е"] = "e"` is unreachable — the scan intercepts ⟨е⟩ in an earlier
   branch that emits `je`/`e` itself, so the manifest entry can never be read. It would produce the
   same value if it were, so nothing is at stake; recorded because "is every table reached" is the
   question that was asked and the honest answer here is "all but one key".
3. **Which path does the instrument measure?** `PhonemizeWord` (the tests' entry) and `Text()` (the
   golden's) are the same scan, and both are compared per line in Run 3. ⚠ The Roman policy is
   reachable ONLY through `Phonemize` — the Registry wraps `Text()` — so both the differential and
   `TatarTests` go through `Phonemize` for every Roman case.

**No findings to file against the TypeScript.** Unlike the Shan port, nothing in these four modules
is dead or mis-wired.
