# TypeScript → Rust porting contract

⚠ **`csharp/PORTING.md` IS THE CONTRACT, AND THIS FILE ONLY ADDS TO IT.** Everything there that is not
about .NET applies here unchanged:
- the goldens are the definition of done, byte-identical **on one machine**;
- `data/` is owned by no engine;
- TS comments are not transcribed;
- the port is bidirectional: a bug is fixed in the TypeScript first;
- port in dependency order;
- read each file for correctness as well as fidelity.

Read that file first. Below are only the Rust dialect rules.

## Structure
- Mirror the TS tree one module per file, with snake_case names: `src/languages/thai/syllabifier.ts` →
  `rust/vernacula-phonemizer/src/languages/thai/syllabifier.rs`, and `src/core/loadTsv.ts` → `src/core/load_tsv.rs`.
- The file header is 2–4 lines: what the module does, then `Ported from src/<path>.ts — see that file for
  the corpus evidence.`

## Strings: `JsString`, never `String`, inside the engine
- `core::js_string::JsString` is UTF-16 code units, exactly a JS string. `.len()`, indices, `slice`,
  `charCodeAt` and sort order (derived `Ord` = code-unit order = JS default `sort()`) all match JS, and a
  lone surrogate is representable.
- `String`/`&str` appear only at the public API and when reading files. Literals go through `js("…")`.
- ⚠ Do not "simplify" a hot path onto `&str`. A byte index over IPA is a silent divergence wherever a
  length is compared, not only where a slice would panic.
- Lowercasing a word goes through `JsString::to_lower_case` (full mapping, final sigma, U+0130 →
  `i̇`). ⚠ Rust's Unicode tables are not V8's ICU tables. Where the two versions differ, the result
  differs; measure it as C# did (#1116), never assume it.

## Regex: verbatim patterns through `JsRegex`
- Every pattern is the TypeScript source string VERBATIM: `js_re!(r"\b(st|dr)\.", "gi")` for a literal,
  `JsRegex::new(&pattern, flags)` for a pattern built at runtime. ⚠ Never hand-translate one, and never
  use the `regex` crate. Its dialect is not JS (`\d`, `\b`, lookaround, case folding).
- `regress` is an ECMAScript engine, so no translator exists. `JsRegex` only aligns three runtime
  behaviours with V8: the code-unit input model without `u`, V8's code-unit scan step, and the legacy
  `/i` ASCII-fold rule. `cargo run --release -p regex-diff` checks all 2,381 corpus patterns against Node.
  It must stay at 0 differ.
- `s.replace(re, str)` → `re.replace(&s, &rep)`, which implements JS `$` substitution. A callback →
  `re.replace_with(&s, |m, s| …)`. `matchAll` → `re.match_all(&s)`. `exec`/`match` without `g` →
  `re.exec(&s)`. `test` → `re.test(&s)`.
- ⚠ A `g` regex's `lastIndex` state is NOT emulated. A TS site that calls `.test`/`.exec` repeatedly on a
  `g` regex depends on it, so port that site explicitly with `exec_at` and note it.

## Numbers, maps, ordering
- JS `Number` → `f64` unless the TS is provably integral (as in C#).
- `Map`/`Set` iteration is insertion order. Where a module iterates one, use an insertion-ordered structure
  and say so; `HashMap` order is random per process.
- Sorts: `JsString`'s `Ord` for default `sort()`; numeric comparators as written.

## Neural runtime
- Pure Rust, in this crate: no `ort` and no native library (#1463). Its output is held to ONNX Runtime on
  the machine that generated the goldens. That means exact integer arithmetic, plus MLAS's
  dynamic-quantization rounding and its sigmoid/tanh approximations.
- It is `core::neural`: `load_model(key)` / `OnnxModel::from_bytes`, then `run(&[(name, Tensor)])`. An op,
  attribute or layout it does not reproduce exactly fails at LOAD. Batch 1 only.
- ⚠ Every MLAS/Eigen detail it copies is load-bearing, measured by reverting it (the knobs in `neural::mlas`):
  the u8s8 int16 pair saturation alone breaks 99% of English words. Do not "fix" one as a bug or "simplify"
  one onto libm. docs/investigations/rust-port/rust_neural_runtime_investigation.md has the counts.
- Check a change with `.venv/bin/python -I rust/tools/onnx-diff/gen_refs.py` (ORT references into the
  gitignored `.probe/neural/`), then `cd rust && cargo run --release -p onnx-diff`. Every row must stay exact.
