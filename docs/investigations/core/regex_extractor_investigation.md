# Regex corpus extractor: what the text scanner missed (#1590)

Question: how much of `src/` did `tools/extract_regexes.mts` actually put in front of regex-diff? #1590 reported
that two jv and two mad patterns with a `"` inside a character class were missing.

## Run 1 — 2026-10-15 18:30

I compared the text scanner's corpus (main at 9cfebcdc) against every `RegularExpressionLiteral` that the
TypeScript parser finds in `src/**/*.ts` (scratch script: `ts.createSourceFile`, then a node walk).

```
AST literals: 4360  distinct: 2518
in AST, not in corpus: 119
in corpus, not in AST: 11
```

The 119 are far more than the four in the report:
- most of `slovenian/normalize.ts`, where one class quote opened a fake string that swallowed the rest of the file;
- patterns in sk, sv, tk, uz and umb, among others.

The 11 are not patterns at all. They are fragments spliced across source lines, e.g.
`(\d)\s?°\s?(\d+)\s?[′']\s?(\d+)\s?[″""$1 gradus $2 minut $3 sekunt ");↵ s = rewrite(s, /(\d)\s?°`.

The cause is that strings were stripped before scanning, so a `"` inside a class paired with the next real string's
quote. The scanner also had to guess regex versus division, which is what the "14 unparseable, dropped" line was
counting, silently.

## Run 2 — 2026-10-15 18:45

I replaced the scanner with the parser walk (`regexLiterals`). A literal that fails to compile now throws instead
of being dropped.

```
npx tsx tools/extract_regexes.mts   → 2518 distinct patterns from 4360 regex literals in 717 files
cargo run --release -p regex-diff   → 152686 probe results identical, 0 DIFFER, 0 patterns refused
dotnet run --project csharp/tools/regex-diff -c Release → 152686 identical, 0 DIFFER, 0 threw
```

That is up from 146,326 probe results. Both translators agree on all 119 newly covered patterns, so the gap hid no
translator defect; it hid only coverage.

Guard check: I ran the new test's synthetic source through the OLD scanner (copied from main). It returned one
spliced "pattern" running across three lines, which swallowed two real literals; it invented ` 2 ` from
`6 / 2 / 3`; and it missed the literal inside a template interpolation. The parser returns all five.

Not covered by this change: patterns built with `new RegExp(…)` from strings or templates. Those are not literals,
and #1595 tracks them.

## Run 3 — 2026-10-15 20:55 (#1595's tooling item)

#1595 reported that regex literals written inside a `${…}` interpolation were never extracted. The known cases
were rn `(?:kuva|guhera)\s\S{0,10}\s*$` and `[– -]` in ln, ht and bm. Since Run 2 (#1602), both are in
`csharp/regex-corpus.jsonl`. The corpus keeps one row per pattern and flags, so the ln and ht copies are covered
by bm's row. That item is done.

The remaining gap is different: patterns BUILT at runtime. `new RegExp(` occurs 1,134 times across 282 files in
`src/`, and none of those patterns is extracted. Folding the compile-time-constant ones (string literals, and
templates over same-file `const` strings or arrays) is a constant-folding pass of its own, so it is left for a
follow-up, with this count as its baseline.
