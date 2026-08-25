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

## Batch 2 — th, vi, cmn — 2026-08-25 06:40

**⚠ THE BATCH SPLIT ITSELF ON INSPECTION.** Six languages were queued as "letterNames only"; three turned out
to hold something else entirely.

- **th, vi, cmn** hold a Record keyed by UPPERCASE LATIN — a SPELLING map, for an embedded foreign run. These
  lift as `letterNames`.
- **ta, te, kn** hold an ARRAY of native-script letter names used to BUILD A REGEX that RECOGNISES a
  dot-separated initialism run in the native script. That is a different fact with a different shape and a
  different purpose, and calling it `letterNames` would file two things under one name — the `PREFIX_GUESS`
  shape. Deferred to its own batch, to be lifted under a name that says what it is.

**No phonotactics for any of the three**, and that is not an omission: the OOV spell-it-out test does not
apply. A Latin run inside a Thai, Vietnamese or Chinese sentence is spelled because it is FOREIGN, not
because its consonant clusters are illegal.

**0 of 24 probe readings moved**, sync and async. Sweep: th 2, vi 4, cmn 4.

### ⚠ The ARPABET shape, checked rather than assumed

These tables are keyed by UPPERCASE Latin, and the engine looks a run up by the character as WRITTEN. The C#
loader applies a camelCase policy — which is exactly what mangled English's ARPABET block into 42 wrong golden
rows. Dictionary KEYS are not covered by that policy (it applies to property names), but "not covered" is a
claim, so it was tested: `ThaiManifest.LetterNames` contains `"A"` and does not contain `"a"`, 26 entries.
Both coupling tests now assert the keys are uppercase, and lower-casing them at the lookup fails.

### Two more things the guard found

`ManifestMappingTests` did not cover **Mandarin**. Adding it immediately reported two unmapped keys —
`resolve` and `phases` — which turn out to be PROSE: an ordered description of the pipeline and a
done/deferred status list, read by neither engine and not declared in the TypeScript's `CmnManifest` either.
The `note` case, not the tg `numbers.and` case, so they are listed as metadata rather than given C#
properties that would model a field neither side has.

## Remaining

8: fr, ru, jv, ha, en, and the ta/te/kn recognition-list batch.
  · `jv` has no manifest.ts and needs one.
  · `th`, `vi`, `ta`, `te`, `kn`, `cmn` have no phonotactics block — letterNames only.
  · `en` last: the largest engine, neural, and four accent variants read it.
