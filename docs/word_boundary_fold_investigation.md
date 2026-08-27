# `\b` under `/iu` — investigation (#1127)

## Run 1 — 2026-08-27, the repro

**Question.** #1127 recorded one cross-engine divergence surfaced by #1126: `fr` `ſt. Foo` reads
`fɔˈo` in TS and `te fɔˈo` in C#. Which stage introduces the `te`?

```
TS  ſt. Foo → fɔˈo      st. Foo → sɛ̃ fɔˈo      t. Foo → te fɔˈo      Aſt. Foo → ˈa . fɔˈo
```

`normalizeFrench("ſt. Foo")` returns the input UNCHANGED, while `normalizeFrench("t. Foo")` returns
`té Foo`. So the C# side is firing rule 4 (NAME INITIALS) where TS declines it, and the `te` is the
French letter name for `t`. **Implication:** not a lookup-table miss (the #1122 family) — the two
engines disagree about whether the pattern MATCHES at all.

## Run 2 — the pattern

```ts
s.replace(/\b([a-zà-ÿ])\.(\s+)(?=[\p{L}])/giu, …)
```

The class was already fold-widened by `JsRegex` (that is #1122's machinery), so the suspect is the
`\b`. JS defines `\b` through `\w`, and `JsRegex` emits it as a lookaround pair over
`[A-Za-z0-9_]` — the ASCII definition, which is correct for JS **except** under `i`+`u` together,
where `WordCharacters` admits every character whose `Canonicalize` (simple case folding) lands in
the ASCII set.

**Measured over the whole BMP against Node**, rather than read off the spec:

```
node: for cp in 0..0xFFFF, is there a boundary after the character?  (probe `^.\b`)
  plain / u / i : the 62 ASCII word characters, nothing else
  iu            : those 62 PLUS U+017F LONG S and U+212A KELVIN
```

Exactly two, and only under `iu`. ⚠ The first probe I wrote was `\bt` against `ch + "t"`, which
CANNOT measure this: under `i` the `t` also matches an uppercase `T`, so the match lands at index 0
on the start-of-string boundary and reports "boundary" for every input. The `^.\b` form asks the
question directly.

## Run 3 — why the differential harness never caught it

`csharp/tools/regex-diff` replays 2,310 patterns over a probe set explicitly chosen for the dialect
gap, and its probe list has carried `"ſKΩẞıͅ"` since the harness was
built. It reported CLEAN throughout.

**The probe has the fold characters ISOLATED.** A boundary defect only exists at the seam between a
fold character and an ASCII one, so no probe in the set could express it. Added `ſt. Foo`,
`maſse Kg`, `aſ bK c` and re-extracted.

Against the UNFIXED `JsRegex`, over 124,740 probe results:

```
124739 identical, 1 DIFFER
  /\b([a-zà-ÿ])\.(\s+)(?=[\p{L}])/giu   input "ſt. Foo"   node []   .NET ["t. "]
```

One pattern of 2,310. **Implication:** the blast radius is genuinely small — but it was invisible,
which is the property that matters, and the same emit serves every `\b` in the repo.

## Run 4 — the fix and the gates

`WordBoundary`/`NonWordBoundary` become `…For(bool foldWide)`, `\w`/`\W` take the same widened set,
and `foldWide` (already computed as `u && i` for class widening) is threaded into `AppendEscape`.

```
regex-diff       124,740 results, 0 DIFFER, 0 refused
C# tests         2,464 pass  (14 new; verified 3 FAIL against the unfixed translator)
TS               5,674 pass · tsc clean
parity           134 languages, 26,427 rows, 0 differ
fr probes        ſt. Foo / st. Foo / t. Foo / ſt Foo / Aſt. Foo — byte-identical in both engines
```

**Negative result worth keeping:** nothing in `src/` or the goldens changes. TS was right all along;
this is a translator defect only, and no golden could ever have shown it.
