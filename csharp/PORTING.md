# TypeScript → C# porting contract

Every ported file follows these rules, so 683 files come out as one dialect instead of 683.
⚠ THE GOLDEN OUTPUTS ARE THE DEFINITION OF DONE: `phonemize(text, lang)` in C# must be
**byte-identical** to the TypeScript engine. 271,798 rows of reference output exist
(`/mnt/data/omnivoice_ipa/work/phonemized_vernacula/byid/<lang>.tsv`, 102 languages), plus the
4,928-test suite whose expectations are portable goldens. "Looks right" is not a state.

## Structure
- Mirror the TS tree 1:1: `src/languages/thai/syllabifier.ts` → `csharp/Vernacula.Phonemizer/Languages/Thai/Syllabifier.cs`.
  One TS module = one C# file; keep names, keep comment text (they carry measured evidence).
- Namespace = folder: `Vernacula.Phonemizer.Languages.Thai`.
- Data files (`.tsv`, `.jsonc`, `.txt`, `.onnx` — 317 files, 141 MB) are NOT ported. They live in
  the repo-root `data/` tree, mirrored on the module structure (`data/languages/thai/…`,
  `data/core/…`) and OWNED BY NO ENGINE: the TypeScript resolves them through
  `src/core/dataPath.ts`, the C# through `DataPath.Resolve("languages/thai/…")`, both against the
  same keys. `VERNACULA_DATA_DIR` overrides the root in both. The csproj copies nothing.

## Language & library mapping
- `string` stays UTF-16 in both — indexing and `.Length` semantics match JS exactly. Do NOT
  "fix" surrogate handling; the TS code's behaviour is the specification, bugs included.
- `normalize("NFC")` → `str.Normalize(NormalizationForm.FormC)`.
- `matchAll` → `Regex.Matches`; `replace(re, fn)` → `Regex.Replace(s, re, m => …)`.
- Ports of `Map`/`Set` → `Dictionary`/`HashSet`; ⚠ JS Map preserves INSERTION ORDER and some
  modules iterate it — where iteration order matters, note it and use `List<KeyValuePair<…>>`
  or an ordered structure.
- The tiny async surface (ONNX g2p) → `Task`-based, `Microsoft.ML.OnnxRuntime` (already the
  vernacula stack's runtime).

## ⚠ Regex — ALL patterns go through the translator
- ⚠ NEVER hand-translate a pattern. Every regex — literal or dynamic — is built via
  `JsRegex.Compile(pattern, flags)` (Core/JsRegex.cs) with the TS pattern string VERBATIM. The
  codebase has ~7,000 patterns, and the JS/.NET dialect gap is a field of silent divergences that
  no hand port survives:
    `\d` ×1,914 — JS is ASCII `[0-9]`; .NET matches EVERY Unicode digit (Nd). The engine's
       native-digit architecture depends on `\d` NOT matching `৩`/`५`/`٢` — a missed rewrite is
       silent and lands in exactly the scripts that matter. The translator rewrites it.
    `\b` ×138 — JS is ASCII-\w-based; .NET is Unicode. Rewritten to lookaround emulation.
    `\p{Script=X}` ×79 — absent from .NET. Expanded from the ported scripts.ts tables
       (UnicodeScripts). ⚠ NEVER `\p{IsGreek}`-style blocks: blocks ≠ scripts, silently wrong.
    `v`-flag — OUTSIDE the verified subset: `JsRegex` THROWS at construction. A loud error at
       startup beats a quiet mismatch at match time; those sites get individual treatment.
    Simple case folding under `/iu` — JS folds a long s onto `s`, ypogegrammeni onto iota, and the
       pre-1918 Cyrillic letters onto their modern forms; .NET does none of these. A measured table
       widens the class. ⚠ Only under `u`: legacy `/i` deliberately refuses non-ASCII→ASCII folds.
    Code points vs code units — .NET matches one UTF-16 UNIT, JS under `u` matches one CODE POINT.
       `\p{L}` gains an astral half, `[^x]`/`\D`/`\W`/`\S`/`.` take a whole surrogate pair rather
       than matching half a character, and global iteration is driven by `JsRe` because JS uses two
       different advance rules and `Regex.Matches` matches neither.
  Keeping the pattern strings byte-identical to the TS source is the point: ports diff
  mechanically, future TS→C# syncs stay trivial, and the whole dialect gap is ONE differentially
  tested component instead of 683 files of hazard. As of the first full run: 2,314 distinct
  patterns × 51 probes, **118,014 results identical to Node, 0 divergent, 0 refused**.
- Flags: `s`→Singleline, `m`→Multiline, `i`→IgnoreCase|CultureInvariant, `u`→drives the code-point
  rewrites and the wide case fold, `g`/`y`/`d`→call-site helpers (`JsRegex.MatchAll`, sticky, indices).
- Lookbehind ports as-is (.NET is MORE permissive — do not widen a pattern because it now can).
- Always `RegexOptions.CultureInvariant`. ⚠ Turkish casing (`i`→`İ`) corrupts case-folds on any
  tr-TR machine otherwise — and we ship Turkish.
- `ToLowerInvariant`/`ToUpperInvariant` ONLY. Bare `ToLower()` is a bug.

## Ordering & numbers
- `Array.prototype.sort` default is LEXICOGRAPHIC (string) — port as `OrdinalIgnoreCase`-free
  `string.CompareOrdinal`, not the .NET culture default. `sort((a,b)=>a-b)` → numeric.
- JS `Number` is double; TS code doing integer math stays `double` unless provably integral —
  ⚠ do not "improve" to `int` where the TS could produce a fractional intermediate.
- No `Date`, no `Intl`, no locale-dependent formatting exists in the source. Keep it that way.

## Process
- Port in dependency order: Core → registry/index → languages (leaf modules first inside each).
- ⚠ THE DEPENDENCY GRAPH IS NOT JUST IMPORTS. `core/scripts.ts` routes an embedded foreign run to
  ANOTHER language's engine and `Registry` CATCHES the failure, so an unported target does not raise —
  the run is silently dropped and the golden row merely differs, looking like a bug in the language you
  just ported. Measured over the 109 goldens: 65 need no other engine, 40 need `en`, 3 need `ru`, 1
  needs `el`. `Registry.PortPending` records what a run asked for and did not get; the parity tool
  prints it, so "blocked" reads differently from "wrong".
- A ported language registers itself from `Languages/Bootstrap.cs` — one explicit list, NOT a
  `[ModuleInitializer]` per file (CA2255 in a library, and it would scatter the coverage answer across
  182 files). A neural language also needs its `NeuralRegistry` entry, and the bootstrap installs BOTH:
  ⚠ the neural table must be live before the FIRST `PhonemizeAsync`, or that call silently serves the
  sync reading.
- ⚠ NEVER set `InvariantGlobalization` in a project that touches the engine. `string.Normalize` becomes
  a no-op — no throw, no warning — and every NFC/NFD fold stops working. The engine now refuses to start
  in that mode (`Core/Globalization.cs`); it was the PARITY TOOL that had it set, so the gate was
  reporting the engine as broken.
- After each language: run the parity tool (`csharp/tools/parity`) against its golden TSV.
  A language is DONE when its rows are byte-identical, not before.
- ⚠ ENGINEERING SHORTCOMINGS MAY BE CORRECTED; OBSERVABLE BEHAVIOUR MAY NOT. The line between the
  two is the golden gate. Free to fix: quadratic loops, repeated recompilation of regexes, string
  concatenation in loops, copy-paste that a shared helper collapses, untyped grab-bag objects,
  missing early exits — anything where the C# is simply BETTER ENGINEERING for the same outputs.
  Not free to fix: anything `phonemize()` returns. If a "cleanup" moves one byte of one golden row,
  it was a behaviour change wearing a cleanup's clothes — revert it and file the finding instead.
- ⚠ THE PORT IS BIDIRECTIONAL: A BUG FOUND WHILE PORTING IS FIXED ON BOTH SIDES, and a hazard found
  while porting is mitigated on both sides. A porter is the closest reading the TypeScript will ever
  get, and discarding those findings to preserve "faithfulness" wastes the review the port performs.
  The invariant is not "C# matches frozen TS behaviour" — it is "THE TWO ENGINES AGREE", and the pair
  moves together:
    1. the fix lands in the TypeScript FIRST, with a test that pins it (the TS side is where the
       4,928-test suite and the corpus tooling live — it is the side that can VALIDATE a fix);
    2. the affected goldens are regenerated (tools/gen_parity_goldens.mts);
    3. the C# implements the FIXED behaviour and the parity gate closes over the new goldens.
  ⚠ NEVER fix the C# alone: an improvement that exists in one engine is a fork wearing a fix's
  clothes, invisible to both sides' tests. If the TS half of a fix cannot land now (needs corpus
  evidence, needs a decision), the C# ports the CURRENT behaviour and the finding is filed — matched
  engines with a shared known bug beat diverged engines where one is right.
