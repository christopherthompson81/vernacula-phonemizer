# `letterNames` sweep — investigation log

The narrow, repeated lift: move each ported language's `letterNames` and `phonotactics` — the two tables
`core/initialisms.ts` reads — out of its normalize.ts and into its manifest. Sixteen languages remained after
el, de, uk, es, pt and it were done as part of their own full-language lifts.

Worked in BATCHES from here, at the user's direction: the change is the same three lines per language, so the
per-language cost is the verification, not the edit.

## Batch 1 — nl, pl, hu, tr — 2026-08-25 06:00

**Method.** A generator (`lift_letternames.py`) parses `LETTER_NAME` and the `makeUnreadableTest` block out of
a normalize.ts and emits the JSONC; an applier appends it, deletes the inline tables and rewires the two call
sites. Mechanical, but each language is verified independently.

**0 of 47 probe readings moved** across all four languages, sync and async.

**Sweep.**

```
        letterNames  vowels  onsets  codas
nl            5        2       2       3
pl            4        2       2       4
hu            3        2       2       5
tr            4        2       2       3
```

`onsets` and `codas` swept 0 in every language on the first pass — the same probe gap the it lift hit, and for
the same reason: nothing reaches a cluster rule except an all-caps run whose readability turns on it. Adding
the loanword shapes each language actually licenses (SPORT, START, TEST, MARKT, KART) reached all eight.

## ⚠ Two test defects, both found by the tests failing on CORRECT data

**1. Turkish's vowel class is wider than its letter-name table, and that is right.** The first version
asserted that every character in `phonotactics.vowels` has a `letterNames` entry. Turkish's class carries the
loanword circumflexes ⟨â î û⟩, which have no distinct letter NAME — they are said as the base letter — so the
assertion failed on correct data. `core/initialisms.ts` already handles it: `d.letterName(...) ?? m[0]` falls
back to the character, so a gap spells the letter rather than leaking the string "undefined". Verified
(`KÂR` → `kˈaɾ`, no leak). Replaced with a test of the FALLBACK rather than a demand for coverage.

**2. Asserting a table's SHAPE does not test that anything reads it.** The phonotactics test checked the
manifest's own data and passed with `legalOnsets` emptied in a normalize.ts — the sabotage that should have
been its whole point. Fixed by adding a second sentence per language: a loanword-shaped run that must be READ
rather than spelled, which is the only observable that depends on the cluster tables. Sabotage now fails.

That second one is the recurring shape of this session in miniature: an assertion that passes whether or not
the code is right is worth less than no assertion, because it looks like coverage.

## Result

`nl`, `pl`, `hu`, `tr`: `letterNames` + `phonotactics` lifted, four `Manifest.cs` types extended, one batched
coupling test on each side. 0 readings moved; C# matches Node in both modes for all four. Parity 60 languages
/ 12,000 rows / 0 differ; 447 C# tests, 5,081 TS tests.

## Remaining

11: fr, ru, jv, th, vi, ta, te, kn, ha, cmn, en.
  · `jv` has no manifest.ts and needs one.
  · `th`, `vi`, `ta`, `te`, `kn`, `cmn` have no phonotactics block — letterNames only.
  · `en` last: the largest engine, neural, and four accent variants read it.
