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
2. ~~Differential regex harness~~ **BUILT AND RUN — CLEAN.** `tools/extract_regexes.mts` +
   `csharp/tools/regex-diff/`. 2,314 distinct patterns × 51 probes = **118,014 assertions**, all
   identical to Node, 0 patterns refused. Re-run with:
   `npx tsx tools/extract_regexes.mts && dotnet run --project csharp/tools/regex-diff`
   ⚠ Probes are chosen for the DIALECT GAP, not for plausible text — an ordinary-word probe set
   would pass with the gap wide open. The first run found SEVEN real defects in JsRegex, all fixed
   and pinned in `Vernacula.Phonemizer.Tests/JsRegexDialectTests.cs` (28 tests):
     - **Simple case folding.** JS /iu folds `\u017F`→s, `\u0345`→ι, `\u1C80-\u1C88`→modern
       Cyrillic; .NET IgnoreCase does none of them. French, Portuguese, Mindong and Lingala
       tokenizers all dropped a long s. Fixed with a MEASURED table (94 divergent pairs of 2,408).
     - **...but only under /u.** Legacy /i refuses non-ASCII→ASCII folds; applying the fold on `i`
       alone regressed `scottishgaelic/numbers.ts`. The harness caught the regression immediately.
     - **`[^\S\n]`** (4 patterns) and **`\p{ASCII}`** were refused outright — both are now
       translated (.NET class subtraction, and the trivial range).
     - **Astral members in a class** (`[\u{20000}-\u{2a6df}]`, cmn/ja/Adlam) were refused; they now
       become surrogate-pair alternations.
     - **`[]` is not the empty set in .NET.** An astral-only class emitted `[]|alt`, which .NET
       reparsed into a class matching LONE SURROGATES — so `[\u{1E950}-\u{1E959}]` matched every
       neighbouring astral code point. Found by a unit test, not the harness: no probe carried Adlam.
     - **Code points vs code units.** .NET's `\p{L}` matches neither half of an astral letter and
       `[^x]` happily matches half of one. Categories now carry an astral half (built from
       `CharUnicodeInfo`, so it cannot drift from the BMP half), and every "any character except"
       construct takes a whole pair.
     - **Two advance rules.** JS global iteration skips a code POINT after a zero-length match but a
       code UNIT after a failed attempt; `Regex.Matches` reproduces neither, so `JsRe` drives the
       loop. Verified against Node on `/(?<![\p{L}])/gu`, which really does report a position
       INSIDE a surrogate pair.
   ⚠ PERF INVARIANT: astral alternations carry a one-class lookahead guard. Without it
   `[\p{L}\p{M}]+` ran **372 ms where plain .NET ran 16 ms** — a 23x tax with correct output.
   Asserted structurally in `AstralBranchesAreGuarded`.

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
