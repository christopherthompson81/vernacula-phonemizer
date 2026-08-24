# TypeScript → C# porting contract

Every ported file follows these rules, so 683 files come out as one dialect instead of 683.
⚠ THE GOLDEN OUTPUTS ARE THE DEFINITION OF DONE: `phonemize(text, lang)` in C# must be
**byte-identical** to the TypeScript engine. 271,798 rows of reference output exist
(`/mnt/data/omnivoice_ipa/work/phonemized_vernacula/byid/<lang>.tsv`, 102 languages), plus the
4,928-test suite whose expectations are portable goldens. "Looks right" is not a state.

## Structure
- Mirror the TS tree 1:1: `src/languages/thai/syllabifier.ts` → `csharp/Vernacula.Phonemizer/Languages/Thai/Syllabifier.cs`.
  One TS module = one C# file; keep names. ⚠ DO NOT keep the comment text — see below.
- Namespace = folder: `Vernacula.Phonemizer.Languages.Thai`.
- Data files (`.tsv`, `.jsonc`, `.txt`, `.onnx` — 317 files, 141 MB) are NOT ported. They live in
  the repo-root `data/` tree, mirrored on the module structure (`data/languages/thai/…`,
  `data/core/…`) and OWNED BY NO ENGINE: the TypeScript resolves them through
  `src/core/dataPath.ts`, the C# through `DataPath.Resolve("languages/thai/…")`, both against the
  same keys. `VERNACULA_DATA_DIR` overrides the root in both. The csproj copies nothing.

## ⚠ Comments — the TypeScript is where the evidence lives
- ⚠ DO NOT TRANSCRIBE TS COMMENTS. An earlier version of this file said to carry them verbatim; that
  was wrong, and it cost 18,857 comment lines (36% of the C# tree) that say nothing the TS does not
  already say better. The TypeScript module is the SPECIFICATION and the permanent home of the
  measured evidence — corpus counts, dump provenance, defect tables, the history of what was tried.
  A second copy in C# is not a second witness: it is a copy that drifts, and every TS-first fix now
  has to be applied to prose twice.
- The C# file header is 2-4 lines: what the module does, and `Ported from src/languages/<x>/<y>.ts —
  see that file for the corpus evidence.` A reader who needs the why has one hop to the whole of it.
- ⚠ KEEP EXACTLY ONE CLASS OF INLINE COMMENT: the note whose absence would let a future editor
  "improve" the port into a divergence. These are load-bearing in the C# specifically —
    · a JS semantic the C# reproduces on purpose (`Contains("")` is true, unpacked iteration order,
      UTF-16 surrogate behaviour, `Math.Round` vs banker's rounding);
    · a `PAIRED-FIX PENDING` marker, which must name the TS issue and be DELETED when it lands — a
      stale one is a fork that documents itself as fidelity (Core/NormalizeSymbols.cs, #934);
    · a non-obvious ordering or fall-through the golden depends on and no name explains.
  If the comment would be equally true of the TypeScript, it belongs only in the TypeScript.
- ⚠ THE CORRECTNESS LENS SURVIVES THIS. Question 1 below — does the code do what its docstring
  promises — is asked against the TS docstring while porting. Shedding the copy does not shed the
  reading; it removes the second place that reading could go stale.

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
- ⚠ A MANIFEST KEY THE NAMING POLICY MANGLES DESERIALIZES TO THE TYPE'S DEFAULT, silently. The loader
  applies camelCase, which does not leave an all-caps or otherwise irregular JSON key alone — English's
  ARPABET block is keyed `AH`/`ER`/`IY`/`UW` and none of them matched, so those vowels loaded as the
  EMPTY STRING and `virgin` read *vd͡ʒɪn*. Put `[JsonPropertyName("…")]` on any property whose JSON key
  is not plain camelCase, and add the language to `ManifestMappingTests`, which diffs the file's key set
  against the round-tripped object so an unclaimed key fails as a test rather than as a phoneme.
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
- ⚠ READ EACH FILE FOR CORRECTNESS, NOT ONLY FOR FIDELITY — and they are different questions. The
  natural porting question is "does my C# match this?"; the bidirectional rule above only pays off if
  someone also asks "IS this right?". The parity gate cannot ask the second one for you: it proves the
  two engines AGREE, so a bug both sides reproduce identically passes it forever. Every defect the port
  has sent back to the TypeScript was found by reading, never by the gate:
    · digit grouping was ASCII-space-only in 63 places (#877) — no test caught it because every
      fixture used ASCII spaces;
    · ja's counter fusion was suppressed by any ≥2-char reading entry, so `1本のペン` read *it͡ɕi ho̞n*
      (#894) — 0 golden rows changed when it was fixed, in either direction;
    · pa's `text()` consulted NONE of its three lexicons while `phonemizeWord` was documented as the
      shipped path, so the engine users reach and the engine the referee eval scores were different
      engines.
  The three questions that have actually found things, worth asking per file:
    1. WHAT DOES THIS FILE'S OWN DOCSTRING PROMISE, and does the code do it? Every one of the above is
       a gap between a stated contract and the code under it — the comment was right and the wiring
       was not.
    2. IS EVERY TABLE THIS FILE LOADS ACTUALLY REACHED? A lexicon nothing consults is not inert, it is
       a silent regression: someone measured a tier into existence and the shipped path skips it.
    3. WHICH PATH DOES THE INSTRUMENT MEASURE? Where the eval, the golden and the shipped entry point
       are not the same path, the measured number does not describe the product — and that gap is
       invisible from inside either path.
  Finding one is not licence to fix it here: it goes through the three steps above, or it is filed.
