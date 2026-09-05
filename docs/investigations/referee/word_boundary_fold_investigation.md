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

## Run 5 — 2026-08-27, deriving the probes instead of authoring them

**Question.** Runs 1–4 fixed `\b`, but the *reason* it survived a year was that the probe set is
hand-authored. Can the seam probes be derived from something that cannot forget?

`tools/extract_regexes.mts` now reads `csharp/fold-pairs.json` — the same measured table `JsRegex`
widens classes from — and, per pattern, emits the fold characters **that pattern can reach** in
eight adjacencies (alone; before/after/between its own fold partner; against an unrelated ASCII
letter; in the `X. Foo` dotted-abbreviation shape; doubled). Capped at 3 fold characters per
pattern, taken in table order, so the output is deterministic and the corpus does not explode.

The three hand-added seam probes from Run 3 were **removed** at the same time, so the derivation has
to earn the coverage rather than inherit it.

```
350 of 2,310 patterns draw derived probes   max 75 probes on one pattern
124,586 probe results (was 124,740)         corpus still 2.6M
```

## Run 6 — what it found immediately

Replayed against the **pre-#1127** translator: **21 DIFFER**, not the 1 the hand-authored probe
found. Against the **fixed** translator: still **20 DIFFER**, all one pattern —

```
/^([a-z]+?)([0-9])?$/i   input "K" (U+212A)   node (no match)   .NET ["K"]   src/languages/wu/wu.ts
```

A **live second defect, in the opposite direction**. Measured both engines over the BMP rather than
reasoning about it:

| | equates onto an ASCII letter |
|---|---|
| JS legacy `/i` | **nothing** (the spec's ASCII guard) |
| JS `/iu` | `s`/`S`~U+017F, `k`/`K`~U+212A |
| .NET `IgnoreCase` | `k`/`K`~U+212A — and *not* U+017F |

So the translator ADDED what .NET misses under `/iu` and had nothing to REMOVE what .NET invents
under `/i`. Filed as #1129.

**Dead end kept:** class subtraction cannot express it. .NET applies subtraction AFTER folding, so
`[a-z-[\u212A]]` under IgnoreCase matches neither `k` nor `K`. `RegexOptions.ECMAScript` does not
change the folding either. What works is the inline option scope — `(?-i:…)` really does disable
IgnoreCase for what it encloses — so the atom is guarded from outside:
`(?:(?!(?-i:\u212A))[a-z])`. ⚠ The group is load-bearing: `(?!…)k+` guards only the first `k`, which
the quantifier test now pins.

**Also a dead end:** my first attempt to test the guard reported that it did not work
(`U+212A=True`). It was the probe that was broken, not the guard — the Kelvin sign had been mangled
before it reached the regex. Re-measuring with the character constructed in code gave the opposite
answer. Second time this investigation that the instrument, not the subject, was the thing at fault.

## Run 7 — gates

```
regex-diff   124,586 results, 0 DIFFER, 0 refused   (21 DIFFER against the pre-#1127 translator)
C#           2,481 pass  (17 new; verified 6 FAIL against the un-narrowed translator)
TS           5,674 pass · tsc clean
parity       134 languages, 26,427 rows, 0 differ
```
