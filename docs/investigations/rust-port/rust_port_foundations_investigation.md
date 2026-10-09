# Rust port: the foundations (regex dialect, string model, neural runtime)

Tracking issue: #1463. Decisions recorded there (2026-10-09): pure-Rust neural runtime, held to ORT on
the golden machine; English first; sync `phonemize(text, lang)`.

## Run 1 — 2026-10-09 (regex: can an ECMAScript engine replace the translator?)

**Question.** C# needed `Core/JsRegex.cs`, a JS→.NET pattern translator, because .NET's dialect differs
from JS (`\d`, `\b`, `\p{Script=…}`, case folding, code units against code points). Rust's `regex` crate is
further away: no lookaround and no backreferences. `regress` 0.12 is an ECMAScript regex engine with a
UTF-16 input mode. If it matches Node over the recorded corpus, the patterns port VERBATIM with no
translator at all.

**Command.** `cargo run --release -p regex-diff -- ../csharp/regex-corpus.jsonl` (new tool
`rust/tools/regex-diff`, a twin of `csharp/tools/regex-diff`). Input is decoded to UTF-16, with the
lone-surrogate sentinel undone, and run through `Regex::find_from_utf16`.

**Raw finding.** 2,381 patterns, 145,140 probe results:
`145108 probe results identical, 32 DIFFER, 0 patterns refused`. By flags: `i` 29, `""` 2, `gu` 1.
Three classes:

1. **Legacy `/i` (no `u`) folds non-ASCII onto ASCII: 29 results.** `/^([a-z]+?)([0-9])?$/i`
   matches `K` (U+212A KELVIN) and `/^[bcdfgmpst]/i` matches `ſ`, where Node declines both. The spec's
   `Canonicalize` for non-unicode `/i` uppercases, then refuses any result that maps a char ≥ 128 to one
   < 128. regress's `fold_code_point(cu, false)` is a bare `uppercase(cu)`, and class construction folds
   through the Unicode `FOLDS` table in either mode. This is the same divergence as C#'s #1129, from the
   other direction. Exactly three code points fold onto ASCII: ı U+0131 (upper I), ſ U+017F (upper S,
   folds s) and K U+212A (folds k).
2. **Non-`u` `\S` takes a whole surrogate pair: 2 results.** `/\S/` over `𠀁…` gives Node a lone high
   surrogate and regress the whole astral char. JS without `u` works on code units, and regress's
   `find_from_utf16` decodes pairs in either mode. `find_from_ucs2` is the code-unit input, so a non-`u`
   pattern should use it.
3. **A FAILED attempt under `/gu` steps one code unit in V8: 1 result.** `/(?<![\p{L}\p{M}\d''’-])/gu`
   over three astral letters gives Node 4 empty matches and regress 2. This is the rule C#'s `JsRe.Matches`
   documents: after an empty match, advance one code POINT; after a failed attempt, one code UNIT, so V8
   tries mid-pair positions. regress's scan skips them.

**Implication.** All three can be fixed in a thin wrapper, and the pattern strings stay verbatim:
(1) remap the three code points on the INPUT to an inert same-width unit for a non-`u` `/i` pattern
(refused if the pattern itself contains one of them, as a loud failure);
(2) pick `ucs2` against `utf16` by the `u` flag;
(3) drive global iteration ourselves, with anchored attempts at the mid-pair positions.
Next: build `core::js_regex` in the crate and re-run.

## Run 2 — 2026-10-09 (regex: the wrapper `core::js_regex`)

**Question.** Do the three wrapper fixes from Run 1 close the gap, and is each one load-bearing?

**Command.** `cargo run --release -p regex-diff`, which now drives `vernacula_phonemizer::core::js_regex::JsRegex`
(regex-diff's `match_all` for `g`, `exec` otherwise). Then each fix reverted in turn by a temporary edit.

**Raw finding.**
- Full wrapper: `145140 probe results identical, 0 DIFFER, 0 patterns refused`. 1.7 s wall for the whole corpus.
- Fold remap disabled: `145111 identical, 29 DIFFER` (`i`: 29), which is exactly class 1.
- Always `find_from_utf16` (no `ucs2` for non-`u`): `145138 identical, 2 DIFFER` (`""`: 2), class 2.
- Mid-pair scan disabled: `145139 identical, 1 DIFFER` (`gu`: 1), class 3.

So each fix accounts for exactly its own class, and nothing else in the corpus moves.

**Implication.** Decided: the Rust port keeps the TS pattern strings VERBATIM through `JsRegex`/`js_re!`.
The C#-style translator is unnecessary. Known limits, recorded rather than fixed:
- The legacy-`/i` guard over-refuses: any literal or class range touching U+0131, U+017F, U+212A or
  U+E000 under `/i` without `u` fails at compile. No pattern in the corpus trips it today, and a refusal
  is loud.
- The mid-pair scan costs one extra engine call per surrogate pair before the next match under `u`. On
  long astral text with no match that is quadratic. Measure it if a CJK-extension or emoji-heavy corpus
  turns out slow.
- The proper fix for class 1 belongs in regress: the spec's `Canonicalize` rule for non-unicode `/i`,
  applied both in `fold_code_point` and in class construction (`add_icase_code_points` folds through the
  Unicode table in every mode). Worth an upstream report, after which the remap can go.

## Run 3 — 2026-10-09 (#1464 review: the mid-pair scan was quadratic)

**Question.** The review measured `JsRegex::new("x","u").test()` at 336 ms on 8,000 emoji, and `phonemize` on
4,000 emoji at 48 s. Run 2's "measure it if astral text turns out slow" came due. Can the scan run only when a
mid-pair match is possible at all?

**What V8 does, measured.** Over `😀😀a😀`, no tested `u` pattern (`[^a]`, `\S`, `.`, `x*`, `\B`, `(?<![\p{L}])`,
lone-surrogate escapes and classes) matched mid-pair. Mid-pair positions are tried only after a FAILED attempt
at a pair start (C#'s JsRe note), and a match there must be zero-width or consume a lone low surrogate.

**Change.** `may_start_mid_pair(pattern)` is a conservative scan of the leading atoms. Assertions are
skipped; the first consuming atom decides; anything unrecognised counts as "may".

**Command.** `cargo run --release -p regex-diff`, which now also runs a SOUNDNESS pass: every `u` corpus pattern
over astral-heavy subjects (fixed probes, plus each corpus input with an emoji interleaved), fast path against
forced full scan.

**Raw finding.**
- `mid-pair analysis: skips the scan for 2119 u-patterns; 150377 astral subjects, 0 UNSOUND`. Node corpus still
  `145140 identical, 0 DIFFER`.
- With the analysis forced to "never scan": `188 UNSOUND`, so the soundness pass can see a wrong skip.
- `phonemize("😀"×4000 + " a", "en")`: 48 s → 1.9 s, including ~0.8 s of one-time engine load
  (examples/astral_timing.rs).

**Implication.** Fixed for the 2,119 patterns that cannot start mid-pair. The ~110 that may still scan are
quadratic in the worst case, but no longer dominate.
