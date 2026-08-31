# Min Dong (cdo) — port investigation

The port itself landed on `port/cdo-csharp` (PR #1225). This document records the **review** of that
port: what was measured, what the PR claimed that turned out to be wrong, and what the instruments
could and could not see.

## Run 1 — 2026-08-31 10:20 — the differential the PR called unavailable

PR #1225 declares its own evidence gap:

> cdo has no FLEURS text in the repo … so the corpus-wide differential is unavailable.

Half right, and the wrong half was load-bearing. FLEURS cdo is genuinely absent. But:

```
tools/corpus/mined/cdo.jsonc    142,810 bytes
tools/corpus/attest/cdo.jsonc    22,182 bytes
```

Both are in the repo. Built a corpus from mined + attest + the golden and ran the differential that
the PR said could not be run:

```
537 unique texts · norm 0 differ · text 0 differ
```

So the gap was an artifact of looking only for FLEURS. The differential exists and it is clean; the
PR's stated limitation should not be carried forward as a known-unknown.

## Run 2 — 2026-08-31 10:26 — the walks the evidence lacked

Exhaustive rather than sampled, because the interesting structure here is a small finite product
space and there is no reason to sample it:

| walk | rows | differ |
|---|---|---|
| BUC syllables — every initial (14 + zero) × every rime (50) × every tone mark (5) on each rime's first vowel, plus bare syllabic m/n/ng | 4,293 | 0 |
| astral + lone-surrogate fuzz on `norm`, `word`, `text` | 35,714 | 0 |
| numbers — 0–20,000 exhaustive + magnitude seams + non-finite | 20,047 | 0 |
| digit families — 4 families × 9 operand frames | 72 | 0 |

The syllable walk is the one that matters: it is the space where the 韻變 tight/loose register
selection lives, and it is now covered by enumeration rather than by the 200 golden rows.

## Run 3 — 2026-08-31 10:33 — the rime-table asymmetry, and a divergence that is unreachable

`rimes` has 50 entries, `rimesLoose` 48, and the naive reading is that two rimes lost their loose
form. That reading is wrong — the tables **overlap** rather than nest. 16 rimes have no loose form
and 14 loose spellings have no tight rime, because `rimesLoose` is keyed by loose *spellings* too,
not merely by loose IPA for tight spellings.

That makes the lookup a three-way fallback, and the two engines write it differently:

```ts
const rimeIpa = (register === "L" && DEF.rimesLoose[rest]) || DEF.rimes[rest] || DEF.rimesLoose[rest];
```
```csharp
if (register == "L" && DEF.RimesLoose.TryGetValue(rest, out var loose)) rimeIpa = loose;
rimeIpa ??= DEF.Rimes.GetValueOrDefault(rest);
rimeIpa ??= DEF.RimesLoose.GetValueOrDefault(rest);
```

⚠ These are **not** the same function. JS `||` treats the empty string as falsy and falls through;
C# `TryGetValue` treats it as found and stops. A single `""` value in either table would split the
engines.

Checked rather than assumed — every table, every value:

```
initials 14 · rimes 50 · rimesLoose 48 · toneChao 7 · toneMark 5 · ioFamily 16
empty values: 0 in all six
```

The divergence is unreachable by construction, not merely untested. Worth a comment if either table
ever becomes data-driven from a source that can emit `""`.

## Run 4 — 2026-08-31 10:39 — an instrument that was not sound, and the one that was

Built an ad-hoc pattern diff: a `RegExp` constructor Proxy on the TS side (hooked before the import,
never cleared, so module-init patterns are captured) against reflection over C# statics and delegate
closure state. Result: 6 shared, 11 TS-only, 6 C#-only.

That result is **an instrument artifact, not a finding**, and it is worth recording why, because the
failure is not obvious:

- The TS Proxy catches `new RegExp(...)` only. Regex **literals** never touch the constructor, so
  they are invisible to it — and the six "C#-only" patterns are exactly MinDong's literals.
- The C# walk starts from the MinDong namespace and reaches the shared symbol tier only as far as the
  `SYMBOLS` delegate's closure graph, so shared-tier patterns are undercounted the other way.

The two dumps are scope-limited in complementary directions, so set inequality between them carries
no signal. The repo already has the sound instrument — `tools/extract_regexes.mts` works from
*source*, so literals and constructor calls alike:

```
corpus fresh (test/regex-corpus-fresh.test.ts ✓) · 6 cdo patterns present
regex-diff: 141,068 probe results identical, 0 DIFFER, 0 threw
```

Lesson, consistent with earlier ports: a clean result from an instrument that cannot fail is
worthless, and so is a dirty result from one whose scope does not mean what you assumed.

## Run 5 — 2026-08-31 10:44 — the leak sweep, and why the first version could not work

First attempt scanned the IPA column for surviving Latin-ish tokens. It reported 11,581 hits, which
is meaningless: IPA *is* Latin-based, so `t i s k ŋ u p n` are the expected output, not residue.

Rebuilt against the actual inventory (the 28 distinct characters in `initials` ∪ `rimes` ∪
`rimesLoose` ∪ `toneChao`), plus punctuation, digits and tone letters — with a planted `ħ` to prove
the instrument can fail:

```
REAL:          1,835 stray chars, 41 distinct
SANITY PROBE:  1,836 stray chars, 42 distinct   → instrument can fail: YES
```

The strays are `ʂ ɕ ʈ ʐ ɻ ə` and friends — Standard Chinese retroflexes and schwa, which are not in
any Min Dong table. Not a leak: the Han front-end is **deferred by design**, documented in the module
header, because no independent Han→reading dictionary exists for cdo (the only source is Wiktionary,
which is this engine's referee, so wiring it would be circular). Han text such as ⟨創作⟩ therefore
routes through the shared `core/scripts.ts` router and comes back with Mandarin readings — in both
engines, identically.

This is worth keeping as a negative result: the stray inventory of a Sinitic port with a deferred Han
front-end is *expected* to be full of Mandarin phones, and a leak sweep over such a language cannot
distinguish "leak" from "documented fallback" without the design context.

## Gates

```
dotnet test                     5,091 passed, 0 failed
parity -- cdo                   200/200 byte-identical
parity (full fleet)             169 languages byte-identical, 0 differ (32,939 rows)
golden-swap widening            735,869 rows ok, 0 differ · poison 0 · provenance clean
regex-diff                      141,068 identical, 0 differ
accent variants                 5/5 build
```

Culture sweep over `Languages/MinDong/*.cs`: `EndsWith` is Ordinal, casing and normalization go
through `Js.*`, and `OrderByDescending(k => k.Length)` is an integer key on a stable sort matching
JS's stable `b.length - a.length` (this is the longest-first onset scan, so ⟨ng⟩ beats ⟨n⟩+⟨g⟩).
No `Parse`, no bare `ToString()`.

## Standing

Nothing outstanding against the port. The one item the PR body should not carry forward is its own
"corpus-wide differential is unavailable" claim — see Run 1.
