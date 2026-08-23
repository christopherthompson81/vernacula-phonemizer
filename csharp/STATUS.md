# C# port — state as of 2026-08-23

Resume here. Read `PORTING.md` first; it is the contract and it has been amended four times.

## Done

| | |
|---|---|
| Scaffold | `Vernacula.Phonemizer` (net10.0) + xunit tests + `tools/parity`, solution wired |
| Core | **26 of 28** TS core modules ported, ~6,300 lines, `dotnet build` clean |
| `JsRegex.cs` | the pattern translator (407 lines) — **all** regexes route through it |
| `DataPath.cs` | resolves the shared root `data/` tree; mirrors `src/core/dataPath.ts` |
| `Registry.cs` | 859 lines, self-registration (`Registry.Register("thai", () => …)`); languages slot in without editing it |
| Goldens | 109 files in `csharp/goldens/` (100 FLEURS-text, 9 lexicon-only) |

## In flight at pause

- `Core/Initialisms.cs` and `Core/NormalizeSymbols.cs` — the last two core files (agent running).

## Next, in order

1. **Finish Core** (the two above), then `dotnet sln add csharp/tools/parity` — it is deliberately
   out of the solution so it cannot fail the build gate before the engine API exists.
2. ~~Differential regex harness~~ **BUILT** — `tools/extract_regexes.mts` +
   `csharp/tools/regex-diff/`. 2,585 distinct patterns × 47 probes = **121,495 assertions**, with
   Node's answers recorded in `csharp/regex-corpus.jsonl`. Run:
   `npx tsx tools/extract_regexes.mts && dotnet run --project csharp/tools/regex-diff`
   Hazard coverage: `\d` 1,079 · `\p{L…}` 720 · `(?<!` 783 · `(?<=` 107 · `\b` 106 ·
   `\p{Script=` 55 · `\u{` 6 · v-flag 4. ⚠ Probes are chosen for the DIALECT GAP (ASCII vs
   Unicode digits, non-Latin scripts, empty/space/newline for `\b`), not for plausible text — an
   ordinary-word probe set would pass with the gap wide open.
   ⚠ NOT YET RUN: it needs Core complete to compile. First run is the next action after that.
3. **Goldens for the 84 uncovered codes.** `tools/gen_parity_goldens.mts` produced nothing for them
   — mostly regional variants (`en-GB`, `pt-BR`) and languages with no FLEURS text. Without a golden
   a language cannot be declared ported; find a text source or accept lexicon-only coverage.
4. **Languages**, in dependency order, batched. 652 files / 112k lines / 182 directories. Each batch
   gated on its golden before the next starts.

## ⚠ Things that will bite

- **`\d` is the single worst hazard**: 1,914 uses, JS ASCII-only vs .NET all-Unicode-digits, and the
  engine's native-digit architecture depends on the JS meaning. It is silent when wrong and lands
  hardest in the scripts we care most about. Never write a bare `\d` in a .NET pattern.
- **Goldens are the definition of done**, byte-identical. Not "close".
- ⚠ **Goldens are ASYNC-mode output** (`phonemizeAsync` → ONNX neural taggers). Comparing them
  against the sync engine reports 467 of 2,400 rows changed, all phantom. The C# parity runner must
  call the neural-capable path.
- ⚠ **Never regenerate goldens while the tree is moving.** The first set was generated *during* the
  `git mv` of 317 data files and came out half-and-half — silently, and it looked like a real
  regression in languages the branch never touched.
- **Fixes are bidirectional**: a bug found while porting is fixed in TypeScript FIRST (with a test),
  goldens regenerate, then C# implements the fixed behaviour. Never fix C# alone — a fix in one
  engine is a fork. Sites awaiting the TS half are marked `// ⚠ PAIRED-FIX PENDING:`.
- **Data lives in `data/`, owned by neither engine.** Both resolve the same keys. The generator
  tools under `tools/` write there too — that was a review catch, not something a test found.
